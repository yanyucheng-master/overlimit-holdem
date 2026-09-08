const PRESENTATION_KIND = Object.freeze({
  ENDGAME_DECLARE: "ENDGAME_DECLARE",
  ENDGAME_EXECUTION: "ENDGAME_EXECUTION",
  DEAD_END_COMMIT: "DEAD_END_COMMIT",
});

const PRESENTATION_DURATION_MS = Object.freeze({
  [PRESENTATION_KIND.ENDGAME_DECLARE]: 2600,
  [PRESENTATION_KIND.ENDGAME_EXECUTION]: 2800,
  [PRESENTATION_KIND.DEAD_END_COMMIT]: 2300,
});

const MAX_PRESENTATION_WINDOW_MS = 6000;

function presentationDuration(kind) {
  const value = Number(PRESENTATION_DURATION_MS[kind]) || 0;
  return Math.max(0, Math.min(MAX_PRESENTATION_WINDOW_MS, value));
}

function toPublicPresentationBarrier(barrier) {
  if (!barrier || typeof barrier !== "object") return null;
  const startedAt = Number(barrier.startedAt);
  const until = Number(barrier.until);
  if (!barrier.id || !PRESENTATION_DURATION_MS[barrier.kind]) return null;
  if (!Number.isFinite(startedAt) || !Number.isFinite(until) || until < startedAt) return null;
  return {
    id: String(barrier.id),
    kind: barrier.kind,
    handNo: Math.max(0, Number(barrier.handNo) || 0),
    startedAt,
    until,
    durationMs: Math.max(0, until - startedAt),
    serverNow: Date.now(),
  };
}

module.exports = {
  PRESENTATION_KIND,
  PRESENTATION_DURATION_MS,
  MAX_PRESENTATION_WINDOW_MS,
  presentationDuration,
  toPublicPresentationBarrier,
};
