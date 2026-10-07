(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.OverlimitTableMusic = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const PIECES = Object.freeze({
    lobby: "l1-before-the-deal-loop",
    daily: "b-velvet-gambit-loop",
    allin: "c2-no-way-back-loop",
    endgameOnce: "d5-final-writ-once",
    endgameLoop: "d5-final-writ-loop",
  });
  const ONCE_SECONDS = 12.936354166666666;
  const PIECE_SECONDS = Object.freeze({ lobby: 75.29327083333334, daily: 152.19464583333334, allin: 53.996291666666664,
    endgameOnce: ONCE_SECONDS, endgameLoop: 42.664625 });
  const MARKER = "overlimit_table_music_hand_v1";
  const LOBBY_CUE = Object.freeze({ scene: "lobby", key: "lobby", playOpening: false });
  const LOBBY_SCREENS = new Set(["auth", "wait", "skillLab"]);
  // Room creation, waiting and loadout configuration share one continuous cue.
  // Public hand events only select music while the table is actually visible.
  const cueForScreen = (screen, tableCue, { reconnectingTable = false } = {}) =>
    screen === "game" || (screen === "wait" && reconnectingTable) ? tableCue
      : LOBBY_SCREENS.has(screen) ? LOBBY_CUE : null;
  const own = (value, key) => Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
  const scope = (roomId, handId) => String(roomId || "") + ":" + String(handId || "");

  // Only public socket edges enter this director. It never reads the mutable UI
  // players/phase while the next hand's packets are still arriving.
  class Director {
    constructor({ onChange = () => {}, storage = null } = {}) {
      this.onChange = onChange;
      this.storage = storage;
      this.retired = new Set();
      this.reset();
    }

    reset() {
      this.roomId = "";
      this.handId = "";
      this.handNo = 0;
      this.liveHand = false;
      this.terminal = false;
      this.normalOnly = false;
      this.endgame = false;
      this.allin = false;
      this.opening = false;
      this.cue = null;
      this.publish();
    }

    restoreMarker() {
      try {
        const value = JSON.parse(this.storage?.getItem(MARKER) || "null");
        if (value?.scope === scope(this.roomId, this.handId)) {
          this.terminal = value.terminal === true;
          this.normalOnly = value.normalOnly === true;
          return value.openingConsumed === true;
        }
      } catch (_error) { /* Storage is optional. */ }
      return false;
    }

    persist() {
      if (!this.handId) return;
      try {
        this.storage?.setItem(MARKER, JSON.stringify({
          scope: scope(this.roomId, this.handId), terminal: this.terminal,
          normalOnly: this.normalOnly, openingConsumed: this.endgame || this.normalOnly || this.terminal,
        }));
      } catch (_error) { /* Music remains usable when storage is unavailable. */ }
    }

    beginHand(roomId, handId, { live = true, handNo = 0 } = {}) {
      if (!roomId || !handId) return false;
      const key = scope(roomId, handId);
      if (this.retired.has(key)) return false;
      if (key === scope(this.roomId, this.handId)) {
        this.handNo = Math.max(this.handNo, Number(handNo) || 0);
        return true;
      }
      if (this.handId) this.retired.add(scope(this.roomId, this.handId));
      if (this.retired.size > 16) this.retired.delete(this.retired.values().next().value);
      this.roomId = String(roomId);
      this.handId = String(handId);
      this.handNo = Number(handNo) || 0;
      this.liveHand = live;
      this.terminal = this.normalOnly = this.endgame = this.allin = this.opening = false;
      this.restoreMarker();
      this.publish();
      return true;
    }

    snapshot(payload, roomId) {
      if (!payload) return;
      const incomingRoom = payload.roomId || roomId;
      if (payload.handId) {
        if (incomingRoom === this.roomId && Number(payload.handNo) < this.handNo) return;
        if (!this.beginHand(incomingRoom, payload.handId, { live: false, handNo: payload.handNo })) return;
      } else if (!this.handId || incomingRoom !== this.roomId) return;
      // showdown is deliberately non-terminal: ENDGAME_EXECUTION can still be
      // holding settlement behind its public presentation barrier.
      if (["end", "game_over"].includes(payload.phase)) {
        this.finishHand(payload);
        return;
      }
      if (this.terminal) return;
      this.publicPlayers(payload.players);
      this.skillState(payload.skillState);
    }

    publicPlayers(players) {
      if (!this.handId || this.terminal || this.normalOnly || !Array.isArray(players)) return;
      if (players.some((player) => player.isAllIn === true)) this.allin = true;
      this.publish();
    }

    action(payload, { playerId, chipViewHidden } = {}) {
      if (!this.handId || this.terminal || this.normalOnly) return;
      const disclosed = !chipViewHidden || payload.forcePublicAllIn || payload.playerId === playerId;
      if (disclosed && (payload.forcePublicAllIn || payload.declaredAction === "allin" || payload.action === "allin")) {
        this.allin = true;
      }
      // This array has already been filtered for this viewer by the server.
      this.publicPlayers(payload.playerChips);
      this.publish();
    }

    skillState(value) {
      if (!this.handId || this.terminal || !own(value, "endgameActive")) return;
      if (value.endgameActive) this.activateEndgame();
      else if (this.endgame) {
        this.endgame = false;
        this.normalOnly = true;
        this.opening = false;
        this.persist();
        this.publish();
      }
    }

    resolved(payload) {
      if (payload?.skillId === "ENDGAME" && payload.publicData?.endgame === true) this.activateEndgame();
    }

    activateEndgame() {
      if (!this.handId || this.terminal || this.normalOnly || this.endgame) return;
      this.opening = this.liveHand && !this.restoreMarker();
      this.endgame = true;
      this.persist();
      this.publish();
    }

    finishHand(payload = {}) {
      if (payload.handId && payload.handId !== this.handId) return;
      if (Number(payload.handNo) > 0 && this.handNo > 0 && Number(payload.handNo) !== this.handNo) return;
      this.terminal = true;
      this.endgame = this.allin = this.opening = false;
      this.persist();
      this.publish();
    }

    publish() {
      const scene = this.endgame && !this.terminal && !this.normalOnly ? "endgame"
        : this.allin && !this.terminal && !this.normalOnly ? "allin" : "daily";
      const key = scene === "daily" ? "daily" : scene + ":" + scope(this.roomId, this.handId);
      if (this.cue?.key === key) return;
      this.cue = Object.freeze({ scene, key, playOpening: scene === "endgame" && this.opening });
      this.onChange(this.cue);
    }
  }

  class Player {
    constructor({ getContext, fetchAudio = (...args) => fetch(...args), onStatus = () => {}, baseUrl = "./assets/audio/" } = {}) {
      this.getContext = getContext;
      this.fetchAudio = fetchAudio;
      this.onStatus = onStatus;
      this.baseUrl = baseUrl;
      this.environment = { atTable: false, atLobby: false, visible: true, connected: false, volume: 0 };
      this.cue = { scene: "daily", key: "daily", playOpening: false };
      this.cache = new Map();
      this.encoded = new Map();
      this.revision = 0;
      this.position = 0;
      this.ambientPositions = { daily: 0, lobby: 0 };
      this.playing = null;
      this.pending = false;
      this.failure = false;
      this.status = { state: "outside", scene: "daily" };
    }

    getStatus() {
      return { ...this.status, key: this.cue.key, position: this.currentPosition(),
        phase: this.cue.scene === "endgame" && this.currentPosition() < ONCE_SECONDS ? "openingAndEntry" : "loop",
        decodedPieces: [...this.cache.keys()], formats: this.playing?.formats || {} };
    }

    report(state) {
      this.status = { state, scene: this.cue.scene };
      this.onStatus(this.getStatus());
    }

    currentPosition() {
      return this.playing
        ? this.position + Math.max(0, this.playing.context.currentTime - this.playing.startedAt)
        : this.position;
    }

    setScene(cue) {
      if (!cue || cue.key === this.cue.key) return;
      this.pause();
      if (own(this.ambientPositions, this.cue.scene)) this.ambientPositions[this.cue.scene] = this.position;
      this.cue = cue;
      this.position = own(this.ambientPositions, cue.scene) ? this.ambientPositions[cue.scene]
        : cue.scene === "endgame" && !cue.playOpening ? ONCE_SECONDS : 0;
      this.failure = false;
      this.reconcile();
    }

    setEnvironment(next, cue = this.cue) {
      Object.assign(this.environment, next);
      this.environment.volume = Math.max(0, Math.min(100, Number(this.environment.volume) || 0));
      // Apply screen availability and its cue together; a new cue must never
      // start with the previous screen's connection/snapshot permissions.
      if (cue && cue.key !== this.cue.key) { this.setScene(cue); return; }
      this.reconcile();
    }

    unlock() { this.reconcile(); }
    retry() { this.failure = false; this.reconcile(); }

    blockedState() {
      const value = this.environment;
      if (value.volume <= 0) return "off";
      if (!value.atTable && !value.atLobby) return "outside";
      if (!value.visible || (value.atTable && !value.connected)) return "paused";
      return null;
    }

    reconcile() {
      const blocked = this.blockedState();
      if (blocked) { this.pause(); this.report(blocked); return; }
      if (this.playing) {
        this.playing.gain.gain.setTargetAtTime(this.environment.volume / 100, this.playing.context.currentTime, 0.04);
        return;
      }
      if (this.failure) { this.report("failed"); return; }
      if (this.pending) return;
      let context;
      try { context = this.getContext?.(); } catch (_error) { this.report("unsupported"); return; }
      if (!context) { this.report("gesture"); return; }
      if (context.state === "closed") { this.report("unsupported"); return; }
      if (this.context !== context) {
        this.context = context;
        context.addEventListener?.("statechange", () => {
          if (context.state !== "running") {
            this.pause(); this.report("paused");
          } else this.reconcile();
        });
      }
      const revision = ++this.revision;
      const controller = new AbortController();
      this.controller = controller;
      this.pending = true;
      this.report("loading");
      this.start(context, revision, controller.signal).catch((error) => {
        if (revision !== this.revision || error.name === "AbortError") return;
        this.pending = false;
        this.failure = true;
        this.report("failed");
      });
    }

    async load(piece, context, signal) {
      if (this.cache.has(piece)) return this.cache.get(piece);
      let lastError;
      for (const format of ["flac", "mp3"]) {
        try {
          let bytes = format === "flac" ? this.encoded.get(piece) : null;
          if (!bytes) {
            const response = await this.fetchAudio(this.baseUrl + PIECES[piece] + "." + format, { signal });
            if (!response.ok) throw new Error("Audio HTTP " + response.status);
            bytes = await response.arrayBuffer();
          }
          let buffer = await context.decodeAudioData(bytes.slice(0));
          if (signal.aborted) throw Object.assign(new Error("Superseded"), { name: "AbortError" });
          // Chromium leaves 30 extra frames at the end of this short MP3 even
          // with a gapless header. Remove codec tail padding by master duration;
          // never stretch the music. FLAC uses the approved sample count directly.
          const frames = Math.round(PIECE_SECONDS[piece] * buffer.sampleRate);
          if (format === "mp3" && buffer.length > frames && buffer.length - frames < buffer.sampleRate * 0.05) {
            const trimmed = context.createBuffer(buffer.numberOfChannels, frames, buffer.sampleRate);
            for (let c = 0; c < buffer.numberOfChannels; c++) {
              trimmed.copyToChannel(buffer.getChannelData(c).subarray(0, frames), c);
            }
            buffer = trimmed;
          }
          const result = { buffer, format };
          this.cache.set(piece, result);
          return result;
        } catch (error) {
          if (signal.aborted || error.name === "AbortError") throw error;
          lastError = error;
        }
      }
      throw lastError;
    }

    async start(context, revision, signal) {
      if (context.state !== "running") await context.resume();
      if (revision !== this.revision || this.blockedState()) return;
      const keys = this.cue.scene === "endgame" ? ["endgameOnce", "endgameLoop"] : [this.cue.scene];
      const loaded = await Promise.all(keys.map((key) => this.load(key, context, signal)));
      if (revision !== this.revision || this.blockedState()) return;
      const gain = context.createGain();
      const at = context.currentTime + 0.03;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(this.environment.volume / 100, at + 0.12);
      gain.connect(context.destination);
      const nodes = [];
      const make = (buffer, loop, when, offset) => {
        const node = context.createBufferSource();
        node.buffer = buffer;
        node.loop = loop;
        node.connect(gain);
        node.start(when, offset);
        nodes.push(node);
        return node;
      };
      if (this.cue.scene === "endgame") {
        const once = loaded[0].buffer, loop = loaded[1].buffer;
        if (this.position < ONCE_SECONDS) {
          const offset = Math.min(this.position, once.duration);
          const opening = make(once, false, at, offset);
          // Schedule both buffers before playback starts: no JS callback,
          // crossfade or gain envelope interrupts the source-contiguous entry.
          make(loop, true, at + once.duration - offset, 0);
          opening.onended = () => {
            opening.disconnect();
            if (this.playing?.revision === revision) this.report("playing");
          };
        } else make(loop, true, at, (this.position - ONCE_SECONDS) % loop.duration);
      } else make(loaded[0].buffer, true, at, this.position % loaded[0].buffer.duration);
      this.playing = { context, gain, nodes, startedAt: at, revision,
        formats: Object.fromEntries(keys.map((key, i) => [key, loaded[i].format])) };
      this.pending = false;
      this.report("playing");
      while (this.cache.size > 4) {
        const unused = [...this.cache.keys()].find((key) => !["daily", "lobby"].includes(key) && !keys.includes(key));
        if (!unused) break;
        this.cache.delete(unused);
      }
      if (this.cue.scene === "daily") this.warm();
    }

    warm() {
      this.warmController?.abort();
      const controller = new AbortController();
      this.warmController = controller;
      // Fetch compact encoded cues while B plays; decode only the chosen cue.
      // Turning music off/backgrounding aborts these requests as well.
      for (const piece of ["allin", "endgameOnce", "endgameLoop"]) {
        if (this.encoded.has(piece) || this.cache.has(piece)) continue;
        this.fetchAudio(this.baseUrl + PIECES[piece] + ".flac", { signal: controller.signal })
          .then((response) => { if (!response.ok) throw new Error("Prefetch failed"); return response.arrayBuffer(); })
          .then((bytes) => { if (!controller.signal.aborted) this.encoded.set(piece, bytes); })
          .catch(() => {}); // Active loading provides the visible error/retry path.
      }
    }

    pause() {
      ++this.revision;
      this.controller?.abort();
      this.warmController?.abort();
      this.pending = false;
      if (!this.playing) return;
      this.position = this.currentPosition();
      const { context, gain, nodes } = this.playing;
      this.playing = null;
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.025);
      for (const node of nodes) {
        node.onended = null;
        try { node.stop(now + 0.03); } catch (_error) { /* Already ended. */ }
      }
      setTimeout(() => {
        nodes.forEach((node) => node.disconnect());
        gain.disconnect();
      }, 40);
    }
  }

  return { Director, Player, PIECES, ONCE_SECONDS, LOBBY_CUE, cueForScreen };
});
