const { GAME_MODE } = require("../game/gameModes");
const { SKILL_MODE } = require("../game/skillModes");
const { SKILL_TAGS, SKILL_CONFIG } = require("../game/skillConfig");
const { RoomManager } = require("../game/roomManager");
const { GameEngine } = require("../game/gameEngine");
const { createDeck } = require("../utils/deck");
const { getSkillDefinition } = require("../game/skills/definitions");
const {
  setPlayerLoadout,
  getPublicSkillSummary,
  getSelfSkillSummary,
  getPublicRoomSkillSnapshot,
  getRealEnergy,
} = require("../game/skills/skillEngine");
const logger = require("../utils/logger");
const eventBus = require("../utils/eventBus");

function makeIoStub() {
  const emits = [];
  return {
    emits,
    to: (target) => ({ emit: (event, payload) => emits.push({ target, event, payload }) }),
  };
}

function setupRoom({
  loadoutA = ["DEEP_BREATH", "RECYCLE"],
  loadoutB = ["DEFENSE", "RECYCLE"],
  random = () => 0.99,
} = {}) {
  const io = makeIoStub();
  const roomManager = new RoomManager({ logger, eventBus });
  const engine = new GameEngine({ io, roomManager, logger, eventBus, deckFactory: createDeck });
  engine.skillEngine.random = random;
  const room = roomManager.createRoom(null, GAME_MODE.STANDARD, SKILL_MODE.ABYSS);
  const a = roomManager.joinRoom({
    roomId: room.roomId,
    playerName: "A",
    playerId: "PA",
    socketId: "s1",
  }).player;
  const b = roomManager.joinRoom({
    roomId: room.roomId,
    playerName: "B",
    playerId: "PB",
    socketId: "s2",
  }).player;
  expect(setPlayerLoadout(a, loadoutA).ok).toBe(true);
  expect(setPlayerLoadout(b, loadoutB).ok).toBe(true);
  room.__skillEngineForTests = engine.skillEngine;
  engine.startHand(room);
  engine.clearActionTimer(room);
  return { io, roomManager, engine, room, a, b };
}

function use(engine, room, player, skillId, target = {}, requestId = `${skillId}-${Math.random()}`) {
  room.currentPlayerIndex = room.players.findIndex((candidate) => candidate.playerId === player.playerId);
  room.phase = "pre_flop";
  player.isAllIn = false;
  return engine.handleSkillUse(room, player, { skillId, target, requestId });
}

function packetsFor(io, player, events = null) {
  return io.emits.filter((entry) => (
    entry.target === player.socketId && (!events || events.includes(entry.event))
  ));
}

function lastPacket(io, player, event) {
  return [...io.emits].reverse().find((entry) => (
    entry.target === player.socketId && entry.event === event
  ));
}

function expectNoDeepBreathIdentity(value) {
  const text = JSON.stringify(value);
  expect(text).not.toContain("DEEP_BREATH");
  expect(text).not.toContain("深呼吸");
}

