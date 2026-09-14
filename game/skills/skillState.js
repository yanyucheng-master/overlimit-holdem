const { SKILL_CONFIG } = require("../skillConfig");
const { getSkillDefinition, listSkillDefinitions, isProtocolSkill } = require("./definitions");

const {
  LOAN_CREDIT, getLoanCreditState, getLoanQuota, getLoanSummary,
  loanReuseBlocked, expireLoanDebts, expireLoanDebtsForRoom, isMatchOverForLoan,
} = require("./loanState");

function createEmptySkillRuntime() {
  return {
    equippedSkillIds: [],
    loadoutConfirmed: false,
    invalidBuild: false,
    invalidBuildNotified: false,
    abyssEnergy: 0,
    visibleAbyssEnergy: 0,
    skillUsesThisHand: {},
    skillUsesThisGame: {},
    skillEventsThisHand: 0,
    lockedThisHand: false,
    lockReason: null,
    breathArmed: false,
    breathBroken: false,
    recycleUsedThisHand: false,
    paidFailuresThisHand: [],
    topSecretActive: false,
    topSecretPaidThisHand: false,
    topSecretRevealed: false,
    counterArmed: false,
    desperationActive: false,
    bloodBattleActive: false,
    defenseActive: false,
    defenseRevealed: false,
    facedAggressionThisPhase: false,
    deadEndActive: false,
    allInAction: false,
    stackCommitted: false,
    perceptionTriggerCount: 0,
    perceptionCheckedNodes: [],
    perceptionHistory: [],
    fortuneRewriteCount: 0,
    fortuneResourceUsed: false,
    foldedThisHand: false,
    handStartChips: 0,
    directChipGainThisHand: 0,
    privateResults: [],
    confirmedPublicSkills: [],
    revealedSkillIds: [],
    loanDebts: [],
    loanHandNo: 0,
    loanLastClosedHandNo: -1,
    loanRepaymentReceipts: new Map(),
    loanChipUsesThisHand: 0,
    loanEnergyUsesThisHand: 0,
    loanTotalUsesThisHand: 0,
    alertChanceIndex: 0,
    alertPromptPending: false,
    alertPromptedThisHand: false,
    retreatActive: false,
    retreatTriggered: false,
    probeActive: false,
    disguiseActive: false,
  };
}

function createRoomSkillState() {
  return {
    processedRequestIds: new Set(),
    skillActionLog: [],
    transformations: [],
    burnedCards: [],
    removedCards: [],
    nullifications: [],
    nullifiedCommunityCardIds: [],
    noFoldActive: false,
    contributionCap: null,
    fairnessActive: false,
    handEndRecoverySettled: false,
    settlement: null,
    bettingClosed: false,
    endgameActive: null,
    endgameWindow: null,
    endgameWindowResolved: false,
    callToZeroAggressorId: null,
  };
}

function getEnergyCap(player) {
  const ids = player?.skillRuntime?.equippedSkillIds || [];
  return ids.includes("DESTINY")
    ? SKILL_CONFIG.DESTINY_MAX_ABYSS_ENERGY
    : SKILL_CONFIG.MAX_ABYSS_ENERGY;
}

function getRealEnergy(player) {
  const value = Number(player?.skillRuntime?.abyssEnergy);
  return Number.isFinite(value) ? value : 0;
}

function clampPublicEnergy(value) {
  const real = Number(value);
  if (!Number.isFinite(real)) return 0;
  if (real < 0) return 0;
  return Math.min(SKILL_CONFIG.PUBLIC_ENERGY_DISPLAY_CAP, Math.trunc(real));
}

function computePublicEnergySnapshot(player) {
  return clampPublicEnergy(getRealEnergy(player));
}

function getPublicEnergySnapshot(player) {
  if (!player?.skillRuntime) return 0;
  const stored = Number(player.skillRuntime.visibleAbyssEnergy);
  return clampPublicEnergy(stored);
}

function getPublicEnergyDisplay(player) {
  // Mask used only when writing the end-of-hand public snapshot.
  // Opponent payloads must read getPublicEnergySnapshot(), never live energy.
  return computePublicEnergySnapshot(player);
}

