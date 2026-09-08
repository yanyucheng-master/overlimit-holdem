const { GAME_MODE } = require("../game/gameModes");
const { SKILL_MODE } = require("../game/skillModes");
const { RoomManager } = require("../game/roomManager");
const { GameEngine } = require("../game/gameEngine");
const { createDeck } = require("../utils/deck");
const { setPlayerLoadout } = require("../game/skills/skillEngine");
const {
  PRESENTATION_KIND,
  PRESENTATION_DURATION_MS,
  MAX_PRESENTATION_WINDOW_MS,
  presentationDuration,
  toPublicPresentationBarrier,
} = require("../game/presentationConfig");
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
  loadoutA = ["ENDGAME", "DEEP_BREATH"],
  loadoutB = ["DEFENSE", "RECYCLE"],
} = {}) {
  const io = makeIoStub();
  const roomManager = new RoomManager({ logger, eventBus });
  const engine = new GameEngine({ io, roomManager, logger, eventBus, deckFactory: createDeck });
  const room = roomManager.createRoom(null, GAME_MODE.STANDARD, SKILL_MODE.ABYSS);
  const a = roomManager.joinRoom({ roomId: room.roomId, playerName: "A", playerId: "PA", socketId: "s1" }).player;
  const b = roomManager.joinRoom({ roomId: room.roomId, playerName: "B", playerId: "PB", socketId: "s2" }).player;
  expect(setPlayerLoadout(a, loadoutA).ok).toBe(true);
  expect(setPlayerLoadout(b, loadoutB).ok).toBe(true);
  room.__skillEngineForTests = engine.skillEngine;
  engine.startHand(room);
  engine.clearActionTimer(room);
  return { io, roomManager, engine, room, a, b };
}

function card(code, suit, rank, value) {
  return { code, suit, rank, value };
}

function prepareEndgameExecution(ctx) {
  const { engine, room, a, b } = ctx;
  room.skillState.endgameActive = { casterId: a.playerId, execution: true, confiscated: 0 };
  room.communityCards = [
    card("H2", "H", "2", 2),
    card("C9", "C", "9", 9),
    card("S5", "S", "5", 5),
    card("D7", "D", "7", 7),
    card("H8", "H", "8", 8),
  ];
  a.cards = [card("S2", "S", "2", 2), card("D3", "D", "3", 3)];
  b.cards = [card("SA", "S", "A", 14), card("DA", "D", "A", 14)];
  room.phase = "river";
  a.chips = 950;
  b.chips = 950;
  a.streetBet = 50;
  b.streetBet = 50;
  a.totalBet = 50;
  b.totalBet = 50;
  room.pot = 100;
  ctx.presentationBaseline = {
    chips: room.players.map((player) => ({ playerId: player.playerId, chips: player.chips })),
    pot: room.pot,
  };
  engine.settleShowdown(room);
  return room.presentationBarrier;
}

function payloads(io, event) {
  return io.emits.filter((entry) => entry.event === event);
}