describe("Deep Breath 秘密主动技能契约", () => {
  test("DB-SECRET-01 定义为主动秘密、带 SECRET 标签且其他参数保持不变", () => {
    const skill = getSkillDefinition("DEEP_BREATH");
    expect(skill).toMatchObject({
      load: 1,
      energyCost: 1,
      visibility: "SECRET",
      maxUsesPerHand: 1,
      requiresActionTurn: true,
      canBeCountered: true,
    });
    expect(skill.tags).toEqual(expect.arrayContaining([
      SKILL_TAGS.ACTIVE,
      SKILL_TAGS.RESOURCE,
      SKILL_TAGS.SECRET,
      SKILL_TAGS.ONCE_PER_HAND,
    ]));
    expect(skill.allowedPhases).toEqual(["pre_flop", "flop", "turn", "river"]);
  });

  test("DB-SECRET-02 本人收到带技能身份的私有 resolved，普通对手不收到", () => {
    const { io, engine, room, a, b } = setupRoom();
    io.emits.length = 0;

    expect(use(engine, room, a, "DEEP_BREATH", {}, "db-self")).toMatchObject({
      ok: true,
      status: "SUCCESS",
    });

    const selfResolved = lastPacket(io, a, "skill:resolved");
    expect(selfResolved?.payload).toMatchObject({
      requestId: "db-self",
      skillId: "DEEP_BREATH",
      casterId: a.playerId,
      status: "SUCCESS",
      visibility: "SECRET",
      publicSummary: "秘密技能已结算",
    });
    expect(getSelfSkillSummary(a).breathArmed).toBe(true);
    expect(packetsFor(io, b, ["skill:resolved"]).some((entry) => (
      entry.payload?.skillId === "DEEP_BREATH"
    ))).toBe(false);
  });

  test("DB-SECRET-03/04 实时状态、公开播报、重连与公开手牌审计均不泄露身份", () => {
    const { io, engine, room, a, b } = setupRoom();
    io.emits.length = 0;
    expect(use(engine, room, a, "DEEP_BREATH", {}, "db-public-redaction")).toMatchObject({
      status: "SUCCESS",
    });

    const opponentLivePackets = packetsFor(io, b, ["skill:resolved", "skill:state", "room_state"]);
    expect(opponentLivePackets.length).toBeGreaterThan(0);
    expectNoDeepBreathIdentity(opponentLivePackets);
    expectNoDeepBreathIdentity(getPublicRoomSkillSnapshot(room, b));
    expect(getPublicSkillSummary(a).knownSkills).not.toContain("DEEP_BREATH");

    const publicExtras = engine.skillEngine.buildRevealExtras(room);
    const privateExtras = engine.skillEngine.buildRevealExtras(room, { includePrivateAudit: true });
    expectNoDeepBreathIdentity(publicExtras.skillActions);
    expect(privateExtras.skillActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        skillId: "DEEP_BREATH",
        casterId: a.playerId,
        secret: true,
      }),
    ]));

    io.emits.length = 0;
    engine.revealHandCommitment(room);
    const publicReveal = [...io.emits].reverse().find((entry) => (
      entry.target === room.roomId && entry.event === "hand_reveal"
    ))?.payload;
    expect(publicReveal).toBeTruthy();
    expectNoDeepBreathIdentity(publicReveal);
    expect(room.privateHandAuditHistory.at(-1).skillActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ skillId: "DEEP_BREATH", casterId: a.playerId }),
    ]));

    io.emits.length = 0;
    engine.restorePlayerState(room, b);
    expectNoDeepBreathIdentity(packetsFor(io, b));
  });

  test("DB-SECRET-05 发动时本人真实能量扣 1，对手公开数字保持手内冻结", () => {
    const { engine, room, a, b } = setupRoom();
    expect(getPublicSkillSummary(a).abyssEnergy).toBe(SKILL_CONFIG.INITIAL_ABYSS_ENERGY);
    expect(use(engine, room, a, "DEEP_BREATH", {}, "db-energy-frozen")).toMatchObject({
      status: "SUCCESS",
    });
    expect(getRealEnergy(a)).toBe(3);
    expect(getSelfSkillSummary(a).abyssEnergy).toBe(3);
    expect(engine.getRoomSnapshot(room, b).players.find((player) => player.playerId === a.playerId)
      .skills.abyssEnergy).toBe(4);
  });

  test("DB-SECRET-06 手牌结束恢复 2 后才刷新下一公开快照，且无专门公开提示", () => {
    const { io, engine, room, a, b } = setupRoom();
    expect(use(engine, room, a, "DEEP_BREATH", {}, "db-energy-refresh")).toMatchObject({
      status: "SUCCESS",
    });
    io.emits.length = 0;
    engine.skillEngine.endHand(room, { reason: "showdown", winner: a, tie: false });
    const refundPacket = lastPacket(io, a, "skill:private-result");
    expect(refundPacket?.payload).toMatchObject({
      skillId: "DEEP_BREATH",
      status: "REFUNDED",
      amount: 2,
      message: "深呼吸：恢复 2 点能量。",
    });
    expect(a.skillRuntime.breathArmed).toBe(false);
    expect(a.skillRuntime.breathBroken).toBe(false);
    expect(getSelfSkillSummary(a).breathArmed).toBe(false);
    engine.skillEngine.broadcastSkillState(room);
    engine.broadcastRoomState(room);
    expect(getRealEnergy(a)).toBe(5);
    expect(getPublicSkillSummary(a).abyssEnergy).toBe(5);
    expect(engine.getRoomSnapshot(room, b).players.find((player) => player.playerId === a.playerId)
      .skills.abyssEnergy).toBe(5);
    expectNoDeepBreathIdentity(packetsFor(io, b));
    expect(JSON.stringify(packetsFor(io, b))).not.toContain("+2");
    engine.skillEngine.endHand(room, { reason: "showdown", winner: a, tie: false });
    expect(getRealEnergy(a)).toBe(5);
    expect(a.skillRuntime.privateResults.filter((result) => (
      result.skillId === "DEEP_BREATH" && result.status === "REFUNDED"
    ))).toHaveLength(1);
  });

  test("DB-SETTLEMENT-01 对手 socket、公共日志、房间状态和结算载荷均无返能身份细节", () => {
    const { io, engine, room, a, b } = setupRoom();
    expect(use(engine, room, a, "DEEP_BREATH", {}, "db-public-settlement")).toMatchObject({
      status: "SUCCESS",
    });
    io.emits.length = 0;
    a.status = "active";
    b.status = "folded";
    engine.settleByFold(room);

    const opponentPackets = packetsFor(io, b);
    const handResult = lastPacket(io, b, "hand_result")?.payload;
    expect(handResult).toBeTruthy();
    expectNoDeepBreathIdentity(opponentPackets);
    expectNoDeepBreathIdentity(getPublicRoomSkillSnapshot(room, b).recentLog);
    expectNoDeepBreathIdentity(engine.getRoomSnapshot(room, b));
    expectNoDeepBreathIdentity(handResult);
    expect((handResult.skillSettlement?.effects || []).map((effect) => effect.skillId)).not.toContain("DEEP_BREATH");
    expect(JSON.stringify(opponentPackets)).not.toMatch(/恢复 2|返能|"amount":2/);
    expect(lastPacket(io, a, "skill:private-result")?.payload).toMatchObject({
      skillId: "DEEP_BREATH",
      status: "REFUNDED",
      amount: 2,
    });
    expect(a.skillRuntime.breathArmed).toBe(false);
    engine.abortPendingRoomWork(room);
  });

  test("DB-ALERT-01 警觉监听深呼吸，但只给出通用私有提示", () => {
    const { io, engine, room, a, b } = setupRoom({
      loadoutA: ["DEEP_BREATH", "RECYCLE"],
      loadoutB: ["ALERT", "RECYCLE"],
      random: () => 0,
    });
    io.emits.length = 0;
    expect(use(engine, room, a, "DEEP_BREATH", {}, "db-alert")).toMatchObject({ status: "SUCCESS" });
    expect(b.skillRuntime.alertPromptPending).toBe(true);

    engine.skillEngine.onBettingDecisionStart(room, b);
    const alert = b.skillRuntime.privateResults.at(-1);
    expect(alert).toMatchObject({
      skillId: "ALERT",
      message: SKILL_CONFIG.ALERT_MESSAGE,
    });
    expectNoDeepBreathIdentity(alert);
    expectNoDeepBreathIdentity(packetsFor(io, b, ["skill:resolved", "room_state"]));
  });

  test("DB-CLAIR-01 灵视私下确认已发生深呼吸，但不揭露待恢复与最终返能", () => {
    const { engine, room, a, b } = setupRoom({
      loadoutA: ["DEEP_BREATH", "RECYCLE"],
      loadoutB: ["CLAIRVOYANCE", "RECYCLE"],
    });
    expect(use(engine, room, a, "DEEP_BREATH", {}, "db-before-clair")).toMatchObject({ status: "SUCCESS" });
    expect(use(engine, room, b, "CLAIRVOYANCE", {}, "clair-after-db")).toMatchObject({ status: "SUCCESS" });

    const clairvoyance = b.skillRuntime.privateResults.at(-1);
    const deepBreathEvent = clairvoyance.events.find((entry) => entry.skillId === "DEEP_BREATH");
    expect(deepBreathEvent).toMatchObject({ skillId: "DEEP_BREATH", status: "SUCCESS" });
    expect(deepBreathEvent).not.toHaveProperty("pending");
    expect(deepBreathEvent).not.toHaveProperty("audit");
    expect(JSON.stringify(clairvoyance)).not.toMatch(/breathArmed|restor|返还|恢复 2/);
  });

  test("DB-COUNTER-01 反制先扣 1 后令深呼吸失败，不建立待恢复状态", () => {
    const { io, engine, room, a, b } = setupRoom({
      loadoutA: ["DEEP_BREATH", "RECYCLE"],
      loadoutB: ["COUNTER", "RECYCLE"],
    });
    b.skillRuntime.counterArmed = true;
    io.emits.length = 0;

    expect(use(engine, room, a, "DEEP_BREATH", {}, "db-countered")).toMatchObject({
      ok: true,
      status: "COUNTERED",
    });
    expect(getRealEnergy(a)).toBe(3);
    expect(a.skillRuntime.breathArmed).toBe(false);
    expect(a.skillRuntime.paidFailuresThisHand).toEqual(expect.arrayContaining([
      expect.objectContaining({ skillId: "DEEP_BREATH", cost: 1, reason: "COUNTERED" }),
    ]));
    expectNoDeepBreathIdentity(packetsFor(io, b, ["skill:resolved", "skill:state", "room_state"]));
    expect(lastPacket(io, a, "skill:private-result")?.payload).toMatchObject({
      skillId: "DEEP_BREATH",
    });
  });

  test("DB-RECYCLE-01 费用 1 的失败候选向下取整返还 0，不产生额外能量", () => {
    const { engine, room, a, b } = setupRoom({
      loadoutA: ["DEEP_BREATH", "RECYCLE"],
      loadoutB: ["COUNTER", "RECYCLE"],
    });
    b.skillRuntime.counterArmed = true;
    expect(use(engine, room, a, "DEEP_BREATH", {}, "db-recycle-zero")).toMatchObject({ status: "COUNTERED" });
    expect(getRealEnergy(a)).toBe(3);

    engine.skillEngine.endHand(room, { reason: "showdown", winner: a, tie: false });
    expect(getRealEnergy(a)).toBe(3);
    expect(a.skillRuntime.recycleUsedThisHand).toBe(true);
    const recycleEvent = room.skillState.skillActionLog.find((entry) => (
      entry.skillId === "RECYCLE" && entry.casterId === a.playerId
    ));
    expect(recycleEvent.audit).toMatchObject({
      failedSkillId: "DEEP_BREATH",
      originalCost: 1,
      restored: 0,
    });
  });

  test("DB-FAIRNESS-01 公平清除待恢复并抑制手牌结束 +2", () => {
    const { engine, room, a } = setupRoom({
      loadoutA: ["DEEP_BREATH", "FAIRNESS"],
      loadoutB: ["DEFENSE", "RECYCLE"],
    });
    a.skillRuntime.abyssEnergy = 8;
    expect(use(engine, room, a, "DEEP_BREATH", {}, "db-before-fair")).toMatchObject({ status: "SUCCESS" });
    expect(a.skillRuntime.breathArmed).toBe(true);
    expect(getRealEnergy(a)).toBe(7);

    expect(use(engine, room, a, "FAIRNESS", {}, "fair-clears-db")).toMatchObject({ status: "SUCCESS" });
    expect(a.skillRuntime.breathArmed).toBe(false);
    expect(getRealEnergy(a)).toBe(4);
    engine.skillEngine.endHand(room, { reason: "showdown", winner: a, tie: false });
    expect(getRealEnergy(a)).toBe(4);
  });
});
