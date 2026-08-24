import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import playwrightRuntime from "./playwright-runtime.js";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3002";
const CAPTURE_DIR = process.env.SKILL_FX_CAPTURE_DIR || "";
const EXPECTED_SKILLS = 23;
const EXPECTED_OPTIONS = EXPECTED_SKILLS + 1;
const REPRESENTATIVE_CAPTURES = [
  "DEEP_BREATH", "BLOOD_BATTLE", "FAIRNESS", "CHEAT", "NULLIFICATION",
  "DESTINY", "RESTART", "DISGUISE", "DEAD_END",
];

const profileIdFor = (skillId) => skillId.startsWith("PROTOCOL_") ? "PROTOCOL_SHOWDOWN" : skillId;

async function selectAndReplay(page, skillId, options = {}) {
  await page.locator("#skill-fx-gallery-perspective").selectOption(options.perspective || "self");
  await page.locator("#skill-fx-gallery-skill").selectOption(skillId);
  await page.locator("#skill-fx-gallery-target").selectOption(options.target || "profile");
  await page.locator("#skill-fx-gallery-variant").selectOption(options.variant || "default");
  if (options.disclosure) await page.locator("#skill-fx-gallery-disclosure").selectOption(options.disclosure);
  if (options.status) await page.locator("#skill-fx-gallery-status").selectOption(options.status);
  await page.locator("#btn-replay-skill-fx").click();
  const profileId = profileIdFor(skillId);
  const instance = page.locator(`#skill-fx-gallery-effect-layer .skill-effect-instance[data-skill="${profileId}"]`);
  await instance.waitFor({ state: "attached", timeout: 1800 });
  return instance;
}

async function inspectInstance(instance) {
  return instance.evaluate((node) => {
    const numberVar = (name) => Number.parseFloat(node.style.getPropertyValue(name));
    const core = node.querySelector(".skill-effect-core");
    const impact = node.querySelector(".skill-effect-impact");
    const route = node.querySelector(".skill-effect-route");
    const caption = node.querySelector(".skill-effect-caption");
    return {
      skill: node.dataset.skill,
      family: node.dataset.effect,
      tier: node.dataset.tier,
      impactType: node.dataset.impact,
      identity: node.dataset.identity,
      quality: node.dataset.quality,
      motion: node.dataset.motion,
      hasRoute: node.dataset.hasRoute,
      stageX: numberVar("--fx-stage-x"),
      stageY: numberVar("--fx-stage-y"),
      targetX: numberVar("--fx-target-x"),
      targetY: numberVar("--fx-target-y"),
      heroNodes: node.querySelectorAll(".skill-effect-core > *").length,
      particleNodes: node.querySelectorAll(".skill-effect-particles > *").length,
      impactNodes: node.querySelectorAll(".skill-effect-impact > *").length,
      routeNodes: node.querySelectorAll(".skill-effect-route > *").length,
      stageDisplay: getComputedStyle(node.querySelector(".skill-effect-stage")).display,
      coreDisplay: core ? getComputedStyle(core).display : "none",
      impactDisplay: impact ? getComputedStyle(impact).display : "none",
      routeDisplay: route ? getComputedStyle(route).display : "none",
      captionDisplay: caption ? getComputedStyle(caption).display : "none",
      captionText: caption?.textContent || "",
    };
  });
}

async function anchorAudit(page, skillId, expectedSelector, options = {}) {
  const instance = await selectAndReplay(page, skillId, options);
  return instance.evaluate((node, selector) => {
    const layer = node.parentElement;
    const stageAnchor = document.querySelector('[data-fx-gallery-anchor="stageCenter"]');
    const targetAnchor = document.querySelector(selector);
    const layerRect = layer.getBoundingClientRect();
    const stageRect = stageAnchor.getBoundingClientRect();
    const targetRect = targetAnchor.getBoundingClientRect();
    const stageX = Number.parseFloat(node.style.getPropertyValue("--fx-stage-x"));
    const stageY = Number.parseFloat(node.style.getPropertyValue("--fx-stage-y"));
    const targetX = Number.parseFloat(node.style.getPropertyValue("--fx-target-x"));
    const targetY = Number.parseFloat(node.style.getPropertyValue("--fx-target-y"));
    return {
      stageX,
      stageY,
      targetX,
      targetY,
      expectedStageX: stageRect.left + stageRect.width / 2 - layerRect.left,
      expectedStageY: stageRect.top + stageRect.height / 2 - layerRect.top,
      expectedTargetX: targetRect.left + targetRect.width / 2 - layerRect.left,
      expectedTargetY: targetRect.top + targetRect.height / 2 - layerRect.top,
      stageTargetDistance: Math.hypot(stageX - targetX, stageY - targetY),
      hasRoute: node.dataset.hasRoute,
      impactType: node.dataset.impact,
    };
  }, expectedSelector);
}

