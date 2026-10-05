const { RoomManager } = require("../game/roomManager");
const { GameEngine } = require("../game/gameEngine");
const { createDeck } = require("../utils/deck");
const { GAME_MODE } = require("../game/gameModes");
const { SKILL_MODE } = require("../game/skillModes");

test("classic mode can deal the next flop after a prior showdown settlement", () => {
  const logger = { info() {}, warn() {}, error() {} };
  const eventBus = { emit() {} };
  const io = { to: () => ({ emit() {} }) };
  const roomManager = new RoomManager({ logger, eventBus });
  const engine = new GameEngine({ io, roomManager, logger, eventBus, deckFactory: createDeck });
  const room = roomManager.createRoom(null, GAME_MODE.STANDARD, SKILL_MODE.OFF);
  roomManager.joinRoom({ roomId: room.roomId, playerName: "A", playerId: "PA", socketId: "s1" });
  roomManager.joinRoom({ roomId: room.roomId, playerName: "B", playerId: "PB", socketId: "s2" });
  try {
    engine.startHand(room);
    engine.clearActionTimer(room);
    for (let step = 0; step < 12 && ["pre_flop", "flop", "turn", "river"].includes(room.phase); step++) {
      const player = room.players[room.currentPlayerIndex];
      expect(engine.handlePlayerAction(room, room.currentPlayerIndex,
        player.streetBet < room.currentBet ? "call" : "check").ok).toBe(true);
      engine.clearActionTimer(room);
    }
    expect(room.phase).toBe("end");
    expect(room.skillState.settlement).toBeDefined();
    expect(room.skillState.burnedCards).toBeUndefined();
    if (room.nextHandTimer) clearTimeout(room.nextHandTimer);
    engine.startHand(room);
    engine.clearActionTimer(room);
    while (room.phase === "pre_flop") {
      const player = room.players[room.currentPlayerIndex];
      const action = player.streetBet < room.currentBet ? "call" : "check";
      expect(engine.handlePlayerAction(room, room.currentPlayerIndex, action).ok).toBe(true);
      engine.clearActionTimer(room);
    }
    expect(room.phase).toBe("flop");
    expect(room.communityCards).toHaveLength(3);
    expect(new Set(room.communityCards.map((c) => c.code)).size).toBe(3);
  } finally { engine.abortPendingRoomWork(room); }
});
