const { io: Client } = require("socket.io-client");
const { createAppServer } = require("../server/server");
const { GAME_MODE } = require("../game/gameModes");
const { verifyDeckCommitment } = require("../game/deckCommitment");

function waitFor(socket, event, predicate = () => true, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`timeout waiting ${event}`));
    }, timeout);
    function onEvent(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(payload);
    }
    socket.on(event, onEvent);
  });
}

function expectNoEvent(socket, event, duration = 140) {
  return new Promise((resolve, reject) => {
    const onEvent = (payload) => {
      clearTimeout(timer);
      socket.off(event, onEvent);
      reject(new Error(`unexpected ${event}: ${JSON.stringify(payload)}`));
    };
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      resolve();
    }, duration);
    socket.on(event, onEvent);
  });
}

async function setupRoom(baseUrl, { gameMode = GAME_MODE.STANDARD } = {}) {
  const c1 = new Client(baseUrl, { transports: ["websocket"] });
  const c2 = new Client(baseUrl, { transports: ["websocket"] });
  await Promise.all([waitFor(c1, "connect"), waitFor(c2, "connect")]);

  const p1Join = waitFor(c1, "room_joined");
  const created = waitFor(c1, "room_created");
  c1.emit("create_room", { playerName: "A", playerId: "PA", gameMode });
  await created;
  const j1 = await p1Join;
  const roomId = j1.roomId;

  const p2Join = waitFor(c2, "room_joined");
  const p1Cards = waitFor(c1, "your_cards");
  const p2Cards = waitFor(c2, "your_cards");
  const p1Commitment = waitFor(c1, "hand_commitment");
  const p2Commitment = waitFor(c2, "hand_commitment");
  const turnPromise = waitFor(c1, "player_turn");
  c2.emit("join_room", { roomId, playerName: "B", playerId: "PB" });
  const j2 = await p2Join;

  const [cards1, cards2, commitment1, commitment2] = await Promise.all([
    p1Cards,
    p2Cards,
    p1Commitment,
    p2Commitment,
  ]);
  const turn = await turnPromise;
  return {
    c1,
    c2,
    roomId,
    j1,
    j2,
    turn,
    cards1,
    cards2,
    commitment1,
    commitment2,
    gameMode,
  };
}

function emitPlayerAction(socket, turn, action, amount) {
  socket.emit("player_action", {
    action,
    ...(amount == null ? {} : { amount }),
    handId: turn.handId,
    turnId: turn.turnId,
  });
}

