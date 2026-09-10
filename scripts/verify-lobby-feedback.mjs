import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import runtime from "./playwright-runtime.js";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3002";
const OUTPUT = path.resolve(process.env.LOBBY_FEEDBACK_DIR || "artifacts/lobby-feedback");
const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 700 }];
const report = { ok: false, cases: [], screenshots: [], videos: [], failures: [] };

async function stable(page) {
  await page.waitForFunction(() => {
    const panels = [...document.querySelectorAll(".screen.active, [data-ui-modal], [data-ui-modal] > .modal-panel")];
    return panels.every((panel) => !panel.getAnimations().some((animation) => animation.playState === "running"))
      && !document.querySelector(".ui-releasing, .ui-confirming");
  });
}

async function capture(page, name) {
  await stable(page);
  const file = path.join(OUTPUT, name + ".png");
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push(file);
}

async function layout(page) {
  const result = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > innerWidth + 1,
    vertical: document.documentElement.scrollHeight > innerHeight + 1,
    bodyHorizontal: document.body.scrollWidth > innerWidth + 1,
  }));
  assert.deepEqual(result, { horizontal: false, vertical: false, bodyHorizontal: false });
}

async function press(page, selector, quality, { pointSelector = null, kind = "control" } = {}) {
  const target = page.locator(selector);
  await target.scrollIntoViewIfNeeded();
  await stable(page);
  const before = await target.boundingBox();
  const point = pointSelector ? await target.locator(pointSelector).boundingBox() : before;
  const x = point.x + point.width / 2;
  const y = point.y + point.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForFunction(({ selector, quality, kind }) => {
    const node = document.querySelector(selector);
    const paint = node.querySelector(":scope > .ui-feedback-surface");
    if (!node.classList.contains("ui-pressed") || !paint) return false;
    const scale = Number(getComputedStyle(paint).scale);
    return quality === "low" ? scale === 1 : Math.abs(scale - (kind === "control" ? .97 : .985)) < .002;
  }, { selector, quality, kind });
  const during = await target.boundingBox();
  for (const key of ["x", "y", "width", "height"]) assert.ok(Math.abs(before[key] - during[key]) < .1, `moving hit target: ${selector} ${key}`);
  const hit = await target.evaluate((node, point) => node.contains(document.elementFromPoint(point.x, point.y)), { x, y });
  assert.equal(hit, true, `covered hit target: ${selector}`);
  if (kind === "control") {
    assert.equal(await target.evaluate((node) => Boolean(node.parentElement.closest(".protocol-card")?.classList.contains("ui-pressed"))), false, "nested button also pressed its parent card");
  }
  await page.mouse.up();
  return { stableTarget: true, quality, scale: quality === "low" ? 1 : kind === "control" ? .97 : .985 };
}

async function modalFocusLoop(page, selector) {
  const result = await page.locator(selector).evaluate((modal) => {
    const items = [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
      .filter((node) => node.getClientRects().length > 0 && !node.closest("[inert]"));
    window.__feedbackFocus = { first: items[0], last: items.at(-1) };
    items[0].focus();
    return { inert: modal.inert, backgroundInert: document.getElementById("main-content").inert, count: items.length };
  });
  assert.equal(result.inert, false);
  assert.equal(result.backgroundInert, true);
  assert.ok(result.count > 1);
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.evaluate(() => document.activeElement === window.__feedbackFocus.last), true);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement === window.__feedbackFocus.first), true);
}

