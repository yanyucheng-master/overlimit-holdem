import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import runtime from "./playwright-runtime.js";
import lobby from "./lobby-test-helpers.js";
import server from "../server/server.js";

const output = path.resolve("artifacts/bgm-lobby-20261007/reports");
await fs.mkdir(output, { recursive: true });
const app = server.createAppServer({ matchmakingAutoStart: false });
await new Promise(resolve => app.httpServer.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${app.httpServer.address().port}`;
const browser = await chromium.launch(runtime.chromiumLaunchOptions({ headless: true }));
const report = { base, cases: [], observations: [], errors: [], direct_audio_listening: false,
  fixture_note: "Fresh isolated game server and real UI clients. Connection/visibility/load failures are explicit test fixtures; no production test hooks." };
let expectedFailure = false;

async function fresh(music) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(({ music }) => {
    localStorage.setItem("abyss_ui_settings_v2", JSON.stringify({ language: "zh-CN", languageChosen: true,
      animation: "low", sfx: 0, ...(music === undefined ? {} : { music }) }));
    localStorage.setItem("overlimit_quickstart_v1", "seen");
    localStorage.setItem("abyss_skill_loadout_v2", JSON.stringify(["ENDGAME", "DEEP_BREATH"]));
  }, { music });
  const page = await context.newPage();
  const audioRequests = [];
  page.on("request", req => { if (/\/assets\/audio\/.*\.(flac|mp3)$/.test(req.url())) audioRequests.push(req.url()); });
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", msg => { if (msg.type() === "error" && !expectedFailure) report.errors.push(msg.text()); });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForFunction(() => socket.connected && state.skillCatalog.length === 33);
  return { page, context, audioRequests };
}
const status = page => page.evaluate(() => tableMusicPlayer.getStatus());
async function playing(page, scene) {
  await page.waitForFunction(scene => tableMusicPlayer.getStatus().state === "playing"
    && tableMusicPlayer.getStatus().scene === scene, scene, { timeout: 15000 });
  const value = await status(page);
  report.observations.push({ scene, ...value });
  return value;
}
async function sourceRevision(page) { return page.evaluate(() => tableMusicPlayer.playing.revision); }
async function backToLobby(page) {
  await page.click("#btn-settings");
  await page.click("#btn-settings-lobby");
  if (await page.locator("#btn-leave-confirm").isVisible()) await page.click("#btn-leave-confirm");
  await page.locator("#screen-auth.active").waitFor();
  await playing(page, "lobby");
}

try {
  const host = await fresh();
  const page = host.page;
  assert.equal(await page.evaluate(() => state.settings.music), 35);
  assert.equal((await status(page)).state, "gesture");
  assert.equal(host.audioRequests.length, 0);
  await page.click("#btn-settings");
  await playing(page, "lobby");
  const revision = await sourceRevision(page);
  assert.match(await page.locator("#setting-music-status").innerText(), /正在播放：入席之前/);
  await page.locator("#setting-language").selectOption("en-US");
  assert.match(await page.locator("#setting-music-status").innerText(), /Playing: Before the Deal/);
  await page.locator("#setting-language").selectOption("zh-CN");
  assert.equal(await sourceRevision(page), revision);
  await page.screenshot({ path: path.join(output, "lobby-settings.png") });
  await page.click("#btn-close-settings");
  report.cases.push({ case: "initial_lobby_default_volume_gesture_and_language", passed: true });

  await lobby.openLobbyLab(page);
  await playing(page, "lobby");
  assert.equal(await sourceRevision(page), revision);
  await page.click("#btn-back-skill-lab");
  await page.locator("#screen-auth.active").waitFor();
  assert.equal(await sourceRevision(page), revision);
  report.cases.push({ case: "loadout_configuration_continues_same_source", passed: true });

  await lobby.startLobbyAction(page, "standard", "off", "create");
  await page.locator("#screen-wait.active").waitFor();
  await playing(page, "lobby");
  const roomId = await page.evaluate(() => state.roomId);
  assert.equal(await sourceRevision(page), revision);
  const room = app.roomManager.rooms.get(roomId);
  app.gameEngine.broadcastRoomState(room);
  app.gameEngine.broadcastRoomState(room);
  await page.waitForTimeout(150);
  assert.equal(await sourceRevision(page), revision);
  assert.ok((await status(page)).position > 0);
  await page.click("#btn-settings");
  assert.match(await page.locator("#setting-music-status").innerText(), /正在播放：入席之前/);
  await page.screenshot({ path: path.join(output, "created-room-settings.png") });
  await page.click("#btn-close-settings");
  report.cases.push({ case: "create_room_and_repeated_wait_snapshots_do_not_restart", passed: true });

  await page.evaluate(() => socket.disconnect());
  await playing(page, "lobby");
  assert.equal(await sourceRevision(page), revision);
  await page.evaluate(() => socket.connect());
  await page.waitForFunction(() => socket.connected && !state.reconnecting);
  assert.equal(await sourceRevision(page), revision);
  const lobbyPosition = (await status(page)).position;
  report.cases.push({ case: "waiting_connection_loss_does_not_pause_or_restart_lobby", passed: true });

  const rival = await fresh(0);
  await rival.page.click("#btn-open-join");
  assert.equal((await status(rival.page)).state, "off");
  assert.equal(rival.audioRequests.length, 0);
  await rival.page.fill("#input-room", roomId);
  await rival.page.click("#btn-join");
  await page.locator("#screen-game.active").waitFor();
  app.gameEngine.clearActionTimer(room);
  await playing(page, "daily");
  assert.equal((await status(rival.page)).state, "off");
  const dailyPosition = (await status(page)).position;
  await backToLobby(page);
  const resumed = await status(page);
  assert.ok(resumed.position >= lobbyPosition && resumed.position < lobbyPosition + 10);
  report.cases.push({ case: "game_start_uses_b_exit_resumes_lobby_and_saved_zero_stays_off", passed: true,
    lobbyPosition, resumedPosition: resumed.position, dailyPosition });

  await page.click("#btn-settings");
  await page.locator("#setting-music").fill("0");
  assert.equal((await status(page)).state, "off");
  const pausedPosition = (await status(page)).position;
  await page.locator("#setting-music").fill("35");
  await playing(page, "lobby");
  assert.ok((await status(page)).position >= pausedPosition);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal((await status(page)).state, "paused");
  const hiddenPosition = (await status(page)).position;
  await page.waitForTimeout(100);
  assert.equal((await status(page)).position, hiddenPosition);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
  await playing(page, "lobby");
  report.cases.push({ case: "mute_and_background_resume_without_losing_position", passed: true });

  // Render the actual transport across two seams in both runtime formats.
  report.browser_audio = await page.evaluate(async () => {
    const manifest = await (await fetch("./assets/audio/provenance.json")).json();
    const spec = manifest.pieces.lobby;
    const ctx = new AudioContext({ sampleRate: 48000 });
    const results = [];
    for (const format of ["flac", "mp3"]) {
      const loader = new OverlimitTableMusic.Player({ getContext: () => ctx,
        fetchAudio: (url, options) => format === "mp3" && url.endsWith(".flac")
          ? Promise.resolve({ ok: false, status: 415 }) : fetch(url, options) });
      const loaded = await loader.load("lobby", ctx, new AbortController().signal);
      const buffer = loaded.buffer;
      const offline = new OfflineAudioContext(2, 1440 + buffer.length * 3, 48000);
      const adapter = { state: "running", currentTime: 0, destination: offline.destination,
        createGain: () => offline.createGain(), createBufferSource: () => offline.createBufferSource() };
      const player = new OverlimitTableMusic.Player({ getContext: () => adapter });
      player.cue = OverlimitTableMusic.LOBBY_CUE;
      player.environment = { atLobby: true, visible: true, volume: 100 };
      player.cache.set("lobby", loaded);
      await player.start(adapter, 0, new AbortController().signal);
      const rendered = await offline.startRendering();
      let maxError = 0;
      for (let c = 0; c < 2; c++) {
        const actual = rendered.getChannelData(c), expected = buffer.getChannelData(c);
        for (let i = 5760; i < buffer.length * 3; i++) {
          maxError = Math.max(maxError, Math.abs(actual[1440 + i] - expected[i % buffer.length]));
        }
      }
      results.push({ format: loaded.format, frames: buffer.length, masterFrames: spec.frames,
        duration: buffer.duration, render_max_pcm_error: maxError });
    }
    await ctx.close();
    return { results, meaning: "Runtime sample scheduling across two seams; musical seam acceptance needs human audition" };
  });
  assert.ok(report.browser_audio.results.every(r => r.frames === r.masterFrames && r.render_max_pcm_error < 0.000001));
  report.cases.push({ case: "flac_mp3_decode_and_two_seam_render", passed: true });

  expectedFailure = true;
  await page.route("**/assets/audio/*", route => route.fulfill({ status: 503, body: "test audio unavailable" }));
  await page.reload({ waitUntil: "networkidle" });
  await page.click("#btn-settings");
  await page.waitForFunction(() => tableMusicPlayer.getStatus().state === "failed");
  await page.locator("#btn-music-retry").waitFor({ state: "visible" });
  await page.unroute("**/assets/audio/*");
  expectedFailure = false;
  await page.click("#btn-music-retry");
  await playing(page, "lobby");
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 700 }]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.equal(await page.locator("#setting-music-status").isVisible(), true);
  }
  report.cases.push({ case: "failed_lobby_load_retry_and_mobile_status", passed: true });
  assert.deepEqual(report.errors, []);
  report.passed = true;
  console.log(JSON.stringify({ passed: true, cases: report.cases.length, observations: report.observations.length,
    audio: report.browser_audio }));
} catch (error) {
  report.passed = false;
  report.failure = error.stack;
  console.error(error);
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(output, "browser-check.json"), JSON.stringify(report, null, 2) + "\n");
  for (const room of app.roomManager.rooms.values()) app.gameEngine.abortPendingRoomWork(room);
  await browser.close();
  await new Promise(resolve => app.io.close(resolve));
}
