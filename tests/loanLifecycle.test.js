const crypto = require("crypto");
const { GAME_MODE } = require("../game/gameModes");
const { SKILL_MODE } = require("../game/skillModes");
const { RoomManager } = require("../game/roomManager");
const { GameEngine } = require("../game/gameEngine");
const { getValidActions } = require("../game/pokerLogic");
const { createDeck } = require("../utils/deck");
const { beginHandSkills, prepareNextHandSkills, setPlayerLoadout } = require("../game/skills/skillEngine");
const { gainEnergy, getSelfSkillSummary, getPublicSkillSummary, getPublicRoomSkillSnapshot } = require("../game/skills/skillState");
const { addLoanDebt, closeLoanHand, settleLoanDefaultsBeforeNextHand, adjustLoanInterest, getLoanCreditState, getLoanQuota } = require("../game/skills/loanState");
const { transferChips, commitChipsToPot, CHIP_REASON, assertChipConservation } = require("../game/chipEconomy");
const logger = require("../utils/logger");
const eventBus = require("../utils/eventBus");

function setup(loadoutA = ["LOAN", "FAIRNESS"], loadoutB = ["DEFENSE", "RECYCLE"]) {
  const emits = [];
  const io = { to: (target) => ({ emit: (event, payload) => emits.push({ target, event, payload }) }) };
  const roomManager = new RoomManager({ logger, eventBus });
  const engine = new GameEngine({ io, roomManager, logger, eventBus, deckFactory: createDeck });
  const room = roomManager.createRoom(null, GAME_MODE.STANDARD, SKILL_MODE.ABYSS);
  const a = roomManager.joinRoom({ roomId: room.roomId, playerName: "A", playerId: "PA", socketId: "s1" }).player;
  const b = roomManager.joinRoom({ roomId: room.roomId, playerName: "B", playerId: "PB", socketId: "s2" }).player;
  expect(setPlayerLoadout(a, loadoutA).ok).toBe(true);
  expect(setPlayerLoadout(b, loadoutB).ok).toBe(true);
  engine.startHand(room);
  engine.clearActionTimer(room);
  a.skillRuntime.abyssEnergy = 8;
  return { engine, room, a, b, emits, roomManager };
}
function use(ctx, skillId, mode, player = ctx.a) {
  ctx.room.currentPlayerIndex = ctx.room.players.indexOf(player);
  return ctx.engine.handleSkillUse(ctx.room, player, { skillId, target: mode ? { mode } : {}, requestId: crypto.randomUUID() });
}
function finish(ctx, reason = "fold", tie = false) {
  ctx.engine.skillEngine.endHand(ctx.room, { reason, tie, winner: tie ? null : ctx.b });
}
function next(ctx) {
  prepareNextHandSkills(ctx.room, ctx.room.handNo + 1);
  ctx.room.handNo++;
  ctx.room.handId = crypto.randomUUID();
  ctx.room.phase = "pre_flop";
  ctx.room.players.forEach((p) => { p.status = "active"; p.isAllIn = false; });
  beginHandSkills(ctx.room);
}
function repay(ctx, debt = ctx.a.skillRuntime.loanDebts[0], requestId = crypto.randomUUID(), player = ctx.a) {
  return ctx.engine.handleLoanRepayment(ctx.room, player, { debtId: debt.id, requestId, handId: ctx.room.handId });
}
function debt(ctx, kind = "chip", principal = kind === "chip" ? 100 : 5) {
  return addLoanDebt(ctx.a.skillRuntime, { kind, principal, lenderId: ctx.b.playerId, handNo: ctx.room.handNo });
}