async function exercise(page, sample) {
  const { quality, locale, viewport, name } = sample;
  const evidence = { name, viewport, quality, locale };
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.getElementById("connection-banner").classList.contains("hidden"));
  assert.equal(await page.locator(".protocol-btn").count(), 12);
  await layout(page);
  await capture(page, `${name}-lobby`);

  const card = '.protocol-card[data-game-mode="overdrive"][data-skill-mode="off"]';
  evidence.cardPress = await press(page, card, quality, { pointSelector: ":scope > strong", kind: "card" });
  assert.equal(await page.locator(card).getAttribute("aria-current"), "true");
  const cancelled = '.protocol-card[data-game-mode="standard"][data-skill-mode="off"]';
  const start = await page.locator(cancelled).locator(":scope > strong").boundingBox();
  await page.mouse.move(start.x + 15, start.y + 8);
  await page.mouse.down();
  await page.mouse.move(2, 2);
  await page.mouse.move(start.x + 15, start.y + 8);
  await page.mouse.up();
  assert.equal(await page.locator(card).getAttribute("aria-current"), "true", "cancelled drag selected another mode");
  assert.equal(await page.locator(".ui-pressed").count(), 0);
  evidence.cancelledDrag = true;

  // Native text editing and copy selection remain available inside the lobby.
  await page.locator("#input-name").fill("Feedback QA");
  await page.locator("#input-name").press("ControlOrMeta+A");
  assert.equal(await page.locator("#input-name").evaluate((input) => input.selectionEnd - input.selectionStart), 11);
  await page.locator("#input-name").press("ArrowRight");
  assert.equal(await page.locator("#brand-title").evaluate((node) => getComputedStyle(node).userSelect), "none");
  const title = await page.locator("#brand-title").boundingBox();
  await page.mouse.move(title.x + 2, title.y + title.height / 2);
  await page.mouse.down();
  await page.mouse.move(title.x + title.width - 2, title.y + title.height / 2, { steps: 6 });
  await page.mouse.up();
  assert.equal(await page.evaluate(() => String(getSelection())), "", "lobby title can still be drag-selected");
  evidence.labEntry = await press(page, "#btn-open-skill-lab", quality);
  await page.waitForSelector("#screen-skill-lab.active");
  await page.waitForFunction(() => document.querySelectorAll("#skill-lab-catalog .skill-card").length > 0);
  await stable(page);
  await layout(page);

  const skillCard = page.locator("#skill-lab-catalog .skill-card").nth(3);
  assert.equal(await skillCard.evaluate((node) => getComputedStyle(node).borderRadius), "16px");
  const skillId = await skillCard.getAttribute("data-skill-id");
  const choose = skillCard.locator(".skill-card-select");
  await choose.scrollIntoViewIfNeeded();
  await choose.focus();
  const before = await skillCard.evaluate((node) => {
    window.__feedbackCard = node;
    return { scroll: document.getElementById("skill-lab-catalog").scrollTop, selected: node.classList.contains("selected") };
  });
  await page.keyboard.press("Space");
  await page.waitForFunction((id) => document.querySelector(`#skill-lab-catalog [data-skill-id="${id}"] .skill-card-select`).getAttribute("aria-pressed") === "true", skillId);
  evidence.cardReuse = await skillCard.evaluate((node) => ({
    sameNode: node === window.__feedbackCard,
    focused: document.activeElement === node.querySelector(".skill-card-select"),
    scroll: document.getElementById("skill-lab-catalog").scrollTop,
    selectedCount: document.querySelectorAll("#skill-lab-catalog .skill-card.selected").length,
  }));
  assert.equal(evidence.cardReuse.sameNode, true);
  assert.equal(evidence.cardReuse.focused, true);
  assert.equal(evidence.cardReuse.selectedCount, 1, "one key press must toggle exactly once");
  assert.ok(Math.abs(evidence.cardReuse.scroll - before.scroll) <= 1, "selection moved catalog scroll");
  await capture(page, `${name}-lab`);

  await skillCard.locator(".skill-zoom-button").click();
  await modalFocusLoop(page, "#skill-preview-modal");
  assert.equal(await page.locator("#skill-preview-description").evaluate((node) => getComputedStyle(node).userSelect), "text");
  await page.keyboard.press("Escape");
  await page.locator("#skill-preview-modal").waitFor({ state: "hidden" });
  assert.equal(await skillCard.locator(".skill-zoom-button").evaluate((node) => document.activeElement === node), true);
  await page.locator('[data-skill-filter="resource"]').click();
  assert.equal(await page.locator("#skill-lab-catalog").evaluate((node) => node.scrollTop), 0);
  await page.locator('[data-skill-filter="all"]').click();
  assert.equal(await page.locator(`[data-skill-id="${skillId}"]`).evaluate((node) => node === window.__feedbackCard), true);
  await page.keyboard.press("Escape");
  await page.waitForSelector("#screen-auth.active");
  await stable(page);
  assert.equal(await page.locator("#btn-open-skill-lab").evaluate((node) => document.activeElement === node), true);

  await page.locator("#btn-settings").click();
  await modalFocusLoop(page, "#settings-modal");
  const clippedSettingCopy = await page.locator("#settings-modal").evaluate((modal) => [...modal.querySelectorAll(".settings-grid > .setting-row")].flatMap((row) => {
    const bounds = row.getBoundingClientRect();
    return [...row.querySelectorAll(":scope > span:not(.ui-feedback-surface) > strong, :scope > span:not(.ui-feedback-surface) > small")]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1;
      }).map((node) => node.textContent);
  }));
  assert.deepEqual(clippedSettingCopy, [], "setting text escaped its row");
  await page.locator("#settings-modal .settings-grid").evaluate((node) => { node.scrollTop = 0; });
  await capture(page, `${name}-settings`);
  const expected = quality === "low" ? .08 : .18;
  assert.equal(await page.locator("#settings-modal").evaluate((node) => parseFloat(getComputedStyle(node).transitionDuration)), expected);
  await page.locator("#btn-close-settings").click();
  // The close surface can still be painted, but is already inert and transparent to input.
  assert.equal(await page.locator("#settings-modal").evaluate((node) => node.inert), true);
  await page.locator("#btn-settings").click();
  await stable(page);
  assert.equal(await page.locator("#settings-modal").isVisible(), true);
  assert.equal(await page.locator("#settings-modal").evaluate((node) => node.inert), false);
  await page.keyboard.press("Escape");
  await page.locator("#settings-modal").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#btn-settings").evaluate((node) => document.activeElement === node), true);
  evidence.modalReversal = true;

  await page.locator("#btn-open-rules").click();
  await stable(page);
  assert.equal(await page.locator("#rules-article").evaluate((node) => getComputedStyle(node).userSelect), "text");
  await page.locator("#rules-search").fill(locale === "en-US" ? "energy" : "能量");
  assert.ok((await page.locator("#rules-search-results-list").textContent()).trim().length > 0);
  await page.keyboard.press("Escape");
  await page.locator("#rules-handbook-modal").waitFor({ state: "hidden" });

  await page.locator("#btn-open-quickstart").click();
  await stable(page);
  const shot = page.locator('[data-quickstart-page="1"] [data-quickstart-zoom]').first();
  await shot.click();
  await page.waitForFunction(() => document.getElementById("quickstart-image-expanded").complete);
  await stable(page);
  await modalFocusLoop(page, "#quickstart-image-modal");
  await page.locator("#btn-quickstart-image-zoom-in").click();
  const zoomed = await page.locator("#quickstart-image-expanded").evaluate((node) => getComputedStyle(node).transform);
  assert.notEqual(zoomed, "none");
  const stage = await page.locator("#quickstart-image-stage").boundingBox();
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width / 2 + 30, stage.y + stage.height / 2 + 16, { steps: 5 });
  await page.mouse.up();
  assert.equal(await page.locator(".ui-pressed").count(), 0);
  await page.keyboard.press("Escape");
  await page.locator("#quickstart-image-modal").waitFor({ state: "hidden" });
  assert.equal(await shot.evaluate((node) => document.activeElement === node), true);
  await page.locator("#btn-quickstart-next").click();
  await page.waitForFunction(() => document.querySelector('[data-quickstart-page="2"]').getAttribute("aria-hidden") === "false");
  await page.keyboard.press("Escape");
  await page.locator("#quickstart-modal").waitFor({ state: "hidden" });
  await layout(page);
  evidence.tutorialAndSelection = true;

  // One direct room action must reach the existing waiting-room flow once.
  const create = '.protocol-card[data-game-mode="standard"][data-skill-mode="off"] [data-room-action="create"]';
  evidence.nestedButton = await press(page, create, quality);
  await page.waitForSelector("#screen-wait.active");
  assert.ok((await page.locator("#wait-room-id").textContent()).trim().length >= 6);
  assert.equal(await page.locator("#screen-game [data-ui-feedback]").count(), 0);
  evidence.directEntry = true;
  return evidence;
}