function energyVisibleToViewer(player, viewer) {
  if (!player?.skillRuntime) return 0;
  if (viewer && player.playerId === viewer.playerId) return getRealEnergy(player);
  return getPublicEnergySnapshot(player);
}

function resetPlayerSkillsForGame(player) {
  const previous = player.skillRuntime || createEmptySkillRuntime();
  player.skillRuntime = {
    ...createEmptySkillRuntime(),
    equippedSkillIds: [...(previous.equippedSkillIds || [])],
    loadoutConfirmed: Boolean(previous.loadoutConfirmed),
    invalidBuild: Boolean(previous.invalidBuild),
    invalidBuildNotified: Boolean(previous.invalidBuildNotified),
    // Rematches currently retain the same locked loadout. Knowledge that was
    // naturally revealed in the previous game therefore remains valid.
    revealedSkillIds: [...(previous.revealedSkillIds || [])],
    abyssEnergy: SKILL_CONFIG.INITIAL_ABYSS_ENERGY,
    visibleAbyssEnergy: SKILL_CONFIG.INITIAL_ABYSS_ENERGY,
  };
}

function resetPlayerSkillsForHand(player) {
  if (!player.skillRuntime) return;
  const runtime = player.skillRuntime;
  const persist = {
    equippedSkillIds: runtime.equippedSkillIds,
    loadoutConfirmed: runtime.loadoutConfirmed,
    invalidBuild: Boolean(runtime.invalidBuild),
    invalidBuildNotified: Boolean(runtime.invalidBuildNotified),
    abyssEnergy: runtime.abyssEnergy,
    visibleAbyssEnergy: runtime.visibleAbyssEnergy,
    skillUsesThisGame: runtime.skillUsesThisGame,
    loanDebts: runtime.loanDebts || [],
    loanHandNo: runtime.loanHandNo,
    loanLastClosedHandNo: runtime.loanLastClosedHandNo,
    loanRepaymentReceipts: runtime.loanRepaymentReceipts,
    alertChanceIndex: Math.max(0, Number(runtime.alertChanceIndex) || 0),
    alertPromptPending: Boolean(runtime.alertPromptPending),
    revealedSkillIds: [...(runtime.revealedSkillIds || [])],
  };
  Object.assign(runtime, createEmptySkillRuntime(), persist);
  runtime.handStartChips = Number(player.chips) || 0;
}

function resetRoomSkillsForHand(room) {
  room.skillState = room.skillState || createRoomSkillState();
  const processed = room.skillState.processedRequestIds instanceof Set
    ? room.skillState.processedRequestIds
    : new Set();
  Object.assign(room.skillState, createRoomSkillState(), { processedRequestIds: processed });
  if (processed.size > 2048) processed.clear();
}

function validateLoadout(skillIds) {
  if (!Array.isArray(skillIds)) {
    return { ok: false, reason: "INVALID_BUILD_FORMAT", error: "技能构筑格式错误" };
  }
  if (skillIds.length < SKILL_CONFIG.MIN_EQUIPPED_SKILLS) {
    return {
      ok: false,
      reason: "TOO_FEW_SKILLS",
      error: `至少装备 ${SKILL_CONFIG.MIN_EQUIPPED_SKILLS} 个技能`,
    };
  }
  if (skillIds.length > SKILL_CONFIG.MAX_EQUIPPED_SKILLS) {
    return {
      ok: false,
      reason: "TOO_MANY_SKILLS",
      error: `最多装备 ${SKILL_CONFIG.MAX_EQUIPPED_SKILLS} 个技能`,
    };
  }
  const normalized = [];
  for (const rawId of skillIds) {
    if (typeof rawId !== "string") {
      return { ok: false, reason: "INVALID_SKILL_ID_FORMAT", error: "技能 ID 格式错误" };
    }
    normalized.push(rawId.trim().toUpperCase());
  }

  const skills = normalized.map((skillId, index) => {
    const skill = getSkillDefinition(skillId);
    return { skill, rawId: skillIds[index] };
  });
  const unknown = skills.find((entry) => !entry.skill);
  if (unknown) {
    return { ok: false, reason: "UNKNOWN_SKILL_ID", error: `未知技能：${unknown.rawId}` };
  }

  if (new Set(normalized).size !== normalized.length) {
    return { ok: false, reason: "DUPLICATE_SKILL_ID", error: "不能重复装备同名技能" };
  }

  const totalLoad = skills.reduce((sum, entry) => sum + entry.skill.load, 0);
  if (totalLoad > SKILL_CONFIG.MAX_SKILL_LOAD) {
    return {
      ok: false,
      reason: "LOAD_LIMIT_EXCEEDED",
      error: `技能负载不能超过 ${SKILL_CONFIG.MAX_SKILL_LOAD}`,
    };
  }
  return { ok: true, skillIds: normalized, totalLoad };
}