describe("V1.0 voluntary Loan lifecycle", () => {
  test.each(["energy", "chip"])("N+2 final settlement resources can repay normal %s debt before default", (kind) => {
    jest.useFakeTimers();
    const c = setup(["LOAN", "FAIRNESS"], ["ALERT"]);
    try {
      const d = debt(c, kind);
      finish(c); next(c); finish(c); next(c);
      expect(c.room.handNo).toBe(d.borrowedHandNo + 2);
      if (kind === "energy") c.a.skillRuntime.abyssEnergy = 5;
      else {
        transferChips(c.room, c.a, c.b, c.a.chips - 100, CHIP_REASON.LOAN_TRANSFER);
        commitChipsToPot(c.room, c.b, 25, CHIP_REASON.STANDARD_BET);
      }
      expect(repay(c, d).ok).toBe(false);
      c.b.status = "folded";
      c.engine.settleByFold(c.room);
      expect(c.room.phase).toBe("end");
      expect(d).toMatchObject({ amount: kind === "energy" ? 6 : 150, defaultApplied: false, penalty: 0 });
      expect(kind === "energy" ? c.a.skillRuntime.abyssEnergy : c.a.chips).toBe(kind === "energy" ? 6 : 200);
      expect(getSelfSkillSummary(c.a, c.room).loan).toMatchObject({ state: "DEBT_OPEN", tranches: [{ graceHandsRemaining: 0, canRepay: true }] });
      expect(c.engine.skillEngine.validateUse(c.room, c.a, "FAIRNESS").ok).toBe(false);
      const timer = c.room.nextHandTimer;
      expect(repay(c, d).ok).toBe(true);
      expect(c.room.nextHandTimer).toBe(timer);
      expect(getLoanCreditState(c.a.skillRuntime)).toBe("AVAILABLE");
      jest.advanceTimersToNextTimer();
      expect(c.room.handNo).toBe(d.borrowedHandNo + 3);
      expect(c.a.skillRuntime.loanDebts).toEqual([]);
      expect(d.defaultApplied).toBe(false);
      expect(() => assertChipConservation(2000, c.room.pot + c.a.chips + c.b.chips)).not.toThrow();
    } finally {
      c.engine.abortPendingRoomWork(c.room);
      jest.useRealTimers();
    }
  });
  test.each([["chip", "chip"], ["chip", "energy"], ["energy", "chip"]])("two uses %s + %s, no third", (first, second) => {
    const c = setup();
    expect(use(c, "LOAN", first).status).toBe("SUCCESS");
    expect(use(c, "LOAN", second).status).toBe("SUCCESS");
    const energy = c.a.skillRuntime.abyssEnergy;
    expect(use(c, "LOAN", "chip").ok).toBe(false);
    expect(use(c, "LOAN", "energy").ok).toBe(false);
    expect(c.a.skillRuntime.abyssEnergy).toBe(energy);
    expect(c.a.skillRuntime.loanTotalUsesThisHand).toBe(2);
    expect(c.a.skillRuntime.loanDebts).toHaveLength(2);
    expect(getLoanQuota()).toEqual({ maxChip: 2, maxEnergy: 1, maxTotal: 2 });
  });
  test("Energy + Energy is rejected without consuming remaining Chip quota", () => {
    const c = setup();
    expect(use(c, "LOAN", "energy").ok).toBe(true);
    expect(use(c, "LOAN", "energy").ok).toBe(false);
    expect(c.a.skillRuntime.loanTotalUsesThisHand).toBe(1);
    expect(use(c, "LOAN", "chip").status).toBe("SUCCESS");
  });
  test("same-hand repayment never refreshes quota", () => {
    const c = setup();
    expect(use(c, "LOAN", "chip").ok).toBe(true);
    expect(repay(c).ok).toBe(true);
    expect(use(c, "LOAN", "chip").ok).toBe(true);
    expect(repay(c).ok).toBe(true);
    expect(use(c, "LOAN", "energy").ok).toBe(false);
    expect(c.a.skillRuntime.loanTotalUsesThisHand).toBe(2);
  });
  test("old debt locks borrowing; paying only one does not unlock; all paid reopens immediately", () => {
    const c = setup();
    use(c, "LOAN", "chip"); use(c, "LOAN", "chip");
    finish(c); next(c);
    expect(getLoanCreditState(c.a.skillRuntime)).toBe("DEBT_OPEN");
    expect(use(c, "LOAN", "chip").ok).toBe(false);
    expect(repay(c).ok).toBe(true);
    expect(use(c, "LOAN", "chip").ok).toBe(false);
    expect(repay(c).ok).toBe(true);
    expect(getLoanCreditState(c.a.skillRuntime)).toBe("AVAILABLE");
    c.a.skillRuntime.abyssEnergy = 8;
    expect(use(c, "LOAN", "energy").ok).toBe(true);
    expect(c.a.skillRuntime.loanTotalUsesThisHand).toBe(1);
  });
  test.each(["showdown", "fold", "tie", "retreat"])("%s counts as a grace hand; default only entering N+3", (reason) => {
    const c = setup();
    debt(c);
    finish(c); expect(c.a.skillRuntime.loanDebts[0].amount).toBe(150);
    next(c); finish(c, reason, ["tie", "retreat"].includes(reason));
    expect(c.a.skillRuntime.loanDebts[0].defaultApplied).toBe(false);
    expect(getSelfSkillSummary(c.a, c.room).loan.tranches[0].graceHandsRemaining).toBe(1);
    next(c); finish(c, reason, ["tie", "retreat"].includes(reason));
    expect(c.a.skillRuntime.loanDebts[0]).toMatchObject({ amount: 150, defaultApplied: false, penalty: 0 });
    expect(getSelfSkillSummary(c.a, c.room).loan).toMatchObject({ state: "DEBT_OPEN", tranches: [{ graceHandsRemaining: 0 }] });
    next(c);
    expect(c.a.skillRuntime.loanDebts[0]).toMatchObject({ amount: 175, defaultApplied: true, penalty: 25 });
    for (let i = 0; i < 12; i++) { next(c); finish(c); }
    expect(c.a.skillRuntime.loanDebts[0].amount).toBe(175);
  });
  test.each([
    ["chip", 1, false, 175], ["chip", 2, false, 350], ["energy", 1, false, 7],
    ["chip", 1, true, 125], ["chip", 2, true, 250], ["energy", 1, true, 6],
  ])("%s x%i fairness=%s one-time default=%i", (kind, count, fairness, total) => {
    const c = setup();
    for (let i = 0; i < count; i++) debt(c, kind);
    if (fairness) adjustLoanInterest(c.a.skillRuntime);
    closeLoanHand(c.a.skillRuntime, c.room.handNo + 2);
    closeLoanHand(c.a.skillRuntime, c.room.handNo + 2);
    expect(c.a.skillRuntime.loanDebts.every((d) => !d.defaultApplied && d.penalty === 0)).toBe(true);
    settleLoanDefaultsBeforeNextHand(c.a.skillRuntime, c.room.handNo + 3);
    settleLoanDefaultsBeforeNextHand(c.a.skillRuntime, c.room.handNo + 3);
    closeLoanHand(c.a.skillRuntime, c.room.handNo + 8);
    settleLoanDefaultsBeforeNextHand(c.a.skillRuntime, c.room.handNo + 9);
    expect(c.a.skillRuntime.loanDebts.reduce((sum, d) => sum + d.amount, 0)).toBe(total);
    expect(getLoanCreditState(c.a.skillRuntime)).toBe("DEFAULTED");
  });
  test.each([false, true])("real next-hand timer defaults once; duplicate end/finalize/boundary is inert (Fairness=%s)", (fairness) => {
    jest.useFakeTimers();
    const c = setup(["LOAN"], ["ALERT"]);
    try {
      debt(c); debt(c, "energy");
      if (fairness) adjustLoanInterest(c.a.skillRuntime);
      const dates = c.a.skillRuntime.loanDebts.map((d) => [d.borrowedHandNo, d.defaultAfterHandNo]);
      // Preparing before both complete grace hands must not default.
      settleLoanDefaultsBeforeNextHand(c.a.skillRuntime, c.room.handNo + 3);
      expect(c.a.skillRuntime.loanDebts.every((d) => !d.defaultApplied)).toBe(true);
      finish(c); next(c); finish(c); next(c);
      c.a.skillRuntime.abyssEnergy = 5;
      c.b.status = "folded";
      c.engine.settleByFold(c.room);
      const timer = c.room.nextHandTimer;
      const start = jest.spyOn(c.engine, "startHand");
      c.engine.skillEngine.endHand(c.room, { reason: "fold", winner: c.a });
      c.engine.finalizeHand(c.room, 1);
      expect(c.room.nextHandTimer).toBe(timer);
      expect(c.a.skillRuntime.abyssEnergy).toBe(6);
      expect(c.a.skillRuntime.loanDebts.map((d) => d.amount)).toEqual(fairness ? [100, 5] : [150, 6]);
      jest.advanceTimersByTime(1);
      expect(start).not.toHaveBeenCalled();
      jest.advanceTimersToNextTimer();
      expect(start).toHaveBeenCalledTimes(1);
      expect(c.room.handNo).toBe(4);
      expect(c.a.skillRuntime.loanDebts.map((d) => d.amount)).toEqual(fairness ? [125, 6] : [175, 7]);
      const before = getSelfSkillSummary(c.a, c.room).loan;
      prepareNextHandSkills(c.room, c.room.handNo);
      prepareNextHandSkills(c.room, c.room.handNo);
      expect(getSelfSkillSummary(c.a, c.room).loan).toEqual(before);
      expect(c.a.skillRuntime.loanDebts.map((d) => [d.borrowedHandNo, d.defaultAfterHandNo])).toEqual(dates);
      expect(getLoanCreditState(c.a.skillRuntime)).toBe("DEFAULTED");
      c.engine.clearActionTimer(c.room);
      jest.advanceTimersByTime(10000);
      expect(start).toHaveBeenCalledTimes(1);
    } finally { c.engine.abortPendingRoomWork(c.room); jest.useRealTimers(); }
  });
  test("Fairness keeps real principal, dates and quota, cannot reduce twice or after default", () => {
    const c = setup();
    expect(use(c, "LOAN", "chip").ok).toBe(true);
    const d = c.a.skillRuntime.loanDebts[0];
    const original = { ...d };
    expect(use(c, "FAIRNESS").ok).toBe(true);
    expect(d).toMatchObject({ amount: 100, principal: 100, fairnessAdjusted: true, borrowedHandNo: original.borrowedHandNo, defaultAfterHandNo: original.defaultAfterHandNo });
    expect(c.a.skillRuntime.loanTotalUsesThisHand).toBe(1);
    adjustLoanInterest(c.a.skillRuntime);
    expect(d.amount).toBe(100);
    finish(c);
    expect(getLoanCreditState(c.a.skillRuntime)).toBe("DEBT_OPEN");
    closeLoanHand(c.a.skillRuntime, original.defaultAfterHandNo);
    settleLoanDefaultsBeforeNextHand(c.a.skillRuntime, original.defaultAfterHandNo + 1);
    adjustLoanInterest(c.a.skillRuntime);
    expect(d).toMatchObject({ amount: 125, defaultApplied: true });
  });
  test("Fairness handles two chip tranches and mixed debt independently", () => {
    const c = setup();
    debt(c); debt(c); adjustLoanInterest(c.a.skillRuntime);
    expect(c.a.skillRuntime.loanDebts.map((d) => d.amount)).toEqual([100, 100]);
    c.a.skillRuntime.loanDebts = [];
    debt(c); debt(c, "energy"); adjustLoanInterest(c.a.skillRuntime);
    expect(c.a.skillRuntime.loanDebts.map((d) => d.amount)).toEqual([100, 5]);
  });
  test("default before Fairness keeps interest and penalties", () => {
    const c = setup();
    debt(c); debt(c, "energy");
    closeLoanHand(c.a.skillRuntime, c.room.handNo + 2);
    settleLoanDefaultsBeforeNextHand(c.a.skillRuntime, c.room.handNo + 3);
    use(c, "FAIRNESS");
    expect(c.a.skillRuntime.loanDebts.map((d) => d.amount)).toEqual([175, 7]);
  });
  test("energy principal is actual cap-truncated receipt, never nominal 5", () => {
    const c = setup();
    expect(use(c, "LOAN", "energy").ok).toBe(true);
    expect(c.a.skillRuntime.loanDebts[0]).toMatchObject({ principal: 2, amount: 6 });
    use(c, "FAIRNESS");
    expect(c.a.skillRuntime.loanDebts[0].amount).toBe(2);
  });
  test("partial chip principal is retained and zero principal still needs explicit close", () => {
    const c = setup();
    debt(c, "chip", 37); debt(c, "energy", 0);
    adjustLoanInterest(c.a.skillRuntime); finish(c);
    expect(c.a.skillRuntime.loanDebts.map((d) => d.amount)).toEqual([37, 0]);
    expect(repay(c).ok).toBe(true);
    expect(getLoanCreditState(c.a.skillRuntime)).toBe("DEBT_OPEN");
    expect(repay(c).ok).toBe(true);
    expect(getLoanCreditState(c.a.skillRuntime)).toBe("AVAILABLE");
  });
  test("repayment is not a skill, does not break Breath/trigger Counter/Alert or advance timers", () => {
    const c = setup(["LOAN", "DEEP_BREATH"], ["COUNTER", "ALERT"]);
    debt(c); use(c, "DEEP_BREATH");
    c.b.skillRuntime.counterArmed = true;
    c.room.actionDeadline = Date.now() + 20000;
    const alertBefore = { index: c.b.skillRuntime.alertChanceIndex, pending: c.b.skillRuntime.alertPromptPending };
    const before = { events: c.a.skillRuntime.skillEventsThisHand, quota: c.a.skillRuntime.loanTotalUsesThisHand, log: c.room.skillState.skillActionLog.length, current: c.room.currentPlayerIndex, turn: c.room.turnId, deadline: c.room.actionDeadline, energy: c.a.skillRuntime.abyssEnergy };
    expect(repay(c).ok).toBe(true);
    expect(c.a.skillRuntime).toMatchObject({ breathArmed: true, breathBroken: false, loanTotalUsesThisHand: before.quota, skillEventsThisHand: before.events, abyssEnergy: before.energy });
    expect(c.b.skillRuntime).toMatchObject({ counterArmed: true, alertChanceIndex: alertBefore.index, alertPromptPending: alertBefore.pending });
    expect(c.room.skillState.skillActionLog).toHaveLength(before.log);
    expect([c.room.currentPlayerIndex, c.room.turnId, c.room.actionDeadline]).toEqual([before.current, before.turn, before.deadline]);
    const refresh = c.emits.filter((entry) => entry.event === "player_turn").slice(-2);
    expect(refresh).toHaveLength(2);
    expect(refresh.every((entry) => entry.payload.refreshOnly === true && entry.payload.turnId === before.turn
      && entry.payload.actionDeadline === before.deadline)).toBe(true);
  });
  test("Fairness lock permits real repayment, not new skill use", () => {
    const c = setup();
    debt(c); use(c, "FAIRNESS");
    expect(repay(c).ok).toBe(true);
    expect(use(c, "LOAN", "energy").ok).toBe(false);
  });
  test("off-turn chip repayment refreshes a pending bot's legal raise without restarting its timer", () => {
    const c = setup(["LOAN"], ["ALERT"]);
    commitChipsToPot(c.room, c.a, 25, CHIP_REASON.STANDARD_BET);
    transferChips(c.room, c.a, c.b, c.a.chips - 200, CHIP_REASON.LOAN_TRANSFER);
    debt(c);
    c.b.isBot = true;
    c.room.currentPlayerIndex = 1;
    const originalTurn = getValidActions(c.room, 1);
    expect(originalTurn.maxTotalBet).toBe(250);
    jest.useFakeTimers();
    const random = jest.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.99).mockReturnValue(0.99);
    const choose = jest.spyOn(c.engine, "chooseBotAction");
    try {
      c.room.actionDeadline = Date.now() + 20000;
      const deadline = c.room.actionDeadline;
      c.engine.scheduleBotAction(c.room, 1);
      const pendingTimer = c.room.botActionTimer;
      expect(repay(c).ok).toBe(true);
      expect(c.room.botActionTimer).toBe(pendingTimer);
      expect(c.room.actionDeadline).toBe(deadline);
      expect(c.room.currentPlayerIndex).toBe(1);
      expect(getValidActions(c.room, 1).maxTotalBet).toBe(100);
      jest.advanceTimersByTime(800);
      expect(choose).toHaveBeenCalledTimes(1);
      expect(choose.mock.calls[0][2].maxTotalBet).toBe(100);
      expect(choose.mock.results[0].value).toEqual({ action: "raise", amount: 100 });
      expect(c.room.currentBet).toBe(100);
      expect(c.b.hasActed).toBe(true);
      expect(c.room.currentPlayerIndex).toBe(0);
      expect(c.room.pot + c.a.chips + c.b.chips).toBe(2000);
    } finally {
      c.engine.abortPendingRoomWork(c.room);
      jest.clearAllTimers();
      jest.useRealTimers();
      random.mockRestore();
      choose.mockRestore();
    }
  });
  test("duplicate, replay and request-id conflict cannot double charge", () => {
    const c = setup();
    const d = debt(c), other = debt(c);
    const id = crypto.randomUUID(), before = c.a.chips;
    expect(repay(c, d, id).ok).toBe(true);
    expect(repay(c, d, id)).toMatchObject({ ok: true, duplicate: true });
    expect(repay(c, d).ok).toBe(false);
    expect(repay(c, other, id)).toMatchObject({ ok: false, reason: "requestConflict" });
    expect(c.a.chips).toBe(before - 150);
    expect(c.a.skillRuntime.loanDebts).toHaveLength(1);
    expect(() => assertChipConservation(2000, c.room.pot + c.a.chips + c.b.chips)).not.toThrow();
  });
  test("repayment validates identity, phase, current hand, resources and lender", () => {
    const c = setup();
    const d = debt(c, "energy");
    c.a.skillRuntime.abyssEnergy = 5;
    expect(repay(c, d)).toMatchObject({ ok: false, reason: "notEnoughEnergy" });
    expect(c.a.skillRuntime.abyssEnergy).toBe(5);
    expect(repay(c, d, crypto.randomUUID(), c.b).ok).toBe(false);
    expect(c.engine.handleLoanRepayment(c.room, c.a, { debtId: d.id, requestId: crypto.randomUUID(), handId: "stale" }).ok).toBe(false);
    c.room.phase = "game_over"; expect(repay(c, d).ok).toBe(false);
    c.room.phase = "pre_flop"; d.kind = "chip"; d.lenderId = "missing";
    expect(repay(c, d).reason).toBe("lenderMissing");
    d.lenderId = c.b.playerId; d.amount = 1500;
    expect(repay(c, d).reason).toBe("notEnoughChips");
  });
  test("chip repayment cannot resurrect all-in or create active-hand zero stack", () => {
    const c = setup();
    const d = debt(c);
    transferChips(c.room, c.a, c.b, c.a.chips - 150, CHIP_REASON.LOAN_TRANSFER);
    expect(repay(c, d).reason).toBe("waitSettlement");
    c.room.phase = "end";
    expect(repay(c, d).ok).toBe(true);
    expect(c.a.chips).toBe(0);
    expect(c.a.skillRuntime.loanDebts).toHaveLength(0);
    expect(() => assertChipConservation(2000, c.room.pot + c.a.chips + c.b.chips)).not.toThrow();
    const x = setup(); debt(x); x.b.isAllIn = true;
    expect(repay(x).reason).toBe("waitSettlement");
  });
  test("Countered secret Loan creates no debt or public identity; Recycle refunds only paid failure", () => {
    const c = setup(["LOAN", "RECYCLE"], ["COUNTER", "ALERT"]);
    c.b.skillRuntime.counterArmed = true;
    c.a.skillRuntime.abyssEnergy = 4;
    expect(use(c, "LOAN", "energy").status).toBe("COUNTERED");
    expect(c.a.skillRuntime.abyssEnergy).toBe(2);
    expect(c.a.skillRuntime.loanDebts).toHaveLength(0);
    expect(getLoanCreditState(c.a.skillRuntime)).toBe("AVAILABLE");
    expect(JSON.stringify(getPublicRoomSkillSnapshot(c.room, c.b))).not.toContain("LOAN");
    expect(JSON.stringify(c.engine.skillEngine.buildRevealExtras(c.room))).not.toContain('"skillId":"LOAN"');
    expect(c.engine.skillEngine.buildRevealExtras(c.room, { includePrivateAudit: true }).skillActions)
      .toEqual(expect.arrayContaining([expect.objectContaining({ skillId: "LOAN", status: "COUNTERED", secret: true })]));
    finish(c);
    expect(c.a.skillRuntime.abyssEnergy).toBe(5); // paid -2, natural +2, Recycle +1
  });
  test("live all-in is not match end: energy repayment is legal and cannot erase other debts", () => {
    const c = setup();
    const energy = debt(c, "energy"), chip = debt(c);
    commitChipsToPot(c.room, c.b, c.b.chips, CHIP_REASON.STANDARD_BET);
    c.b.isAllIn = true;
    expect(repay(c, energy)).toMatchObject({ ok: true, paid: 6 });
    expect(c.a.skillRuntime.abyssEnergy).toBe(2);
    expect(c.a.skillRuntime.loanDebts).toEqual([chip]);
    expect(repay(c, chip).reason).toBe("waitSettlement");
    expect(c.b.chips).toBe(0);
    expect(c.room.pot + c.a.chips + c.b.chips).toBe(2000);
  });
  test("no automatic collections at any hand end; future energy gains are not seized", () => {
    const c = setup();
    debt(c); debt(c, "energy");
    c.a.skillRuntime.abyssEnergy = 0;
    const stacks = c.room.players.map((p) => p.chips);
    for (let i = 0; i < 7; i++) { finish(c); next(c); }
    expect(c.room.players.map((p) => p.chips)).toEqual(stacks);
    expect(c.a.skillRuntime.abyssEnergy).toBe(8);
    expect(c.a.skillRuntime.loanDebts.map((d) => d.amount)).toEqual([175, 7]);
    c.a.skillRuntime.abyssEnergy = 0;
    expect(gainEnergy(c.a, 2)).toBe(2);
    expect(c.a.skillRuntime.loanDebts[1].amount).toBe(7);
    expect(use(c, "LOAN", "energy").ok).toBe(false);
    expect(use(c, "FAIRNESS").ok).toBe(false); // insufficient 3 energy, not a credit lock
    c.a.skillRuntime.abyssEnergy = 3; expect(use(c, "FAIRNESS").ok).toBe(true);
  });
  test("socket-restoration leaves tranche, grace, adjustment, default and hand quota unchanged", () => {
    const c = setup();
    use(c, "LOAN", "energy"); adjustLoanInterest(c.a.skillRuntime);
    const before = getSelfSkillSummary(c.a, c.room);
    c.engine.restorePlayerState(c.room, c.a);
    expect(getSelfSkillSummary(c.a, c.room)).toEqual(before);
    closeLoanHand(c.a.skillRuntime, c.room.handNo + 2);
    const finalWindow = getSelfSkillSummary(c.a, c.room);
    expect(finalWindow.loan.state).toBe("DEBT_OPEN");
    c.engine.restorePlayerState(c.room, c.a);
    expect(getSelfSkillSummary(c.a, c.room)).toEqual(finalWindow);
    settleLoanDefaultsBeforeNextHand(c.a.skillRuntime, c.room.handNo + 3);
    const defaulted = getSelfSkillSummary(c.a, c.room);
    c.engine.restorePlayerState(c.room, c.a);
    expect(getSelfSkillSummary(c.a, c.room)).toEqual(defaulted);
  });
  test("secret debt and Fairness adjustment stay out of opponent state and reconnect", () => {
    const c = setup();
    use(c, "LOAN", "energy"); use(c, "FAIRNESS");
    c.emits.length = 0;
    c.engine.restorePlayerState(c.room, c.b);
    const other = c.emits.filter((e) => e.target === c.b.socketId);
    const serialized = JSON.stringify(other);
    const d = c.a.skillRuntime.loanDebts[0];
    expect(serialized).not.toContain(d.id);
    expect(serialized).not.toContain('"skillId":"LOAN"');
    expect(JSON.stringify(getPublicSkillSummary(c.a))).not.toMatch(/loan|Debt|principal|repay/i);
    const reveal = JSON.stringify(c.engine.skillEngine.buildRevealExtras(c.room));
    expect(reveal).not.toContain(d.id);
    expect(reveal).not.toContain('"skillId":"LOAN"');
    expect(reveal).not.toContain("adjustedTrancheIds");
    expect(getSelfSkillSummary(c.a, c.room).loan.tranches[0]).toMatchObject({ amount: 2, fairnessAdjusted: true });
  });
  test("two Chip loans retain 200-chip Loan Kill and terminate all debts", () => {
    const c = setup();
    transferChips(c.room, c.b, c.a, c.b.chips - 200, CHIP_REASON.LOAN_TRANSFER);
    expect(use(c, "LOAN", "chip").status).toBe("SUCCESS");
    expect(c.b.chips).toBe(100);
    expect(use(c, "LOAN", "chip").status).toBe("SUCCESS");
    expect(c.b.chips).toBe(0);
    expect(c.a.skillRuntime.loanDebts).toHaveLength(0);
    expect(() => assertChipConservation(2000, c.room.pot + c.a.chips + c.b.chips)).not.toThrow();
    if (c.room.nextHandTimer) clearTimeout(c.room.nextHandTimer);
  });
});

