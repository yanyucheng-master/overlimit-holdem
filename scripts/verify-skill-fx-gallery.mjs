import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import playwrightRuntime from "./playwright-runtime.js";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3002";
const CAPTURE_DIR = process.env.SKILL_FX_CAPTURE_DIR || "";
const EXPECTED_SKILLS = 23;
const EXPECTED_OPTIONS = EXPECTED_SKILLS + 1;

async function replaySelection(page, skillId) {
  await page.locator("#skill-fx-gallery-perspective").selectOption("self");
  await page.locator("#skill-fx-gallery-skill").selectOption(skillId);
  await page.locator("#btn-replay-skill-fx").click();
  const expectedProfileId = skillId.startsWith("PROTOCOL_") ? "PROTOCOL_SHOWDOWN" : skillId;
  const instance = page.locator(`#skill-fx-gallery-effect-layer .skill-effect-instance[data-skill="${expectedProfileId}"]`);
  await instance.waitFor({ state: "attached", timeout: 1500 });
  return instance.evaluate((node) => ({
    skill: node.dataset.skill,
    family: node.dataset.effect,
    tier: node.dataset.tier,
    quality: node.dataset.quality,
    motion: node.dataset.motion,
    atomCount: node.querySelectorAll(".skill-effect-core > *, .skill-effect-particles > *, .skill-effect-route > *").length,
    rect: (() => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    })(),
  }));
}

