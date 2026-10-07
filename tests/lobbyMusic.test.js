const { Director, Player, LOBBY_CUE, cueForScreen, ONCE_SECONDS } = require("../public/table-music");

const daily = { scene: "daily", key: "daily", playOpening: false };
const endgame = { scene: "endgame", key: "endgame:ROOM:HAND", playOpening: true };
const lobbyEnvironment = { atLobby: true, atTable: false, visible: true, connected: false, volume: 35 };
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

function fixture() {
  const starts = [];
  const context = { state: "running", currentTime: 0, destination: {},
    createGain: () => ({ gain: { value: 0.35, setValueAtTime() {}, linearRampToValueAtTime() {},
      setTargetAtTime() {}, cancelScheduledValues() {} }, connect() {}, disconnect() {} }),
    createBufferSource: () => {
      const node = { connect() {}, disconnect() {}, stop: jest.fn(),
        start: (when, offset) => starts.push({ node, when, offset }) };
      return node;
    },
    resume: async () => {}, decodeAudioData: async () => ({ duration: 75.29327083333334 }),
  };
  const fetchAudio = jest.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }));
  const player = new Player({ getContext: () => context, fetchAudio });
  for (const [key, duration] of Object.entries({ lobby: 75.29327083333334, daily: 152,
    allin: 54, endgameOnce: ONCE_SECONDS, endgameLoop: 42.664625 })) {
    player.cache.set(key, { buffer: { duration }, format: "flac" });
  }
  return { context, starts, fetchAudio, player };
}

test("lobby, create-room wait and loadout screens share one cue; table uses the public director", () => {
  for (const screen of ["auth", "wait", "skillLab"]) expect(cueForScreen(screen, endgame)).toBe(LOBBY_CUE);
  expect(cueForScreen("game", endgame)).toBe(endgame);
  expect(cueForScreen("unknown", endgame)).toBeNull();
});

test("creation, repeated room snapshots and skill configuration continue the same lobby source", async () => {
  const { player, context, starts, fetchAudio } = fixture();
  for (const screen of ["auth", "wait", "wait", "skillLab", "auth"]) {
    player.setEnvironment(lobbyEnvironment, cueForScreen(screen, endgame));
    await flush();
    context.currentTime += 3;
  }
  expect(starts).toHaveLength(1);
  expect(player.getStatus()).toMatchObject({ state: "playing", scene: "lobby" });
  expect(player.getStatus().position).toBeCloseTo(14.97);
  expect(fetchAudio).not.toHaveBeenCalled(); // No combat assets prefetched in the lobby.
  player.pause();
});

test("public hand updates in a waiting screen cannot interrupt lobby music", async () => {
  const { player, starts } = fixture();
  let screen = "wait", tableCue = daily;
  const apply = () => player.setEnvironment({ ...lobbyEnvironment, atTable: screen === "game",
    atLobby: screen !== "game", connected: true }, cueForScreen(screen, tableCue));
  const director = new Director({ onChange: (cue) => { tableCue = cue; apply(); } });
  await flush();
  director.snapshot({ roomId: "ROOM", handId: "HAND", handNo: 1, phase: "river",
    players: [{ isAllIn: true }], skillState: { endgameActive: true } });
  await flush();
  expect(starts).toHaveLength(1);
  expect(player.getStatus().scene).toBe("lobby");
  screen = "game";
  apply();
  await flush();
  expect(player.getStatus()).toMatchObject({ state: "playing", scene: "endgame", phase: "loop" });
  expect(starts).toHaveLength(2); // Rejoining an active ENDGAME skips its declaration.
  player.pause();
});

test("lobby plays through connection loss; hidden and mute pause at the saved position", async () => {
  const { player, starts, context } = fixture();
  player.setEnvironment(lobbyEnvironment, LOBBY_CUE);
  await flush();
  context.currentTime = 8;
  player.setEnvironment({ connected: false });
  expect(starts).toHaveLength(1);
  player.setEnvironment({ visible: false });
  const paused = player.getStatus().position;
  context.currentTime = 80;
  expect(player.getStatus()).toMatchObject({ state: "paused", position: paused });
  player.setEnvironment({ visible: true });
  await flush();
  expect(starts[1].offset).toBeCloseTo(paused);
  player.setEnvironment({ volume: 0 });
  expect(player.getStatus().state).toBe("off");
  expect(player.playing).toBeNull();
  player.setEnvironment({ volume: 35 });
  await flush();
  expect(starts[2].offset).toBeCloseTo(paused);
  player.pause();
});

