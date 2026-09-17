import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import playwrightRuntime from "./playwright-runtime.js";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3002";
const CAPTURE_DIR = process.env.SKILL_FX_CAPTURE_DIR || "";
const EXPECTED_SKILLS = 23;
const EXPECTED_OPTIONS = EXPECTED_SKILLS + 9;
const MOBILE_GALLERY_VIEWPORTS = [
  { width: 320, height: 700 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
];
const DESKTOP_GALLERY_VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
];
const REPRESENTATIVE_CAPTURES = [
  "DEEP_BREATH", "PROBE", "RECYCLE", "ALERT", "FAIRNESS", "INTIMIDATION",
  "BLOOD_BATTLE", "CHEAT", "COUNTER", "NULLIFICATION", "FORTUNE", "DESTINY",
  "RESTART", "DISGUISE", "DEAD_END", "PROTOCOL_PAIR",
];
const HERO_CAPTURES = [
  "DEEP_BREATH", "CHEAT", "COUNTER", "NULLIFICATION", "FAIRNESS",
  "BLOOD_BATTLE", "INTIMIDATION", "DESTINY", "DEAD_END", "RESTART",
];
const MOBILE_HERO_CAPTURES = ["CHEAT", "FAIRNESS", "NULLIFICATION", "DEAD_END", "RESTART"];
const CAPTURE_PHASES = [20, 45, 65, 82];
const FAIRNESS_FINISH_CAPTURE_OFFSETS = [-200, 0, 50, 150, 350];

const profileIdFor = (skillId) => skillId.startsWith("PROTOCOL_") ? "PROTOCOL_SHOWDOWN" : skillId;

async function selectAndReplay(page, skillId, options = {}) {
  await page.locator("#skill-fx-gallery-perspective").selectOption(options.perspective || "self");
  await page.locator("#skill-fx-gallery-skill").selectOption(skillId);
  await page.locator("#skill-fx-gallery-target").selectOption(options.target || "profile");
  await page.locator("#skill-fx-gallery-variant").selectOption(options.variant || "default");
  if (options.disclosure) await page.locator("#skill-fx-gallery-disclosure").selectOption(options.disclosure);
  if (options.status) await page.locator("#skill-fx-gallery-status").selectOption(options.status);
  await page.locator("#btn-replay-skill-fx").click();
  const instance = page.locator("#skill-fx-gallery-effect-layer .skill-effect-instance");
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
    const layerRect = node.parentElement.getBoundingClientRect();
    const captionRect = caption?.getBoundingClientRect();
    return {
      skill: node.dataset.skill,
      family: node.dataset.effect,
      tier: node.dataset.tier,
      impactType: node.dataset.impact,
      identity: node.dataset.identity,
      quality: node.dataset.quality,
      motion: node.dataset.motion,
      presentation: node.dataset.presentation,
      context: node.dataset.context,
      durationMs: numberVar("--fx-duration"),
      rhythm: node.dataset.rhythm,
      verb: node.dataset.verb,
      anticipationMs: numberVar("--fx-anticipation-ms"),
      manifestMs: numberVar("--fx-manifest-ms"),
      routeDelayMs: numberVar("--fx-route-delay"),
      routeMs: numberVar("--fx-route-ms"),
      impactDelayMs: numberVar("--fx-impact-delay"),
      impactMs: numberVar("--fx-impact-ms"),
      holdMs: numberVar("--fx-hold-ms"),
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
      atmosphereDisplay: getComputedStyle(node.querySelector(".skill-effect-atmosphere")).display,
      captionDisplay: caption ? getComputedStyle(caption).display : "none",
      captionText: caption?.textContent || "",
      captionInsideLayer: !captionRect
        || (captionRect.top >= layerRect.top - 1 && captionRect.bottom <= layerRect.bottom + 1),
    };
  });
}

async function anchorAudit(page, skillId, expectedSelector, options = {}) {
  const {
    expectedStageSelector = '[data-fx-gallery-anchor="stageCenter"]',
    expectedSecondarySelector = null,
    expectedSourceSelector = null,
    expectedDestinationSelector = null,
    ...replayOptions
  } = options;
  const instance = await selectAndReplay(page, skillId, replayOptions);
  return instance.evaluate((node, selectors) => {
    const layer = node.parentElement;
    const stageAnchor = document.querySelector(selectors.stage);
    const targetAnchor = document.querySelector(selectors.target);
    const secondaryTargetAnchor = selectors.secondary
      ? document.querySelector(selectors.secondary)
      : null;
    const sourceAnchor = selectors.source
      ? document.querySelector(selectors.source)
      : null;
    const destinationAnchor = selectors.destination
      ? document.querySelector(selectors.destination)
      : null;
    const layerRect = layer.getBoundingClientRect();
    const stageRect = stageAnchor.getBoundingClientRect();
    const targetRect = targetAnchor.getBoundingClientRect();
    const secondaryTargetRect = secondaryTargetAnchor?.getBoundingClientRect();
    const stageX = Number.parseFloat(node.style.getPropertyValue("--fx-stage-x"));
    const stageY = Number.parseFloat(node.style.getPropertyValue("--fx-stage-y"));
    const targetX = Number.parseFloat(node.style.getPropertyValue("--fx-target-x"));
    const targetY = Number.parseFloat(node.style.getPropertyValue("--fx-target-y"));
    const secondaryTargetX = Number.parseFloat(node.style.getPropertyValue("--fx-secondary-target-x"));
    const secondaryTargetY = Number.parseFloat(node.style.getPropertyValue("--fx-secondary-target-y"));
    const fromX = Number.parseFloat(node.style.getPropertyValue("--fx-from-x"));
    const fromY = Number.parseFloat(node.style.getPropertyValue("--fx-from-y"));
    const toX = Number.parseFloat(node.style.getPropertyValue("--fx-to-x"));
    const toY = Number.parseFloat(node.style.getPropertyValue("--fx-to-y"));
    const sourceRect = sourceAnchor?.getBoundingClientRect();
    const destinationRect = destinationAnchor?.getBoundingClientRect();
    return {
      stageX,
      stageY,
      targetX,
      targetY,
      expectedStageX: stageRect.left + stageRect.width / 2 - layerRect.left,
      expectedStageY: stageRect.top + stageRect.height / 2 - layerRect.top,
      expectedTargetX: targetRect.left + targetRect.width / 2 - layerRect.left,
      expectedTargetY: targetRect.top + targetRect.height / 2 - layerRect.top,
      secondaryTargetX,
      secondaryTargetY,
      expectedSecondaryTargetX: secondaryTargetRect
        ? secondaryTargetRect.left + secondaryTargetRect.width / 2 - layerRect.left
        : null,
      expectedSecondaryTargetY: secondaryTargetRect
        ? secondaryTargetRect.top + secondaryTargetRect.height / 2 - layerRect.top
        : null,
      stageTargetDistance: Math.hypot(stageX - targetX, stageY - targetY),
      fromX,
      fromY,
      toX,
      toY,
      expectedFromX: sourceRect ? sourceRect.left + sourceRect.width / 2 - layerRect.left : null,
      expectedFromY: sourceRect ? sourceRect.top + sourceRect.height / 2 - layerRect.top : null,
      expectedToX: destinationRect ? destinationRect.left + destinationRect.width / 2 - layerRect.left : null,
      expectedToY: destinationRect ? destinationRect.top + destinationRect.height / 2 - layerRect.top : null,
      routeDistance: Math.hypot(fromX - toX, fromY - toY),
      hasRoute: node.dataset.hasRoute,
      impactType: node.dataset.impact,
    };
  }, {
    stage: expectedStageSelector,
    target: expectedSelector,
    secondary: expectedSecondarySelector,
    source: expectedSourceSelector,
    destination: expectedDestinationSelector,
  });
}

