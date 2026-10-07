const { Director, Player, ONCE_SECONDS } = require("../public/table-music");

function director() {
  const changes = [];
  const values = new Map();
  const storage = { getItem: (k) => values.get(k), setItem: (k, v) => values.set(k, v) };
  const music = new Director({ onChange: (cue) => changes.push(cue), storage });
  music.beginHand("ROOM", "HAND1", { handNo: 1 });
  return { music, changes, storage };
}

describe("public table music scene selection", () => {
  test("ENDGAME overrides ALL IN, and expiry returns to daily for the rest of this hand", () => {
    const { music } = director();
    music.action({ playerId: "A", action: "allin" });
    expect(music.cue.scene).toBe("allin");
    music.resolved({ skillId: "ENDGAME", publicData: { endgame: true } });
    expect(music.cue).toMatchObject({ scene: "endgame", playOpening: true });
    music.skillState({ endgameActive: false });
    music.snapshot({ roomId: "ROOM", handId: "HAND1", handNo: 1, phase: "river", players: [{ isAllIn: true }] });
    music.action({ playerId: "A", action: "allin" });
    music.skillState({ endgameActive: true });
    expect(music.cue.scene).toBe("daily");
    music.beginHand("ROOM", "HAND2", { handNo: 2 });
    music.action({ playerId: "A", action: "allin" });
    expect(music.cue.scene).toBe("allin");
  });

  test("execution showdown holds D5; hand_result defeats every late active snapshot", () => {
    const { music } = director();
    music.skillState({ endgameActive: true });
    music.snapshot({ roomId: "ROOM", handId: "HAND1", handNo: 1, phase: "showdown",
      presentationBarrier: { kind: "ENDGAME_EXECUTION" }, skillState: { endgameActive: true } });
    expect(music.cue.scene).toBe("endgame");
    music.finishHand({ handNo: 1 });
    music.skillState({ endgameActive: true });
    music.resolved({ skillId: "ENDGAME", publicData: { endgame: true } });
    music.snapshot({ roomId: "ROOM", handId: "HAND1", handNo: 1, phase: "showdown",
      skillState: { endgameActive: true }, players: [{ isAllIn: true }] });
    expect(music.cue.scene).toBe("daily");
  });

  test("duplicate snapshots, skill results and same-hand starts never redeclare", () => {
    const { music, changes } = director();
    music.skillState({ endgameActive: true });
    const count = changes.length;
    music.beginHand("ROOM", "HAND1");
    music.resolved({ skillId: "ENDGAME", publicData: { endgame: true } });
    music.snapshot({ roomId: "ROOM", handId: "HAND1", handNo: 1, phase: "river", skillState: { endgameActive: true } });
    expect(changes).toHaveLength(count);
  });

  test("counter, failed use and the ENDGAME selection window do not trigger music", () => {
    const { music } = director();
    music.skillState({ endgameWindow: { playerId: "A" }, endgameActive: false });
    music.resolved({ skillId: "COUNTER", publicData: { countered: "ENDGAME" } });
    music.resolved({ skillId: "ENDGAME", publicData: {} });
    expect(music.cue.scene).toBe("daily");
  });

  test("concealed opponent ALL IN is not inferred from amounts or chips", () => {
    const { music } = director();
    music.action({ playerId: "B", action: "allin", declaredAction: "allin", amount: 999,
      playerChips: [{ playerId: "B", chips: 0, isAllIn: false }] }, { playerId: "A", chipViewHidden: true });
    expect(music.cue.scene).toBe("daily");
    music.action({ playerId: "B", action: "call", forcePublicAllIn: true }, { playerId: "A", chipViewHidden: true });
    expect(music.cue.scene).toBe("allin");
  });

  test("public call-to-zero and own ALL IN still trigger C2", () => {
    const { music } = director();
    music.action({ playerId: "A", action: "call", playerChips: [{ isAllIn: true }] }, { chipViewHidden: true, playerId: "A" });
    expect(music.cue.scene).toBe("allin");
  });

  test("restoration skips declaration and preserves terminal/expiry latch across reload", () => {
    const { music, storage } = director();
    music.skillState({ endgameActive: true });
    const restored = new Director({ storage });
    restored.snapshot({ roomId: "ROOM", handId: "HAND1", handNo: 1, phase: "showdown", skillState: { endgameActive: true } });
    expect(restored.cue).toMatchObject({ scene: "endgame", playOpening: false });
    restored.finishHand({ handNo: 1 });
    const finished = new Director({ storage });
    finished.snapshot({ roomId: "ROOM", handId: "HAND1", handNo: 1, phase: "showdown", skillState: { endgameActive: true } });
    expect(finished.cue.scene).toBe("daily");
  });

  test("late old-hand packets cannot undo a new hand; daily continues across hands", () => {
    const { music, changes } = director();
    const count = changes.length;
    music.beginHand("ROOM", "HAND2", { handNo: 2 });
    expect(changes).toHaveLength(count);
    music.action({ action: "allin" });
    music.finishHand({ handNo: 1 });
    music.snapshot({ roomId: "ROOM", handId: "HAND1", handNo: 1, phase: "end" });
    music.beginHand("ROOM", "HAND1");
    expect(music.cue.scene).toBe("allin");
    expect(music.handId).toBe("HAND2");
  });
});

