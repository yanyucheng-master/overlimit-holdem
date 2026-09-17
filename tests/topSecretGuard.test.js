const { GameEngine } = require("../game/gameEngine");
const { RoomManager } = require("../game/roomManager");
const { createDeck } = require("../utils/deck");
const { setPlayerLoadout, beginHandSkills } = require("../game/skills/skillEngine");
const { getSkillDefinition } = require("../game/skills/definitions");
const { getPublicSkillSummary, getSelfSkillSummary, getPublicRoomSkillSnapshot } = require("../game/skills/skillState");
const { buildPerceptionFacts } = require("../game/skills/perceptionFacts");
const logger = require("../utils/logger");
const eventBus = require("../utils/eventBus");

function setup(attacks = ["INTEL_ONE", "RECYCLE"], guard = ["TOP_SECRET", "DEEP_BREATH"]) {
  const emits = [];
  const io = { to: (target) => ({ emit: (event, payload) => emits.push({ target, event, payload }) }) };
  const roomManager = new RoomManager({ logger, eventBus });
  const engine = new GameEngine({ io, roomManager, logger, eventBus, deckFactory: createDeck });
  engine.skillEngine.random = () => 0.99;
  const room = roomManager.createRoom(null, "standard", "abyss");
  const a = roomManager.joinRoom({ roomId: room.roomId, playerName: "A", playerId: "A", socketId: "a" }).player;
  const b = roomManager.joinRoom({ roomId: room.roomId, playerName: "B", playerId: "B", socketId: "b" }).player;
  expect(setPlayerLoadout(a, attacks).ok).toBe(true);
  expect(setPlayerLoadout(b, guard).ok).toBe(true);
  engine.startHand(room);
  engine.clearActionTimer(room);
  room.currentPlayerIndex = 0;
  return { engine, room, a, b, emits };
}
const disarm = ({ engine, room, b }, handId = room.handId) => engine.handleTopSecretDisarm(room, b, { handId });
const access = ({ engine, room, a, b }) => engine.skillEngine.blocksPrivateHoleAccess(room, a, b, { skillId: "FUTURE_SKILL", operation: "infer" });
const use = ({ engine, room, a }, id, target = {}) => engine.handleSkillUse(room, a, { skillId: id, target, requestId: `${id}-${Math.random()}` });