function isNear(actual, expected, tolerance = 2.5) {
  return Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= tolerance;
}

function auditMatchesAnchors(audit) {
  const primaryMatches = isNear(audit.stageX, audit.expectedStageX)
    && isNear(audit.stageY, audit.expectedStageY)
    && isNear(audit.targetX, audit.expectedTargetX)
    && isNear(audit.targetY, audit.expectedTargetY);
  const secondaryMatches = audit.expectedSecondaryTargetX == null
    || (isNear(audit.secondaryTargetX, audit.expectedSecondaryTargetX)
      && isNear(audit.secondaryTargetY, audit.expectedSecondaryTargetY));
  const routeMatches = audit.expectedFromX == null
    || (isNear(audit.fromX, audit.expectedFromX)
      && isNear(audit.fromY, audit.expectedFromY)
      && isNear(audit.toX, audit.expectedToX)
      && isNear(audit.toY, audit.expectedToY));
  return primaryMatches && secondaryMatches && routeMatches;
}

async function auditFairnessCompletion(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("#skill-fx-gallery-quality").selectOption("high");
  return page.evaluate(async () => {
    const gallery = window.OverlimitSkillFxGallery;
    const effectLayer = document.getElementById("skill-fx-gallery-effect-layer");
    const stage = document.querySelector('[data-fx-gallery-anchor="stageCenter"]');
    const self = document.querySelector('[data-fx-gallery-anchor="self"]');
    const opponent = document.querySelector('[data-fx-gallery-anchor="opponent"]');
    const screen = document.getElementById("screen-game");
    gallery.manager.clear();

    let addedInstances = 0;
    let removedInstances = 0;
    let bodyShakeObserved = false;
    let reappearedAfterFinish = false;
    let sawFinishedState = false;
    let maxInstances = 0;
    let maxAtmospheres = 0;
    const rootAnimations = new Set();
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        [...record.addedNodes].forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && node.matches?.(".skill-effect-instance")) {
            addedInstances += 1;
            if (sawFinishedState) reappearedAfterFinish = true;
          }
        });
        [...record.removedNodes].forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && node.matches?.(".skill-effect-instance")) {
            removedInstances += 1;
            sawFinishedState = true;
          }
        });
      });
    });
    observer.observe(effectLayer, { childList: true });

    const accepted = gallery.manager.play({
      force: true,
      eventId: "verify:fairness:lifecycle",
      skillId: "FAIRNESS",
      audience: "public",
      disclosure: "public",
      casterId: "CASTER",
      viewerId: "VIEWER",
      stageElement: stage,
      targetElement: self,
      secondaryTargetElement: opponent,
      route: false,
    });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const instance = effectLayer.querySelector(".skill-effect-instance");
    const durationMs = Number.parseFloat(instance?.style.getPropertyValue("--fx-duration")) || 2050;
    const startedAt = performance.now();
    while (performance.now() - startedAt < durationMs + 420) {
      const count = effectLayer.querySelectorAll(".skill-effect-instance").length;
      const atmospheres = effectLayer.querySelectorAll(".skill-effect-atmosphere").length;
      maxInstances = Math.max(maxInstances, count);
      maxAtmospheres = Math.max(maxAtmospheres, atmospheres);
      bodyShakeObserved ||= document.body.classList.contains("skill-fx-shake-soft");
      if (screen) rootAnimations.add(getComputedStyle(screen).animationName);
      if (sawFinishedState && count > 0) reappearedAfterFinish = true;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    observer.disconnect();
    const finalInstances = effectLayer.querySelectorAll(".skill-effect-instance").length;
    const finalAtmospheres = effectLayer.querySelectorAll(".skill-effect-atmosphere").length;
    gallery.manager.clear();
    return {
      accepted,
      addedInstances,
      removedInstances,
      maxInstances,
      maxAtmospheres,
      finalInstances,
      finalAtmospheres,
      bodyShakeObserved,
      reappearedAfterFinish,
      rootAnimations: [...rootAnimations],
    };
  });
}

async function auditEndgameSettlementOrdering(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  return page.evaluate(async () => {
    clearPresentationCoordinator();
    clearHandSettlement();
    const modal = document.getElementById("hand-settle-modal");
    const events = [];
    const onPresentation = (event) => {
      events.push({
        stage: event.detail?.stage || "",
        kind: event.detail?.kind || "",
        at: performance.now(),
        settlementHidden: modal.classList.contains("hidden"),
      });
    };
    document.addEventListener("overlimit:presentation", onPresentation);
    const serverNow = Date.now();
    const barrier = syncPresentationBarrier({
      id: "verify:endgame:execution",
      kind: "ENDGAME_EXECUTION",
      handNo: 99991,
      serverNow,
      until: serverNow + 760,
      durationMs: 760,
    }, { restored: false });
    playEndgameExecution({ barrier });
    const settlementPromise = queueHandSettlement({
      reason: "showdown",
      handNo: 99991,
      handId: "verify:endgame:execution",
      settleMs: 3000,
      endgameExecution: true,
      endgameExecutionOverride: true,
      communityCards: [],
      players: [],
      winner: null,
      winnerName: "",
      tie: true,
      pot: 0,
      skillSettlement: null,
    });
    await new Promise((resolve) => setTimeout(resolve, 90));
    const prematureSettlementVisible = !modal.classList.contains("hidden");
    await settlementPromise;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const settlementVisibleAfterFx = !modal.classList.contains("hidden");
    const orderedStages = events.map((entry) => entry.stage);
    const fxStartedIndex = orderedStages.indexOf("fxStarted");
    const fxFinishedIndex = orderedStages.indexOf("fxFinished");
    const settlementIndex = orderedStages.indexOf("settlementUiShown");
    const hiddenAtFxFinished = fxFinishedIndex >= 0 && events[fxFinishedIndex].settlementHidden;
    document.removeEventListener("overlimit:presentation", onPresentation);
    clearHandSettlement();
    clearPresentationCoordinator();
    return {
      prematureSettlementVisible,
      settlementVisibleAfterFx,
      hiddenAtFxFinished,
      orderedStages,
      ordered: fxStartedIndex >= 0 && fxFinishedIndex > fxStartedIndex && settlementIndex >= fxFinishedIndex,
    };
  });
}

