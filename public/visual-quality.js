(function initVisualQuality(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OverlimitVisualQuality = api;
  // Resolve before styles paint, using the same migration as the client.
  if (root?.document) {
    let stored;
    try { stored = JSON.parse(root.localStorage.getItem("abyss_ui_settings_v2") || "{}"); } catch (_error) {}
    root.document.documentElement.dataset.animation = api.resolveStoredQuality(
      stored, Boolean(root.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
    );
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildVisualQuality() {
  "use strict";

  function normalizeQuality(value) {
    return value === "low" ? "low" : "high";
  }

  // Legacy switches are read only during migration, never stored as new options.
  function resolveStoredQuality(stored, prefersReducedMotion = false) {
    const settings = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
    if (settings.reduceMotion === true || settings.lowPerformance === true || settings.animation === "medium") {
      return "low";
    }
    if (settings.animation === "high" || settings.animation === "low") return settings.animation;
    return prefersReducedMotion ? "low" : "high";
  }

  return Object.freeze({ normalizeQuality, resolveStoredQuality });
});