describe("Secret Guard state and server ordering", () => {
  test("default ARMED is free; definition remains passive, load 3 / cost 3", () => {
    const f = setup();
    expect(getSkillDefinition("TOP_SECRET")).toMatchObject({ load: 3, energyCost: 3, visibility: "SECRET" });
    expect(f.b.skillRuntime).toMatchObject({ topSecretState: "ARMED", abyssEnergy: 4, skillEventsThisHand: 0 });
    expect(getSelfSkillSummary(f.b, f.room)).toMatchObject({ topSecretState: "ARMED", topSecretCanDisarm: true });
  });
  test.each([0, 1])("disarm on actor index %s does not touch any game/skill side effects", (actor) => {
    const f = setup();
    f.room.currentPlayerIndex = actor;
    f.b.skillRuntime.breathArmed = true;
    f.a.skillRuntime.counterArmed = true;
    const before = JSON.stringify({ ...f.room, players: undefined, skillState: f.room.skillState });
    const runtimeBefore = { ...f.b.skillRuntime };
    const emits = f.emits.length;
    expect(disarm(f)).toEqual({ ok: true });
    expect(f.b.skillRuntime).toEqual({ ...runtimeBefore, topSecretState: "DISARMED_LOCKED" });
    expect(JSON.stringify({ ...f.room, players: undefined, skillState: f.room.skillState })).toBe(before);
    expect(f.emits).toHaveLength(emits);
    expect(f.a.skillRuntime.counterArmed).toBe(true);
    expect(disarm(f).ok).toBe(false);
    expect(access(f)).toBe(false);
  });
  test.each(["waiting", "drafting", "end", "showdown", "game_over"])("disarm is rejected in %s", (phase) => {
    const f = setup(); f.room.phase = phase;
    expect(disarm(f).ok).toBe(false);
    expect(f.b.skillRuntime.topSecretState).toBe("ARMED");
  });
  test.each(["DISARMED_LOCKED", "ACTIVE_LOCKED"])("next hand resets %s, stale hand request cannot disarm", (value) => {
    const f = setup(); const previous = f.room.handId;
    f.b.skillRuntime.topSecretState = value;
    f.room.handNo += 1; f.room.handId = "next-hand";
    beginHandSkills(f.room);
    expect(f.b.skillRuntime.topSecretState).toBe("ARMED");
    expect(disarm(f, previous).ok).toBe(false);
    expect(disarm(f).ok).toBe(true);
  });
  test("intrusion first locks ON and charges once; later disarm cannot undo it", () => {
    const f = setup();
    f.b.skillRuntime.breathArmed = true;
    expect(access(f)).toBe(true);
    expect(f.b.skillRuntime).toMatchObject({ topSecretState: "ACTIVE_LOCKED", abyssEnergy: 1, breathBroken: true, skillEventsThisHand: 1 });
    expect(disarm(f).ok).toBe(false);
    for (let i = 0; i < 5; i += 1) expect(access(f)).toBe(true);
    expect(f.b.skillRuntime.abyssEnergy).toBe(1);
    expect(f.room.skillState.skillActionLog).toHaveLength(1);
  });
  test.each([-1, 0, 2])("energy %s passes intrusion but keeps ARMED; later recovery can activate", (energy) => {
    const f = setup(); f.b.skillRuntime.abyssEnergy = energy;
    expect(access(f)).toBe(false);
    expect(f.b.skillRuntime).toMatchObject({ topSecretState: "ARMED", abyssEnergy: energy });
    f.b.skillRuntime.abyssEnergy = 3;
    expect(access(f)).toBe(true);
    expect(f.b.skillRuntime.abyssEnergy).toBe(0);
  });
  test("Dead End blocks new protection but preserves an already active guard", () => {
    const f = setup();
    f.b.skillRuntime.lockedThisHand = true; f.b.skillRuntime.lockReason = "DEAD_END";
    expect(access(f)).toBe(false);
    f.b.skillRuntime.lockedThisHand = false;
    expect(access(f)).toBe(true);
    f.b.skillRuntime.lockedThisHand = true;
    expect(access(f)).toBe(true);
  });
  test.each([false, true])("Fairness clears and prevents protection, previously active=%s", (active) => {
    const f = setup(["FAIRNESS"]);
    if (active) access(f);
    expect(use(f, "FAIRNESS").ok).toBe(true);
    expect(f.b.skillRuntime.topSecretState).toBe("DISARMED_LOCKED");
    f.b.skillRuntime.abyssEnergy = 8;
    expect(access(f)).toBe(false);
    expect(disarm(f).ok).toBe(false);
  });
});

