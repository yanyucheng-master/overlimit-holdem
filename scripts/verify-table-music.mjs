import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import runtime from "./playwright-runtime.js";
import lobby from "./lobby-test-helpers.js";
import server from "../server/server.js";

const output = path.resolve(process.env.BGM_VERIFY_DIR || "artifacts/bgm-integration-20261005");
await fs.mkdir(output, { recursive: true });
const app = server.createAppServer({ matchmakingAutoStart: false });
await new Promise((resolve) => app.httpServer.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${app.httpServer.address().port}`;
const browser = await chromium.launch(runtime.chromiumLaunchOptions({ headless: true }));
const report = { base, browser: "Installed Chromium via Playwright", cases: [], errors: [],
  fixture_note: "Two real UI clients and public server emissions. Declaration timer held only in this isolated test to inspect the 12.94s passage. Skill expiry and execution hands explicitly constructed as fixtures.",
  direct_audio_listening: false };
const contexts = [];
let expectedFailure = false;

async function status(page) { return page.evaluate(() => tableMusicPlayer.getStatus()); }
async function playing(page, scene) {
  await page.waitForFunction((scene) => tableMusicPlayer.getStatus().state === "playing"
    && tableMusicPlayer.getStatus().scene === scene, scene, { timeout: 15000 });
  const value = await status(page);
  report.cases.push({ scene, status: value });
  return value;
}

async function pair() {
  const pages = [];
  for (let n = 0; n < 2; n++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    contexts.push(context);
    await context.addInitScript(({ n }) => {
      if (!localStorage.getItem("abyss_ui_settings_v2")) {
        localStorage.setItem("abyss_ui_settings_v2", JSON.stringify({ language: "zh-CN", languageChosen: true,
          animation: "low", sfx: 0, ...(n === 1 ? { music: 0 } : {}) }));
      }
      localStorage.setItem("abyss_skill_loadout_v2", JSON.stringify(["ENDGAME", "DEEP_BREATH"]));
      localStorage.setItem("overlimit_quickstart_v1", "seen");
    }, { n });
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !expectedFailure) report.errors.push(message.text());
    });
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForFunction(() => socket.connected && state.skillCatalog.length === 33);
    assert.equal(await page.evaluate(() => state.settings.music), n === 1 ? 0 : 35);
    pages.push(page);
  }
  await lobby.startLobbyAction(pages[0], "standard", "abyss", "create");
  await pages[0].waitForFunction(() => Boolean(state.roomId));
  const id = await pages[0].evaluate(() => state.roomId);
  await pages[1].click("#btn-open-join");
  await pages[1].fill("#input-room", id);
  await pages[1].click("#btn-join");
  await Promise.all(pages.map((page) => page.locator("#screen-game.active").waitFor()));
  const room = app.roomManager.rooms.get(id);
  app.gameEngine.clearActionTimer(room);
  const ids = await Promise.all(pages.map((page) => page.evaluate(() => state.playerId)));
  return { pages, room, ids };
}

async function volume(page, value) {
  await page.click("#btn-settings");
  await page.locator("#setting-music").fill(String(value));
  await page.click("#btn-close-settings");
}

function holdDeclaration(room) {
  assert.equal(room.presentationBarrier.kind, "ENDGAME_DECLARE");
  clearTimeout(room.presentationBarrierTimer);
  room.presentationBarrierTimer = null;
}

try {
  const { pages, room, ids } = await pair();
  await playing(pages[0], "daily");
  assert.equal((await status(pages[1])).state, "off");
  await volume(pages[1], 35);
  await playing(pages[1], "daily");

  // Actual all-in action, with an authoritative concealed view for the rival.
  const actorIndex = room.currentPlayerIndex;
  const actor = room.players[actorIndex], rival = room.players[1 - actorIndex];
  const actorPage = pages[ids.indexOf(actor.playerId)], rivalPage = pages[ids.indexOf(rival.playerId)];
  actor.skillRuntime.disguiseActive = true;
  app.gameEngine.broadcastRoomState(room);
  await rivalPage.waitForFunction(() => state.chipViewHidden === true);
  assert.equal(app.gameEngine.handlePlayerAction(room, actorIndex, "allin").ok, true);
  app.gameEngine.clearActionTimer(room);
  await playing(actorPage, "allin");
  await rivalPage.waitForFunction(() => state.players.some((p) => p.playerId !== state.playerId && p.isAllIn === false));
  assert.equal((await status(rivalPage)).scene, "daily");
  report.cases.push({ case: "concealed_opponent_allin_does_not_leak", passed: true });
  actor.skillRuntime.disguiseActive = false;
  app.gameEngine.broadcastRoomState(room);
  await playing(rivalPage, "allin");

  rival.skillRuntime.abyssEnergy = 8;
  const used = app.gameEngine.handleSkillUse(room, rival, { skillId: "ENDGAME", target: {}, requestId: "music-qa-endgame" });
  assert.equal(used.status, "SUCCESS", JSON.stringify(used));
  holdDeclaration(room);
  await Promise.all(pages.map((page) => playing(page, "endgame")));
  const start = await status(rivalPage);
  assert.equal(start.phase, "openingAndEntry");
  app.gameEngine.skillEngine.broadcastSkillState(room);
  app.gameEngine.broadcastRoomState(room);
  await rivalPage.waitForTimeout(200);
  assert.ok((await status(rivalPage)).position >= start.position);
  await rivalPage.waitForFunction(() => tableMusicPlayer.getStatus().phase === "loop", null, { timeout: 16000 });
  const fast = await status(rivalPage);
  assert.equal(fast.formats.endgameOnce, "flac");
  assert.equal(fast.formats.endgameLoop, "flac");
  assert.equal(await rivalPage.evaluate(() => tableMusicPlayer.playing.nodes.filter((n) => n.loop).length), 1);
  await rivalPage.click("#btn-settings");
  await rivalPage.screenshot({ path: path.join(output, "game-endgame-playing.png") });
  await rivalPage.click("#btn-close-settings");

  // Exercise the real page visibility listener with a test-only visibility fixture.
  await rivalPage.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const paused = await status(rivalPage);
  assert.equal(paused.state, "paused");
  await rivalPage.waitForTimeout(200);
  assert.equal((await status(rivalPage)).position, paused.position);
  await rivalPage.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await playing(rivalPage, "endgame");
  assert.equal((await status(rivalPage)).phase, "loop");
  await volume(rivalPage, 0);
  assert.equal((await status(rivalPage)).state, "off");
  await volume(rivalPage, 35);
  await playing(rivalPage, "endgame");
  assert.equal((await status(rivalPage)).phase, "loop");

  // Disconnect suspends immediately; a fresh snapshot permits resumption.
  await rivalPage.evaluate(() => socket.disconnect());
  assert.equal((await status(rivalPage)).state, "paused");
  await rivalPage.evaluate(() => socket.connect());
  await playing(rivalPage, "endgame");
  assert.equal((await status(rivalPage)).phase, "loop");
  await rivalPage.reload({ waitUntil: "networkidle" });
  await rivalPage.click("#btn-settings"); // Trusted gesture after navigation.
  await playing(rivalPage, "endgame");
  assert.equal((await status(rivalPage)).phase, "loop");
  await rivalPage.click("#btn-close-settings");
  report.cases.push({ case: "visibility_mute_disconnect_reload_no_declaration_replay", passed: true });

  // Verify all 8 formats against master frame counts in Chromium, then render
  // the actual Player scheduling through OfflineAudioContext across two loops.
  report.browser_audio = await rivalPage.evaluate(async () => {
    const manifest = await (await fetch("./assets/audio/provenance.json")).json();
    const context = new AudioContext({ sampleRate: 48000 });
    const buffers = {}, decoded = [];
    for (const [piece, spec] of Object.entries(manifest.pieces)) {
      for (const format of ["flac", "mp3"]) {
        const file = format === "flac" ? spec.flac.file : spec.fallback.file;
        const buffer = await context.decodeAudioData(await (await fetch("./assets/audio/" + file)).arrayBuffer());
        decoded.push({ piece, format, frames: buffer.length, masterFrames: spec.frames,
          sampleRate: buffer.sampleRate, seconds: buffer.duration, framesEqual: buffer.length === spec.frames });
        if (format === "flac") buffers[piece] = buffer;
      }
    }
    const once = buffers.endgameOnce, loop = buffers.endgameLoop;
    const offline = new OfflineAudioContext(2, 1440 + once.length + 2 * loop.length, 48000);
    const adapter = { state: "running", currentTime: 0, destination: offline.destination,
      createGain: () => offline.createGain(), createBufferSource: () => offline.createBufferSource() };
    const player = new OverlimitTableMusic.Player({ getContext: () => adapter });
    player.cue = { scene: "endgame", key: "offline-d5", playOpening: true };
    player.environment = { atTable: true, connected: true, visible: true, volume: 100 };
    player.cache.set("endgameOnce", { buffer: once, format: "flac" });
    player.cache.set("endgameLoop", { buffer: loop, format: "flac" });
    await player.start(adapter, 0, new AbortController().signal);
    const render = await offline.startRendering();
    let maxError = 0;
    for (let c = 0; c < 2; c++) {
      const actual = render.getChannelData(c), a = once.getChannelData(c), b = loop.getChannelData(c);
      for (let i = 5760; i < a.length; i++) maxError = Math.max(maxError, Math.abs(actual[1440 + i] - a[i]));
      for (let i = 0; i < 2 * b.length; i++) maxError = Math.max(maxError, Math.abs(actual[1440 + a.length + i] - b[i % b.length]));
    }
    const compatibility = new OverlimitTableMusic.Player({ getContext: () => context,
      fetchAudio: (url, options) => url.endsWith(".flac") ? Promise.resolve({ ok: false, status: 415 }) : fetch(url, options) });
    const compatibilityFrames = [];
    for (const [piece, spec] of Object.entries(manifest.pieces)) {
      const value = await compatibility.load(piece, context, new AbortController().signal);
      compatibilityFrames.push({ piece, format: value.format, frames: value.buffer.length, masterFrames: spec.frames,
        framesEqual: value.buffer.length === spec.frames });
    }
    await context.close();
    return { decoded, compatibilityFrames, d5_two_loop_render_max_pcm_error: maxError,
      meaning: "Engine sample/timing correspondence; does not prove inaudible musical seams" };
  });
  assert.ok(report.browser_audio.decoded.filter((a) => a.format === "flac").every((a) => a.framesEqual));
  assert.ok(report.browser_audio.compatibilityFrames.every((a) => a.framesEqual && a.format === "mp3"));
  assert.ok(report.browser_audio.d5_two_loop_render_max_pcm_error < 0.000001);

  // Real server execution barrier, held just long enough to observe the cue.
  app.gameEngine.cancelPresentationBarrier(room);
  const card = (code, suit, rank, value) => ({ code, suit, rank, value });
  room.communityCards = [card("H2", "H", "2", 2), card("C9", "C", "9", 9), card("S5", "S", "5", 5),
    card("D7", "D", "7", 7), card("H8", "H", "8", 8)];
  rival.cards = [card("S2", "S", "2", 2), card("D3", "D", "3", 3)];
  actor.cards = [card("SA", "S", "A", 14), card("DA", "D", "A", 14)];
  room.skillState.endgameActive.execution = true;
  room.phase = "river";
  app.gameEngine.settleShowdown(room);
  assert.equal(room.presentationBarrier.kind, "ENDGAME_EXECUTION");
  clearTimeout(room.presentationBarrierTimer);
  room.presentationBarrierTimer = null;
  await rivalPage.waitForFunction(() => state.phase === "showdown");
  assert.equal((await status(rivalPage)).scene, "endgame");
  app.gameEngine.releasePresentationBarrier(room, room.presentationBarrier.id);
  await playing(rivalPage, "daily");
  if (room.nextHandTimer) clearTimeout(room.nextHandTimer);
  app.gameEngine.skillEngine.broadcastSkillState(room);
  app.gameEngine.broadcastRoomState(room);
  await rivalPage.waitForTimeout(150);
  assert.equal((await status(rivalPage)).scene, "daily");
  report.cases.push({ case: "authoritative_result_stops_d5_during_local_execution_tail", passed: true });

  // Independent expiry fixture; never restore ALL IN within that same hand.
  const second = await pair();
  const current = second.room.players[second.room.currentPlayerIndex];
  current.skillRuntime.abyssEnergy = 8;
  assert.equal(app.gameEngine.handleSkillUse(second.room, current, { skillId: "ENDGAME", target: {}, requestId: "music-expiry" }).status, "SUCCESS");
  holdDeclaration(second.room);
  await playing(second.pages[0], "endgame");
  second.room.skillState.endgameActive = null;
  second.room.players[1].isAllIn = true; // Public expiry fixture, no settlement.
  app.gameEngine.skillEngine.broadcastSkillState(second.room);
  app.gameEngine.broadcastRoomState(second.room);
  await playing(second.pages[0], "daily");
  report.cases.push({ case: "expiry_to_daily_despite_remaining_public_allin_flag", passed: true });

  // Reload with audio unavailable, then use the visible retry control.
  expectedFailure = true;
  await second.pages[0].route("**/assets/audio/*", (route) => route.fulfill({ status: 503, body: "fixture audio failure" }));
  await second.pages[0].reload({ waitUntil: "networkidle" });
  await second.pages[0].click("#btn-settings");
  await second.pages[0].waitForFunction(() => tableMusicPlayer.getStatus().state === "failed");
  await second.pages[0].locator("#btn-music-retry").waitFor({ state: "visible" });
  await second.pages[0].unroute("**/assets/audio/*");
  expectedFailure = false;
  await second.pages[0].click("#btn-music-retry");
  await playing(second.pages[0], "daily");
  await second.pages[0].locator("#setting-language").selectOption("en-US");
  assert.match(await second.pages[0].locator("#setting-music-status").innerText(), /Playing: Velvet Gambit/);
  await second.pages[0].locator("#setting-language").selectOption("zh-CN");
  assert.match(await second.pages[0].locator("#setting-music-status").innerText(), /正在播放：暗金博弈/);
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 700 }]) {
    await second.pages[0].setViewportSize(viewport);
    assert.equal(await second.pages[0].evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.equal(await second.pages[0].locator("#setting-music-status").isVisible(), true);
  }
  await second.pages[0].setViewportSize({ width: 1440, height: 900 });
  await second.pages[0].screenshot({ path: path.join(output, "game-daily-settings.png") });
  await second.pages[0].click("#btn-settings-lobby");
  const confirm = second.pages[0].locator("#btn-leave-confirm");
  if (await confirm.isVisible()) await confirm.click();
  await second.pages[0].locator("#screen-auth.active").waitFor();
  await playing(second.pages[0], "lobby");
  assert.match(await second.pages[0].locator("#setting-music-status").textContent(), /入席之前/);
  report.cases.push({ case: "failure_retry_localization_mobile_settings_exit", passed: true });
  assert.deepEqual(report.errors, []);
  report.passed = true;
  console.log(JSON.stringify({ passed: true, cases: report.cases.length, audio: report.browser_audio }));
} catch (error) {
  report.passed = false;
  report.failure = error.stack;
  console.error(error);
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(output, "browser-check.json"), JSON.stringify(report, null, 2) + "\n");
  for (const room of app.roomManager.rooms.values()) app.gameEngine.abortPendingRoomWork(room);
  await browser.close();
  await new Promise((resolve) => app.io.close(resolve));
}