describe("socket integration", () => {
  let httpServer;
  let appServer;
  let baseUrl;
  const clients = [];

  beforeAll(async () => {
    appServer = createAppServer({
      reconnectTtlMs: 600,
      matchmakingAutoStart: false,
    });
    httpServer = appServer.httpServer;
    await new Promise((resolve) => httpServer.listen(0, resolve));
    baseUrl = `http://localhost:${httpServer.address().port}`;
  });

  afterEach(() => {
    while (clients.length) {
      const c = clients.pop();
      try {
        c.close();
      } catch (e) {
        // ignore
      }
    }
  });

  afterAll(async () => {
    await new Promise((resolve) => httpServer.close(resolve));
  });

  test("创建房间、加入房间、收到底牌", async () => {
    const { c1, c2, roomId, j1 } = await setupRoom(baseUrl);
    clients.push(c1, c2);
    expect(roomId).toBeTruthy();
    expect(j1.playerId).toBe("PA");
    expect(j1.reconnectToken).toBeTruthy();
    expect(j1.gameMode).toBe(GAME_MODE.STANDARD);
    expect(j1.players[0]).not.toHaveProperty("cards");
    expect(j1.players[0]).not.toHaveProperty("reconnectToken");
  });

  test("模式会通过 room_created / room_joined / room_state 同步且公开状态不泄露对手手牌", async () => {
    const c1 = new Client(baseUrl, { transports: ["websocket"] });
    clients.push(c1);
    await waitFor(c1, "connect");
    const created = waitFor(c1, "room_created");
    const joined = waitFor(c1, "room_joined");
    const state = waitFor(c1, "room_state", (payload) => payload.gameMode === GAME_MODE.OVERDRIVE);
    c1.emit("create_solo_room", {
      playerName: "Overdrive",
      playerId: "POVERDRIVE",
      gameMode: " OVERDRIVE ",
    });

    const [createdPayload, joinedPayload, statePayload] = await Promise.all([created, joined, state]);
    expect(createdPayload.gameMode).toBe(GAME_MODE.OVERDRIVE);
    expect(joinedPayload.gameMode).toBe(GAME_MODE.OVERDRIVE);
    expect(statePayload.gameMode).toBe(GAME_MODE.OVERDRIVE);
    for (const player of statePayload.players) {
      expect(player).toEqual(
        expect.objectContaining({
          isConnected: expect.any(Boolean),
          isBot: expect.any(Boolean),
          isReady: expect.any(Boolean),
          isAllIn: expect.any(Boolean),
        })
      );
      expect(player).not.toHaveProperty("cards");
      expect(player).not.toHaveProperty("reconnectToken");
    }
  });

  test("已有 playerId 无 token 时拒绝重连，即使原连接仍在线", async () => {
    const { c1, c2, roomId, j1 } = await setupRoom(baseUrl);
    clients.push(c1, c2);
    const attacker = new Client(baseUrl, { transports: ["websocket"] });
    clients.push(attacker);
    await waitFor(attacker, "connect");
    const error = waitFor(attacker, "join_error");
    attacker.emit("join_room", {
      roomId,
      playerName: "A",
      playerId: j1.playerId,
    });
    await expect(error).resolves.toEqual(expect.objectContaining({ message: "重连凭证错误" }));
  });

  test("非法模式以及过长房间号、昵称、密码会被拒绝", async () => {
    const client = new Client(baseUrl, { transports: ["websocket"] });
    clients.push(client);
    await waitFor(client, "connect");

    const cases = [
      ["create_room", { playerName: "A", gameMode: "unknown" }, "不支持的游戏模式"],
      ["create_room", { playerName: "A".repeat(17) }, "昵称长度不能超过 16"],
      ["create_room", { password: "p".repeat(17) }, "房间密码长度不能超过 16"],
      ["join_room", { roomId: "A".repeat(9) }, "房间号长度不能超过 8"],
    ];
    for (const [event, payload, message] of cases) {
      const error = waitFor(client, "join_error");
      client.emit(event, payload);
      await expect(error).resolves.toEqual(expect.objectContaining({ message }));
    }
  });

  test("高频房间请求会被限流", async () => {
    const client = new Client(baseUrl, { transports: ["websocket"] });
    clients.push(client);
    await waitFor(client, "connect");
    const throttled = waitFor(
      client,
      "join_error",
      (payload) => payload.message === "请求过于频繁，请稍后再试"
    );
    for (let i = 0; i < 13; i += 1) {
      client.emit("create_room", { gameMode: "invalid" });
    }
    await throttled;
  });

  test("支持 raise / call / check / fold 全流程", async () => {
    const { c1, c2, j1, j2, turn } = await setupRoom(baseUrl);
    clients.push(c1, c2);
    const sockets = { [j1.playerId]: c1, [j2.playerId]: c2 };

    const nextTurn1 = waitFor(c1, "player_turn", (p) => p.playerId !== turn.playerId);
    emitPlayerAction(sockets[turn.playerId], turn, "raise", turn.minRaise);
    await waitFor(c1, "action_made", (p) => p.action === "raise");

    const turn2 = await nextTurn1;
    const nextTurn2 = waitFor(c1, "player_turn");
    const flopCards = waitFor(c1, "community_cards", (payload) => payload.phase === "flop");
    const flopState = waitFor(c1, "room_state", (payload) => payload.phase === "flop");
    emitPlayerAction(sockets[turn2.playerId], turn2, "call");
    await waitFor(c1, "action_made", (p) => p.action === "call");

    const [flopCardsPayload, flopStatePayload] = await Promise.all([flopCards, flopState]);
    expect(flopCardsPayload.cards).toHaveLength(3);
    expect(flopStatePayload.communityCards).toHaveLength(3);
    expect(flopCardsPayload.cards[0]).toEqual(expect.objectContaining({ code: expect.any(String) }));

    const turn3 = await nextTurn2;
    const nextTurn3 = waitFor(c1, "player_turn");
    emitPlayerAction(sockets[turn3.playerId], turn3, "check");
    await waitFor(c1, "action_made", (p) => p.action === "check");

    const turn4 = await nextTurn3;
    const foldResult = waitFor(c1, "hand_result", (payload) => payload.reason === "fold");
    emitPlayerAction(sockets[turn4.playerId], turn4, "fold");
    await waitFor(c1, "action_made", (p) => p.action === "win_by_fold");
    const settledFold = await foldResult;
    expect(settledFold.settleMs).toBe(4000);
    expect(settledFold.communityCards).toHaveLength(3);

  });

  test("高爆局双客户端 All In 后摊牌并验证同一牌堆承诺", async () => {
    const {
      c1,
      c2,
      j1,
      j2,
      turn,
      commitment1,
      commitment2,
    } = await setupRoom(baseUrl, { gameMode: GAME_MODE.OVERDRIVE });
    clients.push(c1, c2);
    const sockets = { [j1.playerId]: c1, [j2.playerId]: c2 };
    expect(commitment1).toEqual(commitment2);
    expect(commitment1.mode).toBe(GAME_MODE.OVERDRIVE);

    const nextTurn = waitFor(c1, "player_turn", (payload) => payload.playerId !== turn.playerId);
    emitPlayerAction(sockets[turn.playerId], turn, "allin");
    const callerTurn = await nextTurn;

    const handResult = waitFor(c1, "hand_result", (payload) => payload.reason === "showdown");
    const reveal1 = waitFor(c1, "hand_reveal");
    const reveal2 = waitFor(c2, "hand_reveal");
    emitPlayerAction(sockets[callerTurn.playerId], callerTurn, "call");

    const [result, firstReveal, secondReveal] = await Promise.all([
      handResult,
      reveal1,
      reveal2,
    ]);
    expect(result.communityCards).toHaveLength(5);
    expect(result.settleMs).toBe(6000);
    expect(result.players.every((player) => player.cards.length === 2)).toBe(true);
    expect(firstReveal).toEqual(secondReveal);
    expect(firstReveal.commitment).toBe(commitment1.commitment);
    expect(verifyDeckCommitment(firstReveal)).toBe(true);
  });

  test.each([false, true])("Loan repayment: authority, replay, Fairness and real reconnect (final window=%s)", async (finalWindow) => {
    const c1 = new Client(baseUrl, { transports: ["websocket"] });
    const c2 = new Client(baseUrl, { transports: ["websocket"] });
    clients.push(c1, c2);
    await Promise.all([waitFor(c1, "connect"), waitFor(c2, "connect")]);
    const joined1 = waitFor(c1, "room_joined");
    c1.emit("create_room", { playerName: "Loan A", playerId: "PLOANA", skillMode: "abyss" });
    const j1 = await joined1;
    const joined2 = waitFor(c2, "room_joined");
    c2.emit("join_room", { roomId: j1.roomId, playerName: "Loan B", playerId: "PLOANB" });
    const j2 = await joined2;
    const turnP = waitFor(c1, "player_turn");
    c1.emit("skill:loadout:set", { skillIds: ["LOAN", "DEEP_BREATH", "FAIRNESS"] });
    c2.emit("skill:loadout:set", { skillIds: ["LOAN", "DEEP_BREATH", "FAIRNESS"] });
    const turn = await turnP;
    const borrower = turn.playerId === j1.playerId ? c1 : c2;
    const observer = borrower === c1 ? c2 : c1;
    const identity = borrower === c1 ? j1 : j2;
    const room = appServer.roomManager.rooms.get(j1.roomId);
    appServer.gameEngine.clearActionTimer(room);
    const player = room.players.find((p) => p.playerId === turn.playerId);
    const publicPackets = [];
    observer.onAny((event, payload) => publicPackets.push({ event, payload }));
    const debtP = waitFor(borrower, "skill:state", (p) => p.self?.loan?.tranches?.length === 1);
    borrower.emit("skill:use", { skillId: "LOAN", target: { mode: "energy" }, requestId: "loan-secret-socket", handId: turn.handId, turnId: turn.turnId, phase: room.phase });
    const state = await debtP;
    const tranche = state.self.loan.tranches[0];
    expect(tranche).toMatchObject({ principal: 5, amount: 6, defaultApplied: false });
    const forgedP = waitFor(observer, "loan:repayment:result");
    observer.emit("loan:repay", { roomId: room.roomId, playerId: player.playerId, debtId: tranche.id, amount: 0, requestId: "forged-owner", handId: room.handId });
    expect(await forgedP).toMatchObject({ ok: false, reason: "debtMissing" });
    expect(player.skillRuntime.loanDebts[0].amount).toBe(6);
    const fairP = waitFor(borrower, "skill:state", (p) => p.self?.loan?.tranches?.[0]?.fairnessAdjusted);
    borrower.emit("skill:use", { skillId: "FAIRNESS", requestId: "loan-fair", handId: room.handId, turnId: room.turnId, phase: room.phase });
    expect((await fairP).self.loan.tranches[0].amount).toBe(5);
    const { beginHandSkills, prepareNextHandSkills } = require("../game/skills/skillEngine");
    for (let i = 0; i < 2; i++) {
      appServer.gameEngine.skillEngine.endHand(room, { reason: "showdown", tie: true });
      prepareNextHandSkills(room, room.handNo + 1);
      room.handNo++; room.handId = "loan-grace-" + i; beginHandSkills(room);
    }
    player.skillRuntime.abyssEnergy = 6;
    room.players.find((p) => p !== player).status = "folded";
    appServer.gameEngine.settleByFold(room);
    appServer.gameEngine.abortPendingRoomWork(room); // Hold the real end window for reconnect I/O.
    expect(room.phase).toBe("end");
    expect(player.skillRuntime.loanDebts[0]).toMatchObject({ amount: 5, defaultApplied: false, penalty: 0 });
    if (!finalWindow) {
      appServer.gameEngine.startHand(room);
      appServer.gameEngine.clearActionTimer(room);
      player.skillRuntime.abyssEnergy = 8;
    }
    const due = finalWindow ? 5 : 6;
    const snapshot = JSON.parse(JSON.stringify(player.skillRuntime.loanDebts));
    const uses = player.skillRuntime.loanTotalUsesThisHand;
    expect(snapshot[0]).toMatchObject({ amount: due, defaultApplied: !finalWindow, fairnessAdjusted: true, penalty: finalWindow ? 0 : 1 });
    const disconnected = waitFor(observer, "player_disconnected");
    borrower.close();
    await disconnected;
    const reconnected = new Client(baseUrl, { transports: ["websocket"] });
    clients.push(reconnected);
    await waitFor(reconnected, "connect");
    const restoredP = waitFor(reconnected, "skill:state", (p) => p.self?.loan?.tranches?.[0]?.id === tranche.id);
    reconnected.emit("join_room", { roomId: room.roomId, playerId: player.playerId, playerName: player.name, reconnectToken: identity.reconnectToken });
    const restored = await restoredP;
    expect(restored.self.loan.tranches[0]).toMatchObject({
      id: tranche.id, amount: due, principal: 5, defaultApplied: !finalWindow, fairnessAdjusted: true, penalty: finalWindow ? 0 : 1,
    });
    expect(restored.self.loan.state).toBe(finalWindow ? "DEBT_OPEN" : "DEFAULTED");
    expect(player.skillRuntime.loanDebts).toEqual(snapshot);
    expect(player.skillRuntime.loanTotalUsesThisHand).toBe(uses);
    const index = room.currentPlayerIndex, deadline = room.actionDeadline, events = player.skillRuntime.skillEventsThisHand;
    const repayment = { roomId: room.roomId, debtId: tranche.id, requestId: "real-repay", handId: room.handId };
    const paidP = waitFor(reconnected, "loan:repayment:result");
    reconnected.emit("loan:repay", repayment);
    expect(await paidP).toMatchObject({ ok: true, paid: due });
    const repeatP = waitFor(reconnected, "loan:repayment:result");
    reconnected.emit("loan:repay", repayment);
    expect(await repeatP).toMatchObject({ ok: true, duplicate: true });
    const replayP = waitFor(reconnected, "loan:repayment:result");
    reconnected.emit("loan:repay", { ...repayment, requestId: "replay-fresh-id" });
    expect(await replayP).toMatchObject({ ok: false, reason: "debtMissing" });
    expect(player.skillRuntime.abyssEnergy).toBe(2);
    expect(player.skillRuntime.loanDebts).toEqual([]);
    expect([room.currentPlayerIndex, room.actionDeadline, player.skillRuntime.skillEventsThisHand, player.skillRuntime.loanTotalUsesThisHand]).toEqual([index, deadline, events, uses]);
    // Ignore the attacker's own failed request acknowledgement, never a debt disclosure.
    const remote = JSON.stringify(publicPackets.filter((p) => p.event !== "loan:repayment:result"));
    expect(remote).not.toContain(tranche.id);
    expect(remote).not.toContain('"skillId":"LOAN"');
    expect(remote).not.toContain('"principal":');
    if (finalWindow) {
      const opponent = room.players.find((p) => p !== player);
      expect(appServer.gameEngine.getRoomSnapshot(room, opponent).players.find((p) => p.playerId === player.playerId).skills.abyssEnergy).toBe(7);
      const nextHandNo = room.handNo + 1;
      const nextState = waitFor(observer, "room_state", (p) => p.phase === "pre_flop" && p.handNo === nextHandNo);
      appServer.gameEngine.startHand(room);
      const packet = await nextState;
      expect(packet.players.find((p) => p.playerId === player.playerId).skills.abyssEnergy).toBe(2);
      expect(player.skillRuntime.loanDebts).toEqual([]);
    }
    appServer.gameEngine.clearActionTimer(room);
  });

  test("主动技能通过 Socket 单次请求即时结算，不再创建旧式反应窗口", async () => {
    const c1 = new Client(baseUrl, { transports: ["websocket"] });
    const c2 = new Client(baseUrl, { transports: ["websocket"] });
    clients.push(c1, c2);
    await Promise.all([waitFor(c1, "connect"), waitFor(c2, "connect")]);

    const created = waitFor(c1, "room_created");
    const hostJoined = waitFor(c1, "room_joined");
    c1.emit("create_room", {
      playerName: "A",
      playerId: "PSKILLA",
      skillMode: "abyss",
    });
    const [{ roomId }] = await Promise.all([created, hostJoined]);

    const guestJoined = waitFor(c2, "room_joined");
    c2.emit("join_room", {
      roomId,
      playerName: "B",
      playerId: "PSKILLB",
    });
    await guestJoined;

    const hostCards = waitFor(c1, "your_cards");
    const guestCards = waitFor(c2, "your_cards");
    const firstTurnPromise = waitFor(c1, "player_turn");
    const sharedLoadout = ["DEEP_BREATH", "RECYCLE"];
    c1.emit("skill:loadout:set", { skillIds: sharedLoadout });
    c2.emit("skill:loadout:set", { skillIds: sharedLoadout });
    await Promise.all([hostCards, guestCards]);
    const firstTurn = await firstTurnPromise;

    const sockets = { PSKILLA: c1, PSKILLB: c2 };
    const caster = sockets[firstTurn.playerId];
    const opponent = caster === c1 ? c2 : c1;
    const requestId = "integration-deep-breath";
    const resolved = waitFor(
      caster,
      "skill:resolved",
      (payload) => payload.requestId === requestId
    );
    const opponentSeesNoResolved = expectNoEvent(opponent, "skill:resolved", 500);
    const noReaction = expectNoEvent(caster, "skill:reaction-window", 400);
    const startedAt = Date.now();
    caster.emit("skill:use", {
      requestId,
      skillId: "DEEP_BREATH",
      target: {},
      handId: firstTurn.handId,
      turnId: firstTurn.turnId,
      phase: "pre_flop",
    });
    await expect(resolved).resolves.toEqual(
      expect.objectContaining({
        requestId,
        skillId: "DEEP_BREATH",
        status: "SUCCESS",
      })
    );
    await noReaction;
    await opponentSeesNoResolved;
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  test("断线后可凭 token 重连且不会重开牌局，超时终局可完整恢复", async () => {
    const { c1, c2, roomId, j1 } = await setupRoom(baseUrl);
    clients.push(c1, c2);

    const firstDisconnect = waitFor(c2, "player_disconnected");
    c1.close();
    await firstDisconnect;

    const c3 = new Client(baseUrl, { transports: ["websocket"] });
    clients.push(c3);
    await waitFor(c3, "connect");
    const rejoin = waitFor(c3, "room_joined");
    const restoredCards = waitFor(c3, "your_cards");
    const noOpponentRedeal = expectNoEvent(c2, "your_cards");
    c3.emit("join_room", {
      roomId,
      playerName: "A",
      playerId: j1.playerId,
      reconnectToken: j1.reconnectToken,
    });
    await rejoin;
    expect((await restoredCards).cards).toHaveLength(2);
    await noOpponentRedeal;

    const secondDisconnect = waitFor(c2, "player_disconnected");
    c3.close();
    await secondDisconnect;
    const over = await waitFor(c2, "game_over");
    expect(over.reason).toBe("disconnect_timeout_forfeit");

    const c4 = new Client(baseUrl, { transports: ["websocket"] });
    clients.push(c4);
    await waitFor(c4, "connect");
    const finalJoin = waitFor(c4, "room_joined");
    const restoredGameOver = waitFor(c4, "game_over");
    const noCardsAfterGameOver = expectNoEvent(c4, "your_cards");
    c4.emit("join_room", {
      roomId,
      playerName: "A",
      playerId: j1.playerId,
      reconnectToken: j1.reconnectToken,
    });
    await finalJoin;
    await expect(restoredGameOver).resolves.toEqual(
      expect.objectContaining({
        reason: "disconnect_timeout_forfeit",
        rematch: expect.objectContaining({ accepted: expect.any(Array) }),
      })
    );
    await noCardsAfterGameOver;

  });

  test("一方断线时另一方不能单方面开始重赛", async () => {
    const { c1, c2 } = await setupRoom(baseUrl);
    clients.push(c1, c2);
    const disconnected = waitFor(c2, "player_disconnected");
    c1.close();
    await disconnected;
    await waitFor(c2, "game_over");

    const update = waitFor(c2, "rematch_update");
    const noStart = expectNoEvent(c2, "rematch_started");
    c2.emit("rematch_response", { accepted: true });
    await update;
    await noStart;
  });

  test.each([GAME_MODE.STANDARD, GAME_MODE.OVERDRIVE])(
    "%s 模式均可完成基本行动",
    async (gameMode) => {
      const { c1, c2, j1, j2, turn } = await setupRoom(baseUrl, { gameMode });
      clients.push(c1, c2);
      expect(j1.gameMode).toBe(gameMode);
      expect(j2.gameMode).toBe(gameMode);
      const sockets = { [j1.playerId]: c1, [j2.playerId]: c2 };
      const action = turn.validActions.includes("call") ? "call" : "check";
      const made = waitFor(c1, "action_made", (payload) => payload.playerId === turn.playerId);
      emitPlayerAction(sockets[turn.playerId], turn, action);
      await expect(made).resolves.toEqual(expect.objectContaining({ action }));
    }
  );

  test("进行中离房后旧房不会拦截同一 socket 的新房行动", async () => {
    const { c1, c2, roomId } = await setupRoom(baseUrl);
    clients.push(c1, c2);
    const left = waitFor(c1, "left_room");
    c1.emit("leave_room");
    await left;

    const joined = waitFor(c1, "room_joined", (payload) => payload.roomId !== roomId);
    const turn = waitFor(c1, "player_turn", (payload) => payload.playerId === "PA");
    c1.emit("create_solo_room", {
      playerName: "A",
      playerId: "PA",
      gameMode: GAME_MODE.STANDARD,
    });
    await joined;
    const nextTurn = await turn;
    const action = nextTurn.validActions.includes("call") ? "call" : "check";
    const made = waitFor(c1, "action_made", (payload) => payload.playerId === "PA");
    emitPlayerAction(c1, nextTurn, action);
    await expect(made).resolves.toEqual(expect.objectContaining({ action }));
  });

  test("单机模式可创建人机房并正常开局", async () => {
    const c1 = new Client(baseUrl, { transports: ["websocket"] });
    clients.push(c1);
    await waitFor(c1, "connect");
    const joined = waitFor(c1, "room_joined");
    const cards = waitFor(c1, "your_cards");
    const turn = waitFor(c1, "player_turn");
    c1.emit("create_solo_room", { playerName: "Solo", playerId: "PSOLO" });

    const room = await joined;
    const myCards = await cards;
    const firstTurn = await turn;
    expect(room.players.length).toBe(2);
    expect(room.players.some((p) => p.isBot)).toBe(true);
    expect(myCards.cards.length).toBe(2);
    expect(firstTurn.playerId).toBeTruthy();
  });
});
