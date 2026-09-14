"use strict";

// State-machine stress simulation; uses production mutations and conservation checks.
const assert = require("node:assert/strict");
const { RoomManager } = require("../game/roomManager");
const { GameEngine } = require("../game/gameEngine");
const { beginHandSkills, setPlayerLoadout } = require("../game/skills/skillEngine");
const { getLoanCreditState, adjustLoanInterest } = require("../game/skills/loanState");
const { chipTotal, MATCH_TOTAL_CHIPS, transferChips, CHIP_REASON } = require("../game/chipEconomy");
const logger = { info() {}, warn() {}, error() {} };
const eventBus = { emit() {} };
const iterations = Number(process.argv[2] || 1000);
assert(Number.isSafeInteger(iterations) && iterations > 0);
let repayments = 0, defaults = 0, kills = 0;

for (let run = 0; run < iterations; run++) {
  const roomManager = new RoomManager({ logger, eventBus });
  const engine = new GameEngine({ io: { to: () => ({ emit() {} }) }, roomManager, logger, eventBus });
  const room = roomManager.createRoom(null, "standard", "abyss");
  const a = roomManager.joinRoom({ roomId: room.roomId, playerName: "A", playerId: "A", socketId: "a" }).player;
  const b = roomManager.joinRoom({ roomId: room.roomId, playerName: "B", playerId: "B", socketId: "b" }).player;
  assert(setPlayerLoadout(a, ["LOAN", "FAIRNESS", "DEEP_BREATH"]).ok);
  assert(setPlayerLoadout(b, ["ALERT"]).ok);
  engine.startHand(room); engine.clearActionTimer(room);
  engine.skillEngine.random = () => .99;
  a.skillRuntime.abyssEnergy = 8;
  const activate = (mode) => {
    room.currentPlayerIndex = 0;
    return engine.handleSkillUse(room, a, { skillId: "LOAN", target: { mode }, requestId: String(run) + "-" + Math.random() });
  };
  const modes = [["chip", "chip"], ["chip", "energy"], ["energy", "chip"]][run % 3];
  assert(activate(modes[0]).ok); assert(activate(modes[1]).ok);
  const energyAfter = a.skillRuntime.abyssEnergy;
  assert(!activate("energy").ok); assert(!activate("chip").ok);
  assert.equal(a.skillRuntime.abyssEnergy, energyAfter);
  if (run % 2 === 0) adjustLoanInterest(a.skillRuntime);
  const original = a.skillRuntime.loanDebts.map((d) => ({ ...d }));
  const chipsBefore = chipTotal(room);
  for (let hand = 0; hand < 12; hand++) {
    const before = a.skillRuntime.abyssEnergy;
    const reason = ["showdown", "fold", "tie", "retreat"][hand % 4];
    a.skillRuntime.retreatTriggered = reason === "retreat";
    const tie = reason === "tie" || reason === "retreat";
    engine.skillEngine.endHand(room, { reason, winner: tie ? null : b, tie });
    const gain = reason === "retreat" ? 0 : tie ? 1 : 2;
    assert.equal(a.skillRuntime.abyssEnergy, Math.min(8, before + gain));
    engine.skillEngine.endHand(room, { reason, winner: tie ? null : b, tie });
    assert.equal(a.skillRuntime.abyssEnergy, Math.min(8, before + gain));
    assert.equal(chipTotal(room), chipsBefore);
    a.skillRuntime.loanDebts.forEach((d, index) => {
      const penalty = hand >= 2 ? d.kind === "chip" ? 25 : 1 : 0;
      assert.equal(d.amount, original[index].amount + penalty);
    });
    room.handNo++; room.handId = "next-" + run + "-" + hand;
    beginHandSkills(room);
    assert(!activate("chip").ok); assert(!activate("energy").ok);
  }
  assert.equal(getLoanCreditState(a.skillRuntime), "DEFAULTED"); defaults++;
  const defaultAmounts = a.skillRuntime.loanDebts.map((d) => d.amount);
  adjustLoanInterest(a.skillRuntime);
  assert.deepEqual(a.skillRuntime.loanDebts.map((d) => d.amount), defaultAmounts);
  for (const d of [...a.skillRuntime.loanDebts]) {
    const payload = { debtId: d.id, requestId: d.id, handId: room.handId };
    assert(engine.handleLoanRepayment(room, a, payload).ok);
    assert(engine.handleLoanRepayment(room, a, payload).duplicate);
    repayments++;
  }
  assert.equal(getLoanCreditState(a.skillRuntime), "AVAILABLE");
  assert.equal(a.skillRuntime.loanTotalUsesThisHand, 0);
  assert.equal(chipTotal(room), MATCH_TOTAL_CHIPS);
  // Borrowing after real repayment works, still retaining the two-Chip knockout.
  a.skillRuntime.abyssEnergy = 8;
  transferChips(room, b, a, b.chips - 200, CHIP_REASON.LOAN_TRANSFER);
  assert(activate("chip").ok); assert.equal(b.chips, 100);
  assert(activate("chip").ok); assert.equal(b.chips, 0);
  assert.equal(a.skillRuntime.loanDebts.length, 0);
  assert.equal(chipTotal(room), MATCH_TOTAL_CHIPS); kills++;
  if (room.nextHandTimer) clearTimeout(room.nextHandTimer);
  engine.clearActionTimer(room);
  engine.cancelPresentationBarrier(room);
}
console.log(JSON.stringify({ passed: true, iterations, graceHands: iterations * 12, repayments, defaults, kills }));