function fakeContext() {
  const starts = [];
  return { state: "running", currentTime: 0, destination: {}, starts,
    createGain: () => ({ gain: { value: 0.35, setValueAtTime() {}, linearRampToValueAtTime() {},
      setTargetAtTime() {}, cancelScheduledValues() {} }, connect() {}, disconnect() {} }),
    createBufferSource: () => {
      const source = { connect() {}, disconnect() {}, stop: jest.fn(),
        start: (when, offset) => starts.push({ source, when, offset }) };
      return source;
    },
    decodeAudioData: async () => ({ duration: 10 }),
    resume: async () => {},
  };
}
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const environment = { atTable: true, connected: true, visible: true, volume: 35 };
const endgame = { scene: "endgame", key: "endgame:ROOM:HAND", playOpening: true };

function cachedPlayer() {
  const context = fakeContext();
  const player = new Player({ getContext: () => context, fetchAudio: async () => { throw new Error("unused prefetch"); } });
  for (const [key, duration] of Object.entries({ daily: 152, allin: 54, endgameOnce: ONCE_SECONDS, endgameLoop: 42.664625 })) {
    player.cache.set(key, { buffer: { duration }, format: "flac" });
  }
  return { context, player };
}

describe("music transport", () => {
  test("D5 schedules once then the loop at the exact boundary on the audio clock", async () => {
    const { context, player } = cachedPlayer();
    player.setScene(endgame);
    player.setEnvironment(environment);
    await flush();
    expect(context.starts).toHaveLength(2);
    const [once, loop] = context.starts;
    expect(once.source.loop).toBe(false);
    expect(loop.source.loop).toBe(true);
    expect(loop.when - once.when).toBe(ONCE_SECONDS);
    const count = context.starts.length;
    player.setScene(endgame);
    player.setEnvironment({ volume: 50 });
    expect(context.starts).toHaveLength(count);
    expect(player.cache.size).toBeLessThanOrEqual(4);
    player.pause();
  });

  test("background and mute preserve time and never reintroduce the slow opening", async () => {
    const { context, player } = cachedPlayer();
    player.setScene(endgame);
    player.setEnvironment(environment);
    await flush();
    context.currentTime = 18;
    player.setEnvironment({ visible: false });
    const paused = player.getStatus().position;
    context.currentTime = 70;
    expect(player.getStatus().position).toBe(paused);
    player.setEnvironment({ visible: true });
    await flush();
    expect(context.starts).toHaveLength(3);
    expect(context.starts[2].source.loop).toBe(true);
    expect(context.starts[2].offset).toBeCloseTo(paused - ONCE_SECONDS);
    player.setEnvironment({ volume: 0 });
    expect(player.getStatus().state).toBe("off");
    player.setEnvironment({ volume: 35 });
    await flush();
    expect(context.starts[3].source.loop).toBe(true);
    player.pause();
  });

  test("paused opening resumes its remaining portion and keeps the boundary continuous", async () => {
    const { context, player } = cachedPlayer();
    player.setScene(endgame);
    player.setEnvironment(environment);
    await flush();
    context.currentTime = 2;
    player.setEnvironment({ connected: false });
    const offset = player.getStatus().position;
    player.setEnvironment({ connected: true });
    await flush();
    const [once, loop] = context.starts.slice(2);
    expect(once.offset).toBeCloseTo(offset);
    expect(loop.when - once.when).toBeCloseTo(ONCE_SECONDS - offset);
    player.pause();
  });

  test("superseded download/decode cannot play D5 after hand completion", async () => {
    const context = fakeContext();
    let finish;
    const promise = new Promise((resolve) => { finish = resolve; });
    context.decodeAudioData = () => promise;
    const player = new Player({ getContext: () => context,
      fetchAudio: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }) });
    player.setScene(endgame);
    player.setEnvironment(environment);
    await flush();
    player.cache.set("daily", { buffer: { duration: 152 }, format: "flac" });
    player.setScene({ scene: "daily", key: "daily" });
    await flush();
    finish({ duration: 10 });
    await flush();
    expect(context.starts).toHaveLength(1);
    expect(player.getStatus()).toMatchObject({ state: "playing", scene: "daily" });
    player.pause();
  });

  test("off, outside and locked gesture never fetch; failure has an explicit retry", async () => {
    const context = fakeContext();
    let unlocked = false, available = false;
    const fetchAudio = jest.fn(async () => ({ ok: available, status: 404, arrayBuffer: async () => new ArrayBuffer(1) }));
    const player = new Player({ getContext: () => unlocked ? context : null, fetchAudio });
    player.setEnvironment({ ...environment, volume: 0 });
    player.setEnvironment({ volume: 35, atTable: false });
    player.setEnvironment({ atTable: true });
    expect(fetchAudio).not.toHaveBeenCalled();
    expect(player.getStatus().state).toBe("gesture");
    unlocked = true;
    player.unlock();
    await flush();
    expect(player.getStatus().state).toBe("failed");
    available = true;
    player.retry();
    await flush();
    expect(player.getStatus().state).toBe("playing");
    player.setEnvironment({ volume: 0 });
    expect(player.playing).toBeNull();
  });

  test("unsupported FLAC decoding falls back to the packaged MP3", async () => {
    const context = fakeContext();
    const fetchAudio = jest.fn(async (url) => ({ ok: true, arrayBuffer: async () => new Uint8Array([url.endsWith(".flac") ? 0 : 1]).buffer }));
    context.decodeAudioData = async (bytes) => {
      if (new Uint8Array(bytes)[0] === 0) throw new Error("Unsupported FLAC");
      return { duration: 152 };
    };
    const player = new Player({ getContext: () => context, fetchAudio });
    player.setEnvironment(environment);
    await flush();
    expect(player.getStatus().formats.daily).toBe("mp3");
    expect(player.getStatus().state).toBe("playing");
    player.pause();
  });

  test("compatibility decoding removes MP3 tail padding without changing musical tempo", async () => {
    const context = fakeContext();
    context.createBuffer = (channels, length, sampleRate) => ({ numberOfChannels: channels, length, sampleRate,
      duration: length / sampleRate, copyToChannel: jest.fn() });
    context.decodeAudioData = async (bytes) => {
      if (new Uint8Array(bytes)[0] === 0) throw new Error("Unsupported FLAC");
      return { duration: 620975 / 48000, length: 620975, sampleRate: 48000, numberOfChannels: 2,
        getChannelData: () => new Float32Array(620975) };
    };
    const player = new Player({ getContext: () => context,
      fetchAudio: async (url) => ({ ok: true, arrayBuffer: async () => new Uint8Array([url.endsWith(".flac") ? 0 : 1]).buffer }) });
    const result = await player.load("endgameOnce", context, new AbortController().signal);
    expect(result.buffer.length).toBe(620945);
    expect(result.buffer.duration).toBe(ONCE_SECONDS);
    expect(result.buffer.copyToChannel).toHaveBeenCalledTimes(2);
  });
});