function getLoadoutLoad(skillIds = []) {
  return skillIds.reduce((sum, id) => sum + (getSkillDefinition(id)?.load || 0), 0);
}

function pickDefaultBotLoadout() {
  return ["DEEP_BREATH", "BLOOD_BATTLE", "DEFENSE", "DESPERATION"];
}

function gainEnergy(player, amount) {
  const runtime = player?.skillRuntime;
  if (!Number.isSafeInteger(amount) || amount <= 0) return 0;
  const requested = amount;
  if (!runtime || requested <= 0) return 0;
  const before = runtime.abyssEnergy;
  runtime.abyssEnergy = Math.min(getEnergyCap(player), before + requested);
  return runtime.abyssEnergy - before;
}

function spendEnergy(player, amount, { allowDebt = false, minimum = 0 } = {}) {
  const runtime = player?.skillRuntime;
  if (!Number.isSafeInteger(amount) || amount < 0) return false;
  const cost = amount;
  if (!runtime) return false;
  const floor = allowDebt && Number.isSafeInteger(minimum) ? minimum : 0;
  if (runtime.abyssEnergy - cost < floor) return false;
  runtime.abyssEnergy -= cost;
  return true;
}

function getEffectiveEnergyCost(_player, skill, target = {}) {
  if (skill?.id === "NULLIFICATION") {
    return String(target?.mode || "board").toLowerCase() === "hole"
      ? SKILL_CONFIG.NULLIFY_HOLE_COST
      : SKILL_CONFIG.NULLIFY_BOARD_COST;
  }
  return Number.isSafeInteger(skill?.energyCost) && skill.energyCost > 0 ? skill.energyCost : 0;
}

function syncVisibleEnergy(player) {
  if (!player?.skillRuntime) return;
  player.skillRuntime.visibleAbyssEnergy = computePublicEnergySnapshot(player);
}

function hasEquipped(player, skillId) {
  return Boolean(player?.skillRuntime?.equippedSkillIds?.includes(skillId));
}

function confirmPublicSkill(player, skillId) {
  const runtime = player?.skillRuntime;
  if (!runtime || !skillId) return;
  if (!Array.isArray(runtime.confirmedPublicSkills)) runtime.confirmedPublicSkills = [];
  if (!Array.isArray(runtime.revealedSkillIds)) runtime.revealedSkillIds = [];
  if (!runtime.confirmedPublicSkills.includes(skillId)) runtime.confirmedPublicSkills.push(skillId);
  if (!runtime.revealedSkillIds.includes(skillId)) runtime.revealedSkillIds.push(skillId);
}

function getPublicSkillSummary(player) {
  const runtime = player?.skillRuntime || createEmptySkillRuntime();
  return {
    loadoutConfirmed: Boolean(runtime.loadoutConfirmed),
    abyssEnergy: getPublicEnergySnapshot(player),
    energyCap: SKILL_CONFIG.PUBLIC_ENERGY_DISPLAY_CAP,
    buildHidden: true,
    knownSkills: [...(runtime.revealedSkillIds || [])],
    lockedThisHand: Boolean(runtime.lockedThisHand),
    publicEffects: [
      ...(runtime.confirmedPublicSkills || []),
      runtime.bloodBattleActive ? "BLOOD_BATTLE" : null,
      runtime.defenseRevealed ? "DEFENSE" : null,
      runtime.deadEndActive ? "DEAD_END" : null,
      runtime.topSecretRevealed ? "TOP_SECRET" : null,
      runtime.disguiseActive ? "DISGUISE" : null,
    ].filter(Boolean).filter((id, index, list) => list.indexOf(id) === index),
  };
}