describe("authoritative presentation barriers", () => {
  const rooms = [];

  afterEach(() => {
    while (rooms.length) {
      const { engine, room } = rooms.pop();
      engine.abortPendingRoomWork(room);
    }
    jest.useRealTimers();
  });

  test("presentation metadata is bounded, serializable, and shared by both viewers", () => {
    const ctx = setupRoom();
    rooms.push(ctx);
    const barrier = prepareEndgameExecution(ctx);
    expect(barrier).toMatchObject({ kind: PRESENTATION_KIND.ENDGAME_EXECUTION });
    expect(presentationDuration(PRESENTATION_KIND.ENDGAME_EXECUTION)).toBe(
      PRESENTATION_DURATION_MS[PRESENTATION_KIND.ENDGAME_EXECUTION]
    );
    expect(presentationDuration("UNKNOWN")).toBe(0);
    expect(barrier.until - barrier.startedAt).toBeLessThanOrEqual(MAX_PRESENTATION_WINDOW_MS);

    const publicBarrier = toPublicPresentationBarrier(ctx.room.presentationBarrier);
    expect(publicBarrier).toMatchObject({
      id: barrier.id,
      kind: PRESENTATION_KIND.ENDGAME_EXECUTION,
      handNo: ctx.room.handNo,
      durationMs: PRESENTATION_DURATION_MS[PRESENTATION_KIND.ENDGAME_EXECUTION],
    });
    const aSnapshot = ctx.engine.getRoomSnapshot(ctx.room, ctx.a);
    const bSnapshot = ctx.engine.getRoomSnapshot(ctx.room, ctx.b);
    expect(aSnapshot.presentationBarrier.id).toBe(bSnapshot.presentationBarrier.id);
    expect(aSnapshot.presentationBarrier.until).toBe(bSnapshot.presentationBarrier.until);
    expect(aSnapshot.actionDeadline).toBeNull();
    expect(bSnapshot.actionDeadline).toBeNull();
  });

  test("Endgame result and history remain unavailable until execution FX releases", () => {
    const ctx = setupRoom();
    rooms.push(ctx);
    const barrier = prepareEndgameExecution(ctx);
    expect(barrier).toMatchObject({ kind: PRESENTATION_KIND.ENDGAME_EXECUTION });
    expect(ctx.room.phase).toBe("showdown");
    expect(ctx.room.lastHandResult).toBeNull();
    expect(ctx.room.handResultHistory).toEqual([]);
    expect(ctx.room.pot).toBe(ctx.presentationBaseline.pot);
    expect(ctx.room.players.map((player) => ({ playerId: player.playerId, chips: player.chips })))
      .toEqual(ctx.presentationBaseline.chips);
    expect(payloads(ctx.io, "hand_result")).toHaveLength(0);
    const earlyShowdown = payloads(ctx.io, "showdown");
    expect(earlyShowdown).toHaveLength(2);
    earlyShowdown.forEach(({ payload }) => {
      expect(payload).toEqual(expect.objectContaining({
        endgameExecutionOverride: true,
        presentationBarrier: expect.objectContaining({ id: barrier.id }),
      }));
      expect(payload).not.toHaveProperty("players");
      expect(payload).not.toHaveProperty("winner");
      expect(payload).not.toHaveProperty("pot");
    });

    const beforeRestore = ctx.io.emits.length;
    ctx.engine.restorePlayerState(ctx.room, ctx.a);
    const restored = ctx.io.emits.slice(beforeRestore).filter((entry) => entry.target === "s1");
    expect(restored.find((entry) => entry.event === "player_turn")).toBeUndefined();
    expect(restored.find((entry) => entry.event === "hand_history")?.payload?.hands).toEqual([]);

    expect(ctx.engine.releasePresentationBarrier(ctx.room, barrier.id)).toBe(true);
    expect(ctx.room.presentationBarrier).toBeNull();
    expect(ctx.room.lastHandResult).toMatchObject({
      winner: ctx.a.playerId,
      endgameExecutionOverride: true,
    });
    expect(ctx.room.pot).toBe(0);
    expect(ctx.room.players.map((player) => ({ playerId: player.playerId, chips: player.chips })))
      .not.toEqual(ctx.presentationBaseline.chips);
    expect(ctx.room.handResultHistory).toHaveLength(1);
    expect(payloads(ctx.io, "hand_result")).toHaveLength(2);
    expect(ctx.room.phase).toBe("end");
  });

  test("the server fail-safe releases Endgame without a client acknowledgement", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-03T00:00:00.000Z"));
    const ctx = setupRoom();
    rooms.push(ctx);
    const barrier = prepareEndgameExecution(ctx);
    expect(ctx.room.lastHandResult).toBeNull();
    jest.advanceTimersByTime(PRESENTATION_DURATION_MS[PRESENTATION_KIND.ENDGAME_EXECUTION] - 1);
    expect(ctx.room.lastHandResult).toBeNull();
    jest.advanceTimersByTime(1);
    expect(ctx.room.presentationBarrier).toBeNull();
    expect(ctx.room.lastHandResult).toMatchObject({ winner: ctx.a.playerId });
    expect(payloads(ctx.io, "hand_result")).toHaveLength(2);
    expect(ctx.engine.releasePresentationBarrier(ctx.room, barrier.id)).toBe(false);
  });

  test("actions and skill requests are rejected while a public barrier is active", () => {
    const ctx = setupRoom();
    rooms.push(ctx);
    const barrier = ctx.engine.beginPresentationBarrier(ctx.room, {
      kind: PRESENTATION_KIND.ENDGAME_DECLARE,
    });
    expect(barrier).toBeTruthy();
    expect(ctx.room.actionDeadline).toBeNull();
    expect(ctx.engine.handlePlayerAction(ctx.room, ctx.room.currentPlayerIndex, "check", 0)).toMatchObject({
      ok: false,
      error: "公共演出尚未结束",
    });
    expect(ctx.engine.handleSkillUse(ctx.room, ctx.a, {
      skillId: "DEEP_BREATH",
      requestId: "blocked-during-presentation",
    })).toMatchObject({
      ok: false,
      error: "公共演出尚未结束",
    });
  });

  test("Dead End defers only its forced All In transition until its FX window ends", () => {
    const ctx = setupRoom({
      loadoutA: ["DEAD_END", "DEEP_BREATH"],
      loadoutB: ["DEFENSE", "RECYCLE"],
    });
    rooms.push(ctx);
    ctx.a.skillRuntime.abyssEnergy = 8;
    expect(ctx.engine.handleSkillUse(ctx.room, ctx.a, {
      skillId: "DEAD_END",
      requestId: "dead-end-presentation",
      target: {},
    })).toMatchObject({ ok: true, status: "SUCCESS" });
    const barrier = ctx.room.presentationBarrier;
    expect(barrier).toMatchObject({ kind: PRESENTATION_KIND.DEAD_END_COMMIT });
    expect(ctx.a.skillRuntime.deadEndActive).toBe(true);
    expect(ctx.b.skillRuntime.lockedThisHand).toBe(true);
    expect(ctx.a.isAllIn).toBe(false);
    expect(payloads(ctx.io, "action_made")).toHaveLength(0);

    expect(ctx.engine.releasePresentationBarrier(ctx.room, barrier.id)).toBe(true);
    expect(ctx.a.isAllIn).toBe(true);
    expect(ctx.a.skillRuntime.allInAction).toBe(true);
    expect(payloads(ctx.io, "action_made")).toHaveLength(2);
    payloads(ctx.io, "action_made").forEach(({ payload }) => {
      expect(payload.forcePublicAllIn).toBe(true);
    });
  });
});
