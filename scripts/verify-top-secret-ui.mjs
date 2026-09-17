import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import runtime from "./playwright-runtime.js";
import lobby from "./lobby-test-helpers.js";
import server from "../server/server.js";

const output = path.join(os.tmpdir(), "overlimit-top-secret-qa");
const app = server.createAppServer({ matchmakingAutoStart: false });
await new Promise((resolve) => app.httpServer.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${app.httpServer.address().port}`;
const browser = await chromium.launch(runtime.chromiumLaunchOptions({ headless: true }));
const report = { scenarios: [], consoleErrors: [], requestErrors: [] };
await fs.mkdir(output, { recursive: true });
const selector = '.top-secret-guard';

async function audit(page, expected, reduced = false) {
  await page.waitForFunction((state) => document.querySelector('.top-secret-guard')?.dataset.guard === state, expected);
  await page.evaluate(async () => { await document.fonts.ready; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
  const result = await page.locator(selector).evaluate((button) => {
    const r = button.getBoundingClientRect(), actions = document.querySelector('.action-dock').getBoundingClientRect();
    const p = getComputedStyle(button, '::after');
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const label = button.querySelector('.secret-guard-label');
    return { text: button.textContent, aria: button.getAttribute('aria-label'), disabled: button.disabled,
      on: button.dataset.on, lock: Boolean(button.querySelector('svg')), animation: p.animationName,
      rect: r.toJSON(), hit: Boolean(hit && button.contains(hit)),
      inside: r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1,
      overlapsActions: r.left < actions.right && r.right > actions.left && r.top < actions.bottom && r.bottom > actions.top,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      textOverflow: label.scrollWidth > label.clientWidth + 1 || label.getBoundingClientRect().bottom > r.bottom,
      centralSecretFx: Boolean(document.querySelector('.skill-effect-instance[data-skill="TOP_SECRET"]')) };
  });
  assert.equal(result.inside, true, JSON.stringify(result));
  assert.equal(result.hit, true, JSON.stringify(result));
  assert.ok(result.rect.height >= (page.viewportSize().width < 600 ? 44 : 36), JSON.stringify(result));
  assert.equal(result.overlapsActions, false);
  assert.equal(result.overflowX, false);
  assert.equal(result.textOverflow, false, JSON.stringify(result));
  assert.equal(result.centralSecretFx, false);
  assert.equal(result.disabled, expected !== 'ARMED');
  assert.equal(result.lock, expected !== 'ARMED');
  assert.equal(result.on, String(expected !== 'DISARMED_LOCKED'));
  assert.equal(result.animation, reduced || expected === 'DISARMED_LOCKED' ? 'none' : 'secret-guard-flow');
  return result;
}

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 700 }]) {
    for (const locale of ['zh-CN', 'en-US']) for (const quality of ['high', 'low']) {
      const contexts = []; let room;
      const label = `${viewport.width}x${viewport.height}-${locale}-${quality}`;
      try {
        const pages = [];
        for (let i = 0; i < 2; i++) {
          const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
          contexts.push(context);
          await context.addInitScript(({ locale, quality, i }) => {
            localStorage.setItem('abyss_ui_settings_v2', JSON.stringify({ language: locale, languageChosen: true, animation: quality }));
            localStorage.setItem('abyss_skill_loadout_v2', JSON.stringify(i === 0 ? ['TOP_SECRET', 'DEEP_BREATH', 'PROBE', 'ALERT'] : ['INTEL_ONE', 'PROBE']));
            localStorage.setItem('overlimit_quickstart_v1', 'seen');
          }, { locale, quality, i });
          const page = await context.newPage(); pages.push(page);
          page.on('pageerror', (e) => report.consoleErrors.push({ label, message: e.message }));
          page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push({ label, message: m.text() }); });
          page.on('requestfailed', (r) => report.requestErrors.push({ label, url: r.url(), message: r.failure()?.errorText }));
          await page.goto(base, { waitUntil: 'networkidle' });
          await page.waitForFunction(() => socket.connected && state.skillCatalog.length === 33);
        }
        const [owner, opponent] = pages;
        await lobby.startLobbyAction(owner, 'standard', 'abyss', 'create');
        await owner.waitForFunction(() => Boolean(state.roomId));
        const roomId = await owner.evaluate(() => state.roomId);
        room = app.roomManager.rooms.get(roomId);
        await opponent.click('#btn-open-join'); await opponent.fill('#input-room', roomId); await opponent.click('#btn-join');
        await Promise.all(pages.map((p) => p.locator('#screen-game.active').waitFor()));
        app.gameEngine.clearActionTimer(room); // Fixture clock only; production disarm never changes it.
        const player = room.players.find((p) => p.playerId === room.players[0].playerId);
        const other = room.players.find((p) => p !== player);
        room.currentPlayerIndex = room.players.indexOf(other);
        await opponent.evaluate(() => { window.guardPackets = []; socket.onAny((event, payload) => guardPackets.push({ event, payload })); });
        const armed = await audit(owner, 'ARMED');
        await owner.screenshot({ path: path.join(output, `${label}-armed.png`) });
        const geometry = armed.rect.height;
        const clock = [room.currentPlayerIndex, room.turnId, room.actionDeadline];
        await owner.locator(selector).click();
        const off = await audit(owner, 'DISARMED_LOCKED');
        assert.deepEqual([room.currentPlayerIndex, room.turnId, room.actionDeadline], clock);
        assert.equal(player.skillRuntime.abyssEnergy, 4);
        assert.equal(off.rect.height, geometry);
        await owner.screenshot({ path: path.join(output, `${label}-off.png`) });
        assert.equal(await opponent.locator(selector).count(), 0);
        other.status = 'folded';
        app.gameEngine.settleByFold(room);
        app.gameEngine.startHand(room); app.gameEngine.clearActionTimer(room);
        await audit(owner, 'ARMED');
        room.currentPlayerIndex = room.players.indexOf(other);
        other.skillRuntime.abyssEnergy = 8;
        app.gameEngine.skillEngine.broadcastSkillState(room);
        await opponent.evaluate(() => socket.emit('skill:use', {
          skillId: 'INTEL_ONE', target: { zone: 'opponent' }, requestId: 'ui-guard-intrusion',
          handId: state.activeCommitment.handId, turnId: state.turnId, phase: state.phase,
        }));
        const active = await audit(owner, 'ACTIVE_LOCKED');
        assert.equal(active.rect.height, geometry);
        await owner.screenshot({ path: path.join(output, `${label}-active.png`) });
        await owner.emulateMedia({ reducedMotion: 'reduce' });
        const reduced = await audit(owner, 'ACTIVE_LOCKED', true);
        assert.equal(await opponent.evaluate(() => /TOP_SECRET|topSecret|绝密|Top Secret/.test(JSON.stringify(guardPackets))), false);
        report.scenarios.push({ label, armed, off, active, reduced });
        console.log(`PASS ${label}`);
      } finally {
        if (room) app.roomManager.destroyRoom(room.roomId);
        for (const context of contexts) await context.close();
      }
    }
  }
  assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.requestErrors, []);
} finally {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close(); await new Promise((resolve) => app.io.close(resolve));
}
console.log(JSON.stringify({ pass: report.scenarios.length, output }));