describe("Private-hole gate, paid failures and disclosure", () => {
  test("conditional protection does not consume an enemy Counter or trigger Alert", () => {
    const f = setup(["INTEL_ONE", "ALERT"]);
    f.a.skillRuntime.counterArmed = true;
    f.engine.skillEngine.random = () => 0;
    expect(use(f, "INTEL_ONE", { zone: "opponent" })).toMatchObject({ ok: true, status: "FAILED" });
    expect(f.a.skillRuntime).toMatchObject({ counterArmed: true, alertChanceIndex: 0, alertPromptPending: false });
    expect(f.a.skillRuntime.privateResults.map((p) => p.message)).toEqual(["未能获取目标底牌信息。"]);
    expect(f.room.skillState.skillActionLog.find((e) => e.skillId === "TOP_SECRET").kind).toBe("passive");
  });
  test.each([
    ["resolveIntelOne", { zone: "opponent" }],
    ["resolveCheat", { ownIndex: 0, zone: "opponent", index: 0 }],
    ["resolveNullification", { mode: "hole" }],
  ])("%s guards before inspecting card values or building a rollback snapshot", (method, target) => {
    const f = setup();
    const cards = f.b.cards;
    f.b.cards = new Proxy(cards, { get(object, key) {
      if (key === "0" || key === "1") throw new Error("private card read before guard");
      return Reflect.get(object, key);
    } });
    expect(f.engine.skillEngine[method](f.room, f.a, f.b, target, "guard-read", 4).status).toBe("FAILED");
    f.b.cards = cards;
  });
  test("Clairvoyance retains authorized metadata access, not guard choice or private intrusion data", () => {
    const f = setup(["CLAIRVOYANCE"]);
    access(f);
    expect(use(f, "CLAIRVOYANCE")).toMatchObject({ ok: true, status: "SUCCESS" });
    const result = f.a.skillRuntime.privateResults.at(-1);
    expect(result.events).toEqual([expect.objectContaining({ skillId: "TOP_SECRET" })]);
    expect(JSON.stringify(result)).not.toMatch(/topSecretState|ARMED|LOCKED|intrusionSkillId|operation/);
    expect(getPublicSkillSummary(f.b).knownSkills).not.toContain("TOP_SECRET");
  });
  test("ordinary hand reveal omits guard; match-end loadout disclosure retains the existing contract", () => {
    const f = setup(); access(f);
    f.engine.completeHandReveal(f.room);
    expect(JSON.stringify(f.room.handReveal)).not.toMatch(/TOP_SECRET|topSecret/);
    expect(f.room.privateHandAuditHistory[0].skillActions.some((event) => event.skillId === "TOP_SECRET")).toBe(true);
    const loadouts = f.engine.buildLoadoutReveal(f.room);
    expect(loadouts.find((p) => p.playerId === f.b.playerId).skillIds).toContain("TOP_SECRET");
    expect(JSON.stringify(loadouts)).not.toMatch(/topSecretState|ARMED|LOCKED/);
  });
  test("Perception blocks before even reading the hole array, synchronously", () => {
    const f = setup(["PERCEPTION"]);
    f.engine.skillEngine.random = () => 0;
    const cards = f.b.cards;
    const getter = jest.fn(() => { throw new Error("protected hole read"); });
    Object.defineProperty(f.b, "cards", { configurable: true, get: getter });
    expect(f.engine.skillEngine.onCardsDealt(f.room, "FLOP")).toBeUndefined();
    expect(getter).not.toHaveBeenCalled();
    expect(buildPerceptionFacts(f.room, f.a, f.b, { holeProtected: true })).toEqual([]);
    expect(getter).not.toHaveBeenCalled();
    expect(f.b.skillRuntime).toMatchObject({ topSecretState: "ACTIVE_LOCKED", abyssEnergy: 1 });
    expect(f.a.skillRuntime.privateResults.at(-1).message).toBe("本次未获得有效的私人信息。");
    f.engine.skillEngine.onCardsDealt(f.room, "TURN");
    expect(f.b.skillRuntime.abyssEnergy).toBe(1);
    expect(getter).not.toHaveBeenCalled();
    Object.defineProperty(f.b, "cards", { configurable: true, writable: true, value: cards });
  });
  test.each([
    ["INTEL_ONE", { zone: "opponent" }, 4],
    ["CHEAT", { ownIndex: 0, zone: "opponent", index: 0 }, 6],
    ["NULLIFICATION", { mode: "hole" }, 7],
  ])("%s pays, fails generically, mutates no card and remains eligible for Recycle", (id, target, cost) => {
    const f = setup([id, "RECYCLE"]); f.a.skillRuntime.abyssEnergy = 8;
    if (id === "NULLIFICATION") f.room.phase = "flop";
    const cards = () => [...f.room.deck, ...f.room.communityCards, ...f.room.players.flatMap((p) => p.cards)].map((c) => c.code);
    const before = cards(); f.emits.length = 0;
    expect(use(f, id, target)).toMatchObject({ ok: true, status: "FAILED" });
    expect(f.a.skillRuntime.abyssEnergy).toBe(8 - cost);
    expect(cards()).toEqual(before);
    expect(new Set(cards()).size).toBe(52);
    expect(f.room.skillState.nullifications).toHaveLength(0);
    expect(f.a.skillRuntime.paidFailuresThisHand).toEqual([expect.objectContaining({ skillId: id, cost, reason: "TOP_SECRET" })]);
    expect(f.engine.skillEngine.settleRecycle(f.room, f.a)).toBe(Math.floor(cost / 2));
    const attackerPayloads = f.emits.filter((e) => e.target === f.a.socketId || e.target === f.room.roomId);
    expect(JSON.stringify(attackerPayloads)).not.toMatch(/TOP_SECRET|绝密|Top Secret|topSecret|ARMED|LOCKED/);
    expect(JSON.stringify(getPublicSkillSummary(f.b))).not.toMatch(/TOP_SECRET|topSecret/);
    expect(JSON.stringify(getPublicRoomSkillSnapshot(f.room, f.a))).not.toMatch(/TOP_SECRET|topSecret/);
    expect(f.engine.skillEngine.buildRevealExtras(f.room).skillActions.some((e) => e.skillId === "TOP_SECRET")).toBe(false);
    expect(f.engine.skillEngine.buildRevealExtras(f.room, { includePrivateAudit: true }).skillActions.some((e) => e.skillId === "TOP_SECRET")).toBe(true);
    expect(f.emits.some((e) => e.event === "skill:resolved" && e.payload.skillId === "TOP_SECRET")).toBe(false);
  });
  test("OFF permits Perception instantly; defense first rejects a later OFF request", () => {
    const off = setup(["PERCEPTION"]); disarm(off);
    off.engine.skillEngine.random = () => 0;
    expect(off.engine.skillEngine.onCardsDealt(off.room, "FLOP")).toBeUndefined();
    expect(off.a.skillRuntime.perceptionTriggerCount).toBe(1);
    const on = setup(["PERCEPTION"]); on.engine.skillEngine.random = () => 0;
    on.engine.skillEngine.onCardsDealt(on.room, "FLOP");
    expect(on.b.skillRuntime.topSecretState).toBe("ACTIVE_LOCKED");
    expect(disarm(on).ok).toBe(false);
    expect(on.a.skillRuntime.perceptionHistory).toEqual([]);
  });
  test.each([
    ["INTEL_ONE", { zone: "future", boardIndex: 4 }],
    ["CHEAT", { ownIndex: 0, zone: "future", index: 4 }],
    ["NULLIFICATION", { mode: "board", boardIndex: 4 }],
  ])("%s non-private-hole branch does not activate guard", (id, target) => {
    const f = setup([id]); f.a.skillRuntime.abyssEnergy = 8;
    if (id === "NULLIFICATION") f.room.phase = "flop";
    expect(use(f, id, target)).toMatchObject({ ok: true, status: "SUCCESS" });
    expect(f.b.skillRuntime).toMatchObject({ topSecretState: "ARMED", abyssEnergy: 4 });
  });
  test.each(["ARMED", "DISARMED_LOCKED", "ACTIVE_LOCKED"])("restore retains %s privately without replaying an action", (state) => {
    const f = setup(); f.b.skillRuntime.topSecretState = state;
    f.emits.length = 0;
    f.engine.restorePlayerState(f.room, f.b);
    f.engine.restorePlayerState(f.room, f.a);
    expect(f.b.skillRuntime.topSecretState).toBe(state);
    expect(getSelfSkillSummary(f.b, f.room).topSecretState).toBe(state);
    expect(JSON.stringify(f.emits.filter((e) => e.target === f.a.socketId))).not.toMatch(/TOP_SECRET|topSecret|DISARMED_LOCKED|ACTIVE_LOCKED/);
  });
});
