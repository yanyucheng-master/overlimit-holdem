import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import runtime from "./playwright-runtime.js";
import lobby from "./lobby-test-helpers.js";
import server from "../server/server.js";
import loanState from "../game/skills/loanState.js";
import skillState from "../game/skills/skillState.js";

const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 700 }];
const output = process.env.LOAN_QA_DIR || path.join(os.tmpdir(), "overlimit-loan-ui-qa");
const app = server.createAppServer({ matchmakingAutoStart: false });
await new Promise((resolve) => app.httpServer.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${app.httpServer.address().port}`;
const browser = await chromium.launch(runtime.chromiumLaunchOptions({ headless: true }));
const report = { scenarios: [], consoleErrors: [], requestErrors: [] };
await fs.mkdir(output, { recursive: true });

async function clickUser(page, selector) {
  const target = page.locator(selector);
  // Wait for this control's layout, not every unrelated non-blocking FX on the
  // table. Waiting for a whole settlement animation would consume the real
  // two-second repayment window before a user-style click is even attempted.
  await page.evaluate(() => document.fonts.ready);
  // Locator actionability retries after a HUD replacement and waits for the
  // modal's scale transition before we measure its real user hit target.
  await target.click({ trial: true });
  await page.waitForFunction((selector) => {
    const target = document.querySelector(selector);
    if (!target) return false;
    for (let node = target; node; node = node.parentElement) {
      if (node.getAnimations().some((animation) => animation.playState === "running"
        && animation.effect?.getComputedTiming().iterations !== Infinity)) return false;
    }
    return true;
  }, selector);
  const hit = await target.evaluate((node) => {
    const r = node.getBoundingClientRect();
    const center = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { ok: r.width > 0 && r.height >= 36 && r.left >= 0 && r.right <= innerWidth + 1
      && r.top >= 0 && r.bottom <= innerHeight + 1 && Boolean(center && node.contains(center)),
      rect: r.toJSON(), hit: center?.outerHTML.slice(0, 300) };
  });
  assert.equal(hit.ok, true, `User hit target: ${selector}: ${JSON.stringify(hit)}`);
  await target.click();
}

async function audit(page, modal) {
  await lobby.stable(page);
  const value = await page.evaluate((isModal) => {
    const inside = (r) => r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1;
    const box = (sel) => document.querySelector(sel).getBoundingClientRect();
    const hud = box("#skill-hud"), actions = box(".action-dock");
    const intersects = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const panel = box(".loan-debt-panel");
    const texts = [...document.querySelectorAll(isModal ? ".loan-debt-panel strong, .loan-debt-panel small, #loan-debt-status" : "#btn-loan-debts")];
    const controls = [...document.querySelectorAll(isModal ? ".loan-debt-panel button" : "#btn-loan-debts, .primary-actions button")];
    return {
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      hudOverlapsActions: intersects(hud, actions),
      panelInside: !isModal || inside(panel),
      controlsInside: controls.every((node) => inside(node.getBoundingClientRect())),
      textOverflow: texts.filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.textContent),
      text: isModal ? document.querySelector(".loan-debt-panel").innerText : document.querySelector("#btn-loan-debts").textContent,
      panel: { x: panel.x, y: panel.y, width: panel.width, height: panel.height },
    };
  }, modal);
  assert.equal(value.overflowX, false, JSON.stringify(value));
  assert.equal(value.hudOverlapsActions, false, JSON.stringify(value));
  assert.equal(value.panelInside, true, JSON.stringify(value));
  assert.equal(value.controlsInside, true, JSON.stringify(value));
  assert.deepEqual(value.textOverflow, [], JSON.stringify(value));
  return value;
}

try {
  for (const viewport of viewports) for (const locale of ["zh-CN", "en-US"]) for (const quality of ["high", "low"]) {
    const contexts = [];
    let room;
    const label = `${viewport.width}x${viewport.height}-${locale}-${quality}`;
    try {
      const pages = [];
      for (let n = 0; n < 2; n++) {
        const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
        contexts.push(context);
        await context.addInitScript(({ locale, quality }) => {
          localStorage.setItem("abyss_ui_settings_v2", JSON.stringify({ language: locale, languageChosen: true, animation: quality }));
          localStorage.setItem("abyss_skill_loadout_v2", JSON.stringify(quality === "high"
            ? ["LOAN", "FAIRNESS", "DEEP_BREATH", "PROBE"] : ["LOAN", "FAIRNESS", "DEEP_BREATH"]));
          localStorage.setItem("overlimit_quickstart_v1", "seen");
        }, { locale, quality });
        const page = await context.newPage();
        page.on("pageerror", (error) => report.consoleErrors.push({ label, message: error.message }));
        page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push({ label, message: message.text() }); });
        page.on("requestfailed", (request) => { if (request.url().startsWith(base)) report.requestErrors.push({ label, url: request.url(), error: request.failure()?.errorText }); });
        await page.goto(base, { waitUntil: "networkidle" });
        await page.waitForFunction(() => socket.connected && state.skillCatalog.length === 33);
        pages.push(page);
      }
      await lobby.startLobbyAction(pages[0], "standard", "abyss", "create");
      await pages[0].waitForFunction(() => Boolean(state.roomId));
      const roomId = await pages[0].evaluate(() => state.roomId);
      room = app.roomManager.rooms.get(roomId);
      await pages[1].click("#btn-open-join");
      await pages[1].fill("#input-room", roomId);
      await pages[1].click("#btn-join");
      await Promise.all(pages.map((page) => page.locator("#screen-game.active").waitFor()));
      await pages[0].waitForFunction(() => Boolean(state.currentTurnPlayerId));
      app.gameEngine.clearActionTimer(room); // Fixture clock: no timeout while taking the viewport matrix.
      const player = room.players[room.currentPlayerIndex];
      const index = (await pages[0].evaluate(() => state.playerId)) === player.playerId ? 0 : 1;
      const owner = pages[index], opponent = pages[1 - index];
      await owner.waitForFunction(() => document.querySelector('[data-skill-use-id="LOAN"]')?.disabled === false);
      await opponent.evaluate(() => { window.loanQaPackets = []; socket.onAny((event, data) => window.loanQaPackets.push({ event, data })); });

      // Both activations go through the real Skill HUD, modal, socket and authority.
      await clickUser(owner, '[data-skill-use-id="LOAN"]');
      await owner.locator("#skill-choice-modal:not(.hidden)").waitFor();
      await owner.locator("#skill-choice-body .skill-choice-card").filter({ hasText: locale === "zh-CN" ? "能量贷款" : "Energy Loan" }).click();
      await owner.click("#btn-skill-choice-confirm");
      await owner.waitForFunction(() => state.skillSelf?.loan?.tranches?.length === 1);
      const energyDebt = player.skillRuntime.loanDebts[0];
      assert.equal(energyDebt.kind, "energy");
      assert.equal(energyDebt.principal, 5);
      assert.equal(await opponent.locator("#btn-loan-debts").isVisible(), false);
      assert.equal(await opponent.evaluate((id) => JSON.stringify(window.loanQaPackets).includes(id), energyDebt.id), false);
      await clickUser(owner, '[data-skill-use-id="LOAN"]');
      await owner.locator("#skill-choice-body .skill-choice-card").click();
      await owner.click("#btn-skill-choice-confirm");
      await owner.waitForFunction(() => state.skillSelf?.loan?.tranches?.length === 2);
      assert.equal(player.skillRuntime.loanTotalUsesThisHand, 2);
      const hud = await audit(owner, false);
      await owner.screenshot({ path: path.join(output, `${label}-hud.png`) });
      await clickUser(owner, "#btn-loan-debts");
      await owner.locator("#loan-debt-modal:not(.hidden)").waitFor();
      const grace = await audit(owner, true);
      assert.equal(await owner.locator(".loan-debt-row button:disabled").count(), 1);
      await owner.screenshot({ path: path.join(output, `${label}-grace.png`) });

      const finishForOwner = () => {
        room.players.find((p) => p !== player).status = "folded";
        app.gameEngine.settleByFold(room);
        app.gameEngine.abortPendingRoomWork(room); // Keep the end window open for screenshot/user input.
      };
      const startNextHand = () => {
        app.gameEngine.startHand(room);
        app.gameEngine.clearActionTimer(room);
      };
      const completeGrace = () => {
        finishForOwner(); startNextHand(); // Borrowing hand -> grace hand 1.
        finishForOwner(); startNextHand(); // Grace hand 1 -> grace hand 2.
        player.skillRuntime.abyssEnergy = 5;
        finishForOwner(); // All settlement resources are now available, without default.
      };
      // Real settlement/start boundaries; no client-created debt or deadline changes.
      // High covers interest waived then default; Low covers ordinary default.
      if (quality === "high") loanState.adjustLoanInterest(player.skillRuntime);
      await owner.keyboard.press("Escape");
      completeGrace();
      await owner.locator("#hand-settle-modal:not(.hidden)").waitFor();
      await clickUser(owner, "#settle-loan");
      await owner.waitForFunction(() => state.skillSelf.loan.state === "DEBT_OPEN" && state.skillSelf.loan.tranches.every((d) => d.graceHandsRemaining === 0));
      assert(player.skillRuntime.loanDebts.every((d) => !d.defaultApplied && d.penalty === 0));
      assert.equal(player.skillRuntime.abyssEnergy, 6);
      const finalWindow = await audit(owner, true);
      assert.match(finalWindow.text, locale === "zh-CN" ? /最后偿还窗口/ : /Final repayment window/);
      await owner.screenshot({ path: path.join(output, `${label}-final-window.png`) });
      await owner.keyboard.press("Escape");
      startNextHand();
      await owner.locator("#screen-game.active").waitFor();
      await owner.locator("#hand-settle-modal").waitFor({ state: "hidden" });
      await clickUser(owner, "#btn-loan-debts");
      await owner.waitForFunction(() => state.skillSelf.loan.state === "DEFAULTED");
      const defaulted = await audit(owner, true);
      assert.match(defaulted.text, locale === "zh-CN" ? /违约/ : /default/i);
      if (locale === "en-US") assert.equal(/[\u4e00-\u9fff]/.test(defaulted.text), false);
      await owner.screenshot({ path: path.join(output, `${label}-defaulted.png`) });
      await owner.keyboard.press("Escape");
      await owner.locator("#loan-debt-modal").waitFor({ state: "hidden" });
      const lockedHud = await audit(owner, false);
      assert.match(lockedHud.text, locale === "zh-CN" ? /贷款锁定/ : /Loan locked/);
      await owner.screenshot({ path: path.join(output, `${label}-locked-hud.png`) });
      await clickUser(owner, "#btn-loan-debts");
      await owner.locator("#loan-debt-modal:not(.hidden)").waitFor();
      const chipDebt = player.skillRuntime.loanDebts.find((d) => d.kind === "chip");
      const chipsAtDefault = room.players.map((p) => p.chips);
      await clickUser(owner, `.loan-debt-row[data-debt-id="${chipDebt.id}"] button`);
      await owner.waitForFunction(() => state.skillSelf.loan.tranches.length === 1);
      assert.equal(player.chips, chipsAtDefault[index] - chipDebt.amount);
      assert.equal(room.players[1 - index].chips, chipsAtDefault[1 - index] + chipDebt.amount);
      assert.equal(loanState.getLoanCreditState(player.skillRuntime), "DEFAULTED");
      assert.equal(player.skillRuntime.loanTotalUsesThisHand, 0);
      skillState.gainEnergy(player, 8);
      app.gameEngine.skillEngine.broadcastSkillState(room);
      await owner.waitForFunction(() => state.skillSelf.loan.tranches[0].canRepay);
      const amount = player.skillRuntime.loanDebts[0].amount;
      const before = { current: room.currentPlayerIndex, turn: room.turnId, deadline: room.actionDeadline, events: player.skillRuntime.skillEventsThisHand };
      await clickUser(owner, ".loan-debt-row button");
      await owner.waitForFunction(() => state.skillSelf.loan.state === "AVAILABLE");
      assert.equal(player.skillRuntime.abyssEnergy, 8 - amount);
      assert.deepEqual(player.skillRuntime.loanDebts, []);
      assert.equal(player.skillRuntime.loanTotalUsesThisHand, 0);
      assert.deepEqual({ current: room.currentPlayerIndex, turn: room.turnId, deadline: room.actionDeadline, events: player.skillRuntime.skillEventsThisHand }, before);
      await clickUser(owner, "#btn-loan-close");
      await owner.locator("#loan-debt-modal").waitFor({ state: "hidden" });
      assert.equal(await owner.locator("#btn-loan-debts").isVisible(), false);
      const total = room.players.reduce((sum, p) => sum + p.chips, room.pot);
      assert.equal(total, 2000);
      // A fresh secret loan: actually repay using N+2's final +1, from settlement UI.
      player.skillRuntime.abyssEnergy = 4;
      room.currentPlayerIndex = room.players.indexOf(player);
      app.gameEngine.skillEngine.broadcastSkillState(room);
      app.gameEngine.emitTurn(room);
      app.gameEngine.clearActionTimer(room);
      await owner.waitForFunction(() => document.querySelector('[data-skill-use-id="LOAN"]')?.disabled === false);
      await clickUser(owner, '[data-skill-use-id="LOAN"]');
      await owner.locator("#skill-choice-body .skill-choice-card").filter({ hasText: locale === "zh-CN" ? "能量贷款" : "Energy Loan" }).click();
      await owner.click("#btn-skill-choice-confirm");
      await owner.waitForFunction(() => state.skillSelf.loan.tranches.length === 1);
      completeGrace();
      // Exercise the real offline timer and token restore, not a held fixture
      // window: the UI must receive END and let a user click Repay in time.
      const resumedHandNo = room.handNo;
      app.gameEngine.finalizeHand(room);
      await owner.evaluate(() => socket.disconnect());
      await opponent.waitForFunction((handNo) => state.phase === "waiting" && state.handNo === handNo, resumedHandNo);
      assert.equal(room.phase, "waiting");
      assert.equal(player.skillRuntime.loanDebts[0].defaultApplied, false);
      await owner.evaluate(() => socket.connect());
      await owner.waitForFunction((handNo) => state.phase === "end" && state.handNo === handNo
        && state.skillSelf?.loan?.tranches[0]?.canRepay, resumedHandNo);
      await owner.locator("#hand-settle-modal:not(.hidden)").waitFor();
      await clickUser(owner, "#settle-loan");
      await owner.waitForFunction(() => state.skillSelf.loan.tranches[0]?.canRepay && state.skillSelf.loan.tranches[0]?.graceHandsRemaining === 0);
      const finalDebt = player.skillRuntime.loanDebts[0];
      assert.equal(finalDebt.amount, 6);
      assert.equal(finalDebt.defaultApplied, false);
      const opponentPlayer = room.players.find((p) => p !== player);
      const publicEnergy = () => app.gameEngine.getRoomSnapshot(room, opponentPlayer).players.find((p) => p.playerId === player.playerId).skills.abyssEnergy;
      assert.equal(publicEnergy(), 6);
      await clickUser(owner, ".loan-debt-row button");
      await owner.waitForFunction(() => state.skillSelf.loan.state === "AVAILABLE");
      assert.equal(player.skillRuntime.abyssEnergy, 0);
      assert.equal(publicEnergy(), 6);
      assert.equal(await opponent.evaluate((id) => JSON.stringify(window.loanQaPackets).includes(id), finalDebt.id), false);
      await clickUser(owner, "#btn-loan-close");
      assert.equal(app.gameEngine.startHand(room), false); // Cannot cut the resumed window short.
      await opponent.waitForFunction((id) => state.phase === "pre_flop" && state.players.find((p) => p.playerId === id)?.skills?.abyssEnergy === 0, player.playerId);
      app.gameEngine.clearActionTimer(room);
      assert.equal(room.handNo, resumedHandNo + 1);
      assert.equal(finalDebt.defaultApplied, false);
      assert.equal(publicEnergy(), 0);
      report.scenarios.push({ label, hud, lockedHud, grace, finalWindow, defaulted, repayment: "PASS", finalWindowRepayment: "PASS", waitingReconnectRepayment: "PASS", boundarySnapshot: "PASS", secrecy: "PASS", conserved: total });
    } finally {
      if (room) app.gameEngine.closeRoom(room, "verification_complete");
      for (const context of contexts) await context.close();
    }
  }
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.requestErrors, []);
  report.passed = true;
} finally {
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolve) => app.io.close(resolve));
  if (app.httpServer.listening) await new Promise((resolve) => app.httpServer.close(resolve));
}
console.log(JSON.stringify({ passed: report.passed, scenarios: report.scenarios.length, consoleErrors: report.consoleErrors, requestErrors: report.requestErrors, output }));