function getSelfSkillSummary(player, room = null) {
  const runtime = player?.skillRuntime || createEmptySkillRuntime();
  return {
    equippedSkillIds: [...(runtime.equippedSkillIds || [])],
    loadoutConfirmed: Boolean(runtime.loadoutConfirmed),
    buildStatus: runtime.invalidBuild
      ? "INVALID_BUILD"
      : runtime.loadoutConfirmed
        ? "CONFIRMED"
        : "UNCONFIRMED",
    abyssEnergy: getRealEnergy(player),
    visibleAbyssEnergy: getPublicEnergySnapshot(player),
    energyCap: getEnergyCap(player),
    skillUsesThisHand: { ...(runtime.skillUsesThisHand || {}) },
    skillUsesThisGame: { ...(runtime.skillUsesThisGame || {}) },
    skillEventsThisHand: Number(runtime.skillEventsThisHand) || 0,
    lockedThisHand: Boolean(runtime.lockedThisHand),
    lockReason: runtime.lockReason || null,
    breathArmed: Boolean(runtime.breathArmed),
    topSecretActive: Boolean(runtime.topSecretActive),
    counterArmed: Boolean(runtime.counterArmed),
    desperationActive: Boolean(runtime.desperationActive),
    bloodBattleActive: Boolean(runtime.bloodBattleActive),
    defenseActive: Boolean(runtime.defenseActive),
    facedAggressionThisPhase: Boolean(runtime.facedAggressionThisPhase),
    deadEndActive: Boolean(runtime.deadEndActive),
    allInAction: Boolean(runtime.allInAction),
    retreatActive: Boolean(runtime.retreatActive),
    probeActive: Boolean(runtime.probeActive),
    disguiseActive: Boolean(runtime.disguiseActive),
    loan: getLoanSummary(runtime, room, player),
    loanTotalUsesThisHand: runtime.loanTotalUsesThisHand || 0,
    loanChipUsesThisHand: Math.max(0, Number(runtime.loanChipUsesThisHand) || 0),
    loanEnergyUsesThisHand: Math.max(0, Number(runtime.loanEnergyUsesThisHand) || 0),
    loanQuota: getLoanQuota(),
  };
}

function maskLoanPublicSummary(entry, room, viewer) {
  if (!entry || entry.skillId !== "LOAN" || !isChipViewHiddenFor(room, viewer)) return entry;
  const caster = (room?.players || []).find((player) => player.playerId === entry.casterId);
  return {
    ...entry,
    publicSummary: `${caster?.name || "玩家"} 发动「贷款」`,
  };
}

function getPublicRoomSkillSnapshot(room, viewer = null) {
  const state = room?.skillState || createRoomSkillState();
  return {
    noFoldActive: Boolean(state.noFoldActive),
    contributionCap: state.contributionCap == null ? null : Number(state.contributionCap),
    fairnessActive: Boolean(state.fairnessActive),
    bettingClosed: Boolean(state.bettingClosed),
    disguiseActive: Boolean((room.players || []).some((player) => player.skillRuntime?.disguiseActive)),
    endgameWindow: state.endgameWindow
      ? { playerId: state.endgameWindow.playerId }
      : null,
    endgameActive: Boolean(state.endgameActive),
    nullifiedCommunityCardIds: (state.nullifications || [])
      .filter((entry) => entry.revealed && entry.type !== "hole")
      .map((entry) => entry.cardCode)
      .filter(Boolean)
      .filter((code, index, list) => list.indexOf(code) === index),
    recentLog: (state.skillActionLog || [])
      .filter((entry) => !entry.secret)
      .slice(-8)
      .map(({ at, skillId, casterId, status, publicSummary }) => maskLoanPublicSummary({
        at, skillId, casterId, status, publicSummary,
      }, room, viewer)),
  };
}