async function auditFairnessStateBadges(page) {
  return page.evaluate(() => {
    const previousMode = state.skillMode;
    const previousSkillState = state.skillState;
    const self = document.getElementById("self-fairness-lock");
    const opponent = document.getElementById("opponent-fairness-lock");
    const effectCount = () => document.querySelectorAll("#skill-effect-layer .skill-effect-instance").length;
    const before = effectCount();
    try {
      state.skillMode = "abyss";
      state.skillState = { ...previousSkillState, fairnessActive: true };
      renderSkillHud();
      const restored = !self.classList.contains("hidden") && !opponent.classList.contains("hidden");
      const meaningfulLabels = [self, opponent].every((node) => (
        node.getAttribute("role") === "img" && Boolean(node.getAttribute("aria-label")) && Boolean(node.title)
      ));
      const firstAnimation = self.getAnimations()[0];
      state.skillState = { ...state.skillState };
      renderSkillHud();
      const repeatedSyncKeepsNode = document.getElementById("self-fairness-lock") === self
        && self.getAnimations()[0] === firstAnimation;
      const noMainAnimationReplay = effectCount() === before;
      state.skillState = { ...state.skillState, fairnessActive: false };
      renderSkillHud();
      const removed = self.classList.contains("hidden") && opponent.classList.contains("hidden");
      return { restored, meaningfulLabels, repeatedSyncKeepsNode, noMainAnimationReplay, removed };
    } finally {
      state.skillMode = previousMode;
      state.skillState = previousSkillState;
      renderSkillHud();
    }
  });
}

async function auditLowEndgameBarrier(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  return page.evaluate(async () => {
    clearPresentationCoordinator();
    clearHandSettlement();
    const visualQuality = document.getElementById("setting-animation");
    const modal = document.getElementById("hand-settle-modal");
    const overlay = document.getElementById("flash-endgame-kill");
    const game = document.getElementById("screen-game");
    visualQuality.value = "low";
    visualQuality.dispatchEvent(new Event("change", { bubbles: true }));

    const events = [];
    let resolveFinished;
    const finished = new Promise((resolve) => { resolveFinished = resolve; });
    const onPresentation = (event) => {
      const entry = {
        stage: event.detail?.stage || "",
        at: performance.now(),
        settlementHidden: modal.classList.contains("hidden"),
      };
      events.push(entry);
      if (entry.stage === "fxFinished") resolveFinished(entry);
    };
    document.addEventListener("overlimit:presentation", onPresentation);

    const serverNow = Date.now();
    const barrier = syncPresentationBarrier({
      id: "verify:endgame:reduced",
      kind: "ENDGAME_EXECUTION",
      handNo: 99992,
      serverNow,
      until: serverNow + 900,
      durationMs: 900,
    }, { restored: false });
    playEndgameExecution({ barrier });
    await Promise.race([
      finished,
      new Promise((_, reject) => setTimeout(() => reject(new Error("reduced Endgame did not finish")), 1400)),
    ]);

    const staticHold = {
      status: overlay.dataset.presentationStatus,
      visible: !overlay.classList.contains("hidden"),
      resultHold: overlay.classList.contains("is-result-hold"),
      settlementHidden: modal.classList.contains("hidden"),
      barrierActive: game.classList.contains("presentation-barrier-active"),
      actionDeadlineCleared: state.actionDeadline == null,
      countdownRafIdle: state.actionCountdownRaf === 0,
      countdownText: document.getElementById("action-countdown-value")?.textContent || "",
    };

    const remaining = Math.max(0, barrier.localUntil - Date.now());
    await new Promise((resolve) => setTimeout(resolve, remaining + 100));
    await queueHandSettlement({
      reason: "showdown",
      handNo: 99992,
      handId: "verify:endgame:reduced",
      settleMs: 3000,
      endgameExecution: true,
      endgameExecutionOverride: true,
      communityCards: [],
      players: [],
      winner: null,
      winnerName: "",
      tie: true,
      pot: 0,
      skillSettlement: null,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const settlementVisibleAfterBarrier = !modal.classList.contains("hidden");
    const fxStarted = events.find((entry) => entry.stage === "fxStarted");
    const fxFinished = events.find((entry) => entry.stage === "fxFinished");
    const settlementShown = events.find((entry) => entry.stage === "settlementUiShown");

    document.removeEventListener("overlimit:presentation", onPresentation);
    clearHandSettlement();
    clearPresentationCoordinator();
    visualQuality.value = "high";
    visualQuality.dispatchEvent(new Event("change", { bubbles: true }));
    return {
      staticHold,
      settlementVisibleAfterBarrier,
      dynamicDurationMs: fxStarted && fxFinished ? fxFinished.at - fxStarted.at : null,
      revealDelayMs: fxFinished && settlementShown ? settlementShown.at - fxFinished.at : null,
      ordered: Boolean(fxStarted && fxFinished && settlementShown
        && fxStarted.at < fxFinished.at && fxFinished.at <= settlementShown.at),
      events,
    };
  });
}

async function auditGalleryViewport(page, viewport) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    const panel = document.querySelector(".skill-fx-gallery-panel");
    const controls = document.getElementById("skill-fx-gallery-controls");
    if (panel) panel.scrollTop = 0;
    if (controls) controls.scrollTop = 0;
  });
  const instance = await selectAndReplay(page, "DESTINY");
  return instance.evaluate((node, expectedViewport) => {
    const modalNode = document.getElementById("skill-fx-gallery-modal");
    const panelNode = document.querySelector(".skill-fx-gallery-panel");
    const workspaceNode = document.querySelector(".skill-fx-gallery-workspace");
    const stageNode = document.getElementById("skill-fx-gallery-stage");
    const controlsNode = document.getElementById("skill-fx-gallery-controls");
    const replayNode = document.getElementById("btn-replay-skill-fx");
    const captionNode = node.querySelector(".skill-effect-caption");
    const coreNode = node.querySelector(".skill-effect-core");
    const panel = panelNode.getBoundingClientRect();
    const stage = stageNode.getBoundingClientRect();
    const controls = controlsNode.getBoundingClientRect();
    const replay = replayNode.getBoundingClientRect();
    const caption = captionNode?.getBoundingClientRect();
    const stageAnchor = document.querySelector('[data-fx-gallery-anchor="stageCenter"]').getBoundingClientRect();
    const stageY = Number.parseFloat(node.style.getPropertyValue("--fx-stage-y"));
    const layer = node.parentElement.getBoundingClientRect();
    const visibleTop = Math.max(0, panel.top);
    const visibleBottom = Math.min(innerHeight, panel.bottom);
    const rect = (value) => ({
      top: value.top,
      right: value.right,
      bottom: value.bottom,
      left: value.left,
      width: value.width,
      height: value.height,
    });
    const visibleStageHeight = Math.max(0, Math.min(stage.bottom, visibleBottom) - Math.max(stage.top, visibleTop));
    return {
      viewport: { width: innerWidth, height: innerHeight, expected: expectedViewport },
      panelInsideViewport: panel.left >= -1 && panel.right <= innerWidth + 1 && panel.top >= -1 && panel.bottom <= innerHeight + 1,
      stageInsidePanel: stage.left >= panel.left - 1 && stage.right <= panel.right + 1,
      stageVerticallyVisible: stage.top >= visibleTop - 1 && stage.bottom <= visibleBottom + 1,
      stageVisibleRatio: stage.height > 0 ? visibleStageHeight / stage.height : 0,
      captionVerticallyVisible: !caption || (caption.top >= visibleTop - 1 && caption.bottom <= visibleBottom + 1),
      pageHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      modalOverflowX: getComputedStyle(modalNode).overflowX,
      panelOverflowX: getComputedStyle(panelNode).overflowX,
      panelOverflowY: getComputedStyle(panelNode).overflowY,
      replayUsable: replay.height >= 40 && replay.top >= controls.top - 1 && replay.bottom <= controls.bottom + 1,
      stageCentral: Number.isFinite(stageY) && Math.abs(stageY - (stageAnchor.top + stageAnchor.height / 2 - layer.top)) <= 3,
      coreWidth: coreNode.getBoundingClientRect().width,
      documentScrollTop: document.documentElement.scrollTop,
      modalScrollTop: modalNode.scrollTop,
      panelScrollTop: panelNode.scrollTop,
      controlsScrollTop: controlsNode.scrollTop,
      rects: {
        panel: rect(panel),
        workspace: rect(workspaceNode.getBoundingClientRect()),
        stage: rect(stage),
        controls: rect(controls),
        replay: rect(replay),
        caption: caption ? rect(caption) : null,
      },
    };
  }, viewport);
}

