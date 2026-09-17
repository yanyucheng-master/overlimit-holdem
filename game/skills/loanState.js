"use strict";

const crypto = require("crypto");
const { SKILL_CONFIG } = require("../skillConfig");
const { isEconomyFaulted } = require("../chipEconomy");

const LOAN_CREDIT = Object.freeze({
  NORMAL: "AVAILABLE",
  BORROWING: "BORROWING_THIS_HAND",
  DUE: "DEBT_OPEN",
  DEFAULTED: "DEFAULTED",
});

function loanDebts(runtime) {
  return runtime?.loanDebts || [];
}

function getLoanCreditState(runtime) {
  const debts = loanDebts(runtime);
  if (!debts.length) return LOAN_CREDIT.NORMAL;
  if (debts.some((debt) => debt.defaultApplied)) return LOAN_CREDIT.DEFAULTED;
  const handNo = runtime.loanHandNo || 0;
  return debts.every((debt) => debt.borrowedHandNo === handNo)
    && (runtime.loanLastClosedHandNo ?? -1) < handNo
    ? LOAN_CREDIT.BORROWING : LOAN_CREDIT.DUE;
}

function loanReuseBlocked(player) {
  return [LOAN_CREDIT.DUE, LOAN_CREDIT.DEFAULTED].includes(getLoanCreditState(player?.skillRuntime));
}

function getLoanQuota() {
  return {
    maxChip: SKILL_CONFIG.LOAN_CHIP_MAX_USES_PER_HAND,
    maxEnergy: SKILL_CONFIG.LOAN_ENERGY_MAX_USES_PER_HAND,
    maxTotal: SKILL_CONFIG.LOAN_TOTAL_MAX_USES_PER_HAND,
  };
}

function addLoanDebt(runtime, { kind, principal, lenderId = null, handNo }) {
  if (!["chip", "energy"].includes(kind) || !Number.isSafeInteger(principal) || principal < 0
    || !Number.isSafeInteger(handNo) || handNo < 0) throw new Error("Invalid loan tranche");
  const debt = {
    id: crypto.randomUUID(), kind, principal, lenderId,
    amount: kind === "chip" ? SKILL_CONFIG.LOAN_CHIP_REPAY : SKILL_CONFIG.LOAN_ENERGY_REPAY,
    borrowedHandNo: handNo,
    defaultAfterHandNo: handNo + SKILL_CONFIG.LOAN_GRACE_HANDS,
    fairnessAdjusted: false, defaultApplied: false, penalty: 0,
  };
  runtime.loanHandNo = handNo;
  runtime.loanDebts.push(debt);
  return debt;
}

function closeLoanHand(runtime, handNo) {
  if (!runtime || !Number.isSafeInteger(handNo) || handNo <= runtime.loanLastClosedHandNo) return;
  runtime.loanHandNo = handNo;
  runtime.loanLastClosedHandNo = handNo;
}

function hasFinalLoanRepaymentWindow(room, player) {
  const runtime = player?.skillRuntime;
  return Boolean(room?.skillMode === "abyss" && room.handId && room.handNo > 0
    && ["end", "waiting"].includes(room.phase) && !room.rematch?.active
    && !isEconomyFaulted(room) && room.players.length === 2
    && room.players.includes(player) && room.players.every((p) => p.chips > 0 && p.status !== "out")
    && room.skillState?.handEndRecoverySettled && runtime?.loanLastClosedHandNo === room.handNo
    && loanDebts(runtime).some((debt) => !debt.defaultApplied && debt.penalty === 0
      && debt.defaultAfterHandNo === room.handNo
      && debt.defaultAfterHandNo === debt.borrowedHandNo + SKILL_CONFIG.LOAN_GRACE_HANDS));
}

function isFinalLoanResumePending(room) {
  const resume = room?.finalLoanRepaymentResume;
  return Boolean(resume && resume.handId === room.handId && resume.handNo === room.handNo
    && ["end", "waiting"].includes(room.phase) && !resume.released);
}

function settleLoanDefaultsBeforeNextHand(runtime, nextHandNo) {
  if (!runtime || !Number.isSafeInteger(nextHandNo)) return;
  // Closing N+2 leaves its final settlement resources available for repayment.
  // Only the authoritative boundary into N+3 can default an unpaid tranche.
  loanDebts(runtime).forEach((debt) => {
    if (debt.defaultApplied || nextHandNo <= debt.defaultAfterHandNo
      || (runtime.loanLastClosedHandNo ?? -1) < debt.defaultAfterHandNo) return;
    debt.defaultApplied = true;
    debt.penalty = debt.kind === "chip" ? SKILL_CONFIG.LOAN_CHIP_DEFAULT_PENALTY : SKILL_CONFIG.LOAN_ENERGY_DEFAULT_PENALTY;
    debt.amount += debt.penalty;
  });
}