test("lobby and daily table music keep independent resume positions", async () => {
  const { player, starts, context } = fixture();
  player.setEnvironment(lobbyEnvironment, LOBBY_CUE);
  await flush();
  context.currentTime = 12;
  const lobbyPosition = player.getStatus().position;
  player.setEnvironment({ atLobby: false, atTable: true, connected: true }, daily);
  await flush();
  expect(starts[1].offset).toBe(0);
  context.currentTime = 20;
  const tablePosition = player.getStatus().position;
  player.setEnvironment(lobbyEnvironment, LOBBY_CUE);
  await flush();
  expect(starts[2].offset).toBeCloseTo(lobbyPosition);
  player.setEnvironment({ atLobby: false, atTable: true, connected: true }, daily);
  await flush();
  expect(starts[3].offset).toBeCloseTo(tablePosition);
  player.pause();
});

test("entering the table without a snapshot cannot start a cue using lobby permissions", async () => {
  const { player, starts } = fixture();
  player.setEnvironment(lobbyEnvironment, LOBBY_CUE);
  await flush();
  player.setEnvironment({ atLobby: false, atTable: true, connected: false }, daily);
  await flush();
  expect(player.getStatus().state).toBe("paused");
  expect(starts).toHaveLength(1);
  player.setEnvironment({ connected: true });
  await flush();
  expect(player.getStatus().scene).toBe("daily");
  expect(starts).toHaveLength(2);
  player.setEnvironment(lobbyEnvironment, LOBBY_CUE);
  await flush();
  expect(player.getStatus()).toMatchObject({ state: "playing", scene: "lobby" });
  player.pause();
});

test("a live table reconnecting through wait keeps ENDGAME paused and never replays its opening", async () => {
  const { player, starts, context } = fixture();
  player.setEnvironment({ ...lobbyEnvironment, atLobby: false, atTable: true, connected: true }, endgame);
  await flush();
  context.currentTime = 18;
  player.setEnvironment({ connected: false }, cueForScreen("wait", endgame, { reconnectingTable: true }));
  const paused = player.getStatus().position;
  expect(player.getStatus()).toMatchObject({ state: "paused", scene: "endgame", phase: "loop" });
  expect(starts).toHaveLength(2);
  player.setEnvironment({ connected: true }, cueForScreen("game", endgame));
  await flush();
  expect(starts).toHaveLength(3);
  expect(starts[2].node.loop).toBe(true);
  expect(starts[2].offset).toBeCloseTo(paused - ONCE_SECONDS);
  player.pause();
});

test("superseded lobby decoding cannot start after the user has entered a table", async () => {
  const { player, context, starts } = fixture();
  player.cache.delete("lobby");
  let finish;
  context.decodeAudioData = () => new Promise((resolve) => { finish = resolve; });
  player.setEnvironment(lobbyEnvironment, LOBBY_CUE);
  await flush();
  player.setEnvironment({ atLobby: false, atTable: true, connected: true }, daily);
  await flush();
  finish({ duration: 75 });
  await flush();
  expect(starts).toHaveLength(1);
  expect(player.getStatus()).toMatchObject({ state: "playing", scene: "daily" });
  expect(player.cache.has("lobby")).toBe(false);
  player.pause();
});

test("silent lobby never fetches, and the real retry path restores a failed lobby load", async () => {
  const { player, fetchAudio } = fixture();
  player.cache.clear();
  player.setEnvironment({ ...lobbyEnvironment, volume: 0 }, LOBBY_CUE);
  await flush();
  expect(fetchAudio).not.toHaveBeenCalled();
  fetchAudio.mockRejectedValue(new Error("Offline audio fixture"));
  player.setEnvironment({ volume: 35 });
  await flush();
  expect(player.getStatus().state).toBe("failed");
  fetchAudio.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
  player.retry();
  await flush();
  expect(player.getStatus()).toMatchObject({ state: "playing", scene: "lobby" });
  player.pause();
});

test("ENDGAME keeps both ambient buffers and its once/loop pair in a bounded cache", async () => {
  const { player } = fixture();
  player.setEnvironment({ ...lobbyEnvironment, atLobby: false, atTable: true, connected: true }, endgame);
  await flush();
  expect([...player.cache.keys()]).toEqual(expect.arrayContaining(["lobby", "daily", "endgameOnce", "endgameLoop"]));
  expect(player.cache.size).toBe(4);
  player.pause();
});
