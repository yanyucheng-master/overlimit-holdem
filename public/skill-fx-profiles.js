(function initOverlimitSkillFxProfiles(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OVERLIMIT_SKILL_FX = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildSkillFxProfiles() {
  "use strict";

  const FX_TIERS = Object.freeze({
    FX1: Object.freeze({ min: 480, max: 680, defaultMs: 560 }),
    FX2: Object.freeze({ min: 900, max: 1250, defaultMs: 1050 }),
    FX3: Object.freeze({ min: 1200, max: 1650, defaultMs: 1400 }),
    FX4: Object.freeze({ min: 1700, max: 2300, defaultMs: 2000 }),
    FX5: Object.freeze({ min: 2500, max: 3400, defaultMs: 3000 }),
  });

  const FX_PRESENTATION = Object.freeze({
    JOURNEY: "journey",
    PULSE: "pulse",
    RESULT: "result",
  });

  // A journey needs enough time for anticipation, manifestation, travel,
  // physical impact and a readable resolve hold. FX1 remains reserved for a
  // pulse that starts and lands on the same target.
  const JOURNEY_MIN_MS = 900;

  const FX_RHYTHMS = Object.freeze({
    standard: Object.freeze({
      anticipationEnd: 0.15,
      manifestEnd: 0.38,
      routeEnd: 0.62,
      impactEnd: 0.82,
      holdEnd: 0.95,
    }),
    hero: Object.freeze({
      anticipationEnd: 0.14,
      manifestEnd: 0.36,
      routeEnd: 0.60,
      impactEnd: 0.80,
      holdEnd: 0.95,
    }),
    pulse: Object.freeze({
      anticipationEnd: 0.10,
      manifestEnd: 0.34,
      routeEnd: 0.34,
      impactEnd: 0.62,
      holdEnd: 0.88,
    }),
    result: Object.freeze({
      anticipationEnd: 0.08,
      manifestEnd: 0.28,
      routeEnd: 0.42,
      impactEnd: 0.64,
      holdEnd: 0.94,
    }),
  });

  const REDUCED_MOTION_MS = Object.freeze({
    FX1: 300,
    FX2: 340,
    FX3: 380,
    FX4: 420,
    FX5: 420,
  });

  const VISIBILITY = Object.freeze({
    PUBLIC: "PUBLIC",
    SECRET: "SECRET",
    MIXED: "MIXED",
    RESULT: "RESULT",
  });

  const profile = (value) => Object.freeze({
    tier: "FX2",
    family: "signal",
    anchor: "board",
    impact: "board",
    visibility: VISIBILITY.PUBLIC,
    accent: "#46e6ff",
    secondary: "#a65cff",
    glyph: "◇",
    english: value.id,
    broadcast: "light",
    sound: "signal",
    shake: "none",
    haptics: null,
    persistent: null,
    resultLabel: "RESOLVED",
    presentation: FX_PRESENTATION.JOURNEY,
    rhythm: "standard",
    resultRhythms: null,
    verb: value.family || "signal",
    durationMs: null,
    resultDurations: null,
    ...value,
  });

  // ENDGAME is deliberately absent. Its launch animation is a separate,
  // protected presentation and must never fall through to this registry.
  const SKILL_FX_PROFILES = Object.freeze({
    DEEP_BREATH: profile({
      id: "DEEP_BREATH", name: "深呼吸", english: "DEEP BREATH",
      tier: "FX2", durationMs: 1060,
      resultDurations: Object.freeze({ refund: Object.freeze({ min: 1000, max: 1150, defaultMs: 1100 }) }),
      resultRhythms: Object.freeze({ refund: "result" }), verb: "inhale-return",
      family: "breath", anchor: "energy", impact: "energy", visibility: VISIBILITY.SECRET,
      accent: "#55f4db", secondary: "#42bfff", glyph: "∿", sound: "breath",
      persistent: "BREATH", resultLabel: "RESOURCE CYCLE ARMED",
    }),
    RECYCLE: profile({
      id: "RECYCLE", name: "回收利用", english: "RECYCLE",
      tier: "FX2", durationMs: 1000, verb: "fragment-reverse",
      family: "recycle", anchor: "energy", impact: "energy", accent: "#70f1c4",
      secondary: "#f4bd5e", glyph: "↻", sound: "recycle", resultLabel: "ENERGY RETURN",
    }),
    INTIMIDATION: profile({
      id: "INTIMIDATION", name: "恐吓", english: "INTIMIDATION",
      tier: "FX4", durationMs: 1950, rhythm: "hero", verb: "pressure-lock",
      family: "intimidation", anchor: "board", impact: "board", accent: "#ff5f76",
      secondary: "#ffad55", glyph: "!", sound: "pressure", persistent: "NO_FOLD",
      resultLabel: "NO FOLD // CAP 500",
    }),
    DESPERATION: profile({
      id: "DESPERATION", name: "绝境", english: "DESPERATION",
      tier: "FX2", durationMs: 1050, verb: "critical-escalate",
      family: "desperation", anchor: "caster", impact: "player", accent: "#ff456b",
      secondary: "#ffd46c", glyph: "×3", sound: "critical", persistent: "CRITICAL",
      resultLabel: "CRITICAL MULTIPLIER",
    }),
    BLOOD_BATTLE: profile({
      id: "BLOOD_BATTLE", name: "血战", english: "BLOOD BATTLE",
      tier: "FX3", durationMs: 1450, rhythm: "hero", verb: "stakes-escalate",
      family: "blood", anchor: "pot", impact: "chip", accent: "#ff2d5d",
      secondary: "#d442ff", glyph: "×2", sound: "blood", shake: "soft",
      haptics: Object.freeze([38, 24, 68]), persistent: "BLOOD", resultLabel: "STAKES DOUBLED",
    }),
    DEFENSE: profile({
      id: "DEFENSE", name: "防守", english: "DEFENSE",
      tier: "FX2", durationMs: 1050, verb: "shield-absorb",
      family: "defense", anchor: "caster", impact: "player", visibility: VISIBILITY.SECRET,
      accent: "#59e6ff", secondary: "#7d8cff", glyph: "½", sound: "shield",
      persistent: "DEFENSE", resultLabel: "LOSS MITIGATED",
    }),
    PERCEPTION: profile({
      id: "PERCEPTION", name: "感知", english: "PERCEPTION",
      tier: "FX2", durationMs: 1000, verb: "radar-acquire",
      family: "perception", anchor: "target", impact: "card", visibility: VISIBILITY.SECRET,
      accent: "#63f4de", secondary: "#4aaeff", glyph: "◉", sound: "whisper",
      resultLabel: "SIGNAL ACQUIRED",
    }),
    INTEL_ONE: profile({
      id: "INTEL_ONE", name: "情报", english: "INTEL",
      tier: "FX3", durationMs: 1350, verb: "scan-lock",
      family: "intel", anchor: "target", impact: "card", visibility: VISIBILITY.SECRET,
      accent: "#3fe5ff", secondary: "#e6faff", glyph: "⌖", sound: "scan",
      resultLabel: "TARGET READ",
    }),
    TOP_SECRET: profile({
      id: "TOP_SECRET", name: "绝密", english: "TOP SECRET",
      tier: "FX3", durationMs: 1380, verb: "vault-seal",
      family: "top-secret", anchor: "caster", impact: "card", visibility: VISIBILITY.SECRET,
      accent: "#f5c85b", secondary: "#5ee7ff", glyph: "▣", sound: "vault",
      persistent: "SEALED", resultLabel: "ACCESS DENIED",
    }),
    COUNTER: profile({
      id: "COUNTER", name: "反制", english: "COUNTER",
      tier: "FX3", durationMs: 1320, rhythm: "hero", verb: "signal-cut",
      family: "counter", anchor: "target", impact: "interrupt", visibility: VISIBILITY.SECRET,
      accent: "#ff5a8d", secondary: "#59e8ff", glyph: "×", sound: "counter",
      persistent: "COUNTER", resultLabel: "SKILL INTERRUPTED",
    }),
    FAIRNESS: profile({
      id: "FAIRNESS", name: "公平", english: "FAIRNESS",
      tier: "FX4", durationMs: 2050, rhythm: "hero", verb: "table-reset",
      family: "fairness", anchor: "board", impact: "board", accent: "#ffe7a0",
      secondary: "#e8f7ff", glyph: "0", sound: "reset", shake: "soft",
      haptics: Object.freeze([32, 24, 50]), persistent: "SILENCE", resultLabel: "SYSTEM RESET",
    }),
    CHEAT: profile({
      id: "CHEAT", name: "千术", english: "CHEAT",
      tier: "FX3", durationMs: 1450, rhythm: "hero", verb: "card-swap",
      family: "cheat", anchor: "cards", impact: "card", visibility: VISIBILITY.MIXED,
      accent: "#33e8ff", secondary: "#ff47c8", glyph: "⇄", sound: "swap",
      resultLabel: "CARD ROUTE ALTERED",
    }),
    DEAD_END: profile({
      id: "DEAD_END", name: "绝路", english: "DEAD END",
      tier: "FX4", durationMs: 2050, rhythm: "hero", verb: "blast-door-seal",
      family: "dead-end", anchor: "board", impact: "board", accent: "#ff3c61",
      secondary: "#ffb14c", glyph: "⊠", sound: "lockdown", shake: "soft",
      haptics: Object.freeze([45, 30, 82]), persistent: "NO_EXIT", resultLabel: "NO EXIT",
    }),
    CLAIRVOYANCE: profile({
      id: "CLAIRVOYANCE", name: "灵视", english: "CLAIRVOYANCE",
      tier: "FX2", durationMs: 1050, verb: "trace-read",
      family: "clairvoyance", anchor: "opponent", impact: "hud", visibility: VISIBILITY.SECRET,
      accent: "#b57aff", secondary: "#56e8ff", glyph: "◈", sound: "clairvoyance",
      resultLabel: "HIDDEN TRACE READ",
    }),
    NULLIFICATION: profile({
      id: "NULLIFICATION", name: "零化", english: "NULLIFICATION",
      tier: "FX3", durationMs: 1450, rhythm: "hero", verb: "target-erase",
      family: "nullification", anchor: "target", impact: "card", visibility: VISIBILITY.SECRET,
      accent: "#6b6cff", secondary: "#0ce8df", glyph: "Ø", sound: "null",
      persistent: "NULL", resultLabel: "TARGET EXCLUDED",
    }),
    FORTUNE: profile({
      id: "FORTUNE", name: "强运", english: "FORTUNE",
      tier: "FX3", durationMs: 1420, verb: "branch-converge",
      family: "fortune", anchor: "cards", impact: "card", visibility: VISIBILITY.SECRET,
      accent: "#ffd66b", secondary: "#54f0c4", glyph: "✦", sound: "fortune",
      resultLabel: "FAVORABLE BRANCH",
    }),
    DESTINY: profile({
      id: "DESTINY", name: "天命", english: "DESTINY",
      tier: "FX4", durationMs: 2000, rhythm: "hero", verb: "future-lock",
      family: "destiny", anchor: "river", impact: "card", visibility: VISIBILITY.SECRET,
      accent: "#ffcc62", secondary: "#ab5dff", glyph: "V", sound: "destiny",
      persistent: "RIVER_LOCK", resultLabel: "RIVER LOCKED",
    }),
    LOAN: profile({
      id: "LOAN", name: "贷款", english: "LOAN",
      tier: "FX2", durationMs: 1050, verb: "credit-transfer",
      family: "loan", anchor: "players", impact: "chip", visibility: VISIBILITY.MIXED,
      accent: "#f3ca68", secondary: "#49e5d0", glyph: "+", sound: "loan",
      persistent: "DEBT", resultLabel: "CREDIT ROUTE OPEN",
    }),
    ALERT: profile({
      id: "ALERT", name: "警觉", english: "ALERT",
      tier: "FX1", durationMs: 560, presentation: FX_PRESENTATION.PULSE,
      rhythm: "pulse", verb: "hidden-signal-pulse",
      family: "alert", anchor: "self", impact: "hud", visibility: VISIBILITY.SECRET,
      accent: "#72f5e3", secondary: "#f1d777", glyph: "⌁", sound: "alert",
      resultLabel: "HIDDEN ACTIVITY",
    }),
    RETREAT: profile({
      id: "RETREAT", name: "撤退", english: "RETREAT",
      tier: "FX3", durationMs: 1400, verb: "contribution-return",
      family: "retreat", anchor: "pot", impact: "chip", visibility: VISIBILITY.SECRET,
      accent: "#55e8d4", secondary: "#8f87ff", glyph: "↩", sound: "retreat",
      persistent: "EXIT", resultLabel: "CONTRIBUTIONS RETURNED",
    }),
    RESTART: profile({
      id: "RESTART", name: "重启", english: "RESTART",
      tier: "FX3", durationMs: 1450, rhythm: "hero", verb: "recall-shuffle-redeal",
      family: "restart", anchor: "cards", impact: "card", visibility: VISIBILITY.SECRET,
      accent: "#55cfff", secondary: "#c56cff", glyph: "⟳", sound: "restart",
      resultLabel: "HAND REBUILT",
    }),
    PROBE: profile({
      id: "PROBE", name: "试探", english: "PROBE",
      tier: "FX2", durationMs: 960, verb: "pressure-mark",
      family: "probe", anchor: "opponent", impact: "player", visibility: VISIBILITY.SECRET,
      accent: "#e7c965", secondary: "#4ce5dd", glyph: "+50", sound: "probe",
      persistent: "PROBE", resultLabel: "PRESSURE MARK ARMED",
    }),
    DISGUISE: profile({
      id: "DISGUISE", name: "伪装", english: "DISGUISE",
      tier: "FX3", durationMs: 1400, verb: "data-veil",
      family: "disguise", anchor: "board", impact: "hud", accent: "#9e74ff",
      secondary: "#33d8d0", glyph: "—", sound: "veil", persistent: "MASKED",
      resultLabel: "CHIP DATA MASKED",
    }),
  });

  const PROTOCOL_SHOWDOWN_PROFILE = profile({
    id: "PROTOCOL_SHOWDOWN", name: "协议", english: "SHOWDOWN PROTOCOL",
    tier: "FX3", durationMs: 1400, rhythm: "result", verb: "showdown-multiplier",
    family: "protocol", anchor: "settlement", impact: "card", visibility: VISIBILITY.RESULT,
    accent: "#f5d779", secondary: "#65e8e1", glyph: "×2", sound: "protocol",
    resultLabel: "PROTOCOL MULTIPLIER",
  });

  const normalizeSkillId = (skillId) => String(skillId || "").trim().toUpperCase();

  function isProtocolSkillId(skillId) {
    return normalizeSkillId(skillId).startsWith("PROTOCOL_");
  }

  function getSkillFxProfile(skillId) {
    const id = normalizeSkillId(skillId);
    if (id === "ENDGAME") return null;
    if (isProtocolSkillId(id)) return PROTOCOL_SHOWDOWN_PROFILE;
    return SKILL_FX_PROFILES[id] || null;
  }

  function normalizeDisclosure(value) {
    const next = String(value || "").trim().toLowerCase();
    if (["public", "result", "self", "secret"].includes(next)) return next;
    return "public";
  }

  function canRenderSkillFx(event, selectedProfile) {
    if (!event || event.authorized === false) return false;
    const fxProfile = selectedProfile || getSkillFxProfile(event.skillId);
    if (!fxProfile) return false;
    const audience = String(event.audience || "public").toLowerCase();
    const disclosure = normalizeDisclosure(event.disclosure);
    if (audience === "self") return true;
    if (disclosure === "public" || disclosure === "result") return true;
    if (fxProfile.visibility === VISIBILITY.PUBLIC || fxProfile.visibility === VISIBILITY.RESULT) {
      return disclosure !== "secret" && disclosure !== "self";
    }
    return false;
  }

  function fxDuration(profileValue, quality, reduceMotion, variant = "") {
    const selected = profileValue || FX_TIERS.FX2;
    const tier = FX_TIERS[selected.tier] || FX_TIERS.FX2;
    const variantKey = String(variant || "").trim().toLowerCase();
    const resultBudget = selected.resultDurations?.[variantKey] || null;
    const defaultMs = Number(resultBudget?.defaultMs ?? selected.durationMs ?? tier.defaultMs);
    if (reduceMotion) return Math.min(REDUCED_MOTION_MS[selected.tier] || 360, defaultMs);
    const mode = String(quality || "high").toLowerCase();
    const scale = mode === "low" ? 0.86 : mode === "medium" ? 0.94 : 1;
    if (resultBudget) {
      return Math.max(resultBudget.min, Math.min(resultBudget.max, Math.round(defaultMs * scale)));
    }
    const readableMin = selected.presentation === FX_PRESENTATION.JOURNEY
      ? Math.max(tier.min, JOURNEY_MIN_MS)
      : tier.min;
    return Math.max(readableMin, Math.min(tier.max, Math.round(defaultMs * scale)));
  }

  function resolveFxRhythm(profileValue, variant = "") {
    const selected = profileValue || {};
    const variantKey = String(variant || "").trim().toLowerCase();
    const rhythmKey = selected.resultRhythms?.[variantKey]
      || selected.rhythm
      || (selected.presentation === FX_PRESENTATION.PULSE ? "pulse" : "standard");
    return FX_RHYTHMS[rhythmKey] ? rhythmKey : "standard";
  }

  function fxTimeline(profileValue, quality, reduceMotion, variant = "") {
    const durationMs = fxDuration(profileValue, quality, reduceMotion, variant);
    const rhythm = resolveFxRhythm(profileValue, variant);
    const beats = FX_RHYTHMS[rhythm];
    const at = (ratio) => Math.round(durationMs * ratio);
    return Object.freeze({
      rhythm,
      durationMs,
      anticipationEndMs: at(beats.anticipationEnd),
      manifestEndMs: at(beats.manifestEnd),
      routeEndMs: at(beats.routeEnd),
      impactEndMs: at(beats.impactEnd),
      holdEndMs: at(beats.holdEnd),
      exitEndMs: durationMs,
      holdMs: at(beats.holdEnd) - at(beats.impactEnd),
    });
  }

  return Object.freeze({
    FX_TIERS,
    FX_PRESENTATION,
    FX_RHYTHMS,
    REDUCED_MOTION_MS,
    JOURNEY_MIN_MS,
    VISIBILITY,
    SKILL_FX_PROFILES,
    PROTOCOL_SHOWDOWN_PROFILE,
    getSkillFxProfile,
    isProtocolSkillId,
    canRenderSkillFx,
    fxDuration,
    resolveFxRhythm,
    fxTimeline,
  });
});