describe("V1.0 natural energy recovery", () => {
  test.each([["showdown", false, 2, 1], ["fold", false, 2, 1], ["tie", true, 1, 1], ["retreat", true, 0, 1]])("%s recovery and duplicate end guard", (reason, tie, aGain, bGain) => {
    const c = setup(["DEEP_BREATH"], ["ALERT"]);
    c.a.skillRuntime.abyssEnergy = 0; c.b.skillRuntime.abyssEnergy = 0;
    if (reason === "retreat") c.a.skillRuntime.retreatTriggered = true;
    finish(c, reason, tie); finish(c, reason, tie);
    expect([c.a.skillRuntime.abyssEnergy, c.b.skillRuntime.abyssEnergy]).toEqual([aGain, bGain]);
  });
  test.each(["showdown", "fold", "tie", "retreat"])("Fairness suppresses all %s recoveries", (reason) => {
    const c = setup();
    c.room.skillState.fairnessActive = true;
    c.a.skillRuntime.abyssEnergy = 1; c.b.skillRuntime.abyssEnergy = 1;
    c.a.skillRuntime.breathArmed = true; c.b.skillRuntime.counterArmed = true;
    c.b.skillRuntime.desperationActive = true;
    finish(c, reason, ["tie", "retreat"].includes(reason));
    expect([c.a.skillRuntime.abyssEnergy, c.b.skillRuntime.abyssEnergy]).toEqual([1, 1]);
    expect(c.a.skillRuntime.breathArmed).toBe(false);
  });
  test("caps stay 8 and 10; negative Fortune energy recovers without changing its floor", () => {
    const c = setup(["DESTINY", "DEEP_BREATH"], ["ALERT"]);
    c.a.skillRuntime.abyssEnergy = 9; c.b.skillRuntime.abyssEnergy = 8;
    finish(c);
    expect([c.a.skillRuntime.abyssEnergy, c.b.skillRuntime.abyssEnergy]).toEqual([10, 8]);
    next(c); c.a.skillRuntime.abyssEnergy = -4; finish(c);
    expect(c.a.skillRuntime.abyssEnergy).toBe(-2);
  });
});