function adjustLoanInterest(runtime) {
  // The immutable principal is the real credited resource, not the nominal offer.
  // No counters or dates are touched. Defaulted tranches can only be repaid.
  const adjusted = [];
  loanDebts(runtime).forEach((debt) => {
    if (debt.defaultApplied || debt.fairnessAdjusted) return;
    debt.amount = debt.principal;
    debt.fairnessAdjusted = true;
    adjusted.push(debt.id);
  });
  return adjusted;
}

function repaymentEligibility(room, player, debt) {
  if (!room || !player || !room.players.includes(player) || room.skillMode !== "abyss"
    || isEconomyFaulted(room) || !["pre_flop", "flop", "turn", "river", "end"].includes(room.phase)
    || room.players.length !== 2 || room.players.some((p) => p.status === "out")
    || (room.phase === "end" && room.players.some((p) => p.chips <= 0))) return "matchUnavailable";
  if (player.status === "disconnected" || (!player.isBot && !player.socketId)) return "matchUnavailable";
  if (room.presentationBarrier || (room.phase !== "end" && (room.skillState?.bettingClosed || room.skillState?.endgameWindow))) return "waitWindow";
  if (!debt || !loanDebts(player.skillRuntime).includes(debt)) return "debtMissing";
  if (!Number.isSafeInteger(debt.amount) || debt.amount < 0) return "debtInvalid";
  if (debt.kind === "energy") return player.skillRuntime.abyssEnergy >= debt.amount ? null : "notEnoughEnergy";
  if (debt.kind !== "chip") return "debtInvalid";
  const lender = room.players.find((p) => p.playerId === debt.lenderId && p !== player);
  if (!lender) return "lenderMissing";
  if (player.chips < debt.amount) return "notEnoughChips";
  // Do not resurrect an all-in receiver or create a non-betting all-in payer.
  // A zero stack is safe only after settlement, where finalizeHand owns busts.
  if (room.phase !== "end" && (player.chips === debt.amount || room.players.some((p) => p.isAllIn || p.chips <= 0 || p.status === "disconnected"))) return "waitSettlement";
  return null;
}

function getLoanSummary(runtime, room = null, player = null) {
  const debts = loanDebts(runtime);
  return {
    state: getLoanCreditState(runtime),
    borrowingLocked: [LOAN_CREDIT.DUE, LOAN_CREDIT.DEFAULTED].includes(getLoanCreditState(runtime)),
    chipDebt: debts.filter((d) => d.kind === "chip").reduce((sum, d) => sum + d.amount, 0),
    energyDebt: debts.filter((d) => d.kind === "energy").reduce((sum, d) => sum + d.amount, 0),
    tranches: debts.map((debt) => {
      const blockedReason = repaymentEligibility(room, player, debt);
      return {
        id: debt.id, kind: debt.kind, principal: debt.principal, amount: debt.amount,
        borrowedHandNo: debt.borrowedHandNo, defaultAfterHandNo: debt.defaultAfterHandNo,
        graceHandsRemaining: Math.max(0, debt.defaultAfterHandNo - Math.max(debt.borrowedHandNo, runtime.loanLastClosedHandNo ?? -1)),
        fairnessAdjusted: debt.fairnessAdjusted, defaultApplied: debt.defaultApplied, penalty: debt.penalty,
        canRepay: !blockedReason, blockedReason,
      };
    }),
  };
}

function expireLoanDebts(player) {
  if (player?.skillRuntime) player.skillRuntime.loanDebts = [];
}
function expireLoanDebtsForRoom(room) { (room?.players || []).forEach(expireLoanDebts); }
function isMatchOverForLoan(room) { return (room?.players || []).some((p) => p.status === "out" || p.chips <= 0); }

module.exports = { LOAN_CREDIT, loanDebts, getLoanCreditState, getLoanQuota, loanReuseBlocked,
  addLoanDebt, closeLoanHand, settleLoanDefaultsBeforeNextHand, adjustLoanInterest, repaymentEligibility, getLoanSummary,
  hasFinalLoanRepaymentWindow, isFinalLoanResumePending,
  expireLoanDebts, expireLoanDebtsForRoom, isMatchOverForLoan };
