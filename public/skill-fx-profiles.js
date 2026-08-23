(function initOverlimitSkillFxProfiles(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OVERLIMIT_SKILL_FX = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildSkillFxProfiles() {
  "use strict";

  const FX_TIERS = Object.freeze({
    FX1: Object.freeze({ min: 150, max: 450, defaultMs: 360 }),
    FX2: Object.freeze({ min: 400, max: 800, defaultMs: 680 }),
    FX3: Object.freeze({ min: 700, max: 1200, defaultMs: 980 }),
    FX4: Object.freeze({ min: 900, max: 1500, defaultMs: 1280 }),
    FX5: Object.freeze({ min: 1400, max: 3000, defaultMs: 2400 }),
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
    visibility: VISIBILITY.PUBLIC,
    accent: "#46e6ff",
    secondary: "#a65cff",
    glyph: "◇",
    english: value.id,
    broadcast: "standard",
    sound: "signal",
    shake: "none",
    haptics: null,
    persistent: null,
    resultLabel: "RESOLVED",
    ...value,
  });

  // ENDGAME is deliberately absent. Its launch animation is a separate,
  // protected presentation and must never fall through to this registry.
  const SKILL_FX_PROFILES = Object.freeze({
    DEEP_BREATH: profile({
      id: "DEEP_BREATH", name: "深呼吸", english: "DEEP BREATH",
      tier: "FX2", family: "breath", anchor: "energy", visibility: VISIBILITY.SECRET,
      accent: "#55f4db", secondary: "#42bfff", glyph: "∿", sound: "breath",
      persistent: "BREATH", resultLabel: "RESOURCE CYCLE ARMED",
    }),
    RECYCLE: profile({
      id: "RECYCLE", name: "回收利用", english: "RECYCLE",
      tier: "FX2", family: "recycle", anchor: "energy", accent: "#70f1c4",
      secondary: "#f4bd5e", glyph: "↻", sound: "recycle", resultLabel: "ENERGY RETURN",
    }),
    INTIMIDATION: profile({
      id: "INTIMIDATION", name: "恐吓", english: "INTIMIDATION",
      tier: "FX3", family: "intimidation", anchor: "board", accent: "#ff5f76",
      secondary: "#ffad55", glyph: "!", sound: "pressure", persistent: "NO_FOLD",
      resultLabel: "NO FOLD // CAP 500",
    }),
    DESPERATION: profile({
      id: "DESPERATION", name: "绝境", english: "DESPERATION",
      tier: "FX3", family: "desperation", anchor: "caster", accent: "#ff456b",
      secondary: "#ffd46c", glyph: "×3", sound: "critical", persistent: "CRITICAL",
      resultLabel: "CRITICAL MULTIPLIER",
    }),
    BLOOD_BATTLE: profile({
      id: "BLOOD_BATTLE", name: "血战", english: "BLOOD BATTLE",
      tier: "FX3", family: "blood", anchor: "pot", accent: "#ff2d5d",
      secondary: "#d442ff", glyph: "×2", sound: "blood", shake: "soft",
      haptics: Object.freeze([38, 24, 68]), persistent: "BLOOD", resultLabel: "STAKES DOUBLED",
    }),
    DEFENSE: profile({
      id: "DEFENSE", name: "防守", english: "DEFENSE",
      tier: "FX2", family: "defense", anchor: "caster", visibility: VISIBILITY.SECRET,
      accent: "#59e6ff", secondary: "#7d8cff", glyph: "½", sound: "shield",
      persistent: "DEFENSE", resultLabel: "LOSS MITIGATED",
    }),
    PERCEPTION: profile({
      id: "PERCEPTION", name: "感知", english: "PERCEPTION",
      tier: "FX2", family: "perception", anchor: "target", visibility: VISIBILITY.SECRET,
      accent: "#63f4de", secondary: "#4aaeff", glyph: "◉", sound: "whisper",
      resultLabel: "SIGNAL ACQUIRED",
    }),
    INTEL_ONE: profile({
      id: "INTEL_ONE", name: "情报", english: "INTEL",
      tier: "FX3", family: "intel", anchor: "target", visibility: VISIBILITY.SECRET,
      accent: "#3fe5ff", secondary: "#e6faff", glyph: "⌖", sound: "scan",
      resultLabel: "TARGET READ",
    }),
    TOP_SECRET: profile({
      id: "TOP_SECRET", name: "绝密", english: "TOP SECRET",
      tier: "FX3", family: "top-secret", anchor: "caster", visibility: VISIBILITY.SECRET,
      accent: "#f5c85b", secondary: "#5ee7ff", glyph: "▣", sound: "vault",
      persistent: "SEALED", resultLabel: "ACCESS DENIED",
    }),
    COUNTER: profile({
      id: "COUNTER", name: "反制", english: "COUNTER",
      tier: "FX3", family: "counter", anchor: "target", visibility: VISIBILITY.SECRET,
      accent: "#ff5a8d", secondary: "#59e8ff", glyph: "×", sound: "counter",
      persistent: "COUNTER", resultLabel: "SKILL INTERRUPTED",
    }),
    FAIRNESS: profile({
      id: "FAIRNESS", name: "公平", english: "FAIRNESS",
      tier: "FX4", family: "fairness", anchor: "board", accent: "#ffe7a0",
      secondary: "#e8f7ff", glyph: "0", sound: "reset", shake: "soft",
      haptics: Object.freeze([32, 24, 50]), persistent: "SILENCE", resultLabel: "SYSTEM RESET",
    }),
    CHEAT: profile({
      id: "CHEAT", name: "千术", english: "CARD SWITCH",
      tier: "FX3", family: "cheat", anchor: "cards", visibility: VISIBILITY.MIXED,
      accent: "#33e8ff", secondary: "#ff47c8", glyph: "⇄", sound: "swap",
      resultLabel: "CARD ROUTE ALTERED",
    }),
    DEAD_END: profile({
      id: "DEAD_END", name: "绝路", english: "DEAD END",
      tier: "FX4", family: "dead-end", anchor: "board", accent: "#ff3c61",
      secondary: "#ffb14c", glyph: "⊠", sound: "lockdown", shake: "soft",
      haptics: Object.freeze([45, 30, 82]), persistent: "NO_EXIT", resultLabel: "NO EXIT",
    }),
    CLAIRVOYANCE: profile({
      id: "CLAIRVOYANCE", name: "灵视", english: "CLAIRVOYANCE",
      tier: "FX2", family: "clairvoyance", anchor: "opponent", visibility: VISIBILITY.SECRET,
      accent: "#b57aff", secondary: "#56e8ff", glyph: "◈", sound: "clairvoyance",
      resultLabel: "HIDDEN TRACE READ",
    }),
    NULLIFICATION: profile({
      id: "NULLIFICATION", name: "零化", english: "NULLIFICATION",
      tier: "FX3", family: "nullification", anchor: "target", visibility: VISIBILITY.SECRET,
      accent: "#6b6cff", secondary: "#0ce8df", glyph: "Ø", sound: "null",
      persistent: "NULL", resultLabel: "TARGET EXCLUDED",
    }),
    FORTUNE: profile({
      id: "FORTUNE", name: "强运", english: "STRONG FORTUNE",
      tier: "FX2", family: "fortune", anchor: "cards", visibility: VISIBILITY.SECRET,
      accent: "#ffd66b", secondary: "#54f0c4", glyph: "✦", sound: "fortune",
      resultLabel: "FAVORABLE BRANCH",
    }),
    DESTINY: profile({
      id: "DESTINY", name: "天命", english: "DESTINY",
      tier: "FX4", family: "destiny", anchor: "river", visibility: VISIBILITY.SECRET,
      accent: "#ffcc62", secondary: "#ab5dff", glyph: "V", sound: "destiny",
      persistent: "RIVER_LOCK", resultLabel: "RIVER LOCKED",
    }),
    LOAN: profile({
      id: "LOAN", name: "贷款", english: "LOAN",
      tier: "FX2", family: "loan", anchor: "players", visibility: VISIBILITY.MIXED,
      accent: "#f3ca68", secondary: "#49e5d0", glyph: "+", sound: "loan",
      persistent: "DEBT", resultLabel: "CREDIT ROUTE OPEN",
    }),
    ALERT: profile({
      id: "ALERT", name: "警觉", english: "ALERT",
      tier: "FX1", family: "alert", anchor: "self", visibility: VISIBILITY.SECRET,
      accent: "#72f5e3", secondary: "#f1d777", glyph: "⌁", sound: "alert",
      resultLabel: "HIDDEN ACTIVITY",
    }),
    RETREAT: profile({
      id: "RETREAT", name: "撤退", english: "RETREAT",
      tier: "FX3", family: "retreat", anchor: "pot", visibility: VISIBILITY.SECRET,
      accent: "#55e8d4", secondary: "#8f87ff", glyph: "↩", sound: "retreat",
      persistent: "EXIT", resultLabel: "CONTRIBUTIONS RETURNED",
    }),
    RESTART: profile({
      id: "RESTART", name: "重启", english: "RESTART",
      tier: "FX3", family: "restart", anchor: "cards", visibility: VISIBILITY.SECRET,
      accent: "#55cfff", secondary: "#c56cff", glyph: "⟳", sound: "restart",
      resultLabel: "HAND REBUILT",
    }),
    PROBE: profile({
      id: "PROBE", name: "试探", english: "PROBE",
      tier: "FX2", family: "probe", anchor: "opponent", visibility: VISIBILITY.SECRET,
      accent: "#e7c965", secondary: "#4ce5dd", glyph: "+50", sound: "probe",
      persistent: "PROBE", resultLabel: "PRESSURE BONUS",
    }),
    DISGUISE: profile({
      id: "DISGUISE", name: "伪装", english: "DISGUISE",
      tier: "FX3", family: "disguise", anchor: "board", accent: "#9e74ff",
      secondary: "#33d8d0", glyph: "—", sound: "veil", persistent: "MASKED",
      resultLabel: "CHIP DATA MASKED",
    }),
  });

  const PROTOCOL_SHOWDOWN_PROFILE = profile({
    id: "PROTOCOL_SHOWDOWN", name: "协议", english: "SHOWDOWN PROTOCOL",
    tier: "FX3", family: "protocol", anchor: "settlement", visibility: VISIBILITY.RESULT,
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

  function fxDuration(profileValue, quality, reduceMotion) {
    const selected = profileValue || FX_TIERS.FX2;
    const tier = FX_TIERS[selected.tier] || FX_TIERS.FX2;
    if (reduceMotion) return Math.min(360, tier.defaultMs);
    const mode = String(quality || "high").toLowerCase();
    const scale = mode === "low" ? 0.68 : mode === "medium" ? 0.84 : 1;
    return Math.max(tier.min, Math.min(tier.max, Math.round(tier.defaultMs * scale)));
  }

  return Object.freeze({
    FX_TIERS,
    VISIBILITY,
    SKILL_FX_PROFILES,
    PROTOCOL_SHOWDOWN_PROFILE,
    getSkillFxProfile,
    isProtocolSkillId,
    canRenderSkillFx,
    fxDuration,
  });
});
