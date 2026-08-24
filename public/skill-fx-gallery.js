(function initSkillFxGallery(root) {
  "use strict";

  if (!root || !root.document) return;
  const profilesApi = root.OVERLIMIT_SKILL_FX;
  const managerApi = root.OverlimitSkillFx;
  if (!profilesApi || !managerApi) return;

  const byId = (id) => document.getElementById(id);
  const launcher = byId("btn-skill-fx-gallery");
  const modal = byId("skill-fx-gallery-modal");
  const stage = byId("skill-fx-gallery-stage");
  const statusText = byId("skill-fx-gallery-status-text");
  if (!launcher || !modal || !stage) return;

  const debugEnabled = (() => {
    const query = new URLSearchParams(root.location?.search || "");
    return query.get("skillfx") === "1"
      || query.get("skillfx") === "gallery"
      || ["localhost", "127.0.0.1", "::1"].includes(root.location?.hostname || "")
      || root.__OVERLIMIT_DEV__ === true;
  })();

  if (!debugEnabled) {
    launcher.remove();
    return;
  }

  launcher.classList.remove("hidden");
  document.documentElement.dataset.skillFxDebug = "enabled";

  const controls = {
    skill: byId("skill-fx-gallery-skill"),
    phase: byId("skill-fx-gallery-phase"),
    perspective: byId("skill-fx-gallery-perspective"),
    disclosure: byId("skill-fx-gallery-disclosure"),
    status: byId("skill-fx-gallery-status"),
    target: byId("skill-fx-gallery-target"),
    variant: byId("skill-fx-gallery-variant"),
    quality: byId("skill-fx-gallery-quality"),
    reduced: byId("skill-fx-gallery-reduced"),
    showStage: byId("skill-fx-gallery-show-stage"),
    showTarget: byId("skill-fx-gallery-show-target"),
    showCaption: byId("skill-fx-gallery-show-caption"),
    replay: byId("btn-replay-skill-fx"),
    stop: byId("btn-stop-skill-fx"),
    close: byId("btn-close-skill-fx-gallery"),
  };

  Object.values(profilesApi.SKILL_FX_PROFILES).forEach((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = `${profile.name} / ${profile.english} · ${profile.tier}`;
    controls.skill.appendChild(option);
  });
  const protocolOption = document.createElement("option");
  protocolOption.value = "PROTOCOL_PAIR";
  protocolOption.textContent = "协议模板 / SHOWDOWN PROTOCOL · FX3";
  controls.skill.appendChild(protocolOption);

  const anchor = (name) => stage.querySelector(`[data-fx-gallery-anchor="${name}"]`);
  const targetMarker = byId("skill-fx-gallery-target-marker");
  const gallerySettings = { quality: "high", reduceMotion: false, lowPerformance: false };
  const manager = managerApi.createSkillFxManager({
    effectLayer: byId("skill-fx-gallery-effect-layer"),
    stateLayer: byId("skill-fx-gallery-state-layer"),
    broadcastLayer: byId("skill-fx-gallery-public"),
    privateLayer: byId("skill-fx-gallery-private"),
    getSettings: () => gallerySettings,
    getAnchors: () => ({
      board: stage,
      stageCenter: anchor("stageCenter"),
      tableCenter: anchor("stageCenter"),
      self: anchor("self"),
      opponent: anchor("opponent"),
      selfEnergy: anchor("energy"),
      opponentEnergy: anchor("opponentEnergy"),
      selfCards: anchor("selfCards"),
      opponentCards: anchor("opponentCards"),
      community: anchor("community"),
      river: anchor("river"),
      pot: anchor("pot"),
      settlement: anchor("settlement") || anchor("community"),
      target: anchor("river"),
    }),
    playSound: (kind, job) => root.dispatchEvent(new CustomEvent("overlimit:skill-fx-sound", {
      detail: { kind, profileId: job.profile.id, gallery: true },
    })),
    onSuppressed: () => {
      statusText.textContent = "SUPPRESSED // 此视角无权看到该事件";
      statusText.dataset.tone = "suppressed";
    },
  });

  function selectedTarget() {
    const target = controls.target.value;
    if (target === "profile") {
      const skillId = controls.skill.value;
      if (["DEEP_BREATH", "RECYCLE"].includes(skillId)) return anchor("energy");
      if (skillId === "LOAN") return controls.variant.value === "energy" ? anchor("energy") : anchor("self");
      if (["CHEAT", "FORTUNE", "RESTART"].includes(skillId)) return anchor("selfCards");
      if (skillId === "TOP_SECRET") return anchor("selfCards");
      if (["PERCEPTION", "INTEL_ONE"].includes(skillId)) return anchor("opponentCards");
      if (["CLAIRVOYANCE", "PROBE"].includes(skillId)) return anchor("opponent");
      if (["DEFENSE", "COUNTER", "ALERT", "DESPERATION"].includes(skillId)) return anchor("self");
      if (skillId === "BLOOD_BATTLE") return anchor("pot");
      if (skillId === "RETREAT") return anchor("self");
      if (skillId === "DESTINY") return anchor("river");
      if (profilesApi.isProtocolSkillId(skillId)) return anchor("settlement") || anchor("community");
      return stage;
    }
    if (target === "river") return anchor("river");
    if (target === "cards") return anchor("selfCards");
    return anchor(target) || stage;
  }

  function syncAnchorGuides() {
    stage.classList.toggle("show-stage-anchor", Boolean(controls.showStage?.checked));
    stage.classList.toggle("show-target-anchor", Boolean(controls.showTarget?.checked));
    if (!targetMarker) return;
    const node = byId("skill-fx-gallery-effect-layer")?.querySelector(".skill-effect-instance");
    if (!node) {
      targetMarker.classList.add("is-empty");
      targetMarker.style.removeProperty("left");
      targetMarker.style.removeProperty("top");
      return;
    }
    targetMarker.classList.remove("is-empty");
    const x = Number.parseFloat(node.style.getPropertyValue("--fx-target-x"));
    const y = Number.parseFloat(node.style.getPropertyValue("--fx-target-y"));
    const width = Number.parseFloat(node.style.getPropertyValue("--fx-target-w"));
    const height = Number.parseFloat(node.style.getPropertyValue("--fx-target-h"));
    if (Number.isFinite(x)) targetMarker.style.left = `${x}px`;
    if (Number.isFinite(y)) targetMarker.style.top = `${y}px`;
    if (Number.isFinite(width)) targetMarker.style.width = `${Math.max(24, Math.min(180, width))}px`;
    if (Number.isFinite(height)) targetMarker.style.height = `${Math.max(24, Math.min(120, height))}px`;
  }

  function replay() {
    manager.clear({ keepStates: true });
    gallerySettings.quality = controls.quality.value;
    gallerySettings.reduceMotion = controls.reduced.checked;
    const perspective = controls.perspective.value;
    const disclosure = controls.disclosure.value;
    const skillId = controls.skill.value;
    const isProtocol = profilesApi.isProtocolSkillId(skillId);
    const profile = profilesApi.getSkillFxProfile(skillId);
    const deepBreathRefund = skillId === "DEEP_BREATH" && controls.variant.value === "refund";
    const event = {
      force: true,
      eventId: `gallery:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
      skillId,
      phase: isProtocol ? "showdown" : controls.phase.value,
      status: controls.status.value,
      disclosure,
      audience: perspective === "self" ? "self" : "opponent",
      casterId: "GALLERY_CASTER",
      viewerId: perspective === "self" ? "GALLERY_CASTER" : "GALLERY_VIEWER",
      casterLabel: perspective === "self" ? "你" : "对手",
      stageElement: anchor("stageCenter"),
      targetElement: selectedTarget(),
      fromElement: anchor("opponent"),
      toElement: anchor("self"),
      variant: controls.variant.value,
      mode: controls.variant.value,
      context: deepBreathRefund || isProtocol || controls.target.value === "settlement" || controls.phase.value === "showdown"
        ? "settlement"
        : "table",
      resultOnly: isProtocol || disclosure === "result",
      revealIdentity: disclosure === "public" || disclosure === "self",
      stageCaption: controls.showCaption?.checked !== false,
      broadcast: isProtocol || deepBreathRefund ? false : undefined,
      presentation: deepBreathRefund ? "result" : undefined,
      glyph: deepBreathRefund ? "+2" : undefined,
      impactGlyph: deepBreathRefund ? "+2" : undefined,
      stageLines: skillId === "DISGUISE"
        ? ["1000", "POT 150", "CALL 50"]
        : skillId === "LOAN" && controls.variant.value === "chip"
          ? ["CREDIT +100"]
          : [],
      effectLabel: deepBreathRefund
        ? "ENERGY RETURN +2"
        : skillId === "LOAN" && controls.variant.value === "chip"
          ? "CHIP CREDIT +100"
          : profile?.resultLabel,
      safeMessage: controls.status.value === "FAILED"
        ? "RESOLUTION FAILED"
        : controls.status.value === "COUNTERED"
          ? "INTERRUPTED"
          : "VISUAL CONTRACT PREVIEW",
    };
    statusText.dataset.tone = "ready";
    const accepted = manager.play(event);
    statusText.textContent = accepted
      ? `${event.skillId} // ${perspective.toUpperCase()} // ${disclosure.toUpperCase()}`
      : "SUPPRESSED // 此视角无权看到该事件";
    requestAnimationFrame(() => {
      syncAnchorGuides();
      if (root.matchMedia?.("(max-width: 560px)").matches) {
        stage.scrollIntoView({ block: "start", behavior: "auto" });
      }
    });
  }

  function openGallery() {
    modal.classList.remove("hidden");
    controls.skill.focus();
    requestAnimationFrame(replay);
  }

  function closeGallery() {
    manager.clear();
    modal.classList.add("hidden");
    launcher.focus();
  }

  function syncDisclosureForProfile() {
    const profile = profilesApi.getSkillFxProfile(controls.skill.value);
    if (!profile) return;
    if (profile.visibility === profilesApi.VISIBILITY.PUBLIC) controls.disclosure.value = "public";
    else if (profile.visibility === profilesApi.VISIBILITY.RESULT) controls.disclosure.value = "result";
    else controls.disclosure.value = controls.perspective.value === "self" ? "self" : "secret";
  }

  launcher.addEventListener("click", openGallery);
  controls.close.addEventListener("click", closeGallery);
  controls.replay.addEventListener("click", replay);
  controls.stop.addEventListener("click", () => {
    manager.clear();
    syncAnchorGuides();
    statusText.textContent = "STOPPED";
  });
  controls.skill.addEventListener("change", () => {
    syncDisclosureForProfile();
    replay();
  });
  controls.perspective.addEventListener("change", () => {
    syncDisclosureForProfile();
    replay();
  });
  [controls.phase, controls.disclosure, controls.status, controls.target, controls.variant,
    controls.quality, controls.reduced, controls.showStage, controls.showTarget,
    controls.showCaption].forEach((control) => control?.addEventListener("change", replay));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) closeGallery();
  });

  root.OverlimitSkillFxGallery = Object.freeze({
    open: openGallery,
    close: closeGallery,
    replay,
    manager,
    enabled: true,
  });

  syncDisclosureForProfile();
  if (new URLSearchParams(root.location?.search || "").get("skillfx") === "gallery") openGallery();
})(typeof globalThis !== "undefined" ? globalThis : this);