async function touchScroll(browser) {
  const context = await browser.newContext({ viewport: viewports[1], isMobile: true, hasTouch: true, locale: "zh-CN" });
  try {
    await context.addInitScript(() => {
      localStorage.setItem("overlimit_quickstart_v1", "seen");
      localStorage.setItem("abyss_ui_settings_v2", JSON.stringify({ animation: "high", language: "zh-CN", languageChosen: true, sfx: 0, music: 0 }));
    });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.locator("#btn-open-skill-lab").tap();
    await page.waitForFunction(() => document.querySelectorAll("#skill-lab-catalog .skill-card").length > 0);
    await stable(page);
    const catalog = await page.locator("#skill-lab-catalog").boundingBox();
    const cdp = await context.newCDPSession(page);
    const x = Math.round(catalog.x + catalog.width * .35);
    const y = Math.round(catalog.y + catalog.height * .7);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (const distance of [20, 60, 110, 170]) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - distance }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForFunction(() => document.getElementById("skill-lab-catalog").scrollTop > 10);
    assert.equal(await page.locator(".ui-pressed").count(), 0);
    assert.equal(await page.locator("#skill-lab-catalog .skill-card.selected").count(), 0);
    return { name: "touch-scroll-cancel", scrolled: true, accidentalSelection: false };
  } finally { await context.close(); }
}

