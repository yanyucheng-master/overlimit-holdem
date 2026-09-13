(function initOverlimitSkillFxManager(root, factory) {
  const profilesApi = root?.OVERLIMIT_SKILL_FX
    || (typeof require === "function" ? require("./skill-fx-profiles") : null);
  const qualityApi = root?.OverlimitVisualQuality
    || (typeof require === "function" ? require("./visual-quality") : null);
  const artApi = root?.OverlimitSkillFxArt
    || (typeof require === "function" ? require("./skill-fx-art") : null);
  const api = factory(profilesApi, qualityApi, artApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OverlimitSkillFx = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildSkillFxManager(profilesApi, qualityApi, artApi) {
  "use strict";

  const SHAKE_ALLOWLIST = new Set(["FAIRNESS", "DEAD_END", "BLOOD_BATTLE"]);
  const MAX_DEDUPE_KEYS = 192;
  const MAX_QUEUE_LENGTH = 8;
  const RECENT_FINGERPRINT_MS = 760;
  const COUNTER_CUT_MS = 180;
  const BLOOD_UPGRADE_HOLD_MS = 520;

  function normalizeQuality(value) {
    return qualityApi.normalizeQuality(value);
  }

  function cleanToken(value, fallback = "") {
    const text = String(value == null ? fallback : value).replace(/[\u0000-\u001f\u007f]/g, " ").trim();
    return text.slice(0, 180);
  }

  function localizedSkillName(profile) {
    const i18n = typeof window !== "undefined" ? window.OverlimitI18n : null;
    const id = profile && profile.id;
    const key = id ? "skills." + id + ".name" : "";
    if (i18n && key && i18n.has(key)) return i18n.t(key);
    return profile && profile.name ? profile.name : "";
  }

  function localizedSkillKicker(profile) {
    const localizedName = cleanToken(localizedSkillName(profile));
    const englishName = cleanToken(profile && profile.english);
    if (englishName && englishName.toLocaleUpperCase() !== localizedName.toLocaleUpperCase()) {
      return englishName.toLocaleUpperCase();
    }
    return cleanToken(profile && profile.tier ? `${profile.tier} // SKILL EVENT` : "SKILL EVENT");
  }

  function revealsSkillIdentity(event = {}) {
    const disclosure = String(event.disclosure || "public").toLowerCase();
    return event.revealIdentity === true
      || (!event.resultOnly && (event.audience === "self" || disclosure === "public"));
  }

  function neutralResultEvent(event = {}) {
    const publicTargetElement = isElement(event.publicTargetElement) ? event.publicTargetElement : null;
    return {
      ...event,
      // Result-only presentation must not inherit private geometry, including
      // the source/destination and bilateral impacts added by the director.
      stageElement: isElement(event.publicStageElement) ? event.publicStageElement : null,
      targetElement: publicTargetElement,
      fromElement: null,
      toElement: publicTargetElement,
      secondaryTargetElement: null,
      route: false,
      anchor: cleanToken(event.publicAnchor || "board"),
      glyph: cleanToken(event.publicGlyph || "✓"),
      impactGlyph: cleanToken(event.publicImpactGlyph || event.publicGlyph || "✓"),
      resultTitle: cleanToken(event.publicResultTitle || "RESULT CONFIRMED"),
      effectLabel: cleanToken(event.publicResultLabel || "RESOLUTION APPLIED"),
      safeMessage: "",
      stageLines: [],
      compositeSkills: [],
      compositeLabels: [],
      variant: "result",
      mode: "result",
      interruptedVisual: "",
    };
  }

  function neutralResultProfile(profile = {}) {
    return Object.freeze({
      ...profile,
      family: "result",
      tier: "FX2",
      presentation: "result",
      route: false,
      rhythm: "result",
      durationMs: 1050,
      resultDurations: null,
      resultRhythms: null,
      accent: "#d8e8f0",
      secondary: "#79b9c9",
      glyph: "✓",
      sound: "signal",
      haptics: null,
      shake: null,
      persistent: null,
      stageLines: [],
      resultLabel: "RESOLUTION APPLIED",
      verb: "public-result",
      anchor: "board",
    });
  }

  function explicitSkillFxKey(event) {
    if (!event) return "";
    const eventId = cleanToken(event.eventId);
    if (eventId) return `event:${eventId}`;

    const requestId = cleanToken(event.requestId);
    const skillId = cleanToken(event.skillId).toUpperCase();
    if (requestId && skillId) return `request:${requestId}:${skillId}`;

    const resultId = cleanToken(event.resultId);
    if (resultId) return `result:${resultId}`;
    return "";
  }

  function semanticSkillFxKey(event) {
    if (!event) return "";
    const explicit = explicitSkillFxKey(event);
    if (explicit) return explicit;
    return `fallback:${fallbackSkillFxFingerprint(event)}`;
  }

  function fallbackSkillFxFingerprint(event) {
    return [
      cleanToken(event.handId || event.handNo || "hand"),
      cleanToken(event.casterId || "caster"),
      cleanToken(event.skillId || "skill"),
      cleanToken(event.targetKey || event.anchor || "target"),
      cleanToken(event.phase || "phase"),
      cleanToken(event.status || event.state || "SUCCESS"),
      cleanToken(event.disclosure || "public"),
      cleanToken(event.context || "table"),
      event.resultOnly ? "result" : "event",
      Number(event.sequence ?? event.at ?? 0),
    ].join("|");
  }

  function hasExplicitSkillFxId(event) {
    return Boolean(explicitSkillFxKey(event));
  }

  function isElement(value) {
    return Boolean(value && typeof value.getBoundingClientRect === "function");
  }

  function centerOf(element, fallback) {
    if (!isElement(element)) return fallback;
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: Math.max(24, rect.width),
      height: Math.max(24, rect.height),
    };
  }

  function makeAtom(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text != null) node.textContent = cleanToken(text);
    return node;
  }

  function impactGlyphFor(profile, event) {
    if (event.impactGlyph != null) return cleanToken(event.impactGlyph);
    if (profile.impact === "energy") return "•";
    if (profile.impact === "chip") return "◆";
    if (profile.impact === "player") return "◇";
    if (profile.impact === "board") return "⌗";
    if (profile.impact === "hud") return "▦";
    if (profile.impact === "interrupt") return "×";
    return profile.glyph;
  }

  class SkillFxManager {
    constructor(options = {}) {
      this.effectLayer = options.effectLayer || null;
      this.stateLayer = options.stateLayer || null;
      this.broadcastLayer = options.broadcastLayer || null;
      this.privateLayer = options.privateLayer || null;
      this.getAnchors = typeof options.getAnchors === "function" ? options.getAnchors : () => ({});
      this.getSettings = typeof options.getSettings === "function"
        ? options.getSettings
        : () => ({ quality: "high" });
      this.playSound = typeof options.playSound === "function" ? options.playSound : () => {};
      this.playHaptics = typeof options.playHaptics === "function" ? options.playHaptics : () => {};
      this.onSuppressed = typeof options.onSuppressed === "function" ? options.onSuppressed : () => {};
      this.queue = [];
      this.busy = false;
      this.timer = 0;
      this.activeDeadline = 0;
      this.pauseUntil = 0;
      this.activeNode = null;
      this.activeJob = null;
      this.activeToken = 0;
      this.dedupeKeys = new Set();
      this.dedupeOrder = [];
      this.recentFingerprints = new Map();
      this.stateDescriptors = [];
      this.boundRefresh = () => this.refreshPositions();
      if (typeof window !== "undefined") {
        window.addEventListener("resize", this.boundRefresh, { passive: true });
        window.addEventListener("scroll", this.boundRefresh, { passive: true, capture: true });
      }
    }

    settings() {
      const raw = this.getSettings() || {};
      return {
        quality: normalizeQuality(raw.quality),
      };
    }

    refreshQuality() {
      const settings = this.settings();
      if (this.effectLayer) {
        this.effectLayer.dataset.fxQuality = settings.quality;
        this.effectLayer.dataset.fxMotion = settings.quality === "low" ? "reduced" : "full";
      }
      if (this.activeJob && this.activeNode) {
        this.activeJob.settings = settings;
        this.activeNode.dataset.quality = settings.quality;
        this.activeNode.dataset.motion = settings.quality === "low" ? "reduced" : "full";
        if (settings.quality === "low") this.activeNode.dataset.shake = "none";
      }
      // An active effect keeps its original deadline; visual preferences must
      // never advance a presentation barrier or replay an accepted event.
    }

    rememberKey(key) {
      if (!key || this.dedupeKeys.has(key)) return false;
      this.dedupeKeys.add(key);
      this.dedupeOrder.push(key);
      while (this.dedupeOrder.length > MAX_DEDUPE_KEYS) {
        this.dedupeKeys.delete(this.dedupeOrder.shift());
      }
      return true;
    }

    pruneRecentFingerprints(now = Date.now()) {
      this.recentFingerprints.forEach((time, key) => {
        if (now - time > 5000) this.recentFingerprints.delete(key);
      });
    }

    isRecentDuplicate(event) {
      if (hasExplicitSkillFxId(event)) return false;
      const now = Date.now();
      const fingerprint = fallbackSkillFxFingerprint(event);
      const previous = this.recentFingerprints.get(fingerprint) || 0;
      this.pruneRecentFingerprints(now);
      return now - previous < RECENT_FINGERPRINT_MS;
    }

    rememberAcceptedEvent(event, key) {
      if (!this.rememberKey(key)) return false;
      if (!hasExplicitSkillFxId(event)) {
        const now = Date.now();
        this.recentFingerprints.set(fallbackSkillFxFingerprint(event), now);
        this.pruneRecentFingerprints(now);
      }
      return true;
    }

    play(rawEvent = {}) {
      const receivedEvent = { ...rawEvent, skillId: cleanToken(rawEvent.skillId).toUpperCase() };
      const baseProfile = profilesApi?.getSkillFxProfile?.(receivedEvent.skillId);
      if (!baseProfile || receivedEvent.skillId === "ENDGAME" || receivedEvent.restored || receivedEvent.replay) return false;
      if (!profilesApi?.canRenderSkillFx?.(receivedEvent, baseProfile)) {
        this.onSuppressed(receivedEvent, baseProfile);
        return false;
      }
      const identityRevealed = revealsSkillIdentity(receivedEvent);
      const neutralResult = receivedEvent.resultOnly === true && !identityRevealed;
      const event = neutralResult ? neutralResultEvent(receivedEvent) : receivedEvent;
      const requestedTier = cleanToken(event.tier).toUpperCase();
      const requestedPresentation = cleanToken(event.presentation).toLowerCase();
      const presentation = Object.values(profilesApi?.FX_PRESENTATION || {}).includes(requestedPresentation)
        ? requestedPresentation
        : baseProfile.presentation;
      const selectedProfile = /^FX[1-5]$/.test(requestedTier) || presentation !== baseProfile.presentation
        ? Object.freeze({
            ...baseProfile,
            ...(/^FX[1-5]$/.test(requestedTier) ? { tier: requestedTier } : {}),
            presentation,
          })
        : baseProfile;
      const profile = neutralResult ? neutralResultProfile(selectedProfile) : selectedProfile;
      const key = semanticSkillFxKey(receivedEvent);
      if (!event.force && (this.dedupeKeys.has(key) || this.isRecentDuplicate(receivedEvent))) return false;
      const settings = this.settings();
      const duration = profilesApi.fxDuration(profile, settings.quality, event.variant);
      const timeline = profilesApi.fxTimeline?.(profile, settings.quality, event.variant)
        || { rhythm: profile.rhythm || "standard", durationMs: duration };
      const job = { event, profile, settings, duration, timeline, key };
      if (profile.id === "BLOOD_BATTLE" && !neutralResult) {
        const existingBlood = this.activeJob?.profile?.id === "BLOOD_BATTLE"
          ? this.activeJob
          : this.queue.find((queued) => queued.profile.id === "BLOOD_BATTLE");
        const existingHand = cleanToken(existingBlood?.event?.handId ?? existingBlood?.event?.handNo);
        const incomingHand = cleanToken(event.handId ?? event.handNo);
        const existingContext = cleanToken(existingBlood?.event?.context);
        const incomingContext = cleanToken(event.context);
        const sameBloodWindow = (!existingHand || !incomingHand || existingHand === incomingHand)
          && (!existingContext || !incomingContext || existingContext === incomingContext);
        if (existingBlood && sameBloodWindow && existingBlood.event.casterId !== event.casterId) {
          existingBlood.event.glyph = "×4";
          existingBlood.event.effectLabel = "STAKES ×4";
          existingBlood.event.variant = "dual";
          if (existingBlood === this.activeJob && this.activeNode) {
            this.activeNode.dataset.variant = "dual";
            this.activeNode.classList.add("is-upgraded");
            const glyph = this.activeNode.querySelector(".skill-effect-glyph");
            const impactGlyph = this.activeNode.querySelector(".skill-impact-glyph");
            const result = this.activeNode.querySelector(".skill-effect-result");
            if (glyph) glyph.textContent = "×4";
            if (impactGlyph) impactGlyph.textContent = "×4";
            if (result) result.textContent = "STAKES ×4";
            this.extendActiveHold(settings.quality === "low" ? 300 : BLOOD_UPGRADE_HOLD_MS);
          }
          if (!event.force) this.rememberAcceptedEvent(receivedEvent, key);
          return true;
        }
      }
      if (this.queue.length >= MAX_QUEUE_LENGTH) return false;
      const interruptsActive = profile.id === "COUNTER" && profile.tier === "FX3" && this.activeNode
        && this.activeJob?.profile?.id !== "COUNTER";
      if (interruptsActive) {
        const activeIdentityRevealed = this.activeNode.dataset.identity === "revealed";
        event.interruptedVisual = activeIdentityRevealed ? this.activeJob.profile.family : "hidden-signal";
        event.targetElement = isElement(this.activeJob.event.targetElement)
          ? this.activeJob.event.targetElement
          : this.resolveTarget(this.activeJob);
        this.queue.unshift(job);
      } else {
        this.queue.push(job);
      }
      if (!event.force) this.rememberAcceptedEvent(receivedEvent, key);
      if (interruptsActive) {
        this.activeNode.classList.add("is-counter-cut");
        this.activeNode.dataset.interrupted = "true";
        this.activeDeadline = Date.now() + (settings.quality === "low" ? 90 : COUNTER_CUT_MS);
        this.scheduleActiveFinish();
      }
      this.pump();
      return true;
    }

    pump() {
      if (this.busy || !this.queue.length) return;
      const wait = Math.max(0, this.pauseUntil - Date.now());
      if (wait > 0) {
        this.timer = setTimeout(() => {
          this.timer = 0;
          this.pump();
        }, wait);
        return;
      }
      const job = this.queue.shift();
      job.settings = this.settings();
      job.duration = profilesApi.fxDuration(job.profile, job.settings.quality, job.event.variant);
      job.timeline = profilesApi.fxTimeline(job.profile, job.settings.quality, job.event.variant);
      this.busy = true;
      this.activeJob = job;
      this.activeToken += 1;
      job.token = this.activeToken;
      job.finished = false;
      job.startedAt = Date.now();
      this.activeDeadline = job.startedAt + job.duration + 100;
      this.render(job);
      this.scheduleActiveFinish(job.token);
    }

    scheduleActiveFinish(expectedToken = this.activeToken) {
      if (this.timer) clearTimeout(this.timer);
      const remaining = Math.max(0, this.activeDeadline - Date.now());
      this.timer = setTimeout(() => this.finishActive(expectedToken), remaining);
    }

    extendActiveHold(ms) {
      if (!this.activeJob) return;
      this.activeDeadline = Math.max(this.activeDeadline, Date.now() + Math.max(0, Number(ms) || 0));
      this.scheduleActiveFinish(this.activeToken);
    }

    finishActive(expectedToken = this.activeToken) {
      const job = this.activeJob;
      if (!job || job.finished || expectedToken !== this.activeToken || job.token !== expectedToken) return false;
      job.finished = true;
      if (this.timer) clearTimeout(this.timer);
      this.timer = 0;
      this.activeDeadline = 0;
      this.activeNode?.remove();
      this.activeNode = null;
      this.hideBroadcasts();
      if (this.effectLayer) this.effectLayer.classList.remove("is-settlement-active");
      this.activeJob = null;
      this.busy = false;
      if (typeof job.event?.onComplete === "function") job.event.onComplete(job);
      this.pump();
      return true;
    }

    hideBroadcasts() {
      this.broadcastLayer?.classList.add("hidden");
      this.privateLayer?.classList.add("hidden");
      if (typeof document !== "undefined") document.body?.classList.remove("skill-fx-public-on");
    }

    resolveStage(job) {
      const anchors = this.getAnchors() || {};
      if (job.profile.presentation === profilesApi?.FX_PRESENTATION?.PULSE) {
        return this.resolveTarget(job);
      }
      if (isElement(job.event.stageElement)) return job.event.stageElement;
      return anchors.stageCenter || anchors.tableCenter || anchors.community || anchors.board || this.effectLayer;
    }

    resolveTarget(job) {
      const { event, profile } = job;
      const anchors = this.getAnchors() || {};
      if (isElement(event.targetElement)) return event.targetElement;
      const anchor = event.anchor || profile.anchor;
      if (anchor === "caster") return event.casterId === event.viewerId ? anchors.self : anchors.opponent;
      if (anchor === "opponent") return anchors.opponent;
      if (anchor === "self") return anchors.self;
      if (anchor === "energy") return event.casterId === event.viewerId
        ? (anchors.selfEnergy || anchors.self)
        : (anchors.opponentEnergy || anchors.opponent);
      if (anchor === "pot") return anchors.pot || anchors.board;
      if (anchor === "deck") return anchors.deck || anchors.community || anchors.board;
      if (anchor === "river") return anchors.river || anchors.community || anchors.board;
      if (anchor === "cards") return event.casterId === event.viewerId
        ? (anchors.selfCards || anchors.self)
        : (anchors.opponentCards || anchors.opponent);
      if (anchor === "target") return anchors.target || anchors.community || anchors.board;
      if (anchor === "settlement") return anchors.settlement || anchors.pot || anchors.board;
      if (anchor === "players") return anchors.board || anchors.pot;
      return anchors[anchor] || anchors.board || this.effectLayer;
    }

    positionNode(node, stage, target, job) {
      if (!node || !this.effectLayer) return;
      const layerRect = this.effectLayer.getBoundingClientRect();
      const fallback = {
        x: layerRect.left + layerRect.width / 2,
        y: layerRect.top + layerRect.height / 2,
        width: Math.max(120, layerRect.width * 0.22),
        height: Math.max(80, layerRect.height * 0.18),
      };
      const stageBox = centerOf(stage, fallback);
      const targetBox = centerOf(target, stageBox);
      const sourceBox = centerOf(job.event.fromElement, stageBox);
      const destinationBox = centerOf(job.event.toElement, targetBox);
      const secondaryTargetBox = centerOf(job.event.secondaryTargetElement, targetBox);
      const stageX = stageBox.x - layerRect.left;
      const stageY = stageBox.y - layerRect.top;
      const targetX = targetBox.x - layerRect.left;
      const targetY = targetBox.y - layerRect.top;
      node.style.setProperty("--fx-stage-x", `${stageX}px`);
      node.style.setProperty("--fx-stage-y", `${stageY}px`);
      node.style.setProperty("--fx-stage-w", `${stageBox.width}px`);
      node.style.setProperty("--fx-stage-h", `${stageBox.height}px`);
      node.style.setProperty("--fx-target-x", `${targetX}px`);
      node.style.setProperty("--fx-target-y", `${targetY}px`);
      node.style.setProperty("--fx-target-w", `${targetBox.width}px`);
      node.style.setProperty("--fx-target-h", `${targetBox.height}px`);
      node.style.setProperty("--fx-secondary-target-x", `${secondaryTargetBox.x - layerRect.left}px`);
      node.style.setProperty("--fx-secondary-target-y", `${secondaryTargetBox.y - layerRect.top}px`);
      node.style.setProperty("--fx-secondary-target-w", `${secondaryTargetBox.width}px`);
      node.style.setProperty("--fx-secondary-target-h", `${secondaryTargetBox.height}px`);
      // Compatibility aliases keep the existing family artwork centered on the
      // new hero stage while impact/route use the target variables below.
      node.style.setProperty("--fx-x", `${stageX}px`);
      node.style.setProperty("--fx-y", `${stageY}px`);
      node.style.setProperty("--fx-w", `${stageBox.width}px`);
      node.style.setProperty("--fx-h", `${stageBox.height}px`);

      const routeX = destinationBox.x - sourceBox.x;
      const routeY = destinationBox.y - sourceBox.y;
      const routeLength = Math.max(0, Math.hypot(routeX, routeY));
      const routeEnabled = job.event.route !== false && job.profile.route !== false;
      node.dataset.hasRoute = routeEnabled && routeLength > 28 ? "true" : "false";
      node.style.setProperty("--fx-from-x", `${sourceBox.x - layerRect.left}px`);
      node.style.setProperty("--fx-from-y", `${sourceBox.y - layerRect.top}px`);
      node.style.setProperty("--fx-to-x", `${destinationBox.x - layerRect.left}px`);
      node.style.setProperty("--fx-to-y", `${destinationBox.y - layerRect.top}px`);
      node.style.setProperty("--fx-route-length", `${Math.max(24, routeLength)}px`);
      node.style.setProperty("--fx-route-angle", `${Math.atan2(routeY, routeX) * 180 / Math.PI}deg`);
      node.style.setProperty("--fx-route-dx", `${routeX}px`);
      node.style.setProperty("--fx-route-dy", `${routeY}px`);
    }

    buildEffectNode(job) {
      const { event, profile, settings, duration, timeline } = job;
      const node = makeAtom("article", "skill-effect-instance");
      const revealIdentity = revealsSkillIdentity(event);
      const neutralResult = event.resultOnly === true && !revealIdentity;
      // Art selection is downstream of disclosure. Never pass a private identity
      // into the artwork library for an anonymous public resolution.
      const artOptions = {
        family: neutralResult ? "result" : profile.family,
        skillId: neutralResult ? "RESULT" : event.skillId,
        variant: neutralResult ? "default" : cleanToken(event.variant || event.mode || "default").toLowerCase(),
        status: cleanToken(event.status || "SUCCESS").toLowerCase(),
      };
      node.dataset.art = "polished";
      const impactType = cleanToken(neutralResult
        ? (event.publicImpact || "hud")
        : (event.impact || event.impactType
          || (profile.id === "LOAN" && String(event.variant).toLowerCase() === "energy" ? "energy" : profile.impact || "board"))).toLowerCase();
      node.dataset.skill = neutralResult ? "RESULT" : profile.id;
      node.dataset.effect = neutralResult ? "result" : profile.family;
      node.dataset.impact = impactType;
      node.dataset.tier = profile.tier;
      node.dataset.quality = settings.quality;
      node.dataset.motion = settings.quality === "low" ? "reduced" : "full";
      node.dataset.side = event.casterId === event.viewerId ? "self" : "opponent";
      node.dataset.status = cleanToken(event.status || "SUCCESS").toLowerCase();
      node.dataset.variant = cleanToken(event.variant || event.mode || "default").toLowerCase();
      node.dataset.context = cleanToken(event.context || "table").toLowerCase();
      node.dataset.presentation = cleanToken(profile.presentation || "journey").toLowerCase();
      node.dataset.rhythm = cleanToken(timeline?.rhythm || profile.rhythm || "standard").toLowerCase();
      node.dataset.verb = neutralResult ? "public-result" : cleanToken(profile.verb || profile.family).toLowerCase();
      const shakeEligible = profile.id !== "BLOOD_BATTLE"
        || event.context === "settlement"
        || event.resultOnly === true
        || ["REVEALED", "RESULT"].includes(cleanToken(event.status).toUpperCase());
      node.dataset.shake = settings.quality === "high" && shakeEligible
        && profile.shake === "soft" && SHAKE_ALLOWLIST.has(profile.id)
        ? "soft"
        : "none";
      if (event.interruptedVisual) node.dataset.interruptedVisual = cleanToken(event.interruptedVisual).toLowerCase();
      const compositeSkills = Array.isArray(event.compositeSkills)
        ? event.compositeSkills.map((value) => cleanToken(value).toUpperCase()).filter(Boolean).slice(0, 6)
        : [];
      if (compositeSkills.length > 1) node.dataset.composite = compositeSkills.join(" ");
      node.style.setProperty("--fx-duration", `${duration}ms`);
      node.style.setProperty("--fx-accent", neutralResult ? "#d8e8f0" : profile.accent);
      node.style.setProperty("--fx-secondary", neutralResult ? "#79b9c9" : profile.secondary);
      const anticipationEnd = Number(timeline?.anticipationEndMs || Math.round(duration * .15));
      const manifestEnd = Number(timeline?.manifestEndMs || Math.round(duration * .38));
      const routeEnd = Number(timeline?.routeEndMs || Math.round(duration * .62));
      const impactEnd = Number(timeline?.impactEndMs || Math.round(duration * .82));
      const holdEnd = Number(timeline?.holdEndMs || Math.round(duration * .95));
      node.style.setProperty("--fx-anticipation-ms", `${anticipationEnd}ms`);
      node.style.setProperty("--fx-manifest-ms", `${Math.max(1, holdEnd - anticipationEnd)}ms`);
      node.style.setProperty("--fx-route-delay", `${manifestEnd}ms`);
      node.style.setProperty("--fx-route-ms", `${Math.max(1, routeEnd - manifestEnd)}ms`);
      node.style.setProperty("--fx-impact-delay", `${routeEnd}ms`);
      node.style.setProperty("--fx-impact-ms", `${Math.max(1, duration - routeEnd)}ms`);
      node.style.setProperty("--fx-title-delay", `${anticipationEnd}ms`);
      node.style.setProperty("--fx-title-ms", `${Math.max(1, holdEnd - anticipationEnd)}ms`);
      node.style.setProperty("--fx-result-delay", `${routeEnd}ms`);
      node.style.setProperty("--fx-result-ms", `${Math.max(1, duration - routeEnd)}ms`);
      node.style.setProperty("--fx-hold-ms", `${Math.max(1, holdEnd - impactEnd)}ms`);

      const atmosphere = makeAtom("div", "skill-effect-atmosphere");
      const stage = makeAtom("div", "skill-effect-stage");
      const core = makeAtom("div", "skill-effect-core");
      core.append(
        artApi.createCore(artOptions),
        makeAtom("strong", "skill-effect-glyph", neutralResult ? "✓" : (event.glyph || profile.glyph))
      );
      node.dataset.numeric = !neutralResult && /[0-9½]/.test(String(event.glyph || profile.glyph)) ? "true" : "false";

      const configuredStageLines = neutralResult
        ? []
        : Array.isArray(event.stageLines)
        ? event.stageLines
        : Array.isArray(profile.stageLines)
          ? profile.stageLines
          : [];
      if (configuredStageLines.length) {
        const data = makeAtom("div", "skill-effect-stage-data");
        configuredStageLines.slice(0, 4).forEach((value) => data.appendChild(makeAtom("span", "skill-effect-data-line", value)));
        core.appendChild(data);
      }
      stage.appendChild(core);

      const route = makeAtom("div", "skill-effect-route");
      route.append(
        artApi.createRoute(),
        makeAtom("i", "route-packet packet-a"),
        makeAtom("i", "route-packet packet-b")
      );

      const makeImpact = () => {
        const surface = makeAtom("div", "skill-effect-impact");
        surface.append(
          artApi.createImpact(artOptions),
          makeAtom("strong", "skill-impact-glyph", neutralResult ? "✓"
            : event.impactGlyph != null ? event.impactGlyph
              : node.dataset.numeric === "true" ? (event.glyph || profile.glyph)
                : impactGlyphFor({ ...profile, impact: impactType }, event))
        );
        return surface;
      };
      const impact = makeImpact();
      if (isElement(event.secondaryTargetElement)) {
        node.dataset.dualTarget = "true";
        // Each SVG owns unique gradient IDs, including dual-target effects.
        const secondaryImpact = makeImpact();
        secondaryImpact.classList.add("skill-effect-impact-secondary");
        node.appendChild(secondaryImpact);
      }

      const caption = makeAtom("div", "skill-effect-caption");
      const identityProfile = profile.family === "protocol" && !neutralResult
        ? { ...profile, id: event.skillId } : profile;
      node.dataset.identity = revealIdentity ? "revealed" : "result-only";
      node.dataset.caption = event.stageCaption === false ? "hidden" : "visible";
      caption.append(
        makeAtom("strong", "skill-effect-title", revealIdentity ? localizedSkillName(identityProfile) : cleanToken(event.resultTitle || profile.resultLabel)),
        makeAtom("span", "skill-effect-kicker", revealIdentity ? localizedSkillKicker(identityProfile) : (event.resultOnly ? "PUBLIC RESULT" : "TACTICAL RESULT")),
        makeAtom("em", "skill-effect-result", cleanToken(event.effectLabel || event.safeMessage || profile.resultLabel))
      );
      if (compositeSkills.length > 1) {
        const modifiers = makeAtom("span", "skill-effect-modifiers");
        const labels = Array.isArray(event.compositeLabels) ? event.compositeLabels : compositeSkills;
        labels.slice(0, 4).forEach((label) => modifiers.appendChild(makeAtom("i", "skill-effect-modifier", cleanToken(label))));
        caption.appendChild(modifiers);
      }
      node.append(atmosphere, stage, route, impact, caption);
      return node;
    }

    renderBroadcast(job) {
      const { event, profile, duration } = job;
      if (event.context === "settlement" || event.broadcast === false) return;
      const isSelfOnly = event.audience === "self" && ["self", "secret"].includes(String(event.disclosure));
      // The center stage is now the primary identity surface. Private skills do
      // not need a second floating confirmation card, and high-tier public
      // skills would otherwise repeat the same title at the top of the screen.
      if (isSelfOnly && event.privateConfirm !== true) return;
      if (["FX3", "FX4"].includes(profile.tier) && event.stageCaption !== false) return;
      const broadcastMs = isSelfOnly
        ? Math.min(720, Math.max(360, duration))
        : Math.min(1100, Math.max(700, duration));
      if (isSelfOnly && this.privateLayer) {
        this.privateLayer.dataset.skill = profile.id;
        this.privateLayer.dataset.family = profile.family;
        this.privateLayer.style.setProperty("--skfx-dur", `${broadcastMs}ms`);
        const name = this.privateLayer.querySelector(".skfx-secret-name");
        const message = this.privateLayer.querySelector(".skfx-secret-msg");
        if (name) name.textContent = localizedSkillName(profile);
        if (message) message.textContent = cleanToken(event.safeMessage || profile.resultLabel);
        this.privateLayer.classList.remove("hidden");
        return;
      }
      if (!this.broadcastLayer) return;
      const neutralResult = event.resultOnly === true && !revealsSkillIdentity(event);
      this.broadcastLayer.dataset.skill = neutralResult ? "RESULT" : profile.id;
      this.broadcastLayer.dataset.family = neutralResult ? "result" : profile.family;
      this.broadcastLayer.dataset.tier = profile.tier;
      this.broadcastLayer.dataset.side = neutralResult ? "public" : (event.casterId === event.viewerId ? "self" : "opponent");
      this.broadcastLayer.style.setProperty("--skfx-dur", `${broadcastMs}ms`);
      this.broadcastLayer.style.setProperty("--fx-accent", neutralResult ? "#d8e8f0" : profile.accent);
      this.broadcastLayer.style.setProperty("--fx-secondary", neutralResult ? "#79b9c9" : profile.secondary);
      const who = this.broadcastLayer.querySelector(".skfx-who");
      const name = this.broadcastLayer.querySelector(".skfx-name");
      const tag = this.broadcastLayer.querySelector(".skfx-tag");
      if (who) who.textContent = event.resultOnly
        ? "PUBLIC RESULT"
        : cleanToken(event.casterLabel || (event.casterId === event.viewerId
          ? (window.OverlimitI18n ? window.OverlimitI18n.t("fx.you") : "YOU")
          : (window.OverlimitI18n ? window.OverlimitI18n.t("fx.opponent") : "OPPONENT")));
      if (name) name.textContent = event.resultOnly
        ? (neutralResult ? event.resultTitle : profile.resultLabel)
        : (event.executedLabel || (window.OverlimitI18n ? window.OverlimitI18n.t("fx.executed") : "TACTICAL EXECUTED"));
      if (tag) tag.textContent = neutralResult
        ? cleanToken(event.effectLabel || "RESOLUTION APPLIED")
        : cleanToken(event.effectLabel || event.safeMessage || profile.resultLabel);
      this.broadcastLayer.classList.remove("hidden");
      if (typeof document !== "undefined") document.body?.classList.add("skill-fx-public-on");
    }

    render(job) {
      if (!this.effectLayer) {
        this.busy = false;
        this.activeJob = null;
        this.pump();
        return;
      }
      this.effectLayer.dataset.fxQuality = job.settings.quality;
      this.effectLayer.dataset.fxMotion = job.settings.quality === "low" ? "reduced" : "full";
      if (job.event.context === "settlement") this.effectLayer.classList.add("is-settlement-active");
      const node = this.buildEffectNode(job);
      this.effectLayer.appendChild(node);
      this.activeNode = node;
      this.positionNode(node, this.resolveStage(job), this.resolveTarget(job), job);
      this.renderBroadcast(job);
      this.playSound(job.profile.sound, job);
      if (job.settings.quality === "high" && job.profile.haptics) this.playHaptics(job.profile.haptics, job);
    }

    refreshPositions() {
      if (this.activeNode && this.activeJob) {
        this.positionNode(
          this.activeNode,
          this.resolveStage(this.activeJob),
          this.resolveTarget(this.activeJob),
          this.activeJob
        );
      }
      this.positionStateMarkers();
    }

    pause(ms, { clear = false } = {}) {
      if (clear) this.clear({ keepStates: true });
      this.pauseUntil = Math.max(this.pauseUntil, Date.now() + Math.max(0, Number(ms) || 0));
    }

    isPlaying(skillId) {
      const id = cleanToken(skillId).toUpperCase();
      return this.activeJob?.profile?.id === id || this.queue.some((job) => job.profile.id === id);
    }

    syncStates(descriptors = []) {
      if (!this.stateLayer) return;
      const safe = Array.isArray(descriptors)
        ? descriptors.filter((item) => item && item.key && isElement(item.targetElement)).slice(0, 8)
        : [];
      const signature = safe.map((item) => `${item.key}:${item.label}:${item.tone}`).join("|");
      if (this.stateLayer.dataset.signature === signature) {
        this.stateDescriptors = safe;
        this.positionStateMarkers();
        return;
      }
      this.stateLayer.dataset.signature = signature;
      this.stateDescriptors = safe;
      this.stateLayer.textContent = "";
      safe.forEach((descriptor) => {
        const marker = makeAtom("span", "skill-state-marker", descriptor.label);
        marker.dataset.stateKey = cleanToken(descriptor.key).toLowerCase();
        marker.dataset.tone = cleanToken(descriptor.tone || "cyan").toLowerCase();
        marker.setAttribute("aria-hidden", "true");
        this.stateLayer.appendChild(marker);
      });
      this.positionStateMarkers();
    }

    positionStateMarkers() {
      if (!this.stateLayer) return;
      const layerRect = this.stateLayer.getBoundingClientRect();
      [...this.stateLayer.children].forEach((marker, index) => {
        const descriptor = this.stateDescriptors[index];
        if (!descriptor) return;
        const rect = descriptor.targetElement.getBoundingClientRect();
        const offset = Number(descriptor.offset || 0);
        marker.style.setProperty("--state-x", `${rect.right - layerRect.left - 8}px`);
        marker.style.setProperty("--state-y", `${rect.top - layerRect.top + 12 + offset}px`);
      });
    }

    clear({ keepStates = false } = {}) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = 0;
      this.queue.length = 0;
      this.activeNode?.remove();
      this.activeNode = null;
      this.activeJob = null;
      this.busy = false;
      this.activeToken += 1;
      this.activeDeadline = 0;
      this.pauseUntil = 0;
      this.hideBroadcasts();
      this.effectLayer?.classList.remove("is-settlement-active");
      if (!keepStates) this.syncStates([]);
    }

    destroy() {
      this.clear();
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", this.boundRefresh);
        window.removeEventListener("scroll", this.boundRefresh, true);
      }
    }
  }

  function createSkillFxManager(options) {
    return new SkillFxManager(options);
  }

  return Object.freeze({
    SkillFxManager,
    createSkillFxManager,
    semanticSkillFxKey,
    normalizeQuality,
    fallbackSkillFxFingerprint,
    MAX_QUEUE_LENGTH,
    COUNTER_CUT_MS,
    BLOOD_UPGRADE_HOLD_MS,
    SHAKE_ALLOWLIST,
  });
});