function markSkillUse(player, skillId) {
  const runtime = player.skillRuntime;
  runtime.skillUsesThisHand[skillId] = (runtime.skillUsesThisHand[skillId] || 0) + 1;
  runtime.skillUsesThisGame[skillId] = (runtime.skillUsesThisGame[skillId] || 0) + 1;
}

function markSkillEvent(player, skillId) {
  const runtime = player?.skillRuntime;
  if (!runtime) return;
  if (runtime.breathArmed && skillId !== "DEEP_BREATH") runtime.breathBroken = true;
  runtime.skillEventsThisHand += 1;
}

function recordPaidFailure(player, { skillId, cost, reason } = {}) {
  const runtime = player?.skillRuntime;
  if (!runtime) return;
  runtime.paidFailuresThisHand = runtime.paidFailuresThisHand || [];
  runtime.paidFailuresThisHand.push({
    skillId,
    cost: Number.isSafeInteger(cost) && cost > 0 ? cost : 0,
    reason: reason || "FAILED",
  });
}

function getRemainingUses(player, skill) {
  const runtime = player?.skillRuntime || createEmptySkillRuntime();
  const handUsed = runtime.skillUsesThisHand[skill.id] || 0;
  const gameUsed = runtime.skillUsesThisGame[skill.id] || 0;
  return {
    handLeft: skill.maxUsesPerHand == null ? null : Math.max(0, skill.maxUsesPerHand - handUsed),
    gameLeft: skill.maxUsesPerGame == null ? null : Math.max(0, skill.maxUsesPerGame - gameUsed),
  };
}

function canTriggerNewSkillEvent(player, skillId, room, options = {}) {
  const runtime = player?.skillRuntime;
  if (!runtime) return false;
  if (room?.skillState?.fairnessActive) return false;
  if (!options.ignoreLock && runtime.lockedThisHand) return false;
  if (runtime.abyssEnergy < 0 && skillId !== "FORTUNE") return false;
  return true;
}

function equippedProtocols(player) {
  return (player?.skillRuntime?.equippedSkillIds || [])
    .map((id) => getSkillDefinition(id))
    .filter((skill) => isProtocolSkill(skill));
}

function isChipViewHiddenFor(room, viewer) {
  if (!room || !viewer) return false;
  const opponent = (room.players || []).find((player) => player.playerId !== viewer.playerId);
  return Boolean(opponent?.skillRuntime?.disguiseActive);
}

function addDirectChipGain(player, amount) {
  if (!player?.skillRuntime) return;
  if (!Number.isSafeInteger(amount) || amount === 0) return;
  const current = Number.isSafeInteger(player.skillRuntime.directChipGainThisHand)
    ? player.skillRuntime.directChipGainThisHand
    : 0;
  player.skillRuntime.directChipGainThisHand = current + amount;
}

module.exports = {
  createEmptySkillRuntime, createRoomSkillState, resetPlayerSkillsForGame,
  resetPlayerSkillsForHand, resetRoomSkillsForHand,
  validateLoadout, getLoadoutLoad, pickDefaultBotLoadout, gainEnergy, spendEnergy,
  getEffectiveEnergyCost, syncVisibleEnergy, hasEquipped,
  getRealEnergy, computePublicEnergySnapshot, getPublicEnergySnapshot, energyVisibleToViewer,
  clampPublicEnergy,
  getPublicSkillSummary, getSelfSkillSummary, getPublicRoomSkillSnapshot,
  markSkillUse, markSkillEvent, getRemainingUses, listSkillDefinitions,
  getSkillDefinition, getEnergyCap, getPublicEnergyDisplay, confirmPublicSkill,
  recordPaidFailure, canTriggerNewSkillEvent, equippedProtocols,
  isChipViewHiddenFor, addDirectChipGain, loanReuseBlocked,
  expireLoanDebts, expireLoanDebtsForRoom, isMatchOverForLoan,
  maskLoanPublicSummary,
  LOAN_CREDIT, getLoanCreditState, getLoanQuota,
};
