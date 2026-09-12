import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { io } from "socket.io-client";
import runtime from "./playwright-runtime.js";
import lobby from "./lobby-test-helpers.js";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3002";
const OUTPUT = path.resolve(process.env.LOBBY_V2_DIR || "artifacts/lobby-v2");
const VALID = ["DEEP_BREATH", "PROBE", "ALERT"];
const actionEvents = { match: "match:queue", solo: "create_solo_room", create: "create_room" };
const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 700 }];
const layoutViewports = [...viewports, { width: 1366, height: 768 }, { width: 1280, height: 720 }];
const MAX_LOADOUT = ["NULLIFICATION", "DEEP_BREATH", "PROBE", "ALERT"];
const report = { ok: false, cases: [], checks: 0, failures: [], screenshots: [] };
const check = (actual, expected, label) => { report.checks++; assert.deepEqual(actual, expected, label); };
await fs.mkdir(OUTPUT, { recursive: true });
const catalog = await (await fetch(BASE + "/api/skills")).json();
const browser = await chromium.launch(runtime.chromiumLaunchOptions({ headless: true }));

async function capture(page, name) {
  // Capture the settled lobby after transient connection notices dismiss.
  await page.locator("#connection-banner").waitFor({ state: "hidden" });
  await page.waitForFunction(() => !document.querySelector("#toast-region .toast"));
  await lobby.stable(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const file = path.join(OUTPUT, name + ".png");
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push(file);
}

async function scenario(name, options, run) {
  const { viewport = viewports[0], locale = "zh-CN", quality = "high", loadout = VALID, name: playerName = "Lobby QA", catalogGate = false, mobile = false } = options;
  const context = await browser.newContext({ viewport, locale, isMobile: mobile, hasTouch: viewport.width < 500 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let releaseCatalog;
  const gate = new Promise((resolve) => { releaseCatalog = resolve; });
  try {
    await context.addInitScript(({ loadout, locale, quality, playerName }) => {
      if (sessionStorage.getItem("lobby-v2-seeded")) return;
      sessionStorage.setItem("lobby-v2-seeded", "1");
      sessionStorage.setItem("abyss_player_name", playerName);
      localStorage.setItem("abyss_skill_loadout_v2", JSON.stringify(loadout));
      localStorage.setItem("overlimit_quickstart_v1", "seen");
      localStorage.setItem("abyss_ui_settings_v2", JSON.stringify({ animation: quality, language: locale, languageChosen: true, sfx: 0, music: 0 }));
    }, { loadout, locale, quality, playerName });
    if (catalogGate) await page.route("**/api/skills", async (route) => {
      await gate;
      await route.fulfill({ json: catalog });
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => socket.connected && document.body.classList.contains("i18n-ready"));
    if (!catalogGate) await page.waitForFunction(() => state.skillCatalogStatus === "ready");
    await page.evaluate(() => {
      window.__lobbyOutgoing = [];
      socket.onAnyOutgoing((event, payload) => {
        if (["match:queue", "create_room", "create_solo_room", "join_room"].includes(event)) {
          window.__lobbyOutgoing.push({ event, payload });
        }
      });
    });
    const evidence = await run(page, context, releaseCatalog);
    check(errors, [], name + " has no uncaught browser errors");
    report.cases.push({ name, ok: true, ...evidence });
  } catch (error) {
    report.failures.push({ name, error: error.stack || String(error), errors });
    await page.screenshot({ path: path.join(OUTPUT, name + "-failure.png"), fullPage: true }).catch(() => {});
  } finally {
    releaseCatalog();
    await context.close();
  }
}

async function selection(page) {
  return page.evaluate(() => ({ gameMode: state.gameMode, skillMode: state.skillMode }));
}
async function waitAction(page, action) {
  const event = actionEvents[action];
  await page.waitForFunction((event) => window.__lobbyOutgoing.some((item) => item.event === event), event);
  if (action === "match") await page.locator("#match-queue-modal:not(.hidden)").waitFor();
  else await page.locator(action === "solo" ? "#screen-game.active" : "#screen-wait.active").waitFor({ timeout: 15000 });
  return page.evaluate((event) => window.__lobbyOutgoing.filter((item) => item.event === event), event);
}
async function focusLoop(page, modalId) {
  const info = await page.locator(modalId).evaluate((modal) => {
    const items = modalFocusables(modal);
    window.__lobbyFocus = { first: items[0], last: items.at(-1) };
    items[0].focus();
    return { isolated: document.getElementById("main-content").inert && !modal.inert, count: items.length };
  });
  check(info.isolated, true, "modal isolation");
  assert.ok(info.count >= 2);
  await page.keyboard.press("Shift+Tab");
  check(await page.evaluate(() => document.activeElement === window.__lobbyFocus.last), true, "reverse focus loop");
  await page.keyboard.press("Tab");
  check(await page.evaluate(() => document.activeElement === window.__lobbyFocus.first), true, "forward focus loop");
}

try {
  for (const viewport of layoutViewports) for (const locale of ["zh-CN", "en-US"]) for (const quality of ["high", "low"]) {
    await scenario(`layout-${viewport.width}-${locale}-${quality}`, { viewport, locale, quality, loadout: MAX_LOADOUT }, async (page) => {
      const initial = await page.evaluate(() => ({
        gameMode: state.gameMode, skillMode: state.skillMode,
        cards: document.querySelectorAll('[role="radiogroup"] [role="radio"]').length,
        actions: document.querySelectorAll("#screen-auth [data-room-action]").length,
        hiddenLoadout: document.getElementById("lobby-loadout").getBoundingClientRect().height,
        classic: document.querySelector('[data-lobby-mode-card="off"]').getAttribute("aria-checked"),
        overdrive: document.getElementById("lobby-overdrive").getAttribute("aria-checked"),
      }));
      check(initial, { gameMode: "standard", skillMode: "off", cards: 2, actions: 3, hiddenLoadout: 0, classic: "true", overdrive: "false" }, "default information architecture");
      const classicLayout = await lobby.auditLobbyLayout(page);
      check(classicLayout.ok, true, JSON.stringify(classicLayout));
      const prefix = `${viewport.width}-${locale}-${quality}`;
      await capture(page, prefix + "-classic");
      const desktop = viewport.width === 1440 && locale === "zh-CN" && quality === "high";
      if (desktop) await capture(page, "desktop-classic-standard");
      if (viewport.width === 390 && locale === "zh-CN" && quality === "high") await capture(page, "mobile-classic");
      await page.locator("#lobby-overdrive").click();
      check(await selection(page), { gameMode: "overdrive", skillMode: "off" }, "Classic Overdrive mapping");
      if (desktop) await capture(page, "desktop-classic-overdrive");
      await page.locator('[data-lobby-mode-card="abyss"]').click();
      check(await selection(page), { gameMode: "overdrive", skillMode: "abyss" }, "Skill selection retains modifier");
      const equipped = await page.evaluate(() => ({
        visible: document.getElementById("lobby-loadout").getBoundingClientRect().height > 0,
        names: [...document.querySelectorAll(".lobby-skill-pill")].map((tag) => tag.textContent),
        expected: state.savedLoadout.map((id) => skillCopy(id, "name")),
        meter: document.getElementById("lobby-loadout-meter").textContent,
        expectedMeter: t("lobby.loadMeter", { load: validateLoadoutIds(state.savedLoadout).load, maxLoad: currentSkillBuildLimits().maxLoad }),
      }));
      check(equipped.visible, true, "conditional loadout row");
      check(equipped.names, equipped.expected, "equipped names only");
      check(equipped.meter, equipped.expectedMeter, "load comes from existing validation");
      if (desktop) await capture(page, "desktop-skill-overdrive");
      await page.locator("#lobby-overdrive").click();
      check(await selection(page), { gameMode: "standard", skillMode: "abyss" }, "Skill Standard mapping");
      const skillLayout = await lobby.auditLobbyLayout(page);
      check(skillLayout.ok, true, JSON.stringify(skillLayout));
      await capture(page, prefix + "-skill");
      if (desktop) await capture(page, "desktop-skill-standard");
      if (viewport.width === 390 && locale === "zh-CN" && quality === "high") await capture(page, "mobile-skill");
      if (viewport.width === 390 && locale === "en-US" && quality === "high") await capture(page, "mobile-en");
      const saved = await page.evaluate(() => ({ saved: [...state.savedLoadout], selected: [...state.selectedLoadout], storage: localStorage.getItem("abyss_skill_loadout_v2") }));
      await page.locator('[data-lobby-mode-card="off"]').click();
      check(await page.locator("#lobby-loadout").evaluate((row) => row.getBoundingClientRect().height), 0, "Classic leaves no loadout placeholder");
      check(await page.evaluate(() => ({ saved: [...state.savedLoadout], selected: [...state.selectedLoadout], storage: localStorage.getItem("abyss_skill_loadout_v2") })), saved, "Classic preserves both loadouts and storage");
      await lobby.selectLobbyMode(page, "overdrive", "abyss");
      await page.locator("#btn-open-skill-lab").click();
      await page.locator("#screen-skill-lab.active").waitFor();
      await page.locator("#btn-back-skill-lab").click();
      await page.locator("#screen-auth.active").waitFor();
      check(await selection(page), { gameMode: "overdrive", skillMode: "abyss" }, "lab back preserves selection");
      await page.locator("#btn-open-join").click();
      await focusLoop(page, "#lobby-join-modal");
      const modalBounds = await page.locator("#lobby-join-modal .modal-panel").boundingBox();
      check(modalBounds.x >= 0 && modalBounds.x + modalBounds.width <= viewport.width + 1 && modalBounds.y >= 0 && modalBounds.y + modalBounds.height <= viewport.height + 1, true, "Join fits viewport");
      await page.keyboard.press("Escape");
      await page.locator("#lobby-join-modal").waitFor({ state: "hidden" });
      check(await page.locator("#btn-open-join").evaluate((node) => node === document.activeElement), true, "Join returns focus");
      return { classicLayout, skillLayout };
    });
  }

  for (const gameMode of ["standard", "overdrive"]) for (const skillMode of ["off", "abyss"]) for (const action of Object.keys(actionEvents)) {
    await scenario(`action-${gameMode}-${skillMode}-${action}`, {}, async (page) => {
      const name = `${gameMode === "standard" ? "STD" : "OD"}-${skillMode}-${action}`;
      await lobby.editLobbyName(page, name);
      const identity = await page.evaluate(() => ({ state: state.myName, saved: sessionStorage.getItem("abyss_player_name"), shown: document.getElementById("lobby-player-name").textContent }));
      check(identity, { state: name, saved: name, shown: name }, "one lobby identity");
      await lobby.startLobbyAction(page, gameMode, skillMode, action);
      const sent = await waitAction(page, action);
      check(sent.length, 1, "one request per activation");
      check({ gameMode: sent[0].payload.gameMode, skillMode: sent[0].payload.skillMode, name: sent[0].payload.playerName }, { gameMode, skillMode, name }, "actual Socket payload matches selection and identity");
      if (action !== "match") check(await page.evaluate(() => getMe()?.name), name, "server room identity agrees");
      return { action, gameMode, skillMode, payload: sent[0].payload };
    });
  }

  const expensive = [...catalog.skills].sort((a, b) => b.load - a.load).slice(0, 4).map((skill) => skill.id);
  assert.ok(catalog.skills.filter((skill) => expensive.includes(skill.id)).reduce((sum, skill) => sum + skill.load, 0) > catalog.config.maxLoad);
  const invalid = { empty: [], count: catalog.skills.slice(0, 5).map((skill) => skill.id), overload: expensive, duplicate: ["DEEP_BREATH", "DEEP_BREATH"], unknown: ["NOT_A_SKILL"] };
  for (const [reason, loadout] of Object.entries(invalid)) for (const action of Object.keys(actionEvents)) {
    await scenario(`invalid-${reason}-${action}`, { loadout }, async (page) => {
      await lobby.selectLobbyMode(page, "overdrive", "abyss");
      check(await page.locator("#lobby-loadout").getAttribute("class").then((value) => value.includes("is-ready")), false, "invalid row does not imply ready");
      if (reason === "empty" && action === "match") await capture(page, "desktop-skill-invalid");
      await page.locator(`[data-room-action="${action}"]`).click();
      await page.locator("#screen-skill-lab.active").waitFor();
      check(await page.evaluate(() => window.__lobbyOutgoing), [], "invalid loadout sends no room/match request");
      check(await page.evaluate(() => state.pendingRoomAction), { type: action, gameMode: "overdrive", skillMode: "abyss" }, "original continuation is retained");
      if (reason === "empty") {
        await page.locator('[data-skill-id="DEEP_BREATH"] .skill-card-select').click();
        await page.locator("#btn-save-loadout").click();
        const sent = await waitAction(page, action);
        check(sent.length, 1, "saving a valid loadout resumes once");
        check({ gameMode: sent[0].payload.gameMode, skillMode: sent[0].payload.skillMode }, { gameMode: "overdrive", skillMode: "abyss" }, "continuation retains mode");
      } else {
        await page.locator("#btn-back-skill-lab").click();
        check(await page.evaluate(() => state.pendingRoomAction), null, "cancelling lab clears continuation");
        check(await page.evaluate(() => JSON.parse(localStorage.getItem("abyss_skill_loadout_v2"))), loadout, "invalid saved build is not silently cleared");
      }
    });
  }

  for (const action of Object.keys(actionEvents)) await scenario(`catalog-pending-${action}`, { catalogGate: true }, async (page, context, release) => {
    await lobby.selectLobbyMode(page, "standard", "abyss");
    await page.locator(`[data-room-action="${action}"]`).click();
    check(await page.evaluate(() => window.__lobbyOutgoing), [], "unready catalog blocks sending");
    check(await page.evaluate(() => state.pendingRoomAction?.type), action, "catalog continuation uses existing flow");
    release();
    await page.locator("#screen-skill-lab.active").waitFor();
    check(await page.evaluate(() => window.__lobbyOutgoing), [], "catalog readiness alone does not auto-start");
  });

  await scenario("identity-storage-and-defaults", { name: "已有昵称" }, async (page) => {
    check(await page.locator("#lobby-player-name").textContent(), "已有昵称", "session name rendered");
    await page.locator("#btn-edit-name").click();
    await focusLoop(page, "#nickname-modal");
    await page.locator("#nickname-input").fill("New Name");
    await page.locator("#nickname-input").press("ControlOrMeta+A");
    check(await page.locator("#nickname-input").evaluate((input) => ({ count: input.selectionEnd - input.selectionStart, select: getComputedStyle(input).userSelect })), { count: 8, select: "text" }, "name remains editable and selectable");
    await capture(page, "desktop-nickname-edit");
    await page.locator("#nickname-input").press("Enter");
    await page.locator("#nickname-modal").waitFor({ state: "hidden" });
    check(await page.locator("#btn-edit-name").evaluate((node) => node === document.activeElement), true, "name returns to opener");
    await lobby.selectLobbyMode(page, "overdrive", "abyss");
    await page.reload({ waitUntil: "networkidle" });
    check(await page.evaluate(() => ({ shown: document.getElementById("lobby-player-name").textContent, state: state.myName, stored: sessionStorage.getItem("abyss_player_name"), gameMode: state.gameMode, skillMode: state.skillMode })), { shown: "New Name", state: "New Name", stored: "New Name", gameMode: "standard", skillMode: "off" }, "identity persists without adding mode persistence");
    await lobby.editLobbyName(page, "   ");
    check(await page.evaluate(() => ({ name: state.myName, shown: document.getElementById("lobby-player-name").textContent, stored: sessionStorage.getItem("abyss_player_name") })), { name: "player1", shown: "player1", stored: "player1" }, "empty nickname has one visible fallback");
  });

  for (const quality of ["high", "low"]) await scenario(`keyboard-and-cancellation-${quality}`, { quality }, async (page) => {
    const classic = page.locator('[data-lobby-mode-card="off"]');
    const skill = page.locator('[data-lobby-mode-card="abyss"]');
    await classic.focus();
    await page.keyboard.press("ArrowRight");
    check(await skill.getAttribute("aria-checked"), "true", "arrow selects next radio");
    check(await skill.evaluate((node) => node === document.activeElement && node.matches(":focus-visible")), true, "roving focus is visible");
    await page.keyboard.press("Home");
    check(await classic.getAttribute("aria-checked"), "true", "Home selects Classic");
    await page.keyboard.press("End");
    check(await skill.getAttribute("aria-checked"), "true", "End selects Skills");
    await page.keyboard.press("Space");
    check(await skill.getAttribute("aria-checked"), "true", "Space selects without toggling off");
    await page.locator("#lobby-overdrive").focus();
    await page.keyboard.down("Enter");
    await page.keyboard.down("Enter");
    await page.keyboard.up("Enter");
    check(await page.locator("#lobby-overdrive").getAttribute("aria-checked"), "true", "repeated Enter changes switch only once");
    await page.keyboard.press("Space");
    check(await page.locator("#lobby-overdrive").getAttribute("aria-checked"), "false", "Space changes switch once");
    const bounds = await classic.boundingBox();
    await page.mouse.move(bounds.x + 30, bounds.y + 30);
    await page.mouse.down();
    const pressed = await classic.boundingBox();
    check(pressed, bounds, "native radio bounds stay fixed while pressed");
    await classic.dispatchEvent("pointercancel", { pointerId: 1, bubbles: true });
    await page.mouse.up();
    check(await skill.getAttribute("aria-checked"), "true", "pointercancel does not select");
    check(await page.locator(".ui-pressed").count(), 0, "pointercancel clears press");
    await page.mouse.move(bounds.x + 30, bounds.y + 30);
    await page.mouse.down();
    await page.mouse.move(1, 1);
    await page.mouse.up();
    check(await page.locator(".ui-pressed").count(), 0, "leaving target clears press");
    check(await skill.getAttribute("aria-checked"), "true", "leaving target preserves selection");
    await page.locator("#lobby-overdrive").focus();
    await page.keyboard.down("Space");
    await page.keyboard.press("Tab");
    await page.keyboard.up("Space");
    check(await page.locator(".ui-pressed").count(), 0, "keyboard focusout clears press");
    check(await page.locator("#lobby-overdrive").getAttribute("aria-checked"), "false", "focusout cancels pending Space activation");
  });

  await scenario("modal-opener-and-reversal", {}, async (page) => {
    await lobby.selectLobbyMode(page, "overdrive", "abyss");
    await page.locator("#btn-open-quickstart").click();
    await focusLoop(page, "#quickstart-modal");
    await page.keyboard.press("End");
    await page.locator("#btn-quickstart-next").click();
    await page.locator("#quickstart-modal").waitFor({ state: "hidden" });
    check(await page.locator("#btn-open-quickstart").evaluate((node) => node === document.activeElement), true, "Finish returns to real opener");
    check(await selection(page), { gameMode: "overdrive", skillMode: "abyss" }, "tutorial does not change selection");
    for (const [opener, close, modal] of [["#btn-open-join", "#btn-close-join", "#lobby-join-modal"], ["#btn-edit-name", "#btn-close-name", "#nickname-modal"], ["#btn-open-quickstart", "#btn-close-quickstart", "#quickstart-modal"]]) {
      await page.locator(opener).click();
      await page.locator(close).click();
      check(await page.locator(modal).evaluate((node) => node.inert), true, "closing modal is immediately inert");
      await page.locator(opener).click();
      await lobby.stable(page);
      check(await page.locator(modal).evaluate((node) => !node.inert && !node.classList.contains("hidden")), true, "rapid reverse keeps reopened modal active");
      await page.keyboard.press("Escape");
      await page.locator(modal).waitFor({ state: "hidden" });
      check(await page.locator(opener).evaluate((node) => document.activeElement === node), true, "Escape returns to opener");
    }
  });

  for (const constrained of [false, true]) await scenario(constrained ? "constrained-touch-scroll-cancels-mode-selection" : "one-screen-touch-swipe-cancels-mode-selection", {
    viewport: constrained ? { width: 320, height: 460 } : viewports[2], mobile: true,
  }, async (page, context) => {
    await page.locator('[data-lobby-mode-card="abyss"]').tap();
    await lobby.stable(page);
    const rect = await page.locator('[data-lobby-mode-card="off"]').boundingBox();
    const cdp = await context.newCDPSession(page);
    const x = Math.round(rect.x + rect.width / 2), y = Math.round(rect.y + rect.height * .8);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (const distance of [20, 60, 110, 150]) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - distance }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    if (constrained) await page.waitForFunction(() => scrollY > 10);
    else check(await page.evaluate(() => scrollY === 0 && document.documentElement.scrollHeight <= innerHeight + 1), true, "one-screen lobby does not scroll on swipe");
    check(await page.locator('[data-lobby-mode-card="abyss"]').getAttribute("aria-checked"), "true", "native touch gesture does not select Classic");
    check(await page.locator(".ui-pressed").count(), 0, "touch scroll clears press");
  });

  function once(socket, event) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out: " + event)), 8000);
      socket.once(event, (payload) => { clearTimeout(timer); resolve(payload); });
    });
  }
  for (const password of [false, true]) {
    const host = io(BASE, { transports: ["websocket"], forceNew: true });
    try {
      await once(host, "connect");
      const joined = once(host, "room_joined");
      host.emit("create_room", { gameMode: "standard", skillMode: "off", playerName: "V2 Host", password: null });
      const room = await joined;
      if (password) {
        const updated = once(host, "room:password_updated");
        host.emit("room:set_password", { password: "lobby-v2-test" });
        await updated;
      }
      await scenario(password ? "join-password-and-reconnect" : "join-independent-of-mode", { loadout: [] }, async (page) => {
        await lobby.editLobbyName(page, "Join QA");
        await lobby.selectLobbyMode(page, "overdrive", "abyss");
        await page.locator("#btn-open-join").click();
        await page.locator("#input-room").fill(room.roomId.toLowerCase());
        await capture(page, password ? "desktop-join-password-room" : "desktop-join-room");
        await page.locator("#input-room").press("Enter");
        if (password) {
          await page.locator("#join-password-modal:not(.hidden)").waitFor();
          await focusLoop(page, "#join-password-modal");
          await page.locator("#modal-join-password").fill("incorrect");
          await page.locator("#btn-join-password-confirm").click();
          await page.waitForFunction(() => window.__lobbyOutgoing.filter((item) => item.event === "join_room").length === 2 && !document.getElementById("join-password-modal").classList.contains("hidden"));
          await page.keyboard.press("Escape");
          await page.locator("#lobby-join-modal:not(.hidden)").waitFor();
          check(await page.locator("#input-room").evaluate((node) => node === document.activeElement), true, "password cancel returns to room input");
          await page.locator("#btn-join").click();
          await page.locator("#join-password-modal:not(.hidden)").waitFor();
          await page.locator("#modal-join-password").fill("lobby-v2-test");
          await page.locator("#btn-join-password-confirm").click();
        }
        await page.waitForFunction((roomId) => state.roomId === roomId && !state.atLobby && Boolean(getMe()), room.roomId);
        check(await selection(page), { gameMode: "standard", skillMode: "off" }, "Join follows room mode even when lobby skill build is empty");
        check(await page.evaluate(() => ({ name: getMe().name, local: state.myName })), { name: "Join QA", local: "Join QA" }, "Join uses displayed nickname");
        check(await page.evaluate(() => window.__lobbyOutgoing.filter((item) => item.event === "join_room").every((item) => item.payload.playerName === "Join QA" && !Object.hasOwn(item.payload, "gameMode") && !Object.hasOwn(item.payload, "skillMode"))), true, "Join payload retains protocol semantics");
        if (password) {
          const identity = await page.evaluate(() => ({ room: state.roomId, token: state.reconnectToken, player: state.playerId }));
          await page.reload({ waitUntil: "networkidle" });
          await page.waitForFunction((roomId) => state.roomId === roomId && !state.reconnecting && Boolean(getMe()), room.roomId);
          check(await page.evaluate(() => ({ room: state.roomId, token: state.reconnectToken, player: state.playerId })), identity, "reconnect preserves credentials and room");
          check(await page.evaluate(() => ({ name: state.myName, stored: sessionStorage.getItem("abyss_player_name"), server: getMe().name })), { name: "Join QA", stored: "Join QA", server: "Join QA" }, "reconnect restores one identity");
        }
      });
    } finally { host.disconnect(); }
  }
} finally {
  await browser.close();
  report.ok = report.failures.length === 0;
  await fs.writeFile(path.join(OUTPUT, "report.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ ok: report.ok, cases: report.cases.length, checks: report.checks, failures: report.failures, screenshots: report.screenshots.length }));
if (!report.ok) process.exitCode = 1;
