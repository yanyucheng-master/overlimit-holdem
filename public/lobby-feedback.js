(function initLobbyFeedback(root) {
  "use strict";

  const doc = root.document;
  if (!doc) return;
  const modalIds = [
    "settings-modal", "rules-handbook-modal", "quickstart-modal", "quickstart-image-modal",
    "skill-preview-modal", "match-queue-modal", "match-continue-modal", "match-invite-modal", "join-password-modal", "nickname-modal", "lobby-join-modal",
  ];
  const scopes = ["screen-auth", "screen-skill-lab", "btn-settings", ...modalIds]
    .map((id) => doc.getElementById(id)).filter(Boolean);
  const targetSelector = "button:not(#rules-toc-backdrop), a[href], [data-lobby-mode-card], [data-quickstart-zoom], .allin-style-option";
  const timers = new Map();
  const pageAnimations = new Map();
  let active = null;
  let hovered = null;
  let cancelledClick = null;
  const isLow = () => doc.documentElement.dataset.animation === "low";

  function resolve(target) {
    const trigger = target?.closest?.(targetSelector);
    if (!trigger?.closest("[data-ui-scope]") || trigger.closest("[inert], .hidden")
      || trigger.matches(":disabled, [aria-disabled='true']")) return null;
    const surface = trigger.matches(".skill-card-select") ? trigger.closest(".skill-card") : trigger;
    return { trigger, surface };
  }

  function prepare(node) {
    if (node.nodeType !== 1) return;
    const candidates = [...node.querySelectorAll(targetSelector)];
    if (node.matches(targetSelector)) candidates.unshift(node);
    for (const trigger of candidates) {
      const surface = trigger.matches(".skill-card-select") ? trigger.closest(".skill-card") : trigger;
      if (!surface) continue;
      const kind = trigger.matches(".skill-card-select") ? "skill"
        : trigger.matches("[data-lobby-mode-card]") ? "card"
          : trigger.matches("[data-quickstart-zoom], .allin-style-option") ? "media" : "control";
      if (!surface.dataset.uiFeedback) {
        surface.dataset.uiFeedback = kind;
        if (getComputedStyle(surface).position === "static") surface.classList.add("ui-static-control");
      }
      if (kind !== "media" && !surface.querySelector(":scope > .ui-feedback-surface")) {
        const paint = doc.createElement("span");
        paint.className = "ui-feedback-surface";
        paint.setAttribute("aria-hidden", "true");
        surface.appendChild(paint);
      }
      // Keep native controls and existing child selectors intact. Only bare text
      // needs a paintable child; localization may replace it and is handled below.
      if (kind === "control") {
        for (const child of [...trigger.childNodes]) {
          if (child.nodeType !== 3 || !child.textContent.trim()) continue;
          const label = doc.createElement("span");
          label.className = "ui-feedback-label";
          child.replaceWith(label);
          label.appendChild(child);
        }
      }
    }
  }

  function clearPulse(surface) {
    clearTimeout(timers.get(surface));
    timers.delete(surface);
    surface.classList.remove("ui-releasing", "ui-confirming");
  }

  function pulse(surface, selected = false) {
    if (!surface?.isConnected || surface.closest(".hidden, [inert]")) return;
    clearTimeout(timers.get(surface));
    // A confirmed selection may arrive in the same frame as pointer release.
    // Keep its rebound playing while adding the confirmation light.
    surface.classList.remove("ui-confirming");
    if (!selected) surface.classList.remove("ui-releasing");
    void surface.offsetWidth;
    surface.classList.add(selected ? "ui-confirming" : "ui-releasing");
    timers.set(surface, setTimeout(() => clearPulse(surface), isLow() ? 80 : selected ? 220 : 180));
  }

  function cancel({ suppressClick = false } = {}) {
    if (!active) return;
    if (suppressClick && active.source === "pointer") {
      cancelledClick = { trigger: active.trigger, until: performance.now() + 800 };
    }
    active.surface.classList.remove("ui-pressed");
    active = null;
  }

  function reset() {
    cancel({ suppressClick: true });
    hovered = null;
    for (const surface of [...timers.keys()]) clearPulse(surface);
    scopes.forEach((scope) => {
      scope.classList.remove("ui-hover", "ui-pressed");
      scope.querySelectorAll(".ui-hover, .ui-pressed").forEach((node) => node.classList.remove("ui-hover", "ui-pressed"));
    });
  }

  function begin(hit, fields) {
    cancel();
    clearPulse(hit.surface);
    active = { ...hit, ...fields };
    active.surface.classList.add("ui-pressed");
  }

  doc.addEventListener("pointerdown", (event) => {
    cancelledClick = null;
    if (event.button !== 0 || event.isPrimary === false) return;
    const hit = resolve(event.target);
    if (hit) begin(hit, { source: "pointer", pointerId: event.pointerId, pointerType: event.pointerType, x: event.clientX, y: event.clientY });
  }, true);

  doc.addEventListener("pointermove", (event) => {
    if (active?.source !== "pointer" || event.pointerId !== active.pointerId) return;
    const bounds = active.trigger.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
    const dragging = active.pointerType !== "mouse" && Math.hypot(event.clientX - active.x, event.clientY - active.y) > 10;
    if (outside || dragging) cancel({ suppressClick: true });
  }, { capture: true, passive: true });

  doc.addEventListener("pointerup", (event) => {
    if (active?.source !== "pointer" || event.pointerId !== active.pointerId) return;
    const { surface } = active;
    cancel();
    pulse(surface);
  }, true);
  doc.addEventListener("pointercancel", () => cancel({ suppressClick: true }), true);
  doc.addEventListener("scroll", () => {
    if (active?.source === "pointer") cancel({ suppressClick: true });
  }, { capture: true, passive: true });

  doc.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch") return;
    const hit = resolve(event.target);
    if (hovered !== hit?.surface) hovered?.classList.remove("ui-hover");
    hovered = hit?.surface || null;
    hovered?.classList.add("ui-hover");
  }, true);
  doc.addEventListener("pointerout", (event) => {
    const hit = resolve(event.target);
    if (!hit || hit.trigger.contains(event.relatedTarget)) return;
    hit.surface.classList.remove("ui-hover");
    if (hovered === hit.surface) hovered = null;
    if (active?.trigger === hit.trigger) cancel({ suppressClick: true });
  }, true);

  doc.addEventListener("click", (event) => {
    if (cancelledClick && event.detail > 0 && performance.now() < cancelledClick.until
      && cancelledClick.trigger.contains(event.target)) {
      cancelledClick = null;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    // A label's synthesized input click must not replay feedback or its action.
    if (event.target.matches?.("input, select, textarea")) return;
    const hit = resolve(event.target);
    if (!hit) return;
    if (active?.trigger === hit.trigger) cancel();
    if (!hit.surface.classList.contains("ui-releasing")) pulse(hit.surface);
    // This acknowledges input only; selection confirmation is driven by actual
    // ARIA state changes, never by an optimistic network-success animation.
  }, true);

  doc.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key) || event.target.matches?.("input, select, textarea, [contenteditable]")) return;
    const hit = resolve(event.target);
    if (!hit) return;
    if (event.repeat) { event.preventDefault(); return; }
    begin(hit, { source: "keyboard", key: event.key });
  }, true);
  doc.addEventListener("keyup", (event) => {
    if (active?.source !== "keyboard" || active.key !== event.key) return;
    const { surface } = active;
    cancel();
    pulse(surface);
  }, true);
  doc.addEventListener("focusout", (event) => {
    if (active?.source === "keyboard" && !active.trigger.contains(event.relatedTarget)) cancel();
  }, true);
  root.addEventListener("blur", reset);
  doc.addEventListener("visibilitychange", () => { if (doc.hidden) reset(); });
  doc.addEventListener("dragstart", (event) => {
    if (event.target.matches?.("img") && event.target.closest("[data-ui-scope]")) event.preventDefault();
  }, true);

  scopes.forEach((scope) => {
    scope.dataset.uiScope = "";
    if (modalIds.includes(scope.id)) scope.dataset.uiModal = "";
    prepare(scope);
    const observer = new MutationObserver((records) => {
      const selections = new Map();
      for (const record of records) {
        if (record.type === "childList") {
          if (record.target.matches?.(targetSelector)) prepare(record.target);
          record.addedNodes.forEach(prepare);
        } else if (!selections.has(record.target)) {
          selections.set(record.target, record.oldValue);
        }
      }
      for (const [trigger, previous] of selections) {
        const selected = trigger.getAttribute("aria-checked") || trigger.getAttribute("aria-pressed") || trigger.getAttribute("aria-current");
        if (selected === previous || !["true", "page"].includes(selected)) continue;
        const hit = resolve(trigger);
        if (hit) pulse(hit.surface, true);
      }
    });
    observer.observe(scope, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-current", "aria-pressed", "aria-checked"], attributeOldValue: true });
  });

  new MutationObserver(() => {
    reset();
    for (const animation of pageAnimations.values()) animation.cancel();
    pageAnimations.clear();
  }).observe(doc.documentElement, { attributes: true, attributeFilter: ["data-animation"] });

  function enterScreen(target, previous) {
    reset();
    for (const animation of pageAnimations.values()) animation.cancel();
    pageAnimations.clear();
    if (!target?.matches("#screen-auth, #screen-skill-lab") || !previous?.matches("#screen-auth, #screen-skill-lab")) return;
    const direction = target.id === "screen-skill-lab" ? 1 : -1;
    const animation = target.animate([
      { opacity: 0, transform: isLow() ? "none" : `translateX(${direction * 10}px)` },
      { opacity: 1, transform: "none" },
    ], { duration: isLow() ? 80 : 220, easing: "cubic-bezier(.16,1,.3,1)" });
    pageAnimations.set(target, animation);
    animation.finished.then(() => pageAnimations.delete(target), () => {});
  }

  root.OverlimitUIFeedback = Object.freeze({ enterScreen, reset });
})(typeof globalThis !== "undefined" ? globalThis : this);