function isNear(actual, expected, tolerance = 2.5) {
  return Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= tolerance;
}

function auditMatchesAnchors(audit) {
  return isNear(audit.stageX, audit.expectedStageX)
    && isNear(audit.stageY, audit.expectedStageY)
    && isNear(audit.targetX, audit.expectedTargetX)
    && isNear(audit.targetY, audit.expectedTargetY);
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
    if (request.url().startsWith(BASE)) requestErrors.push(`${request.failure()?.errorText || "request failed"} @ ${request.url()}`);
  });

  await page.goto(`${BASE}/?skillfx=gallery`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#skill-fx-gallery-modal:not(.hidden)", { timeout: 10000 });

  const optionIds = await page.locator("#skill-fx-gallery-skill option").evaluateAll((options) => options.map((option) => option.value));
  const effects = [];
  for (const skillId of optionIds) effects.push(await inspectInstance(await selectAndReplay(page, skillId)));

  const stageAudits = {
    deepBreath: await anchorAudit(page, "DEEP_BREATH", '[data-fx-gallery-anchor="energy"]'),
    cheat: await anchorAudit(page, "CHEAT", '[data-fx-gallery-anchor="selfCards"]'),
    nullification: await anchorAudit(page, "NULLIFICATION", '[data-fx-gallery-anchor="river"]', { target: "river", variant: "board" }),
    loanEnergy: await anchorAudit(page, "LOAN", '[data-fx-gallery-anchor="energy"]', { variant: "energy" }),
    loanChip: await anchorAudit(page, "LOAN", '[data-fx-gallery-anchor="self"]', { variant: "chip" }),
    fairness: await anchorAudit(page, "FAIRNESS", "#skill-fx-gallery-stage"),
  };

  const secrecy = await page.evaluate(() => {
    const gallery = window.OverlimitSkillFxGallery;
    gallery.manager.clear();
    const before = document.querySelectorAll("#skill-fx-gallery-effect-layer .skill-effect-instance").length;
    const accepted = gallery.manager.play({
      eventId: "verify:opponent-secret", skillId: "DEEP_BREATH", audience: "opponent",
      disclosure: "secret", casterId: "CASTER", viewerId: "VIEWER", safeMessage: "MUST NOT RENDER",
    });
    return {
      accepted,
      before,
      after: document.querySelectorAll("#skill-fx-gallery-effect-layer .skill-effect-instance").length,
      publicVisible: !document.getElementById("skill-fx-gallery-public").classList.contains("hidden"),
      privateVisible: !document.getElementById("skill-fx-gallery-private").classList.contains("hidden"),
    };
  });

  const resultInstance = await selectAndReplay(page, "TOP_SECRET", {
    perspective: "opponent", disclosure: "result", status: "REVEALED",
  });
  const resultOnly = await resultInstance.evaluate((node) => ({
    identity: node.dataset.identity,
    caption: node.querySelector(".skill-effect-caption")?.textContent || "",
    title: node.querySelector(".skill-effect-title")?.textContent || "",
  }));

  const dedupeAndPriority = await page.evaluate(() => {
    const gallery = window.OverlimitSkillFxGallery;
    gallery.manager.clear();
    const event = { eventId: "verify:dedupe", skillId: "FAIRNESS", audience: "public", disclosure: "public", casterId: "CASTER", viewerId: "VIEWER" };
    const dedupe = [gallery.manager.play(event), gallery.manager.play(event)];
    const endgame = gallery.manager.play({ eventId: "verify:endgame", skillId: "ENDGAME", audience: "public", disclosure: "public", force: true });
    const restored = gallery.manager.play({ eventId: "verify:restored", skillId: "CHEAT", audience: "self", disclosure: "self", restored: true, force: true });
    const replay = gallery.manager.play({ eventId: "verify:replay", skillId: "CHEAT", audience: "self", disclosure: "self", replay: true, force: true });
    return { dedupe, endgame, restored, replay };
  });

  const directorInteractions = await page.evaluate(() => {
    const gallery = window.OverlimitSkillFxGallery;
    const common = {
      handNo: 44,
      context: "table",
      audience: "public",
      disclosure: "public",
      stageElement: document.querySelector('[data-fx-gallery-anchor="stageCenter"]'),
      targetElement: document.querySelector('[data-fx-gallery-anchor="pot"]'),
      force: true,
    };
    gallery.manager.clear();
    const bloodFirst = gallery.manager.play({ ...common, eventId: "verify:blood:a", skillId: "BLOOD_BATTLE", casterId: "A" });
    const bloodSecond = gallery.manager.play({ ...common, eventId: "verify:blood:b", skillId: "BLOOD_BATTLE", casterId: "B" });
    const bloodNode = document.querySelector("#skill-fx-gallery-effect-layer .skill-effect-instance");
    const blood = {
      accepted: [bloodFirst, bloodSecond],
      instances: document.querySelectorAll("#skill-fx-gallery-effect-layer .skill-effect-instance").length,
      variant: bloodNode?.dataset.variant || "",
      upgraded: bloodNode?.classList.contains("is-upgraded") || false,
      glyph: bloodNode?.querySelector(".skill-effect-glyph")?.textContent || "",
    };

    gallery.manager.clear();
    const cheat = gallery.manager.play({ ...common, audience: "self", disclosure: "self", eventId: "verify:counter:target", skillId: "CHEAT", casterId: "A" });
    const counter = gallery.manager.play({ ...common, audience: "self", disclosure: "self", eventId: "verify:counter:cut", skillId: "COUNTER", casterId: "B", tier: "FX3" });
    const active = document.querySelector("#skill-fx-gallery-effect-layer .skill-effect-instance");
    const counterCut = {
      accepted: [cheat, counter],
      targetFamily: active?.dataset.effect || "",
      cut: active?.classList.contains("is-counter-cut") || false,
      queuedCounter: gallery.manager.queue.some((job) => job.profile.id === "COUNTER"),
    };
    gallery.manager.clear();
    return { blood, counterCut };
  });

  const stateMarkers = await page.evaluate(() => {
    const gallery = window.OverlimitSkillFxGallery;
    gallery.manager.clear();
    const self = document.querySelector('[data-fx-gallery-anchor="self"]');
    const river = document.querySelector('[data-fx-gallery-anchor="river"]');
    const stage = document.querySelector('[data-fx-gallery-anchor="stageCenter"]');
    gallery.manager.syncStates([
      { key: "def", label: "DEF", tone: "cyan", targetElement: self },
      { key: "null", label: "NULL", tone: "violet", targetElement: river },
    ]);
    const layer = document.getElementById("skill-fx-gallery-state-layer").getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const stagePoint = { x: stageRect.left + stageRect.width / 2 - layer.left, y: stageRect.top + stageRect.height / 2 - layer.top };
    return [...document.querySelectorAll("#skill-fx-gallery-state-layer .skill-state-marker")].map((marker) => ({
      key: marker.dataset.stateKey,
      x: Number.parseFloat(marker.style.getPropertyValue("--state-x")),
      y: Number.parseFloat(marker.style.getPropertyValue("--state-y")),
      distanceFromStage: Math.hypot(Number.parseFloat(marker.style.getPropertyValue("--state-x")) - stagePoint.x, Number.parseFloat(marker.style.getPropertyValue("--state-y")) - stagePoint.y),
    }));
  });

  await page.locator("#skill-fx-gallery-quality").selectOption("low");
  await page.locator("#skill-fx-gallery-reduced").uncheck();
  let degradedInstance = await selectAndReplay(page, "BLOOD_BATTLE");
  const lowPerformance = await degradedInstance.evaluate((node) => ({
    quality: node.dataset.quality,
    stageDisplay: getComputedStyle(node.querySelector(".skill-effect-stage")).display,
    impactDisplay: getComputedStyle(node.querySelector(".skill-effect-impact")).display,
    packetDisplay: getComputedStyle(node.querySelector(".route-packet")).display,
  }));

  await page.locator("#skill-fx-gallery-quality").selectOption("high");
  await page.locator("#skill-fx-gallery-reduced").check();
  degradedInstance = await selectAndReplay(page, "FAIRNESS");
  const reducedMotion = await degradedInstance.evaluate((node) => ({
    motion: node.dataset.motion,
    stageDisplay: getComputedStyle(node.querySelector(".skill-effect-stage")).display,
    impactDisplay: getComputedStyle(node.querySelector(".skill-effect-impact")).display,
    routeDisplay: getComputedStyle(node.querySelector(".skill-effect-route")).display,
    bodyShakes: document.body.classList.contains("skill-fx-shake-soft"),
  }));

  await page.locator("#skill-fx-gallery-reduced").uncheck();
  await page.locator("#skill-fx-gallery-show-caption").uncheck();
  const captionlessInstance = await selectAndReplay(page, "CHEAT");
  const captionless = await captionlessInstance.evaluate((node) => ({
    captionDisplay: getComputedStyle(node.querySelector(".skill-effect-caption")).display,
    coreDisplay: getComputedStyle(node.querySelector(".skill-effect-core")).display,
    family: node.dataset.effect,
  }));
  await page.locator("#skill-fx-gallery-show-caption").check();

  const graphicalSignatures = [];
  for (const skillId of ["INTIMIDATION", "BLOOD_BATTLE", "DEFENSE", "COUNTER", "FAIRNESS", "CHEAT", "DEAD_END", "NULLIFICATION", "FORTUNE", "DESTINY", "LOAN", "RETREAT", "RESTART", "DISGUISE"]) {
    const instance = await selectAndReplay(page, skillId);
    graphicalSignatures.push(await instance.evaluate((node) => ({
      skill: node.dataset.skill,
      family: node.dataset.effect,
      glyph: node.querySelector(".skill-effect-glyph")?.textContent || "",
      haloAnimation: getComputedStyle(node.querySelector(".halo-a")).animationName,
      cardsVisible: [...node.querySelectorAll(".skill-effect-card")].some((card) => getComputedStyle(card).display !== "none"),
      stageData: Boolean(node.querySelector(".skill-effect-stage-data")),
    })));
  }

  const guides = await page.evaluate(() => ({
    stageControl: Boolean(document.getElementById("skill-fx-gallery-show-stage")),
    targetControl: Boolean(document.getElementById("skill-fx-gallery-show-target")),
    stageVisible: getComputedStyle(document.querySelector(".skill-fx-gallery-stage-center")).opacity,
    targetVisible: getComputedStyle(document.getElementById("skill-fx-gallery-target-marker")).opacity,
  }));

  const pointerSafety = await page.evaluate(() => ({
    effectLayer: getComputedStyle(document.getElementById("skill-effect-layer")).pointerEvents,
    stateLayer: getComputedStyle(document.getElementById("skill-state-layer")).pointerEvents,
    galleryEffectLayer: getComputedStyle(document.getElementById("skill-fx-gallery-effect-layer")).pointerEvents,
    galleryStateLayer: getComputedStyle(document.getElementById("skill-fx-gallery-state-layer")).pointerEvents,
  }));

  const orphanCleanup = await page.evaluate(() => {
    const gallery = window.OverlimitSkillFxGallery;
    gallery.manager.clear();
    return {
      effects: document.querySelectorAll("#skill-fx-gallery-effect-layer .skill-effect-instance").length,
      states: document.querySelectorAll("#skill-fx-gallery-state-layer .skill-state-marker").length,
    };
  });

  const captures = [];
  if (CAPTURE_DIR) {
    fs.mkdirSync(CAPTURE_DIR, { recursive: true });
    await page.locator("#skill-fx-gallery-quality").selectOption("high");
    await page.locator("#skill-fx-gallery-reduced").uncheck();
    await page.locator("#skill-fx-gallery-show-stage").uncheck();
    await page.locator("#skill-fx-gallery-show-target").uncheck();
    for (const skillId of REPRESENTATIVE_CAPTURES) {
      const instance = await selectAndReplay(page, skillId);
      const tier = await instance.getAttribute("data-tier");
      await page.waitForTimeout(tier === "FX4" ? 650 : tier === "FX3" ? 520 : 300);
      const capturePath = path.join(CAPTURE_DIR, `${skillId.toLowerCase()}.png`);
      await page.locator("#skill-fx-gallery-stage").screenshot({ path: capturePath });
      captures.push(capturePath);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(120);
  const mobileInstance = await selectAndReplay(page, "DESTINY");
  const mobile = await mobileInstance.evaluate((node) => {
    const panel = document.querySelector(".skill-fx-gallery-panel").getBoundingClientRect();
    const stage = document.getElementById("skill-fx-gallery-stage").getBoundingClientRect();
    const stageAnchor = document.querySelector('[data-fx-gallery-anchor="stageCenter"]').getBoundingClientRect();
    const stageY = Number.parseFloat(node.style.getPropertyValue("--fx-stage-y"));
    const layer = node.parentElement.getBoundingClientRect();
    return {
      panelInsideViewport: panel.left >= -1 && panel.right <= innerWidth + 1 && panel.top >= -1 && panel.bottom <= innerHeight + 1,
      stageInsidePanel: stage.left >= panel.left - 1 && stage.right <= panel.right + 1,
      stageVerticallyVisible: stage.top >= panel.top - 1 && stage.bottom <= panel.bottom + 1,
      pageHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      replayUsable: document.getElementById("btn-replay-skill-fx").getBoundingClientRect().height >= 40,
      stageCentral: Number.isFinite(stageY) && Math.abs(stageY - (stageAnchor.top + stageAnchor.height / 2 - layer.top)) <= 3,
      coreWidth: node.querySelector(".skill-effect-core").getBoundingClientRect().width,
    };
  });
  if (CAPTURE_DIR) {
    const mobilePath = path.join(CAPTURE_DIR, "mobile-gallery.png");
    await page.locator("#skill-fx-gallery-stage").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.OverlimitSkillFxGallery.replay());
    await page.waitForTimeout(650);
    await page.locator("#skill-fx-gallery-stage").screenshot({ path: mobilePath });
    captures.push(mobilePath);
  }

  await browser.close();

  const failures = [];
  if (optionIds.length !== EXPECTED_OPTIONS) failures.push(`gallery option count is ${optionIds.length}, expected ${EXPECTED_OPTIONS}`);
  if (new Set(optionIds).size !== EXPECTED_OPTIONS) failures.push("gallery contains duplicate skill options");
  if (optionIds.includes("ENDGAME")) failures.push("protected Endgame leaked into gallery");
  if (effects.length !== EXPECTED_OPTIONS) failures.push("not every skill/profile rendered");
  effects.forEach((effect) => {
    if (!effect.family || !effect.tier || !effect.impactType) failures.push(`incomplete director metadata: ${effect.skill}`);
    if (effect.heroNodes > 20 || effect.particleNodes > 12 || effect.impactNodes > 12 || effect.routeNodes > 4) failures.push(`DOM budget exceeded: ${effect.skill}`);
    if (effect.stageDisplay === "none" || effect.coreDisplay === "none" || effect.impactDisplay === "none") failures.push(`stage/impact missing: ${effect.skill}`);
  });
  Object.entries(stageAudits).forEach(([name, audit]) => {
    if (!auditMatchesAnchors(audit)) failures.push(`stage/target anchor mismatch: ${name}`);
  });
  if (stageAudits.deepBreath.stageTargetDistance < 40 || stageAudits.deepBreath.hasRoute !== "true") failures.push("Deep Breath lacks central-to-energy follow-through");
  if (stageAudits.cheat.stageTargetDistance < 35 || stageAudits.cheat.impactType !== "card") failures.push("Cheat lacks card follow-through");
  if (stageAudits.nullification.impactType !== "card") failures.push("Nullification lost card-slot impact");
  if (stageAudits.loanEnergy.impactType !== "energy" || stageAudits.loanChip.impactType !== "chip") failures.push("Loan branch impact types are incorrect");
  if (stageAudits.fairness.impactType !== "board") failures.push("Fairness lost board impact");
  if (secrecy.accepted || secrecy.after !== secrecy.before || secrecy.publicVisible || secrecy.privateVisible) failures.push("opponent secret event produced a visual side channel");
  if (resultOnly.identity !== "result-only" || /绝密|TOP SECRET/i.test(resultOnly.caption) || resultOnly.title !== "ACCESS DENIED") failures.push("result-only stage leaked a secret skill identity");
  if (dedupeAndPriority.dedupe[0] !== true || dedupeAndPriority.dedupe[1] !== false) failures.push("duplicate requestId was not suppressed");
  if (dedupeAndPriority.endgame || dedupeAndPriority.restored || dedupeAndPriority.replay) failures.push("Endgame/reconnect/replay entered ordinary StageFX");
  if (directorInteractions.blood.accepted.some((value) => !value)
    || directorInteractions.blood.instances !== 1
    || directorInteractions.blood.variant !== "dual"
    || !directorInteractions.blood.upgraded
    || directorInteractions.blood.glyph !== "×4") failures.push("dual Blood Battle did not merge into one ×4 stage");
  if (directorInteractions.counterCut.accepted.some((value) => !value)
    || directorInteractions.counterCut.targetFamily !== "cheat"
    || !directorInteractions.counterCut.cut
    || !directorInteractions.counterCut.queuedCounter) failures.push("Counter did not cut the active target stage before resolving");
  if (stateMarkers.length !== 2 || stateMarkers.some((marker) => marker.distanceFromStage < 55)) failures.push("persistent state markers drifted to the stage center");
  if (lowPerformance.quality !== "low" || lowPerformance.stageDisplay === "none" || lowPerformance.impactDisplay === "none" || lowPerformance.packetDisplay !== "none") failures.push("Low Performance did not preserve the reduced central director");
  if (reducedMotion.motion !== "reduced" || reducedMotion.stageDisplay === "none" || reducedMotion.impactDisplay === "none" || reducedMotion.routeDisplay !== "none" || reducedMotion.bodyShakes) failures.push("Reduced Motion central stage/impact contract failed");
  if (captionless.captionDisplay !== "none" || captionless.coreDisplay === "none") failures.push("captionless graphical identity mode failed");
  if (new Set(graphicalSignatures.map((entry) => `${entry.family}|${entry.glyph}|${entry.haloAnimation}|${entry.cardsVisible}|${entry.stageData}`)).size < 12) failures.push("core skills are not graphically distinct enough without captions");
  if (!guides.stageControl || !guides.targetControl || Number(guides.stageVisible) < .5 || Number(guides.targetVisible) < .5) failures.push("Gallery stage/target guides are unavailable");
  if (Object.values(pointerSafety).some((value) => value !== "none")) failures.push("an FX layer blocks pointer input");
  if (orphanCleanup.effects || orphanCleanup.states) failures.push("manager clear left orphan FX nodes");
  if (!mobile.panelInsideViewport || !mobile.stageInsidePanel || !mobile.stageVerticallyVisible
    || mobile.pageHorizontalOverflow || !mobile.replayUsable || !mobile.stageCentral
    || mobile.coreWidth > 390 * .89) failures.push("mobile gallery or central stage contract failed");
  if (consoleErrors.length) failures.push("browser console errors");
  if (requestErrors.length) failures.push("same-origin resource requests failed");

  const clientSource = fs.readFileSync(path.join(process.cwd(), "public", "client.js"), "utf8");
  if (!clientSource.includes('getSkillFxManager()?.isPlaying("DEAD_END")') || !clientSource.includes("if (!deadEndOwnsPresentation) playAllInEffect(payload.playerId)")) failures.push("Dead End / All In presentation dedupe contract is missing");

  console.log(JSON.stringify({
    ok: failures.length === 0,
    failures,
    consoleErrors,
    externalConsoleErrors,
    requestErrors,
    report: {
      optionCount: optionIds.length, effects, stageAudits, secrecy, resultOnly, dedupeAndPriority, directorInteractions,
      stateMarkers, lowPerformance, reducedMotion, captionless, graphicalSignatures, guides,
      pointerSafety, orphanCleanup, mobile, captures,
    },
  }, null, 2));
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