async function main() {
  const browser = await chromium.launch(playwrightRuntime.chromiumLaunchOptions({ headless: true }));
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem("overlimit_quickstart_v1", "seen");
    localStorage.setItem("overlimit_audio_enabled", "false");
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const externalConsoleErrors = [];
  const requestErrors = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    const entry = location?.url ? `${message.text()} @ ${location.url}` : message.text();
    if (!location?.url || location.url.startsWith(BASE)) consoleErrors.push(entry);
    else externalConsoleErrors.push(entry);
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(BASE)) {
      requestErrors.push(`${request.failure()?.errorText || "request failed"} @ ${request.url()}`);
    }
  });

  await page.goto(`${BASE}/?skillfx=gallery`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#skill-fx-gallery-modal:not(.hidden)", { timeout: 10000 });

  const optionIds = await page.locator("#skill-fx-gallery-skill option").evaluateAll((options) => (
    options.map((option) => option.value)
  ));
  const effects = [];
  for (const skillId of optionIds) effects.push(await replaySelection(page, skillId));

  const secrecy = await page.evaluate(() => {
    const gallery = window.OverlimitSkillFxGallery;
    gallery.manager.clear();
    const before = document.querySelectorAll("#skill-fx-gallery-effect-layer .skill-effect-instance").length;
    const accepted = gallery.manager.play({
      eventId: "verify:opponent-secret",
      skillId: "DEEP_BREATH",
      audience: "opponent",
      disclosure: "secret",
      casterId: "CASTER",
      viewerId: "VIEWER",
      safeMessage: "MUST NOT RENDER",
    });
    return {
      accepted,
      before,
      after: document.querySelectorAll("#skill-fx-gallery-effect-layer .skill-effect-instance").length,
      publicVisible: !document.getElementById("skill-fx-gallery-public").classList.contains("hidden"),
      privateVisible: !document.getElementById("skill-fx-gallery-private").classList.contains("hidden"),
      status: document.getElementById("skill-fx-gallery-status-text").textContent,
    };
  });

  const dedupe = await page.evaluate(() => {
    const gallery = window.OverlimitSkillFxGallery;
    gallery.manager.clear();
    const event = {
      eventId: "verify:dedupe",
      skillId: "FAIRNESS",
      audience: "public",
      disclosure: "public",
      casterId: "CASTER",
      viewerId: "VIEWER",
    };
    return [gallery.manager.play(event), gallery.manager.play(event)];
  });

  await page.locator("#skill-fx-gallery-quality").selectOption("low");
  await page.locator("#skill-fx-gallery-reduced").check();
  await page.locator("#skill-fx-gallery-skill").selectOption("BLOOD_BATTLE");
  await page.locator("#btn-replay-skill-fx").click();
  const degraded = await page.locator("#skill-fx-gallery-effect-layer .skill-effect-instance[data-skill=BLOOD_BATTLE]").evaluate((node) => ({
    nodeQuality: node.dataset.quality,
    nodeMotion: node.dataset.motion,
    layerQuality: node.parentElement.dataset.fxQuality,
    layerMotion: node.parentElement.dataset.fxMotion,
    bodyShakes: document.body.classList.contains("skill-fx-shake-soft"),
    animationDuration: getComputedStyle(node).animationDuration,
  }));

  const pointerSafety = await page.evaluate(() => ({
    effectLayer: getComputedStyle(document.getElementById("skill-effect-layer")).pointerEvents,
    stateLayer: getComputedStyle(document.getElementById("skill-state-layer")).pointerEvents,
    galleryLayer: getComputedStyle(document.getElementById("skill-fx-gallery-effect-layer")).pointerEvents,
  }));

  await page.locator("#skill-fx-gallery-quality").selectOption("high");
  await page.locator("#skill-fx-gallery-reduced").uncheck();
  await page.locator("#skill-fx-gallery-perspective").selectOption("self");
  await page.locator("#skill-fx-gallery-skill").selectOption("DEEP_BREATH");
  await page.locator("#btn-replay-skill-fx").click();
  await page.waitForTimeout(300);
  const anchorAudit = await page.evaluate(() => {
    const layer = document.getElementById("skill-fx-gallery-effect-layer");
    const node = layer.querySelector('[data-skill="DEEP_BREATH"]');
    const core = node?.querySelector(".skill-effect-core");
    const energy = document.querySelector('[data-fx-gallery-anchor="energy"]');
    const layerRect = layer.getBoundingClientRect();
    const energyRect = energy.getBoundingClientRect();
    const coreRect = core?.getBoundingClientRect();
    return {
      expectedX: energyRect.left + energyRect.width / 2 - layerRect.left,
      expectedY: energyRect.top + energyRect.height / 2 - layerRect.top,
      actualX: Number.parseFloat(node?.style.getPropertyValue("--fx-x")),
      actualY: Number.parseFloat(node?.style.getPropertyValue("--fx-y")),
      coreOpacity: core ? Number.parseFloat(getComputedStyle(core).opacity) : -1,
      coreAnimation: core ? getComputedStyle(core).animationName : "",
      coreRect: coreRect ? { left: coreRect.left, top: coreRect.top, width: coreRect.width, height: coreRect.height } : null,
    };
  });

  await page.locator("#skill-fx-gallery-skill").selectOption("BLOOD_BATTLE");
  await page.locator("#btn-replay-skill-fx").click();
  await page.waitForTimeout(100);
  const broadcastAudit = await page.evaluate(() => {
    const stage = document.getElementById("skill-fx-gallery-stage").getBoundingClientRect();
    const broadcast = document.getElementById("skill-fx-gallery-public").getBoundingClientRect();
    return {
      left: broadcast.left - stage.left,
      top: broadcast.top - stage.top,
      width: broadcast.width,
      height: broadcast.height,
      stageWidth: stage.width,
      stageHeight: stage.height,
    };
  });

  const captures = [];
  if (CAPTURE_DIR) {
    fs.mkdirSync(CAPTURE_DIR, { recursive: true });
    for (const skillId of ["DEEP_BREATH", "BLOOD_BATTLE", "NULLIFICATION", "DESTINY", "PROTOCOL_PAIR"]) {
      await page.locator("#skill-fx-gallery-skill").selectOption(skillId);
      await page.locator("#btn-replay-skill-fx").click();
      const expectedProfileId = skillId.startsWith("PROTOCOL_") ? "PROTOCOL_SHOWDOWN" : skillId;
      await page.locator(`#skill-fx-gallery-effect-layer .skill-effect-instance[data-skill="${expectedProfileId}"]`)
        .waitFor({ state: "attached", timeout: 1500 });
      await page.waitForTimeout(300);
      const capturePath = path.join(CAPTURE_DIR, `${skillId.toLowerCase()}.png`);
      await page.locator("#skill-fx-gallery-stage").screenshot({ path: capturePath });
      captures.push(capturePath);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  const mobile = await page.evaluate(() => {
    const panel = document.querySelector(".skill-fx-gallery-panel").getBoundingClientRect();
    const stage = document.getElementById("skill-fx-gallery-stage").getBoundingClientRect();
    return {
      panelInsideViewport: panel.left >= -1 && panel.right <= innerWidth + 1 && panel.top >= -1 && panel.bottom <= innerHeight + 1,
      stageInsidePanel: stage.left >= panel.left - 1 && stage.right <= panel.right + 1,
      pageHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      replayUsable: document.getElementById("btn-replay-skill-fx").getBoundingClientRect().height >= 40,
    };
  });
  if (CAPTURE_DIR) {
    const mobilePath = path.join(CAPTURE_DIR, "mobile-gallery.png");
    await page.locator(".skill-fx-gallery-panel").screenshot({ path: mobilePath });
    captures.push(mobilePath);
  }

  await browser.close();

  const failures = [];
  if (optionIds.length !== EXPECTED_OPTIONS) failures.push(`gallery option count is ${optionIds.length}, expected ${EXPECTED_OPTIONS}`);
  if (new Set(optionIds).size !== EXPECTED_OPTIONS) failures.push("gallery contains duplicate skill options");
  if (optionIds.includes("ENDGAME")) failures.push("protected Endgame leaked into gallery");
  if (effects.length !== EXPECTED_OPTIONS) failures.push("not every skill/profile rendered");
  effects.forEach((effect) => {
    if (!effect.family || !effect.tier || effect.atomCount < 12) failures.push(`incomplete effect node: ${effect.skill}`);
    if (effect.rect.width <= 0 || effect.rect.height <= 0) failures.push(`zero-size effect node: ${effect.skill}`);
  });
  if (secrecy.accepted || secrecy.after !== secrecy.before || secrecy.publicVisible || secrecy.privateVisible) {
    failures.push("opponent secret event produced a visual side channel");
  }
  if (!secrecy.status.includes("SUPPRESSED")) failures.push("gallery did not report secret suppression");
  if (dedupe[0] !== true || dedupe[1] !== false) failures.push("duplicate event was not suppressed");
  if (degraded.nodeQuality !== "low" || degraded.layerQuality !== "low") failures.push("low quality did not reach effect layer");
  if (degraded.nodeMotion !== "reduced" || degraded.layerMotion !== "reduced") failures.push("reduce motion did not reach effect layer");
  if (degraded.bodyShakes) failures.push("reduce motion still triggered table shake");
  if (Object.values(pointerSafety).some((value) => value !== "none")) failures.push("effect layer blocks pointer input");
  if (Math.abs(anchorAudit.expectedX - anchorAudit.actualX) > 2 || Math.abs(anchorAudit.expectedY - anchorAudit.actualY) > 2) {
    failures.push("Deep Breath did not resolve to the energy anchor");
  }
  if (anchorAudit.coreOpacity <= 0) failures.push("Deep Breath core is invisible at its visual peak");
  if (broadcastAudit.width > 500 || broadcastAudit.height > 90 || broadcastAudit.top < 0
    || broadcastAudit.left < 0 || broadcastAudit.left + broadcastAudit.width > broadcastAudit.stageWidth + 1) {
    failures.push("public skill broadcast is oversized or clipped");
  }
  if (!mobile.panelInsideViewport || !mobile.stageInsidePanel || mobile.pageHorizontalOverflow || !mobile.replayUsable) {
    failures.push("mobile gallery layout or controls failed");
  }
  if (consoleErrors.length) failures.push("browser console errors");
  if (requestErrors.length) failures.push("same-origin resource requests failed");

  console.log(JSON.stringify({
    ok: failures.length === 0,
    failures,
    consoleErrors,
    externalConsoleErrors,
    requestErrors,
    report: { optionCount: optionIds.length, effects, secrecy, dedupe, degraded, pointerSafety, anchorAudit, broadcastAudit, mobile, captures },
  }, null, 2));
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