async function main() {
  const browser = await chromium.launch(playwrightRuntime.chromiumLaunchOptions({ headless: true }));
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem("overlimit_quickstart_v1", "seen");
    localStorage.setItem("overlimit_audio_enabled", "false");
  });
  await context.addInitScript(playwrightRuntime.pinZhCNLocale);
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
    cheat: await anchorAudit(page, "CHEAT", '[data-fx-gallery-anchor="community"]', {
      expectedSourceSelector: '[data-fx-gallery-anchor="selfCards"]',
      expectedDestinationSelector: '[data-fx-gallery-anchor="community"]',
    }),
    nullification: await anchorAudit(page, "NULLIFICATION", '[data-fx-gallery-anchor="river"]', { target: "river", variant: "board" }),
    loanEnergy: await anchorAudit(page, "LOAN", '[data-fx-gallery-anchor="energy"]', { variant: "energy" }),
    loanChip: await anchorAudit(page, "LOAN", '[data-fx-gallery-anchor="self"]', { variant: "chip" }),
    perception: await anchorAudit(page, "PERCEPTION", '[data-fx-gallery-anchor="community"]', {
      expectedStageSelector: '[data-fx-gallery-anchor="community"]',
    }),
    intimidation: await anchorAudit(page, "INTIMIDATION", '[data-fx-gallery-anchor="opponent"]', {
      expectedStageSelector: '[data-fx-gallery-anchor="opponent"]',
    }),
    fairness: await anchorAudit(page, "FAIRNESS", '[data-fx-gallery-anchor="self"]', {
      expectedSecondarySelector: '[data-fx-gallery-anchor="opponent"]',
    }),
  };

  const alertPulse = await inspectInstance(await selectAndReplay(page, "ALERT"));
  const deepBreathRefund = await inspectInstance(await selectAndReplay(page, "DEEP_BREATH", {
    variant: "refund", status: "REFUNDED", disclosure: "self",
  }));

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

  // Top Secret is now private even on a successful block; use a legitimately
  // disclosed result for the shared neutral-result geometry contract.
  const resultInstance = await selectAndReplay(page, "DEFENSE", {
    perspective: "opponent", disclosure: "result", status: "REVEALED",
  });
  const resultOnly = await resultInstance.evaluate((node) => ({
    skill: node.dataset.skill,
    family: node.dataset.effect,
    tier: node.dataset.tier,
    impact: node.dataset.impact,
    identity: node.dataset.identity,
    durationMs: Number.parseFloat(node.style.getPropertyValue("--fx-duration")),
    caption: node.querySelector(".skill-effect-caption")?.textContent || "",
    title: node.querySelector(".skill-effect-title")?.textContent || "",
    result: node.querySelector(".skill-effect-result")?.textContent || "",
    glyph: node.querySelector(".skill-effect-glyph")?.textContent || "",
    impactGlyph: node.querySelector(".skill-impact-glyph")?.textContent || "",
    stageData: node.querySelectorAll(".skill-effect-stage-data").length,
    modifiers: node.querySelectorAll(".skill-effect-modifier").length,
  }));
  const protocolResultInstance = await selectAndReplay(page, "PROTOCOL_PAIR", {
    perspective: "opponent", disclosure: "result", status: "REVEALED",
  });
  const protocolResultOnly = await protocolResultInstance.evaluate((node) => ({
    skill: node.dataset.skill,
    family: node.dataset.effect,
    tier: node.dataset.tier,
    impact: node.dataset.impact,
    identity: node.dataset.identity,
    durationMs: Number.parseFloat(node.style.getPropertyValue("--fx-duration")),
    caption: node.querySelector(".skill-effect-caption")?.textContent || "",
    title: node.querySelector(".skill-effect-title")?.textContent || "",
    result: node.querySelector(".skill-effect-result")?.textContent || "",
    glyph: node.querySelector(".skill-effect-glyph")?.textContent || "",
    impactGlyph: node.querySelector(".skill-impact-glyph")?.textContent || "",
    stageData: node.querySelectorAll(".skill-effect-stage-data").length,
    modifiers: node.querySelectorAll(".skill-effect-modifier").length,
  }));

  const neutralGeometry = [];
  for (const skillId of ["CHEAT", "PERCEPTION", "FAIRNESS"]) {
    const instance = await selectAndReplay(page, skillId, {
      perspective: "opponent", disclosure: "result", status: "REVEALED",
    });
    neutralGeometry.push(await instance.evaluate((node) => {
      const layer = node.parentElement.getBoundingClientRect();
      const stage = document.querySelector('[data-fx-gallery-anchor="stageCenter"]').getBoundingClientRect();
      return {
        skill: node.dataset.skill,
        family: node.dataset.effect,
        route: node.dataset.hasRoute,
        routeDisplay: getComputedStyle(node.querySelector(".skill-effect-route")).display,
        secondaryImpacts: node.querySelectorAll(".skill-effect-impact-secondary").length,
        stageX: Number.parseFloat(node.style.getPropertyValue("--fx-stage-x")),
        stageY: Number.parseFloat(node.style.getPropertyValue("--fx-stage-y")),
        expectedX: stage.left + stage.width / 2 - layer.left,
        expectedY: stage.top + stage.height / 2 - layer.top,
      };
    }));
  }

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

  const eventAdmission = await page.evaluate(() => {
    const makeQueued = () => {
      const instance = new window.OverlimitSkillFx.SkillFxManager();
      instance.busy = true;
      return instance;
    };
    const copies = makeQueued();
    const copyEvent = { eventId: "evt-copy", skillId: "FAIRNESS", casterId: "P1", handNo: 4 };
    const duplicateCopies = [
      copies.play({ ...copyEvent, audience: "public", disclosure: "public" }),
      copies.play({ ...copyEvent, audience: "self", disclosure: "self" }),
    ];

    const requestCopies = makeQueued();
    const requestCopyEvent = {
      requestId: "request-copy", skillId: "PROBE", casterId: "P1", handNo: 4,
      audience: "self", disclosure: "self",
    };
    const duplicateRequestCopies = [
      requestCopies.play({ ...requestCopyEvent, status: "SUCCESS" }),
      requestCopies.play({ ...requestCopyEvent, resultId: "request-copy-detail", safeMessage: "PRIVATE DETAIL" }),
    ];

    const topSecret = makeQueued();
    const topSecretChains = ["INTEL_ONE", "CHEAT", "NULLIFICATION"].map((skillId) => {
      const requestId = `top-secret-${skillId.toLowerCase()}`;
      const accepted = [
        topSecret.play({
          requestId, skillId: "TOP_SECRET", casterId: "P2", handNo: 4,
          audience: "opponent", disclosure: "public", status: "TRIGGERED",
        }),
        topSecret.play({
          requestId, skillId, casterId: "P1", handNo: 4,
          audience: "self", disclosure: "self", status: "FAILED",
        }),
      ];
      return { skillId, requestId, accepted };
    });

    const deepBreath = makeQueued();
    const deepBreathEvents = [
      deepBreath.play({
        requestId: "deep-breath-use", skillId: "DEEP_BREATH", casterId: "P1", handNo: 4,
        audience: "self", disclosure: "self", status: "SUCCESS",
      }),
      deepBreath.play({
        resultId: "deep-breath-refund", skillId: "DEEP_BREATH", casterId: "P1", handNo: 4,
        audience: "self", disclosure: "self", status: "REFUNDED", resultOnly: true,
      }),
    ];

    const loans = makeQueued();
    const loanBase = {
      skillId: "LOAN", casterId: "P1", handNo: 5, phase: "pre_flop",
      targetKey: "chip", audience: "self", disclosure: "self", status: "SUCCESS",
    };
    const loanRequests = [
      loans.play({ ...loanBase, requestId: "loan-a" }),
      loans.play({ ...loanBase, requestId: "loan-b" }),
    ];

    const fallbacks = makeQueued();
    const fallbackBase = {
      skillId: "NULLIFICATION", casterId: "P1", phase: "turn", at: 7000,
      audience: "self", disclosure: "self",
    };
    const fallbackVariants = [
      fallbacks.play({ ...fallbackBase, handNo: 6, targetKey: "board:3", status: "SUCCESS" }),
      fallbacks.play({ ...fallbackBase, handNo: 7, targetKey: "board:3", status: "SUCCESS" }),
      fallbacks.play({ ...fallbackBase, handNo: 7, targetKey: "board:4", status: "SUCCESS" }),
      fallbacks.play({ ...fallbackBase, handNo: 7, targetKey: "board:4", status: "REVEALED", resultOnly: true }),
    ];
    const fallbackDuplicate = fallbacks.play({
      ...fallbackBase, handNo: 6, targetKey: "board:3", status: "SUCCESS",
    });

    const capacity = makeQueued();
    for (let index = 0; index < 8; index += 1) {
      capacity.play({
        requestId: `capacity-${index}`, skillId: "ALERT", casterId: "P1",
        audience: "self", disclosure: "self", handNo: 8,
      });
    }
    const retryEvent = {
      requestId: "capacity-retry", skillId: "ALERT", casterId: "P1",
      audience: "self", disclosure: "self", handNo: 8,
    };
    const rejected = capacity.play(retryEvent);
    const retryKey = "request:capacity-retry:ALERT";
    const markedWhileRejected = capacity.dedupeKeys.has(retryKey);
    capacity.queue.shift();
    const retried = capacity.play(retryEvent);
    return {
      duplicateCopies,
      copyQueue: copies.queue.length,
      duplicateRequestCopies,
      requestCopyQueue: requestCopies.queue.length,
      topSecretChains,
      topSecretKeys: topSecret.queue.map((job) => job.key),
      deepBreathEvents,
      deepBreathKeys: deepBreath.queue.map((job) => job.key),
      loanRequests,
      loanQueue: loans.queue.map((job) => job.event.requestId),
      fallbackVariants,
      fallbackDuplicate,
      fallbackQueue: fallbacks.queue.length,
      capacity: { rejected, markedWhileRejected, retried, queue: capacity.queue.length },
    };
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
      remainingHoldMs: Math.max(0, gallery.manager.activeDeadline - Date.now()),
    };

    gallery.manager.clear();
    const cheat = gallery.manager.play({ ...common, audience: "self", disclosure: "self", eventId: "verify:counter:target", skillId: "CHEAT", casterId: "A" });
    const probe = gallery.manager.play({ ...common, audience: "self", disclosure: "self", eventId: "verify:counter:queued", skillId: "PROBE", casterId: "A" });
    const counter = gallery.manager.play({ ...common, audience: "self", disclosure: "self", eventId: "verify:counter:cut", skillId: "COUNTER", casterId: "B", tier: "FX3" });
    const active = document.querySelector("#skill-fx-gallery-effect-layer .skill-effect-instance");
    const counterCut = {
      accepted: [cheat, probe, counter],
      targetFamily: active?.dataset.effect || "",
      cut: active?.classList.contains("is-counter-cut") || false,
      queueOrder: gallery.manager.queue.map((job) => job.profile.id),
      interrupted: active?.dataset.interrupted || "",
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
  let degradedInstance = await selectAndReplay(page, "BLOOD_BATTLE");
  const lowQualityDecoration = await degradedInstance.evaluate((node) => ({
    quality: node.dataset.quality,
    stageDisplay: getComputedStyle(node.querySelector(".skill-effect-stage")).display,
    impactDisplay: getComputedStyle(node.querySelector(".skill-effect-impact")).display,
    packetDisplay: getComputedStyle(node.querySelector(".route-packet")).display,
  }));

  await page.locator("#skill-fx-gallery-quality").selectOption("low");
  degradedInstance = await selectAndReplay(page, "FAIRNESS");
  const lowQualityMotion = await degradedInstance.evaluate((node) => ({
    motion: node.dataset.motion,
    stageDisplay: getComputedStyle(node.querySelector(".skill-effect-stage")).display,
    impactDisplay: getComputedStyle(node.querySelector(".skill-effect-impact")).display,
    routeDisplay: getComputedStyle(node.querySelector(".skill-effect-route")).display,
    bodyShakes: document.body.classList.contains("skill-fx-shake-soft"),
  }));

  await page.locator("#skill-fx-gallery-quality").selectOption("high");
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
      artMotion: node.querySelector(".fx-art")?.dataset.motion || "",
      // Compare rendered geometry, independent of labels and gradient IDs.
      geometry: [...node.querySelectorAll(".fx-art-svg path")].map((path) => path.getAttribute("d")).join("|"),
      cardsVisible: [...node.querySelectorAll(".fx-card-piece")].some((card) => getComputedStyle(card).display !== "none"),
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

  const fairnessCompletion = await auditFairnessCompletion(page);
  const fairnessStateBadges = await auditFairnessStateBadges(page);
  const endgameSettlementOrdering = await auditEndgameSettlementOrdering(page);
  const lowEndgameBarrier = await auditLowEndgameBarrier(page);

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
    await page.locator("#skill-fx-gallery-show-stage").uncheck();
    await page.locator("#skill-fx-gallery-show-target").uncheck();
    for (const skillId of REPRESENTATIVE_CAPTURES) {
      for (const phase of CAPTURE_PHASES) {
        const instance = await selectAndReplay(page, skillId);
        const duration = await instance.evaluate((node) => Number.parseFloat(node.style.getPropertyValue("--fx-duration")) || 1050);
        await page.waitForTimeout(Math.max(60, Math.round(duration * phase / 100)));
        const capturePath = path.join(CAPTURE_DIR, `${skillId.toLowerCase()}-${String(phase).padStart(2, "0")}.png`);
        await page.locator("#skill-fx-gallery-stage").screenshot({ path: capturePath });
        captures.push(capturePath);
      }
    }
    const refundInstance = await selectAndReplay(page, "DEEP_BREATH", {
      variant: "refund", status: "REFUNDED", disclosure: "self",
    });
    const refundDuration = await refundInstance.evaluate((node) => Number.parseFloat(node.style.getPropertyValue("--fx-duration")) || 1100);
    await page.waitForTimeout(Math.round(refundDuration * .7));
    const refundCapturePath = path.join(CAPTURE_DIR, "deep_breath_refund.png");
    await page.locator("#skill-fx-gallery-stage").screenshot({ path: refundCapturePath });
    captures.push(refundCapturePath);

    for (const offset of FAIRNESS_FINISH_CAPTURE_OFFSETS) {
      const instance = await selectAndReplay(page, "FAIRNESS");
      const duration = await instance.evaluate((node) => Number.parseFloat(node.style.getPropertyValue("--fx-duration")) || 2050);
      await page.waitForTimeout(Math.max(0, duration + offset));
      const suffix = offset < 0 ? `minus-${Math.abs(offset)}` : offset > 0 ? `plus-${offset}` : "exact";
      const capturePath = path.join(CAPTURE_DIR, `fairness-finish-${suffix}.png`);
      await page.locator("#skill-fx-gallery-stage").screenshot({ path: capturePath });
      captures.push(capturePath);
    }

    await page.setViewportSize({ width: 1920, height: 1080 });
    for (const skillId of HERO_CAPTURES) {
      const instance = await selectAndReplay(page, skillId);
      const duration = await instance.evaluate((node) => Number.parseFloat(node.style.getPropertyValue("--fx-duration")) || 1050);
      await page.waitForTimeout(Math.round(duration * .65));
      const capturePath = path.join(CAPTURE_DIR, `desktop-1920x1080-${skillId.toLowerCase()}-65.png`);
      await page.locator("#skill-fx-gallery-stage").screenshot({ path: capturePath });
      captures.push(capturePath);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    for (const skillId of MOBILE_HERO_CAPTURES) {
      const instance = await selectAndReplay(page, skillId);
      const duration = await instance.evaluate((node) => Number.parseFloat(node.style.getPropertyValue("--fx-duration")) || 1050);
      await page.waitForTimeout(Math.round(duration * .65));
      const capturePath = path.join(CAPTURE_DIR, `mobile-390x844-${skillId.toLowerCase()}-65.png`);
      await page.locator("#skill-fx-gallery-stage").screenshot({ path: capturePath });
      captures.push(capturePath);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator("#skill-fx-gallery-quality").selectOption("low");
    let degradedCapture = await selectAndReplay(page, "FAIRNESS");
    let degradedDuration = await degradedCapture.evaluate((node) => Number.parseFloat(node.style.getPropertyValue("--fx-duration")) || 1050);
    await page.waitForTimeout(Math.round(degradedDuration * .65));
    const lowCapturePath = path.join(CAPTURE_DIR, "quality-low-fairness-65.png");
    await page.locator("#skill-fx-gallery-stage").screenshot({ path: lowCapturePath });
    captures.push(lowCapturePath);

    await page.locator("#skill-fx-gallery-quality").selectOption("low");
    degradedCapture = await selectAndReplay(page, "FAIRNESS");
    degradedDuration = await degradedCapture.evaluate((node) => Number.parseFloat(node.style.getPropertyValue("--fx-duration")) || 420);
    await page.waitForTimeout(Math.round(degradedDuration * .65));
    const reducedCapturePath = path.join(CAPTURE_DIR, "reduced-motion-fairness-65.png");
    await page.locator("#skill-fx-gallery-stage").screenshot({ path: reducedCapturePath });
    captures.push(reducedCapturePath);
    await page.locator("#skill-fx-gallery-quality").selectOption("high");
  }

  const desktopViewports = [];
  for (const viewport of DESKTOP_GALLERY_VIEWPORTS) {
    desktopViewports.push(await auditGalleryViewport(page, viewport));
  }
  const mobileViewports = [];
  for (const viewport of MOBILE_GALLERY_VIEWPORTS) {
    mobileViewports.push(await auditGalleryViewport(page, viewport));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileTargetAudits = {
    cheat: await anchorAudit(page, "CHEAT", '[data-fx-gallery-anchor="community"]', {
      expectedSourceSelector: '[data-fx-gallery-anchor="selfCards"]',
      expectedDestinationSelector: '[data-fx-gallery-anchor="community"]',
    }),
    nullification: await anchorAudit(page, "NULLIFICATION", '[data-fx-gallery-anchor="river"]', { target: "river", variant: "board" }),
    perception: await anchorAudit(page, "PERCEPTION", '[data-fx-gallery-anchor="community"]', {
      expectedStageSelector: '[data-fx-gallery-anchor="community"]',
    }),
    intimidation: await anchorAudit(page, "INTIMIDATION", '[data-fx-gallery-anchor="opponent"]', {
      expectedStageSelector: '[data-fx-gallery-anchor="opponent"]',
    }),
    fairness: await anchorAudit(page, "FAIRNESS", '[data-fx-gallery-anchor="self"]', {
      expectedSecondarySelector: '[data-fx-gallery-anchor="opponent"]',
    }),
    destiny: await anchorAudit(page, "DESTINY", '[data-fx-gallery-anchor="river"]'),
  };
  const mobile = mobileViewports.find((entry) => entry.viewport.width === 390) || mobileViewports[0];
  if (CAPTURE_DIR) {
    await page.setViewportSize({ width: 390, height: 844 });
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
    if (!effect.family || !effect.tier || !effect.impactType || !effect.rhythm || !effect.verb) failures.push(`incomplete director metadata: ${effect.skill}`);
    if (effect.heroNodes > 20 || effect.particleNodes > 12 || effect.impactNodes > 12 || effect.routeNodes > 4) failures.push(`DOM budget exceeded: ${effect.skill}`);
    if (effect.stageDisplay === "none" || effect.coreDisplay === "none" || effect.impactDisplay === "none") failures.push(`stage/impact missing: ${effect.skill}`);
    if (effect.hasRoute === "false" && effect.routeDisplay !== "none") failures.push(`route-free profile still renders a route node: ${effect.skill}`);
    if (effect.presentation === "journey" && effect.durationMs < 900) failures.push(`journey readability budget too short: ${effect.skill}`);
    const orderedTimeline = effect.presentation === "pulse"
      ? effect.anticipationMs > 0 && effect.impactDelayMs >= effect.routeDelayMs
      : effect.anticipationMs > 0 && effect.routeDelayMs > effect.anticipationMs
        && effect.impactDelayMs > effect.routeDelayMs;
    if (!(orderedTimeline && effect.impactDelayMs < effect.durationMs && effect.holdMs > 0)) {
      failures.push(`five-beat timeline contract failed: ${effect.skill}`);
    }
  });
  Object.entries(stageAudits).forEach(([name, audit]) => {
    if (!auditMatchesAnchors(audit)) failures.push(`stage/target anchor mismatch: ${name}`);
  });
  Object.entries(mobileTargetAudits).forEach(([name, audit]) => {
    if (!auditMatchesAnchors(audit)) failures.push(`mobile stage/target anchor mismatch: ${name}`);
  });
  if (stageAudits.deepBreath.stageTargetDistance < 40 || stageAudits.deepBreath.hasRoute !== "true") failures.push("Deep Breath lacks central-to-energy follow-through");
  if (stageAudits.cheat.routeDistance < 35 || stageAudits.cheat.impactType !== "card"
    || stageAudits.cheat.hasRoute !== "true") failures.push("Cheat lacks a visible source-to-destination card swap route");
  if (stageAudits.nullification.impactType !== "card") failures.push("Nullification lost card-slot impact");
  if (stageAudits.loanEnergy.impactType !== "energy" || stageAudits.loanChip.impactType !== "chip") failures.push("Loan branch impact types are incorrect");
  if (stageAudits.perception.impactType !== "board" || stageAudits.perception.hasRoute !== "false") failures.push("Perception lost its route-free public-board information field");
  if (stageAudits.intimidation.impactType !== "player" || stageAudits.intimidation.hasRoute !== "false") failures.push("Intimidation lost its localized opponent-player pressure target");
  if (stageAudits.fairness.impactType !== "hud" || stageAudits.fairness.hasRoute !== "false"
    || stageAudits.fairness.expectedSecondaryTargetX == null) failures.push("Fairness lost its bilateral tactical-zone impacts");
  const timingBySkill = Object.fromEntries(effects.map((effect) => [effect.skill, effect]));
  if (timingBySkill.DEEP_BREATH?.tier !== "FX2" || timingBySkill.DEEP_BREATH?.durationMs < 1000 || timingBySkill.DEEP_BREATH?.durationMs > 1100) failures.push("Deep Breath launch timing left its 1000-1100ms FX2 range");
  if (timingBySkill.PROBE?.tier !== "FX2" || timingBySkill.PROBE?.durationMs < 900 || timingBySkill.PROBE?.durationMs > 1000) failures.push("Probe launch timing left its 900-1000ms FX2 range");
  if (timingBySkill.RECYCLE?.tier !== "FX2" || timingBySkill.RECYCLE?.durationMs < 950 || timingBySkill.RECYCLE?.durationMs > 1050) failures.push("Recycle launch timing left its 950-1050ms FX2 range");
  if (alertPulse.tier !== "FX1" || alertPulse.presentation !== "pulse" || alertPulse.hasRoute !== "false"
    || alertPulse.routeDisplay !== "none" || !alertPulse.captionInsideLayer
    || alertPulse.durationMs < 520 || alertPulse.durationMs > 580) failures.push("Alert left its contained 520-580ms single-point FX1 pulse range");
  if (deepBreathRefund.durationMs < 1000 || deepBreathRefund.durationMs > 1150 || deepBreathRefund.context !== "settlement"
    || deepBreathRefund.captionText.indexOf("ENERGY RETURN +2") < 0) failures.push("Deep Breath private refund result timing/caption failed");
  if (secrecy.accepted || secrecy.after !== secrecy.before || secrecy.publicVisible || secrecy.privateVisible) failures.push("opponent secret event produced a visual side channel");
  if (resultOnly.identity !== "result-only" || resultOnly.skill !== "RESULT" || resultOnly.family !== "result"
    || resultOnly.impact !== "hud" || /防守|DEFENSE|DAMAGE HALVED|绝密|TOP SECRET|ACCESS DENIED|PROTOCOL|×2/i.test(resultOnly.caption)
    || resultOnly.tier !== "FX2" || resultOnly.durationMs !== 1050
    || resultOnly.title !== "RESULT CONFIRMED" || resultOnly.result !== "RESOLUTION APPLIED"
    || resultOnly.glyph !== "✓" || resultOnly.impactGlyph !== "✓" || resultOnly.stageData || resultOnly.modifiers) {
    failures.push("result-only stage leaked a secret skill identity, family silhouette, or skill-specific result copy");
  }
  const neutralResultSignature = ({ skill, family, tier, impact, identity, durationMs, title, result, glyph, impactGlyph, stageData, modifiers }) => (
    JSON.stringify({ skill, family, tier, impact, identity, durationMs, title, result, glyph, impactGlyph, stageData, modifiers })
  );
  if (neutralResultSignature(protocolResultOnly) !== neutralResultSignature(resultOnly)
    || /PROTOCOL|PAIR|×2/i.test(protocolResultOnly.caption)) {
    failures.push("different hidden result-only skills did not converge on one neutral visual contract");
  }
  if (neutralGeometry.some((entry) => entry.skill !== "RESULT" || entry.family !== "result"
    || entry.route !== "false" || entry.routeDisplay !== "none" || entry.secondaryImpacts !== 0
    || !isNear(entry.stageX, entry.expectedX) || !isNear(entry.stageY, entry.expectedY))) {
    failures.push("result-only presentation inherited a private stage, route or bilateral target");
  }
  if (dedupeAndPriority.dedupe[0] !== true || dedupeAndPriority.dedupe[1] !== false) failures.push("duplicate eventId was not suppressed");
  if (eventAdmission.duplicateCopies[0] !== true || eventAdmission.duplicateCopies[1] !== false || eventAdmission.copyQueue !== 1) failures.push("public/private event copies were not merged by eventId");
  if (eventAdmission.duplicateRequestCopies[0] !== true || eventAdmission.duplicateRequestCopies[1] !== false
    || eventAdmission.requestCopyQueue !== 1) failures.push("resolved/private copies were not merged by requestId + skillId");
  if (eventAdmission.topSecretChains.some((chain) => chain.accepted[0] !== false || chain.accepted[1] !== true)
    || eventAdmission.topSecretKeys.length !== 3
    || eventAdmission.topSecretKeys.some((key) => key.endsWith(":TOP_SECRET"))) {
    failures.push("Secret Guard leaked to the opponent or suppressed the attacker's own failure feedback");
  }
  if (eventAdmission.deepBreathEvents.some((value) => !value)
    || eventAdmission.deepBreathKeys.join(",") !== "request:deep-breath-use:DEEP_BREATH,result:deep-breath-refund") failures.push("Deep Breath activation and refund identities collided");
  if (eventAdmission.loanRequests.some((value) => !value) || eventAdmission.loanQueue.join(",") !== "loan-a,loan-b") failures.push("different Loan requestIds did not both enter the FX queue");
  if (eventAdmission.fallbackVariants.some((value) => !value) || eventAdmission.fallbackDuplicate !== false
    || eventAdmission.fallbackQueue !== 4) failures.push("fallback identity did not merge only the identical copy");
  if (eventAdmission.capacity.rejected !== false || eventAdmission.capacity.markedWhileRejected || !eventAdmission.capacity.retried || eventAdmission.capacity.queue !== 8) failures.push("queue rejection poisoned the FX dedupe cache");
  if (dedupeAndPriority.endgame || dedupeAndPriority.restored || dedupeAndPriority.replay) failures.push("Endgame/reconnect/replay entered ordinary StageFX");
  if (directorInteractions.blood.accepted.some((value) => !value)
    || directorInteractions.blood.instances !== 1
    || directorInteractions.blood.variant !== "dual"
    || !directorInteractions.blood.upgraded
    || directorInteractions.blood.glyph !== "×4"
    || directorInteractions.blood.remainingHoldMs < 480) failures.push("dual Blood Battle did not merge into one ×4 stage with a stable upgrade hold");
  if (directorInteractions.counterCut.accepted.some((value) => !value)
    || directorInteractions.counterCut.targetFamily !== "cheat"
    || !directorInteractions.counterCut.cut
    || directorInteractions.counterCut.interrupted !== "true"
    || directorInteractions.counterCut.queueOrder.join(",") !== "COUNTER,PROBE") failures.push("Counter did not cut the active target stage and take priority before resolving");
  if (stateMarkers.length !== 2 || stateMarkers.some((marker) => marker.distanceFromStage < 55)) failures.push("persistent state markers drifted to the stage center");
  if (lowQualityDecoration.quality !== "low" || lowQualityDecoration.stageDisplay === "none" || lowQualityDecoration.impactDisplay === "none" || lowQualityDecoration.packetDisplay !== "none") failures.push("Low quality did not preserve the reduced central director");
  if (lowQualityMotion.motion !== "reduced" || lowQualityMotion.stageDisplay === "none" || lowQualityMotion.impactDisplay === "none" || lowQualityMotion.routeDisplay !== "none" || lowQualityMotion.bodyShakes) failures.push("Low quality central stage/impact contract failed");
  if (captionless.captionDisplay !== "none" || captionless.coreDisplay === "none") failures.push("captionless graphical identity mode failed");
  if (graphicalSignatures.some((entry) => !entry.geometry || !entry.artMotion)
    || new Set(graphicalSignatures.map((entry) => entry.geometry)).size < 12) failures.push("core skills are not graphically distinct enough without captions");
  if (!guides.stageControl || !guides.targetControl || Number(guides.stageVisible) < .5 || Number(guides.targetVisible) < .5) failures.push("Gallery stage/target guides are unavailable");
  if (Object.values(pointerSafety).some((value) => value !== "none")) failures.push("an FX layer blocks pointer input");
  if (!fairnessCompletion.accepted || fairnessCompletion.addedInstances !== 1 || fairnessCompletion.removedInstances !== 1
    || fairnessCompletion.maxInstances !== 1 || fairnessCompletion.maxAtmospheres !== 1
    || fairnessCompletion.finalInstances !== 0 || fairnessCompletion.finalAtmospheres !== 0
    || fairnessCompletion.bodyShakeObserved || fairnessCompletion.reappearedAfterFinish
    || fairnessCompletion.rootAnimations.some((name) => /skill-effect-table-shake/i.test(name))) {
    failures.push("Fairness lifecycle did not complete as a single local-layer instance without root shake or remount");
  }
  if (endgameSettlementOrdering.prematureSettlementVisible || !endgameSettlementOrdering.settlementVisibleAfterFx
    || !endgameSettlementOrdering.hiddenAtFxFinished || !endgameSettlementOrdering.ordered) {
    failures.push(`Endgame presentation barrier ordering failed: ${endgameSettlementOrdering.orderedStages.join(" -> ")}`);
  }
  if (Object.values(fairnessStateBadges).some((passed) => passed !== true)) {
    failures.push("Fairness state sync failed to restore/remove both locks without replaying the main animation");
  }
  if (lowEndgameBarrier.staticHold.status !== "finished"
    || !lowEndgameBarrier.staticHold.visible || !lowEndgameBarrier.staticHold.resultHold
    || !lowEndgameBarrier.staticHold.settlementHidden || !lowEndgameBarrier.staticHold.barrierActive
    || !lowEndgameBarrier.staticHold.actionDeadlineCleared || !lowEndgameBarrier.staticHold.countdownRafIdle
    || lowEndgameBarrier.staticHold.countdownText !== "—"
    || !lowEndgameBarrier.settlementVisibleAfterBarrier || !lowEndgameBarrier.ordered
    || lowEndgameBarrier.dynamicDurationMs < 300 || lowEndgameBarrier.dynamicDurationMs > 500
    || lowEndgameBarrier.revealDelayMs < 350) {
    failures.push("Low quality Endgame did not switch to a static hold until the shared reveal barrier released");
  }
  if (orphanCleanup.effects || orphanCleanup.states) failures.push("manager clear left orphan FX nodes");
  const invalidMobileViewports = mobileViewports.filter((entry) => (
    !entry.panelInsideViewport || !entry.stageInsidePanel || !entry.stageVerticallyVisible
    || entry.stageVisibleRatio < .999 || !entry.captionVerticallyVisible
    || entry.pageHorizontalOverflow || entry.modalOverflowX !== "hidden" || entry.panelOverflowX !== "hidden"
    || !entry.replayUsable || !entry.stageCentral || entry.panelScrollTop > 1
    || entry.coreWidth > entry.viewport.width * .89
  ));
  if (invalidMobileViewports.length) failures.push(`mobile gallery or central stage contract failed: ${invalidMobileViewports.map((entry) => `${entry.viewport.width}x${entry.viewport.height}`).join(", ")}`);
  const invalidDesktopViewports = desktopViewports.filter((entry) => (
    !entry.panelInsideViewport || !entry.stageInsidePanel || !entry.stageVerticallyVisible
    || entry.stageVisibleRatio < .999 || !entry.captionVerticallyVisible
    || entry.pageHorizontalOverflow || entry.modalOverflowX !== "hidden" || entry.panelOverflowX !== "hidden"
    || !entry.replayUsable || !entry.stageCentral || entry.panelScrollTop > 1
  ));
  if (invalidDesktopViewports.length) failures.push(`desktop gallery or central stage contract failed: ${invalidDesktopViewports.map((entry) => `${entry.viewport.width}x${entry.viewport.height}`).join(", ")}`);
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
      optionCount: optionIds.length, effects, stageAudits, alertPulse, deepBreathRefund,
      secrecy, resultOnly, protocolResultOnly, neutralGeometry, dedupeAndPriority, eventAdmission, directorInteractions,
      stateMarkers, lowQualityDecoration, lowQualityMotion, captionless, graphicalSignatures, guides,
      pointerSafety, fairnessCompletion, fairnessStateBadges, endgameSettlementOrdering, lowEndgameBarrier, orphanCleanup,
      mobile, mobileViewports, mobileTargetAudits, desktopViewports, captures,
    },
  }, null, 2));
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