await fs.mkdir(OUTPUT, { recursive: true });
const browser = await chromium.launch(runtime.chromiumLaunchOptions({ headless: true }));
try {
  for (const viewport of viewports) for (const locale of ["zh-CN", "en-US"]) for (const quality of ["high", "low"]) {
    const name = `${viewport.width}-${locale}-${quality}`;
    if (process.env.LOBBY_FEEDBACK_CASE && process.env.LOBBY_FEEDBACK_CASE !== name) continue;
    const record = viewport.width === 1440 && locale === "zh-CN" && quality === "high";
    const context = await browser.newContext({ viewport, locale, hasTouch: viewport.width < 500,
      ...(record ? { recordVideo: { dir: path.join(OUTPUT, "recordings"), size: viewport } } : {}) });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.addInitScript(({ quality, locale }) => {
      localStorage.setItem("overlimit_quickstart_v1", "seen");
      localStorage.setItem("abyss_ui_settings_v2", JSON.stringify({ animation: quality, language: locale, languageChosen: true, sfx: 0, music: 0 }));
    }, { quality, locale });
    try {
      const evidence = await exercise(page, { viewport, locale, quality, name });
      assert.deepEqual(errors, [], "browser errors");
      report.cases.push({ ...evidence, ok: true });
    } catch (error) {
      report.failures.push({ name, message: error.stack || String(error), errors });
      await page.screenshot({ path: path.join(OUTPUT, name + "-failure.png"), fullPage: true }).catch(() => {});
    } finally {
      const video = page.video();
      await context.close();
      if (video) {
        const file = path.join(OUTPUT, "interaction-desktop-high.webm");
        await video.saveAs(file);
        report.videos.push(file);
      }
    }
  }
  if (!process.env.LOBBY_FEEDBACK_CASE) {
    try { report.cases.push({ ...await touchScroll(browser), ok: true }); }
    catch (error) { report.failures.push({ name: "touch-scroll-cancel", message: error.stack || String(error) }); }
  }
  report.ok = report.failures.length === 0;
} finally {
  await browser.close();
  await fs.writeFile(path.join(OUTPUT, "report.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ ok: report.ok, cases: report.cases.length, failures: report.failures, screenshots: report.screenshots.length, videos: report.videos }));
if (!report.ok) process.exitCode = 1;
