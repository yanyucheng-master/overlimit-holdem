(function initOverlimitSkillFxManager(root, factory) {
  const profilesApi = root?.OVERLIMIT_SKILL_FX
    || (typeof require === "function" ? require("./skill-fx-profiles") : null);
  const api = factory(profilesApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OverlimitSkillFx = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildSkillFxManager(profilesApi) {
  "use strict";

  const SHAKE_ALLOWLIST = new Set(["FAIRNESS", "DEAD_END", "BLOOD_BATTLE"]);
  const MAX_DEDUPE_KEYS = 192;
  const MAX_QUEUE_LENGTH = 8;
  const RECENT_FINGERPRINT_MS = 760;

  function normalizeQuality(value) {
    const next = String(value || "high").toLowerCase();
    return ["high", "medium", "low"].includes(next) ? next : "high";
  }

  function cleanToken(value, fallback = "") {
    const text = String(value == null ? fallback : value).replace(/[\u0000-\u001f\u007f]/g, " ").trim();
    return text.slice(0, 180);
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
        : () => ({ quality: "high", reduceMotion: false, lowPerformance: false });
      this.playSound = typeof options.playSound === "function" ? options.playSound : () => {};
      this.playHaptics = typeof options.playHaptics === "function" ? options.playHaptics : () => {};
      this.onSuppressed = typeof options.onSuppressed === "function" ? options.onSuppressed : () => {};
      this.queue = [];
      this.busy = false;
      this.timer = 0;
      this.pauseUntil = 0;
      this.activeNode = null;
      this.activeJob = null;
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
        quality: raw.lowPerformance ? "low" : normalizeQuality(raw.quality || raw.animation),
        reduceMotion: Boolean(raw.reduceMotion),
        lowPerformance: Boolean(raw.lowPerformance),
      };
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
      const event = { ...rawEvent, skillId: cleanToken(rawEvent.skillId).toUpperCase() };
      const baseProfile = profilesApi?.getSkillFxProfile?.(event.skillId);
      if (!baseProfile || event.skillId === "ENDGAME" || event.restored || event.replay) return false;
      if (!profilesApi?.canRenderSkillFx?.(event, baseProfile)) {
        this.onSuppressed(event, baseProfile);
        return false;
      }
      const requestedTier = cleanToken(event.tier).toUpperCase();
      const requestedPresentation = cleanToken(event.presentation).toLowerCase();
      const presentation = Object.values(profilesApi?.FX_PRESENTATION || {}).includes(requestedPresentation)
        ? requestedPresentation
        : baseProfile.presentation;
      const profile = /^FX[1-4]$/.test(requestedTier) || presentation !== baseProfile.presentation
        ? Object.freeze({
            ...baseProfile,
            ...(/^FX[1-4]$/.test(requestedTier) ? { tier: requestedTier } : {}),
            presentation,
          })
        : baseProfile;
      const key = semanticSkillFxKey(event);
      if (!event.force && (this.dedupeKeys.has(key) || this.isRecentDuplicate(event))) return false;
      const settings = this.settings();
      const duration = profilesApi.fxDuration(profile, settings.quality, settings.reduceMotion, event.variant);
      const job = { event, profile, settings, duration, key };
      if (profile.id === "BLOOD_BATTLE") {
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
          }
          if (!event.force) this.rememberAcceptedEvent(event, key);
          return true;
        }
      }
      if (this.queue.length >= MAX_QUEUE_LENGTH) return false;
      this.queue.push(job);
      if (!event.force) this.rememberAcceptedEvent(event, key);
      if (profile.id === "COUNTER" && profile.tier === "FX3" && this.activeNode
        && this.activeJob?.profile?.id !== "COUNTER") {
        this.activeNode.classList.add("is-counter-cut");
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => this.finishActive(), settings.reduceMotion ? 70 : 150);
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
      this.busy = true;
      this.activeJob = job;
      this.render(job);
      this.timer = setTimeout(() => this.finishActive(), job.duration + 100);
    }

    finishActive() {
      if (this.timer) clearTimeout(this.timer);
      this.timer = 0;
      this.activeNode?.remove();
      this.activeNode = null;
      this.hideBroadcasts();
      if (typeof document !== "undefined") {
        document.body?.classList.remove("skill-fx-shake-soft");
      }
      if (this.effectLayer) this.effectLayer.classList.remove("is-settlement-active");
      this.activeJob = null;
      this.busy = false;
      this.pump();
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
      // Compatibility aliases keep the existing family artwork centered on the
      // new hero stage while impact/route use the target variables below.
      node.style.setProperty("--fx-x", `${stageX}px`);
      node.style.setProperty("--fx-y", `${stageY}px`);
      node.style.setProperty("--fx-w", `${stageBox.width}px`);
      node.style.setProperty("--fx-h", `${stageBox.height}px`);

      const routeX = targetBox.x - stageBox.x;
      const routeY = targetBox.y - stageBox.y;
      const routeLength = Math.max(0, Math.hypot(routeX, routeY));
      node.dataset.hasRoute = routeLength > 28 ? "true" : "false";
      node.style.setProperty("--fx-from-x", `${stageX}px`);
      node.style.setProperty("--fx-from-y", `${stageY}px`);
      node.style.setProperty("--fx-to-x", `${targetX}px`);
      node.style.setProperty("--fx-to-y", `${targetY}px`);
      node.style.setProperty("--fx-route-length", `${Math.max(24, routeLength)}px`);
      node.style.setProperty("--fx-route-angle", `${Math.atan2(routeY, routeX) * 180 / Math.PI}deg`);
    }

    buildEffectNode(job) {
      const { event, profile, settings, duration } = job;
      const node = makeAtom("article", "skill-effect-instance");
      const impactType = cleanToken(event.impact || event.impactType
        || (profile.id === "LOAN" && String(event.variant).toLowerCase() === "energy" ? "energy" : profile.impact || "board")).toLowerCase();
      node.dataset.skill = profile.id;
      node.dataset.effect = profile.family;
      node.dataset.impact = impactType;
      node.dataset.tier = profile.tier;
      node.dataset.quality = settings.quality;
      node.dataset.motion = settings.reduceMotion ? "reduced" : "full";
      node.dataset.side = event.casterId === event.viewerId ? "self" : "opponent";
      node.dataset.status = cleanToken(event.status || "SUCCESS").toLowerCase();
      node.dataset.variant = cleanToken(event.variant || event.mode || "default").toLowerCase();
      node.dataset.context = cleanToken(event.context || "table").toLowerCase();
      node.dataset.presentation = cleanToken(profile.presentation || "journey").toLowerCase();
      const compositeSkills = Array.isArray(event.compositeSkills)
        ? event.compositeSkills.map((value) => cleanToken(value).toUpperCase()).filter(Boolean).slice(0, 6)
        : [];
      if (compositeSkills.length > 1) node.dataset.composite = compositeSkills.join(" ");
      node.style.setProperty("--fx-duration", `${duration}ms`);
      node.style.setProperty("--fx-accent", profile.accent);
      node.style.setProperty("--fx-secondary", profile.secondary);

      const stage = makeAtom("div", "skill-effect-stage");
      const core = makeAtom("div", "skill-effect-core");
      core.append(
        makeAtom("i", "skill-effect-halo halo-a"),
        makeAtom("i", "skill-effect-halo halo-b"),
        makeAtom("i", "skill-effect-line line-a"),
        makeAtom("i", "skill-effect-line line-b"),
        makeAtom("i", "skill-effect-line line-c"),
        makeAtom("i", "skill-effect-card card-a"),
        makeAtom("i", "skill-effect-card card-b"),
        makeAtom("i", "skill-effect-card card-c"),
        makeAtom("strong", "skill-effect-glyph", event.glyph || profile.glyph)
      );
      const particles = makeAtom("div", "skill-effect-particles");
      for (let index = 0; index < 8; index += 1) {
        const particle = makeAtom("i", `particle particle-${index + 1}`);
        particles.appendChild(particle);
      }
      core.appendChild(particles);

      const configuredStageLines = Array.isArray(event.stageLines)
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
        makeAtom("i", "route-line"),
        makeAtom("i", "route-packet packet-a"),
        makeAtom("i", "route-packet packet-b")
      );

      const impact = makeAtom("div", "skill-effect-impact");
      impact.append(
        makeAtom("i", "skill-impact-outline"),
        makeAtom("i", "skill-impact-ring"),
        makeAtom("i", "skill-impact-flash"),
        makeAtom("strong", "skill-impact-glyph", impactGlyphFor({ ...profile, impact: impactType }, event))
      );

      const caption = makeAtom("div", "skill-effect-caption");
      const disclosure = String(event.disclosure || "public").toLowerCase();
      const revealIdentity = event.revealIdentity === true
        || (!event.resultOnly && (event.audience === "self" || disclosure === "public"));
      node.dataset.identity = revealIdentity ? "revealed" : "result-only";
      node.dataset.caption = event.stageCaption === false ? "hidden" : "visible";
      caption.append(
        makeAtom("strong", "skill-effect-title", revealIdentity ? profile.name : cleanToken(event.resultTitle || profile.resultLabel)),
        makeAtom("span", "skill-effect-kicker", revealIdentity ? profile.english : (event.resultOnly ? "PUBLIC RESULT" : "TACTICAL RESULT")),
        makeAtom("em", "skill-effect-result", cleanToken(event.effectLabel || event.safeMessage || profile.resultLabel))
      );
      if (compositeSkills.length > 1) {
        const modifiers = makeAtom("span", "skill-effect-modifiers");
        const labels = Array.isArray(event.compositeLabels) ? event.compositeLabels : compositeSkills;
        labels.slice(0, 4).forEach((label) => modifiers.appendChild(makeAtom("i", "skill-effect-modifier", cleanToken(label))));
        caption.appendChild(modifiers);
      }
      node.append(stage, route, impact, caption);
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
        if (name) name.textContent = profile.name;
        if (message) message.textContent = cleanToken(event.safeMessage || profile.resultLabel);
        this.privateLayer.classList.remove("hidden");
        return;
      }
      if (!this.broadcastLayer) return;
      this.broadcastLayer.dataset.skill = profile.id;
      this.broadcastLayer.dataset.family = profile.family;
      this.broadcastLayer.dataset.tier = profile.tier;
      this.broadcastLayer.dataset.side = event.casterId === event.viewerId ? "self" : "opponent";
      this.broadcastLayer.style.setProperty("--skfx-dur", `${broadcastMs}ms`);
      this.broadcastLayer.style.setProperty("--fx-accent", profile.accent);
      this.broadcastLayer.style.setProperty("--fx-secondary", profile.secondary);
      const who = this.broadcastLayer.querySelector(".skfx-who");
      const name = this.broadcastLayer.querySelector(".skfx-name");
      const tag = this.broadcastLayer.querySelector(".skfx-tag");
      if (who) who.textContent = event.resultOnly
        ? "PUBLIC RESULT"
        : cleanToken(event.casterLabel || (event.casterId === event.viewerId ? "你" : "对手"));
      if (name) name.textContent = event.resultOnly ? profile.resultLabel : "战术已执行";
      if (tag) tag.textContent = cleanToken(event.effectLabel || event.safeMessage || profile.resultLabel);
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
      this.effectLayer.dataset.fxMotion = job.settings.reduceMotion ? "reduced" : "full";
      if (job.event.context === "settlement") this.effectLayer.classList.add("is-settlement-active");
      const node = this.buildEffectNode(job);
      this.effectLayer.appendChild(node);
      this.activeNode = node;
      this.positionNode(node, this.resolveStage(job), this.resolveTarget(job), job);
      this.renderBroadcast(job);
      const bloodSettlement = job.profile.id !== "BLOOD_BATTLE"
        || job.event.context === "settlement"
        || job.event.resultOnly === true
        || ["REVEALED", "RESULT"].includes(cleanToken(job.event.status).toUpperCase());
      if (!job.settings.reduceMotion && !job.settings.lowPerformance && bloodSettlement
        && job.profile.shake === "soft" && SHAKE_ALLOWLIST.has(job.profile.id)) {
        document.body?.classList.add("skill-fx-shake-soft");
      }
      this.playSound(job.profile.sound, job);
      if (job.profile.haptics) this.playHaptics(job.profile.haptics, job);
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
      this.pauseUntil = 0;
      this.hideBroadcasts();
      this.effectLayer?.classList.remove("is-settlement-active");
      if (typeof document !== "undefined") document.body?.classList.remove("skill-fx-shake-soft");
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
    SHAKE_ALLOWLIST,
  });
});
