import { chromium } from "playwright";
import playwrightRuntime from "./playwright-runtime.js";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3002";
const LOADOUT = ["DEEP_BREATH", "RECYCLE", "BLOOD_BATTLE", "PROBE"];

async function visible(page, selector) {
  return page.locator(selector).isVisible().catch(() => false);
}

async function skillGeometry(page) {
  return page.evaluate(() => {
    const bar = document.getElementById("skill-bar");
    const slots = [...document.querySelectorAll("#skill-bar .skill-slot")];
    if (!bar) return { count: 0, allInside: false, overflows: true, rects: [] };
    const bounds = bar.getBoundingClientRect();
    const rects = slots.map((slot) => {
      const rect = slot.getBoundingClientRect();
      return {
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        top: Math.round(rect.top * 10) / 10,
        bottom: Math.round(rect.bottom * 10) / 10,
      };
    });
    return {
      count: slots.length,
      allInside: rects.every(
        (rect) =>
          rect.left >= bounds.left - 1 &&
          rect.right <= bounds.right + 1 &&
          rect.top >= bounds.top - 1 &&
          rect.bottom <= bounds.bottom + 1
      ),
      overflows: bar.scrollWidth > bar.clientWidth + 1,
      columns: new Set(rects.map((rect) => rect.left)).size,
      rows: new Set(rects.map((rect) => rect.top)).size,
      rects,
    };
  });
}

async function phoneTableLayout(page) {
  return page.evaluate(() => {
    const dock = document.querySelector(".action-dock")?.getBoundingClientRect();
    const board = document.getElementById("board")?.getBoundingClientRect();
    const opponent = document.getElementById("opponent-area")?.getBoundingClientRect();
    const center = document.getElementById("table-center")?.getBoundingClientRect();
    const self = document.getElementById("self-area")?.getBoundingClientRect();
    const ownSkills = document.getElementById("own-skill-arsenal")?.getBoundingClientRect();
    const opponentSummary = document.getElementById("btn-toggle-opponent-intel")?.getBoundingClientRect();
    const clock = document.getElementById("action-countdown")?.getBoundingClientRect();
    const pot = document.getElementById("pot-core")?.getBoundingClientRect();
    const community = [...document.querySelectorAll("#community-cards .card")].map((card) =>
      card.getBoundingClientRect()
    );
    const opponentCards = [...document.querySelectorAll("#opponent-cards .card")].map((card) =>
      card.getBoundingClientRect()
    );
    const selfCards = [...document.querySelectorAll("#self-cards .card")].map((card) =>
      card.getBoundingClientRect()
    );
    const cardWidths = [...community, ...opponentCards, ...selfCards]
      .map((card) => card.width)
      .filter((width) => width > 0);
    const cardSizeDelta = cardWidths.length
      ? (Math.max(...cardWidths) - Math.min(...cardWidths)) / Math.max(...cardWidths)
      : 1;
    const dockNode = document.querySelector(".action-dock");
    const overlaps = (left, right) =>
      Boolean(
        left &&
        right &&
        left.right > right.left &&
        left.left < right.right &&
        left.bottom > right.top &&
        left.top < right.bottom
      );
    return {
      scrolls:
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 ||
        document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
      dockInside: Boolean(
        dock &&
        dock.left >= -1 &&
        dock.right <= innerWidth + 1 &&
        dock.top >= -1 &&
        dock.bottom <= innerHeight + 1
      ),
      boardDockOverlap: Boolean(board && dock && board.bottom > dock.top + 1),
      selfInsideBoard: Boolean(
        board &&
        self &&
        self.left >= board.left - 1 &&
        self.right <= board.right + 1 &&
        self.top >= board.top - 1 &&
          self.bottom <= board.bottom + 1
      ),
      ownSkillsInsideBoard: Boolean(
        board &&
        ownSkills &&
        ownSkills.left >= board.left - 1 &&
        ownSkills.right <= board.right + 1 &&
        ownSkills.top >= board.top - 1 &&
        ownSkills.bottom <= board.bottom + 1
      ),
      opponentSummaryInsideBoard: Boolean(
        board &&
        opponentSummary &&
        opponentSummary.left >= board.left - 1 &&
        opponentSummary.right <= board.right + 1 &&
        opponentSummary.top >= board.top - 1 &&
        opponentSummary.bottom <= board.bottom + 1
      ),
      visualOrder: Boolean(
        opponent &&
        center &&
        self &&
        ownSkills &&
        opponent.top <= center.top + 1 &&
        center.top <= self.top + 1 &&
        self.top <= ownSkills.top + 1
      ),
      actionSingleLayer: Boolean(
        dockNode &&
        dockNode.children.length === 1 &&
        dockNode.firstElementChild?.classList.contains("poker-actions-layer")
      ),
      cardSizeDelta,
      communityInsideBoard: Boolean(
        board &&
        community.length === 5 &&
        community.every(
          (card) =>
            card.left >= board.left - 1 &&
            card.right <= board.right + 1 &&
            card.top >= board.top - 1 &&
            card.bottom <= board.bottom + 1
        )
      ),
      communityInsideViewport:
        community.length === 5 &&
        community.every(
          (card) =>
            card.left >= -1 &&
            card.right <= innerWidth + 1 &&
            card.top >= -1 &&
            card.bottom <= innerHeight + 1
        ),
      communityClearOfClock: community.length === 5 && community.every((card) => !overlaps(card, clock)),
      communityClearOfPot: community.length === 5 && community.every((card) => !overlaps(card, pot)),
    };
  });
}

async function skillCountLayoutAudit(page, viewport) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(120);
  return page.evaluate(() => {
    const bar = document.getElementById("skill-bar");
    const slots = [...document.querySelectorAll("#skill-bar .skill-slot")];
    if (!bar || slots.length < 4) return { available: false, cases: [] };
    const originalCount = bar.dataset.count || String(slots.length);
    const originalDisplay = slots.map((slot) => slot.style.display);
    const cases = [];
    for (let count = 1; count <= 4; count += 1) {
      bar.dataset.count = String(count);
      slots.forEach((slot, index) => {
        slot.style.display = index < count ? "" : "none";
      });
      void bar.offsetWidth;
      const bounds = bar.getBoundingClientRect();
      const rects = slots.slice(0, count).map((slot) => slot.getBoundingClientRect());
      const columns = new Set(rects.map((rect) => Math.round(rect.left))).size;
      const rows = new Set(rects.map((rect) => Math.round(rect.top))).size;
      cases.push({
        count,
        columns,
        rows,
        allInside: rects.every((rect) => (
          rect.left >= bounds.left - 1 &&
          rect.right <= bounds.right + 1 &&
          rect.top >= bounds.top - 1 &&
          rect.bottom <= bounds.bottom + 1
        )),
        overflows: bar.scrollWidth > bar.clientWidth + 1,
      });
    }
    slots.forEach((slot, index) => {
      slot.style.display = originalDisplay[index];
    });
    bar.dataset.count = originalCount;
    return { available: true, cases };
  });
}

async function mobileDrawerAudit(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(120);
  await page.click("#btn-toggle-opponent-intel");
  await page.waitForFunction(() => document.getElementById("opponent-skill-field")?.classList.contains("is-mobile-open"));
  await page.waitForTimeout(220);
  const intelOpen = await page.evaluate(() => {
    const drawer = document.getElementById("opponent-skill-field");
    const bounds = drawer?.getBoundingClientRect();
    return {
      visible: Boolean(bounds && bounds.width > 1 && bounds.height > 1 && bounds.left >= -1 && bounds.right <= innerWidth + 1),
      ariaHidden: drawer?.getAttribute("aria-hidden"),
      inert: Boolean(drawer?.inert),
      expanded: document.getElementById("btn-toggle-opponent-intel")?.getAttribute("aria-expanded"),
    };
  });
  await page.click("#btn-close-opponent-intel");
  await page.waitForFunction(() => !document.getElementById("opponent-skill-field")?.classList.contains("is-mobile-open"));
  const intelClosed = await page.evaluate(() => ({
    ariaHidden: document.getElementById("opponent-skill-field")?.getAttribute("aria-hidden"),
    inert: Boolean(document.getElementById("opponent-skill-field")?.inert),
    focusReturned: document.activeElement === document.getElementById("btn-toggle-opponent-intel"),
  }));

  await page.click("#btn-toggle-skill-feed");
  await page.waitForFunction(() => document.getElementById("table-telemetry")?.classList.contains("is-feed-open"));
  await page.waitForTimeout(220);
  const feedOpen = await page.evaluate(() => {
    const drawer = document.getElementById("table-telemetry");
    const feed = document.getElementById("skill-broadcast");
    const bounds = drawer?.getBoundingClientRect();
    return {
      visible: Boolean(bounds && bounds.width > 1 && bounds.height > 1 && bounds.left >= -1 && bounds.right <= innerWidth + 1),
      ariaHidden: feed?.getAttribute("aria-hidden"),
      inert: Boolean(feed?.inert),
      expanded: document.getElementById("btn-toggle-skill-feed")?.getAttribute("aria-expanded"),
    };
  });
  await page.click("#btn-close-skill-feed");
  await page.waitForFunction(() => !document.getElementById("table-telemetry")?.classList.contains("is-feed-open"));
  const feedClosed = await page.evaluate(() => ({
    ariaHidden: document.getElementById("skill-broadcast")?.getAttribute("aria-hidden"),
    inert: Boolean(document.getElementById("skill-broadcast")?.inert),
  }));
  return { intelOpen, intelClosed, feedOpen, feedClosed };
}

async function raisePopoverAudit(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(120);
  const button = page.locator("#btn-raise-options");
  if (!(await button.count()) || await button.isDisabled()) return { available: false };
  const geometry = () => page.evaluate(() => {
    const read = (selector) => {
      const bounds = document.querySelector(selector)?.getBoundingClientRect();
      return bounds ? {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        left: bounds.left,
      } : null;
    };
    return {
      board: read("#board"),
      dock: read("#screen-game .action-dock"),
      self: read("#self-area"),
      actions: read("#screen-game .poker-actions-layer"),
      panel: read("#raise-panel"),
      expanded: document.getElementById("btn-raise-options")?.getAttribute("aria-expanded"),
      panelDisplay: getComputedStyle(document.getElementById("raise-panel")).display,
    };
  });
  const before = await geometry();
  await button.click();
  await page.waitForTimeout(80);
  const opened = await geometry();
  await button.click();
  await page.waitForTimeout(80);
  const closed = await geometry();
  const stable = (first, next) => ["board", "dock", "self", "actions"].every((key) => {
    if (!first[key] || !next[key]) return false;
    return ["x", "y", "width", "height"].every((metric) => Math.abs(first[key][metric] - next[key][metric]) <= 1);
  });
  return {
    available: true,
    opened: opened.expanded === "true" && opened.panelDisplay !== "none",
    closed: closed.expanded === "false",
    stableWhileOpen: stable(before, opened),
    stableAfterClose: stable(before, closed),
    panelAboveDock: Boolean(opened.panel && opened.dock && opened.panel.bottom <= opened.dock.top + 1),
    panelInsideViewport: Boolean(opened.panel && opened.panel.left >= -1 && opened.panel.right <= 1441 && opened.panel.top >= -1),
  };
}

async function competitiveTableAudit(page, viewport) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(240);
  const audit = await page.evaluate(({ width, height }) => {
    const byId = (id) => document.getElementById(id);
    const rect = (node) => node?.getBoundingClientRect();
    const visible = (node) => {
      if (!node) return false;
      const style = getComputedStyle(node);
      const bounds = rect(node);
      return Boolean(
        bounds &&
        bounds.width > 1 &&
        bounds.height > 1 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number.parseFloat(style.opacity || "1") > 0.01 &&
        bounds.right > 0 &&
        bounds.left < innerWidth &&
        bounds.bottom > 0 &&
        bounds.top < innerHeight
      );
    };
    const hidden = (node) => !visible(node);
    const close = (left, right, tolerance = 1) => Math.abs(left - right) <= tolerance;
    const topbar = document.querySelector("#screen-game .game-topbar");
    const toolsLeft = document.querySelector("#screen-game .table-tools-left");
    const backButton = byId("btn-back-game");
    const historyButton = byId("btn-hand-history");
    const backLabel = backButton?.querySelector(".game-exit-label");
    const historyLabel = historyButton?.querySelector(".history-label");
    const historyIcon = historyButton?.querySelector(".history-restore-icon");
    const backRect = rect(backButton);
    const historyRect = rect(historyButton);
    const backLabelRect = rect(backLabel);
    const historyLabelRect = rect(historyLabel);
    const historyIconRect = rect(historyIcon);
    const toolsStyle = toolsLeft ? getComputedStyle(toolsLeft) : null;
    const backStyle = backButton ? getComputedStyle(backButton) : null;
    const historyStyle = historyButton ? getComputedStyle(historyButton) : null;
    const historyCount = historyButton?.dataset.count || "";
    const historyCountContent = historyButton ? getComputedStyle(historyButton, "::after").content : "none";
    const paddingKey = (style) => style
      ? [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].join("|")
      : "";
    const runtime = document.querySelector("#screen-game .table-runtime-data");
    const connection = byId("game-connection");
    const ownRail = byId("own-skill-arsenal");
    const intelDrawer = byId("opponent-skill-field");
    const rightRail = byId("table-telemetry");
    const skillBroadcast = byId("skill-broadcast");
    const tableCenter = byId("table-center");
    const clock = rect(byId("action-countdown"));
    const communityCards = [...document.querySelectorAll("#community-cards .card")].map(rect);
    const opponentCards = [...document.querySelectorAll("#opponent-cards .card")].map(rect);
    const selfCards = [...document.querySelectorAll("#self-cards .card")].map(rect);
    const skillSlots = [...document.querySelectorAll("#skill-bar .skill-slot")].map(rect);
    const pokerLayer = rect(document.querySelector("#screen-game .poker-actions-layer"));
    const skillHud = rect(byId("skill-hud"));
    const turnStatus = rect(document.querySelector("#screen-game .turn-status"));
    const deckAnchor = rect(byId("deck-fx-anchor"));
    const stageAnchor = rect(byId("skill-fx-stage-anchor"));
    const compact = matchMedia("(max-width: 760px), (max-height: 560px)").matches;
    const telemetryVisibleChildren = [...(rightRail?.children || [])]
      .filter(visible)
      .map((node) => node.id || node.className);
    const topbarText = topbar?.innerText.replace(/\s+/g, " ").trim() || "";
    const board = rect(byId("board"));
    const dock = rect(document.querySelector("#screen-game .action-dock"));
    const ownRect = rect(ownRail);
    const intelRect = rect(intelDrawer);
    const rightRect = rect(rightRail);
    const opponentSummary = byId("btn-toggle-opponent-intel");
    const opponentSummaryText = byId("opponent-intel-count")?.textContent.trim() || "";
    const opponentSummarySlots = [...(byId("opponent-intel-slots")?.children || [])];
    const actionDock = document.querySelector("#screen-game .action-dock");
    const cardWidths = [...communityCards, ...opponentCards, ...selfCards]
      .map((card) => card?.width || 0)
      .filter((widthValue) => widthValue > 0);
    const cardSizeDelta = cardWidths.length
      ? (Math.max(...cardWidths) - Math.min(...cardWidths)) / Math.max(...cardWidths)
      : 1;
    const skillColumns = new Set(skillSlots.map((slot) => Math.round(slot?.left || 0))).size;
    const skillRows = new Set(skillSlots.map((slot) => Math.round(slot?.top || 0))).size;
    const selfMinimal = {
      avatarHidden: hidden(byId("self-avatar")),
      connectionHidden: hidden(byId("self-connection")),
      betHidden: hidden(byId("self-bet")?.closest(".player-bet-metric")),
      stateHidden: hidden(byId("self-state")),
      cardsVisible: visible(byId("self-cards")),
      nameVisible: visible(byId("self-name")),
      chipsVisible: visible(byId("self-chips")),
      handVisible: visible(byId("self-hand-type")),
    };

    return {
      requested: { width, height },
      actual: { width: innerWidth, height: innerHeight },
      contracts: {
        "TABLE-CLEAN-01": Boolean(
          hidden(runtime) &&
          !/标准局|高爆局|跟注\s*\d|牌堆|HAND|待锁/.test(topbarText) &&
          connection?.textContent.trim() === "" &&
          visible(byId("btn-back-game")) &&
          visible(byId("btn-hand-history"))
        ),
        "TABLE-CLEAN-02": compact
          ? Boolean(
              visible(ownRail) &&
              hidden(intelDrawer) &&
              hidden(rightRail) &&
              intelDrawer?.getAttribute("aria-hidden") === "true"
            )
          : Boolean(
              visible(ownRail) &&
              hidden(intelDrawer) &&
              visible(rightRail) &&
              byId("skill-broadcast-title")?.textContent.trim() === "战术播报" &&
              telemetryVisibleChildren.length === 1 &&
              telemetryVisibleChildren[0] === "skill-broadcast" &&
              intelDrawer?.getAttribute("aria-hidden") === "true"
            ),
        "TABLE-CLEAN-03": Boolean(
          byId("pot-core")?.closest("#table-center") === tableCenter &&
          byId("phase-text")?.closest("#table-center") === tableCenter &&
          byId("action-log")?.classList.contains("sr-only") &&
          getComputedStyle(byId("deck-stack")).visibility === "hidden"
        ),
        "TABLE-CLEAN-04": Boolean(
          clock &&
          communityCards.length === 5 &&
          clock.right <= Math.min(...communityCards.map((card) => card.left)) + 1
        ),
        "TABLE-CLEAN-05": Object.values(selfMinimal).every(Boolean),
        "TABLE-CLEAN-06": Boolean(
          visible(byId("opponent-name")) &&
          visible(byId("opponent-chips")) &&
          visible(byId("opponent-bet")) &&
          visible(byId("opponent-cards"))
        ),
        "TABLE-CLEAN-07": Boolean(
          pokerLayer &&
          skillHud &&
          turnStatus &&
          byId("skill-hud")?.closest("#own-skill-arsenal") === ownRail &&
          document.querySelector("#screen-game .turn-status")?.closest("#table-center") === tableCenter &&
          actionDock?.children.length === 1 &&
          actionDock?.firstElementChild?.classList.contains("poker-actions-layer") &&
          skillHud.bottom <= board.bottom + 1 &&
          pokerLayer.top >= board.bottom - 1
        ),
        "TABLE-CLEAN-08": compact && width <= 760
          ? Boolean(skillSlots.length === 4 && skillColumns === 2 && skillRows === 2)
          : Boolean(skillSlots.length === 4 && skillColumns === 1 && skillRows === 4),
        "TABLE-CLEAN-09": Boolean(
          deckAnchor?.width > 20 &&
          deckAnchor?.height > 20 &&
          stageAnchor?.width > 20 &&
          stageAnchor?.height > 20
        ),
        "TABLE-CLEAN-10": Boolean(
          board &&
          dock &&
          board.bottom <= dock.top + 1 &&
          document.documentElement.scrollWidth <= innerWidth + 1 &&
          document.documentElement.scrollHeight <= innerHeight + 1
        ),
        "TABLE-CLEAN-11": compact
          ? Boolean(
              visible(opponentSummary) &&
              visible(byId("btn-toggle-skill-feed")) &&
              intelDrawer?.getAttribute("aria-hidden") === "true" &&
              skillBroadcast?.getAttribute("aria-hidden") === "true"
            )
          : Boolean(
              visible(opponentSummary) &&
              hidden(byId("btn-toggle-skill-feed"))
            ),
        "TABLE-CLEAN-12": compact
          ? true
          : Boolean(
              ownRect?.width >= 213 &&
              ownRect?.width <= 245 &&
              rightRect?.width >= 183 &&
              rightRect?.width <= 215 &&
              intelRect?.right <= board.left + 1
            ),
        "TABLE-CLEAN-13": Boolean(
          communityCards.length === 5 &&
          opponentCards.length === 2 &&
          selfCards.length === 2 &&
          cardSizeDelta <= 0.1
        ),
        "TABLE-CLEAN-14": Boolean(
          visible(opponentSummary) &&
          opponentSummarySlots.length === 4 &&
          !/\d+\s*\/\s*4/.test(opponentSummaryText) &&
          !/负载/.test(opponentSummaryText)
        ),
        "TABLE-TOOLS-01": Boolean(
          toolsStyle?.display === "flex" &&
          toolsStyle?.flexDirection === "row" &&
          toolsStyle?.alignItems === "center" &&
          backStyle?.display === "flex" &&
          backStyle?.flexDirection === "row" &&
          historyStyle?.display === "flex" &&
          historyStyle?.flexDirection === "row" &&
          backRect &&
          historyRect &&
          close(backRect.height, historyRect.height, 0.5) &&
          close(backRect.top, historyRect.top, 0.5) &&
          close(backRect.top + backRect.height / 2, historyRect.top + historyRect.height / 2, 0.5) &&
          paddingKey(backStyle) === paddingKey(historyStyle) &&
          backStyle.lineHeight === historyStyle.lineHeight &&
          (!visible(backLabel) || Boolean(
            backLabelRect &&
            historyLabelRect &&
            close(backLabelRect.top, historyLabelRect.top, 0.5) &&
            close(backLabelRect.bottom, historyLabelRect.bottom, 0.5)
          )) &&
          historyIconRect?.width >= 15 &&
          historyIconRect?.width <= 17 &&
          historyIconRect?.height >= 15 &&
          historyIconRect?.height <= 17
        ),
        "TABLE-TOOLS-02": Boolean(
          historyLabel?.textContent.trim() === "历史" &&
          (!historyCount || Boolean(
            /^\d+$/.test(historyCount) &&
            Number(historyCount) > 0 &&
            historyCountContent.includes(historyCount) &&
            historyButton?.getAttribute("aria-label")?.includes(historyCount)
          ))
        ),
      },
      selfMinimal,
    };
  }, viewport);

  const readToolGeometry = () => page.evaluate(() => {
    const read = (id) => {
      const button = document.getElementById(id);
      const bounds = button?.getBoundingClientRect();
      return bounds ? {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        count: button.dataset.count || "",
        focused: document.activeElement === button,
        focusVisible: button.matches(":focus-visible"),
      } : null;
    };
    return {
      back: read("btn-back-game"),
      history: read("btn-hand-history"),
    };
  });
  const geometryStable = (before, after) => {
    const close = (left, right) => Math.abs(left - right) <= 0.5;
    return ["back", "history"].every((key) => {
      const first = before[key];
      const next = after[key];
      if (!first || !next) return false;
      return close(first.x, next.x) &&
        close(first.y, next.y) &&
        close(first.height, next.height) &&
        (first.count !== next.count || close(first.width, next.width));
    });
  };

  const initialTools = await readToolGeometry();
  await page.hover("#btn-back-game");
  await page.waitForTimeout(60);
  const backHoverTools = await readToolGeometry();
  await page.hover("#btn-hand-history");
  await page.waitForTimeout(60);
  const historyHoverTools = await readToolGeometry();
  await page.focus("#btn-back-game");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(60);
  const historyFocusTools = await readToolGeometry();
  await page.keyboard.press("Shift+Tab");
  await page.waitForTimeout(60);
  const backFocusTools = await readToolGeometry();
  audit.toolInteraction = {
    initial: initialTools,
    backHover: backHoverTools,
    historyHover: historyHoverTools,
    backFocus: backFocusTools,
    historyFocus: historyFocusTools,
  };
  audit.contracts["TABLE-TOOLS-03"] = [
    backHoverTools,
    historyHoverTools,
    backFocusTools,
    historyFocusTools,
  ].every((geometry) => geometryStable(initialTools, geometry)) &&
    backFocusTools.back?.focused === true &&
    backFocusTools.back?.focusVisible === true &&
    historyFocusTools.history?.focused === true &&
    historyFocusTools.history?.focusVisible === true;
  return audit;
}

async function buttonHitAudit(page, scopeSelector) {
  return page.evaluate((scopeSelector) => {
    const scope = document.querySelector(scopeSelector) || document;
    const failures = [];
    let checked = 0;
    const clipsAxis = (value) => /^(?:auto|scroll|hidden|clip|overlay)$/.test(value);
    [...scope.querySelectorAll("button")].forEach((button) => {
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      if (
        button.disabled ||
        style.display === "none" ||
        style.visibility === "hidden" ||
        rect.width < 1 ||
        rect.height < 1 ||
        rect.bottom <= 0 ||
        rect.top >= innerHeight ||
        rect.right <= 0 ||
        rect.left >= innerWidth
      ) {
        return;
      }
      let left = Math.max(0, rect.left);
      let right = Math.min(innerWidth, rect.right);
      let top = Math.max(0, rect.top);
      let bottom = Math.min(innerHeight, rect.bottom);
      let ancestor = button.parentElement;
      while (ancestor) {
        const ancestorStyle = getComputedStyle(ancestor);
        const ancestorRect = ancestor.getBoundingClientRect();
        if (clipsAxis(ancestorStyle.overflowX)) {
          left = Math.max(left, ancestorRect.left);
          right = Math.min(right, ancestorRect.right);
        }
        if (clipsAxis(ancestorStyle.overflowY)) {
          top = Math.max(top, ancestorRect.top);
          bottom = Math.min(bottom, ancestorRect.bottom);
        }
        ancestor = ancestor.parentElement;
      }
      // A button outside a scroll/clip viewport is not currently interactive;
      // auditing its unclipped center creates false obstruction reports.
      if (right - left < 1 || bottom - top < 1) return;
      checked += 1;
      const x = Math.max(0, Math.min(innerWidth - 1, left + (right - left) / 2));
      const y = Math.max(0, Math.min(innerHeight - 1, top + (bottom - top) / 2));
      const hit = document.elementFromPoint(x, y);
      if (!hit || hit.closest("button") !== button) {
        failures.push({
          id: button.id || null,
          label: button.getAttribute("aria-label") || button.textContent.trim().replace(/\s+/g, " "),
          hit: hit ? hit.id || hit.className || hit.tagName : null,
          x: Math.round(x),
          y: Math.round(y),
        });
      }
    });
    return { checked, failures };
  }, scopeSelector);
}

async function main() {
  const browser = await chromium.launch(playwrightRuntime.chromiumLaunchOptions({ headless: true }));
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const externalConsoleErrors = [];
  const requestErrors = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    const entry = location?.url ? `${message.text()} @ ${location.url}` : message.text();
    if (!location?.url || location.url.startsWith(BASE)) consoleErrors.push(entry);
    else externalConsoleErrors.push(entry);
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(BASE)) {
      requestErrors.push(`${request.failure()?.errorText || "request failed"} @ ${request.url()}`);
    }
  });

  const report = {
    staticButtons: null,
    quickstart: {},
    lobby: {},
    lab: {},
    room: {},
    game: {},
    mobile: {},
    compact: {},
    landscape: {},
    smallLandscape: {},
    allin: {},
    tableClean: [],
  };

  await page.goto(BASE + "/?verify-interactions=1", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#screen-auth.active", { timeout: 10000 });
  await page.waitForSelector("#btn-open-skill-lab:not([disabled])", { timeout: 10000 });
  report.lobby.skillModeCopyLocked = await page.evaluate(() => {
    const description = document.querySelector(
      '.protocol-card[data-game-mode="standard"][data-skill-mode="abyss"] .protocol-desc'
    );
    return {
      zh: description?.textContent?.trim() || "",
      en: description?.dataset.currentEn || "",
    };
  });

  await page.waitForSelector("#quickstart-modal", { state: "hidden", timeout: 5000 });
  report.quickstart.autoStart = await page.evaluate(() => ({
    autoOpened: !document.getElementById("quickstart-modal")?.classList.contains("hidden"),
    mainInert: Boolean(document.getElementById("main-content")?.inert),
    stored: localStorage.getItem("overlimit_quickstart_v1"),
    entryAction: document.getElementById("quickstart-entry-action")?.textContent || "",
  }));
  await page.click("#btn-open-quickstart");
  await page.waitForSelector("#quickstart-modal:not(.hidden)", { timeout: 5000 });
  report.quickstart.initial = await page.evaluate(() => ({
    pageCount: document.querySelectorAll("[data-quickstart-page]").length,
    pageStatus: document.getElementById("quickstart-page-status")?.textContent || "",
    activePage: document.querySelector('[data-quickstart-page][aria-hidden="false"]')?.dataset.quickstartPage || "",
    mainInert: Boolean(document.getElementById("main-content")?.inert),
    images: [...document.querySelectorAll("#quickstart-modal img")].map((image) => image.getAttribute("src")),
  }));
  await page.click("#btn-quickstart-next");
  await page.waitForFunction(() => document.getElementById("quickstart-page-status")?.textContent === "02 / 04");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.getElementById("quickstart-page-status")?.textContent === "03 / 04");
  const quickstartViewport = await page.locator("#quickstart-viewport").boundingBox();
  if (quickstartViewport) {
    const y = quickstartViewport.y + quickstartViewport.height * 0.55;
    await page.mouse.move(quickstartViewport.x + quickstartViewport.width * 0.72, y);
    await page.mouse.down();
    await page.mouse.move(quickstartViewport.x + quickstartViewport.width * 0.42, y, { steps: 5 });
    await page.mouse.up();
  }
  await page.waitForFunction(() => document.getElementById("quickstart-page-status")?.textContent === "04 / 04");
  await page.waitForFunction(
    () => [...document.querySelectorAll("#quickstart-modal img")].every(
      (image) => image.complete && image.naturalWidth > 0
    ),
    null,
    { timeout: 5000 }
  );
  report.quickstart.finalPage = await page.evaluate(() => ({
    pageStatus: document.getElementById("quickstart-page-status")?.textContent || "",
    finishLabel: document.getElementById("btn-quickstart-next")?.textContent || "",
    nextCornerHidden: document.getElementById("btn-quickstart-corner-next")?.classList.contains("is-hidden"),
    allImagesLoaded: [...document.querySelectorAll("#quickstart-modal img")].every(
      (image) => image.complete && image.naturalWidth > 0
    ),
  }));
  await page.click("#btn-quickstart-next");
  await page.waitForSelector("#quickstart-modal", { state: "hidden" });
  await page.waitForFunction(() => document.activeElement?.classList.contains("protocol-card"));
  report.quickstart.completion = await page.evaluate(() => ({
    stored: localStorage.getItem("overlimit_quickstart_v1"),
    entryAction: document.getElementById("quickstart-entry-action")?.textContent || "",
    entryState: document.getElementById("quickstart-entry-state")?.textContent || "",
    selectedProtocolFocused: document.activeElement?.classList.contains("protocol-card") || false,
  }));
  await page.click("#btn-open-quickstart");
  await page.click('#quickstart-dots [data-quickstart-target="2"]');
  await page.click("#btn-quickstart-hands");
  await page.waitForSelector("#rules-handbook-modal:not(.hidden)");
  report.quickstart.rulesRoute = await page.evaluate(() => ({
    rulesOpen: !document.getElementById("rules-handbook-modal")?.classList.contains("hidden"),
    handsActive: document.querySelector('[data-rule-target="rule-hands"]')?.getAttribute("aria-current") === "true",
    tutorialClosed: document.getElementById("quickstart-modal")?.classList.contains("hidden"),
  }));
  await page.click("#btn-close-rules");

  report.staticButtons = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    return {
      count: buttons.length,
      missingType: buttons.filter((button) => button.getAttribute("type") !== "button").length,
      nested: document.querySelectorAll("button button").length,
      unnamed: buttons.filter(
        (button) =>
          !(button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent.trim())
      ).length,
    };
  });
  report.lobby.hitAudit = await buttonHitAudit(page, "#screen-auth");

  await page.click("#btn-settings");
  report.lobby.settingsOpened = await visible(page, "#settings-modal:not(.hidden)");
  report.lobby.settingsLobbyHidden = !(await visible(page, "#btn-settings-lobby"));
  const allInStyles = ["abyss", "verdict", "royal", "singularity"];
  report.lobby.allInStyles = {
    count: await page.locator('input[name="allin-style"]').count(),
    audits: [],
  };
  for (const styleId of allInStyles) {
    await page.locator(`input[name="allin-style"][value="${styleId}"]`).check({ force: true });
    await page.click("#btn-preview-allin");
    await page.waitForTimeout(80);
    report.lobby.allInStyles.audits.push(
      await page.evaluate((expectedStyle) => {
        const flash = document.getElementById("flash-allin");
        const modal = document.getElementById("settings-modal");
        const stored = JSON.parse(localStorage.getItem("abyss_ui_settings_v2") || "{}");
        return {
          expectedStyle,
          appliedStyle: flash?.dataset.allinStyle || "",
          storedStyle: stored.allInStyle || "",
          checked: Boolean(
            document.querySelector(`input[name="allin-style"][value="${expectedStyle}"]`)?.checked
          ),
          visible: Boolean(flash && !flash.classList.contains("hidden")),
          previewLayer: Boolean(flash?.classList.contains("is-preview")),
          aboveSettings:
            Number.parseInt(getComputedStyle(flash).zIndex, 10) >
            Number.parseInt(getComputedStyle(modal).zIndex, 10),
          visibleText: flash?.innerText.replace(/\s+/g, " ").trim() || "",
        };
      }, styleId)
    );
  }
  await page.evaluate(() => {
    const flash = document.getElementById("flash-allin");
    flash?.classList.add("hidden");
    flash?.classList.remove("is-preview");
  });
  await page.click("#btn-close-settings");
  report.lobby.settingsClosed = !(await visible(page, "#settings-modal:not(.hidden)"));

  await page.click("#btn-open-skill-lab");
  await page.waitForSelector("#screen-skill-lab.active");
  await page.waitForSelector("#skill-lab-catalog .skill-card-select");
  const cards = page.locator("#skill-lab-catalog .skill-card");
  const zoomButtons = page.locator("#skill-lab-catalog .skill-zoom-button");
  report.lab.cards = await cards.count();
  report.lab.zoomButtons = await zoomButtons.count();
  const selectedBeforeZoom = await page.locator("#skill-lab-catalog .skill-card.selected").count();
  await zoomButtons.first().click();
  report.lab.previewOpened = await visible(page, "#skill-preview-modal:not(.hidden)");
  report.lab.zoomDidNotSelect =
    selectedBeforeZoom === (await page.locator("#skill-lab-catalog .skill-card.selected").count());
  await page.click("#btn-close-skill-preview");
  report.lab.previewClosed = !(await visible(page, "#skill-preview-modal:not(.hidden)"));
  report.lab.hitAudit = await buttonHitAudit(page, "#screen-skill-lab");

  await page.click("#btn-clear-loadout");
  for (const skillId of LOADOUT) {
    await page.click(`#skill-lab-catalog .skill-card[data-skill-id="${skillId}"] .skill-card-select`);
  }
  report.lab.selected = await page.locator("#skill-lab-catalog .skill-card.selected").count();
  report.lab.selectionVisibility = await page.evaluate(() => {
    const selected = [...document.querySelectorAll("#skill-lab-catalog .skill-card.selected")];
    const unselected = document.querySelector("#skill-lab-catalog .skill-card:not(.selected)");
    const selectedStyles = selected.map((card) => getComputedStyle(card));
    const unselectedStyle = unselected ? getComputedStyle(unselected) : null;
    const markers = selected.map((card) => card.querySelector(".skill-selection-mark"));
    return {
      markerCount: markers.filter(Boolean).length,
      markersVisible: markers.every(
        (marker) => marker && getComputedStyle(marker).display !== "none" && marker.textContent.includes("已选择")
      ),
      borderDistinct: Boolean(
        unselectedStyle && selectedStyles.every((style) => style.borderColor !== unselectedStyle.borderColor)
      ),
      backgroundDistinct: Boolean(
        unselectedStyle && selectedStyles.every((style) => style.backgroundImage !== unselectedStyle.backgroundImage)
      ),
      glowVisible: selectedStyles.every((style) => style.boxShadow !== "none"),
    };
  });
  report.lab.saveEnabled = await page.locator("#btn-save-loadout").isEnabled();
  await page.click("#btn-save-loadout");
  await page.waitForSelector("#screen-auth.active");
  report.lobby.skillModeCopyReady = await page.evaluate(() => {
    const description = document.querySelector(
      '.protocol-card[data-game-mode="standard"][data-skill-mode="abyss"] .protocol-desc'
    );
    return {
      zh: description?.textContent?.trim() || "",
      en: description?.dataset.currentEn || "",
    };
  });

  report.room.doubleClickGate = await page.evaluate(() => {
    const button = document.querySelector(
      '.protocol-card[data-game-mode="standard"][data-skill-mode="abyss"] .protocol-btn[data-room-action="solo"]'
    );
    if (!button) return { found: false, disabledAfterFirst: false };
    button.click();
    const disabledAfterFirst = button.disabled;
    button.click();
    return { found: true, disabledAfterFirst };
  });
  await page.waitForSelector("#screen-game.active", { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.waitForFunction(() => {
    const probe = document.querySelector('[data-skill-use-id="PROBE"]');
    return probe && !probe.disabled;
  }, null, { timeout: 10000 });
  await page.click('[data-skill-use-id="PROBE"]');
  await page.waitForTimeout(900);
  report.game.probeFeed = await page.locator("#skill-log .skill-feed-entry").allInnerTexts()
    .then((entries) => entries.filter((entry) => entry.includes("试探")));

  await page.click("#btn-settings");
  report.game.settingsLobbyVisible = await visible(page, "#btn-settings-lobby");
  await page.click("#btn-settings-lobby");
  report.game.settingsLobbyConfirmation = await visible(page, "#leave-confirm-modal:not(.hidden)");
  if (report.game.settingsLobbyConfirmation) await page.click("#btn-leave-cancel");

  report.game.skillGeometry = await skillGeometry(page);
  report.game.zoomButtons = await page.locator("#skill-bar .skill-zoom-button").count();
  report.game.deckAnchor = await page.evaluate(() => {
    const anchor = document.getElementById("deck-fx-anchor")?.getBoundingClientRect();
    const deckStyle = getComputedStyle(document.getElementById("deck-stack"));
    return {
      width: anchor?.width || 0,
      height: anchor?.height || 0,
      deckVisibility: deckStyle.visibility,
    };
  });
  await page.locator("#skill-bar .skill-zoom-button").first().click();
  report.game.previewOpened = await visible(page, "#skill-preview-modal:not(.hidden)");
  await page.click("#btn-skill-preview-done");

  await page.click("#btn-toggle-opponent-intel");
  await page.waitForFunction(() => document.getElementById("opponent-skill-field")?.classList.contains("is-mobile-open"));
  await page.click("#btn-mark-opponent-skills");
  await page.waitForSelector('#skill-choice-modal[data-variant="dossier"]:not(.hidden)');
  report.game.suspectPicker = await page.evaluate(() => {
    const modal = document.getElementById("skill-choice-modal");
    const filters = [...document.querySelectorAll("#skill-choice-filters [data-skill-filter]")];
    const visibleChoices = () => [...document.querySelectorAll(".dossier-skill-choice")]
      .filter((choice) => !choice.classList.contains("is-filtered-out"));
    return {
      eyebrowHidden: getComputedStyle(document.getElementById("skill-choice-eyebrow")).display === "none",
      stepHidden: getComputedStyle(document.getElementById("skill-choice-step")).display === "none",
      subtitleHidden: getComputedStyle(document.getElementById("skill-choice-text")).display === "none",
      filterCount: filters.length,
      filterLabels: filters.map((button) => button.textContent.trim()),
      activeFilter: modal?.querySelector(".skill-lab-filter.is-active")?.dataset.skillFilter || "",
      initialVisible: visibleChoices().length,
      initialRemaining: document.getElementById("skill-choice-selection")?.textContent.trim() || "",
    };
  });
  await page.click('#skill-choice-filters [data-skill-filter="resource"]');
  await page.waitForFunction(() => (
    document.querySelector('#skill-choice-filters [data-skill-filter="resource"]')?.getAttribute("aria-pressed") === "true"
  ));
  const resourceVisible = await page.locator(
    ".dossier-skill-choice:not(.is-filtered-out)"
  ).count();
  const firstResourceChoice = page.locator(
    ".dossier-skill-choice:not(.is-filtered-out):not(:disabled)"
  ).first();
  const selectedSkillId = await firstResourceChoice.getAttribute("data-skill-id");
  await firstResourceChoice.click();
  await page.click('#skill-choice-filters [data-skill-filter="all"]');
  report.game.suspectPicker.afterFilter = await page.evaluate(({ skillId, resourceCount }) => ({
    resourceVisible: resourceCount,
    selectedPersisted: document.querySelector(
      `.dossier-skill-choice[data-skill-id="${skillId}"]`
    )?.classList.contains("selected") || false,
    remaining: document.getElementById("skill-choice-selection")?.textContent.trim() || "",
    allActive: document.querySelector(
      '#skill-choice-filters [data-skill-filter="all"]'
    )?.getAttribute("aria-pressed") === "true",
  }), { skillId: selectedSkillId, resourceCount: resourceVisible });
  await page.click("#btn-skill-choice-cancel");
  await page.click("#btn-close-opponent-intel");

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
    { width: 320, height: 700 },
  ]) {
    report.tableClean.push(await competitiveTableAudit(page, viewport));
  }
  report.game.skillCounts = await skillCountLayoutAudit(page, { width: 1440, height: 900 });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(120);
  report.game.hitAudit = await buttonHitAudit(page, "#screen-game");

  await page.waitForFunction(
    () =>
      [...document.querySelectorAll(".primary-actions button, #btn-raise")].some(
        (button) => !button.disabled && !button.classList.contains("hidden")
      ),
    null,
    { timeout: 12000 }
  );

  report.game.raiseOptions = await raisePopoverAudit(page);

  report.game.actionGate = await page.evaluate(() => {
    const order = ["check", "call", "fold"];
    const button = order
      .map((action) => document.querySelector(`button[data-action="${action}"]`))
      .find((candidate) => candidate && !candidate.disabled && !candidate.classList.contains("hidden"));
    if (!button) return { found: false, allDisabledAfterFirst: false, action: null };
    const action = button.dataset.action;
    button.click();
    const allDisabledAfterFirst = [...document.querySelectorAll(".action-button[data-action]")].every(
      (candidate) => candidate.disabled
    );
    button.click();
    return { found: true, allDisabledAfterFirst, action };
  });

  const effectFunction = await page.evaluate(() => typeof window.playAllInEffect === "function");
  report.allin.functionAvailable = effectFunction;
  if (effectFunction) {
    await page.evaluate(() => window.playAllInEffect("ui-audit-opponent"));
    await page.waitForTimeout(1500);
    report.allin.visibleAfter1500ms = await visible(page, "#flash-allin:not(.hidden)");
    report.allin.visibleText = (await page.locator("#flash-allin").innerText())
      .replace(/\s+/g, " ")
      .trim();
    report.allin.style = await page.locator("#flash-allin").getAttribute("data-allin-style");
    await page.waitForTimeout(700);
    report.allin.hiddenAfter2200ms = !(await visible(page, "#flash-allin:not(.hidden)"));
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  report.mobile.skillGeometry = await skillGeometry(page);
  report.mobile.layout = await phoneTableLayout(page);
  report.mobile.skillCounts = await skillCountLayoutAudit(page, { width: 390, height: 844 });
  report.mobile.drawers = await mobileDrawerAudit(page);
  await page.click("#btn-settings");
  report.mobile.settings = await page.evaluate(() => {
    const panel = document.querySelector("#settings-modal .settings-panel")?.getBoundingClientRect();
    const lobbyButton = document.getElementById("btn-settings-lobby")?.getBoundingClientRect();
    const triggerStyle = getComputedStyle(document.getElementById("btn-settings"));
    return {
      lobbyButtonVisible: Boolean(
        lobbyButton &&
        lobbyButton.width > 0 &&
        lobbyButton.height >= 44 &&
        lobbyButton.top >= 0 &&
        lobbyButton.bottom <= innerHeight + 1
      ),
      panelInsideHorizontally: Boolean(panel && panel.left >= -1 && panel.right <= innerWidth + 1),
      triggerBorderless: [
        triggerStyle.borderTopWidth,
        triggerStyle.borderRightWidth,
        triggerStyle.borderBottomWidth,
        triggerStyle.borderLeftWidth,
      ].every((width) => width === "0px"),
    };
  });
  await page.click("#btn-close-settings");
  report.mobile.hitAudit = await buttonHitAudit(page, "#screen-game");

  report.compact.skillCounts = await skillCountLayoutAudit(page, { width: 320, height: 700 });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(200);
  report.compact.skillGeometry = await skillGeometry(page);
  report.compact.layout = await phoneTableLayout(page);
  report.compact.hitAudit = await buttonHitAudit(page, "#screen-game");

  const landscapeLayout = () => page.evaluate(() => {
    const dock = document.querySelector(".action-dock")?.getBoundingClientRect();
    const board = document.getElementById("board")?.getBoundingClientRect();
    const self = document.getElementById("self-area")?.getBoundingClientRect();
    const clock = document.getElementById("action-countdown")?.getBoundingClientRect();
    const pot = document.getElementById("pot-core")?.getBoundingClientRect();
    const community = [...document.querySelectorAll("#community-cards .card")].map((card) =>
      card.getBoundingClientRect()
    );
    const overlaps = (left, right) =>
      Boolean(
        left &&
        right &&
        left.right > right.left &&
        left.left < right.right &&
        left.bottom > right.top &&
        left.top < right.bottom
      );
    return {
      scrolls:
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 ||
        document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
      dockInside: Boolean(
        dock && dock.left >= -1 && dock.right <= innerWidth + 1 && dock.bottom <= innerHeight + 1
      ),
      selfInsideBoard: Boolean(
        board && self && self.top >= board.top - 1 && self.bottom <= board.bottom + 1
      ),
      communityInsideBoard: Boolean(
        board && community.length === 5 && community.every(
          (card) =>
            card.left >= board.left - 1 &&
            card.right <= board.right + 1 &&
            card.top >= board.top - 1 &&
            card.bottom <= board.bottom + 1
        )
      ),
      communityClearOfInstruments:
        community.length === 5 &&
        community.every((card) => !overlaps(card, clock) && !overlaps(card, pot)),
    };
  });

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(200);
  report.landscape.skillGeometry = await skillGeometry(page);
  report.landscape.layout = await landscapeLayout();
  report.landscape.hitAudit = await buttonHitAudit(page, "#screen-game");

  await page.setViewportSize({ width: 667, height: 375 });
  await page.waitForTimeout(200);
  report.smallLandscape.skillGeometry = await skillGeometry(page);
  report.smallLandscape.layout = await landscapeLayout();
  report.smallLandscape.hitAudit = await buttonHitAudit(page, "#screen-game");

  await browser.close();

  const failures = [];
  if (
    report.quickstart.autoStart.autoOpened ||
    report.quickstart.autoStart.mainInert ||
    report.quickstart.autoStart.stored !== null ||
    report.quickstart.autoStart.entryAction !== "开始阅读" ||
    report.quickstart.initial.pageCount !== 4 ||
    report.quickstart.initial.pageStatus !== "01 / 04" ||
    report.quickstart.initial.activePage !== "1" ||
    !report.quickstart.initial.mainInert ||
    report.quickstart.initial.images.length !== 5 ||
    report.quickstart.finalPage.pageStatus !== "04 / 04" ||
    report.quickstart.finalPage.finishLabel !== "开始游戏" ||
    !report.quickstart.finalPage.nextCornerHidden ||
    !report.quickstart.finalPage.allImagesLoaded ||
    report.quickstart.completion.stored !== "seen" ||
    report.quickstart.completion.entryAction !== "重新查看" ||
    !report.quickstart.completion.selectedProtocolFocused ||
    !report.quickstart.rulesRoute.rulesOpen ||
    !report.quickstart.rulesRoute.handsActive ||
    !report.quickstart.rulesRoute.tutorialClosed
  ) {
    failures.push("quickstart tutorial flow failed");
  }
  if (report.staticButtons.missingType || report.staticButtons.nested || report.staticButtons.unnamed) {
    failures.push("button DOM contract failed");
  }
  if (!report.lobby.settingsOpened || !report.lobby.settingsClosed || !report.lobby.settingsLobbyHidden) {
    failures.push("settings button routing failed");
  }
  if (
    report.lobby.allInStyles.count !== 4 ||
    report.lobby.allInStyles.audits.some(
      (audit) =>
        audit.appliedStyle !== audit.expectedStyle ||
        (audit.storedStyle
          ? audit.storedStyle !== audit.expectedStyle
          : audit.expectedStyle !== "abyss") ||
        !audit.checked ||
        !audit.visible ||
        !audit.previewLayer ||
        !audit.aboveSettings ||
        audit.visibleText !== "ALL IN"
    )
  ) {
    failures.push("ALL IN style picker or preview failed");
  }
  if (report.lobby.hitAudit.failures.length) failures.push("lobby button hit targets blocked");
  if (
    report.lobby.skillModeCopyLocked.zh !== "需先完成技能构筑" ||
    report.lobby.skillModeCopyLocked.en !== "Complete a skill build first" ||
    report.lobby.skillModeCopyReady.zh !== "使用已保存的技能构筑" ||
    report.lobby.skillModeCopyReady.en !== "Saved skill build ready"
  ) {
    failures.push("skill-mode readiness copy did not update in Chinese and English");
  }
  if (report.lab.cards < 12 || report.lab.zoomButtons !== report.lab.cards) failures.push("skill zoom buttons incomplete");
  if (!report.lab.previewOpened || !report.lab.previewClosed || !report.lab.zoomDidNotSelect) {
    failures.push("skill preview interaction failed");
  }
  if (report.lab.hitAudit.failures.length) failures.push("skill lab button hit targets blocked");
  if (report.lab.selected !== 4 || !report.lab.saveEnabled) failures.push("four-skill loadout failed");
  if (
    report.lab.selectionVisibility.markerCount !== 4 ||
    !report.lab.selectionVisibility.markersVisible ||
    !report.lab.selectionVisibility.borderDistinct ||
    !report.lab.selectionVisibility.backgroundDistinct ||
    !report.lab.selectionVisibility.glowVisible
  ) {
    failures.push("skill selection highlight failed");
  }
  if (!report.room.doubleClickGate.found || !report.room.doubleClickGate.disabledAfterFirst) {
    failures.push("room request double-click gate failed");
  }
  if (report.game.skillGeometry.count !== 4 || !report.game.skillGeometry.allInside || report.game.skillGeometry.overflows) {
    failures.push("desktop four-skill HUD overflow");
  }
  const expectedDesktopSkillCases = [1, 2, 3, 4].map((count) => ({ count, columns: 1, rows: count }));
  if (
    !report.game.skillCounts.available ||
    report.game.skillCounts.cases.length !== expectedDesktopSkillCases.length ||
    report.game.skillCounts.cases.some((current, index) => {
      const expected = expectedDesktopSkillCases[index];
      return current.count !== expected.count ||
        current.columns !== expected.columns ||
        current.rows !== expected.rows ||
        !current.allInside ||
        current.overflows;
    })
  ) {
    failures.push("desktop 1-4 skill arsenal layout contract failed");
  }
  if (
    report.game.zoomButtons !== 4 ||
    report.game.deckAnchor.width <= 20 ||
    report.game.deckAnchor.height <= 20 ||
    report.game.deckAnchor.deckVisibility !== "hidden" ||
    !report.game.previewOpened
  ) {
    failures.push("game HUD controls failed");
  }
  const initialRemaining = Number.parseInt(
    report.game.suspectPicker.initialRemaining.replace(/\D+/g, ""),
    10
  );
  const remainingAfterSelection = Number.parseInt(
    report.game.suspectPicker.afterFilter.remaining.replace(/\D+/g, ""),
    10
  );
  if (
    !report.game.suspectPicker.eyebrowHidden ||
    !report.game.suspectPicker.stepHidden ||
    !report.game.suspectPicker.subtitleHidden ||
    report.game.suspectPicker.filterCount !== 7 ||
    report.game.suspectPicker.filterLabels.join("|") !== "全部|情报|攻击|防御|资源|改牌|协议" ||
    report.game.suspectPicker.activeFilter !== "all" ||
    report.game.suspectPicker.initialVisible < 24 ||
    !report.game.suspectPicker.initialRemaining.startsWith("剩余可用 ") ||
    report.game.suspectPicker.afterFilter.resourceVisible <= 0 ||
    report.game.suspectPicker.afterFilter.resourceVisible >= report.game.suspectPicker.initialVisible ||
    !report.game.suspectPicker.afterFilter.selectedPersisted ||
    !report.game.suspectPicker.afterFilter.allActive ||
    remainingAfterSelection !== initialRemaining - 1
  ) {
    failures.push("opponent skill tag filtering or remaining-slot summary failed");
  }
  for (const audit of report.tableClean) {
    const failedContracts = Object.entries(audit.contracts)
      .filter(([, passed]) => !passed)
      .map(([id]) => id);
    if (failedContracts.length) {
      failures.push(
        `competitive table contracts failed at ${audit.requested.width}x${audit.requested.height}: ${failedContracts.join(", ")}`
      );
    }
  }
  if (!report.game.settingsLobbyVisible || !report.game.settingsLobbyConfirmation) {
    failures.push("settings return-to-lobby flow failed");
  }
  if (report.game.probeFeed.length !== 1 || !report.game.probeFeed[0].includes("试探已秘密生效")) {
    failures.push("Probe tactical feed displayed duplicate activation records");
  }
  if (report.game.hitAudit.failures.length) failures.push("game button hit targets blocked");
  if (!report.game.actionGate.found || !report.game.actionGate.allDisabledAfterFirst) {
    failures.push("poker action double-click gate failed");
  }
  if (
    report.game.raiseOptions.available &&
    (
      !report.game.raiseOptions.opened ||
      !report.game.raiseOptions.closed ||
      !report.game.raiseOptions.stableWhileOpen ||
      !report.game.raiseOptions.stableAfterClose ||
      !report.game.raiseOptions.panelAboveDock ||
      !report.game.raiseOptions.panelInsideViewport
    )
  ) {
    failures.push("raise options popover moved the table or escaped its overlay lane");
  }
  if (
    !report.allin.functionAvailable ||
    !report.allin.visibleAfter1500ms ||
    !report.allin.hiddenAfter2200ms ||
    report.allin.visibleText !== "ALL IN" ||
    !allInStyles.includes(report.allin.style)
  ) {
    failures.push("ALL IN duration failed");
  }
  if (
    report.mobile.skillGeometry.count !== 4 ||
    !report.mobile.skillGeometry.allInside ||
    report.mobile.skillGeometry.overflows ||
    report.mobile.layout.scrolls ||
    !report.mobile.layout.dockInside ||
    report.mobile.layout.boardDockOverlap ||
    !report.mobile.layout.selfInsideBoard ||
    !report.mobile.layout.ownSkillsInsideBoard ||
    !report.mobile.layout.opponentSummaryInsideBoard ||
    !report.mobile.layout.visualOrder ||
    !report.mobile.layout.actionSingleLayer ||
    report.mobile.layout.cardSizeDelta > 0.1 ||
    !report.mobile.layout.communityInsideBoard ||
    !report.mobile.layout.communityInsideViewport ||
    !report.mobile.layout.communityClearOfClock ||
    !report.mobile.layout.communityClearOfPot
  ) {
    failures.push("mobile four-skill layout failed");
  }
  const expectedMobileSkillCases = [
    { count: 1, columns: 1, rows: 1 },
    { count: 2, columns: 2, rows: 1 },
    { count: 3, columns: 3, rows: 1 },
    { count: 4, columns: 2, rows: 2 },
  ];
  if (
    !report.mobile.skillCounts.available ||
    report.mobile.skillCounts.cases.length !== expectedMobileSkillCases.length ||
    report.mobile.skillCounts.cases.some((current, index) => {
      const expected = expectedMobileSkillCases[index];
      return current.count !== expected.count ||
        current.columns !== expected.columns ||
        current.rows !== expected.rows ||
        !current.allInside ||
        current.overflows;
    })
  ) {
    failures.push("mobile 1-4 skill responsive layout contract failed");
  }
  if (
    !report.mobile.drawers.intelOpen.visible ||
    report.mobile.drawers.intelOpen.ariaHidden !== "false" ||
    report.mobile.drawers.intelOpen.inert ||
    report.mobile.drawers.intelOpen.expanded !== "true" ||
    report.mobile.drawers.intelClosed.ariaHidden !== "true" ||
    !report.mobile.drawers.intelClosed.inert ||
    !report.mobile.drawers.intelClosed.focusReturned ||
    !report.mobile.drawers.feedOpen.visible ||
    report.mobile.drawers.feedOpen.ariaHidden !== "false" ||
    report.mobile.drawers.feedOpen.inert ||
    report.mobile.drawers.feedOpen.expanded !== "true" ||
    report.mobile.drawers.feedClosed.ariaHidden !== "true" ||
    !report.mobile.drawers.feedClosed.inert
  ) {
    failures.push("mobile opponent-intel or tactical-feed drawer contract failed");
  }
  if (report.mobile.hitAudit.failures.length) failures.push("mobile button hit targets blocked");
  if (
    !report.mobile.settings.lobbyButtonVisible ||
    !report.mobile.settings.panelInsideHorizontally ||
    !report.mobile.settings.triggerBorderless
  ) {
    failures.push("mobile settings navigation layout failed");
  }
  if (
    report.compact.skillGeometry.count !== 4 ||
    !report.compact.skillGeometry.allInside ||
    report.compact.skillGeometry.overflows ||
    report.compact.layout.scrolls ||
    !report.compact.layout.dockInside ||
    report.compact.layout.boardDockOverlap ||
    !report.compact.layout.selfInsideBoard ||
    !report.compact.layout.ownSkillsInsideBoard ||
    !report.compact.layout.opponentSummaryInsideBoard ||
    !report.compact.layout.visualOrder ||
    !report.compact.layout.actionSingleLayer ||
    report.compact.layout.cardSizeDelta > 0.1 ||
    !report.compact.layout.communityInsideBoard ||
    !report.compact.layout.communityInsideViewport ||
    !report.compact.layout.communityClearOfClock ||
    !report.compact.layout.communityClearOfPot
  ) {
    failures.push("compact four-skill layout failed");
  }
  if (
    !report.compact.skillCounts.available ||
    report.compact.skillCounts.cases.length !== expectedMobileSkillCases.length ||
    report.compact.skillCounts.cases.some((current, index) => {
      const expected = expectedMobileSkillCases[index];
      return current.count !== expected.count ||
        current.columns !== expected.columns ||
        current.rows !== expected.rows ||
        !current.allInside ||
        current.overflows;
    })
  ) {
    failures.push("320px 1-4 skill responsive layout contract failed");
  }
  if (report.compact.hitAudit.failures.length) failures.push("compact button hit targets blocked");
  for (const [name, label] of [
    ["landscape", "landscape"],
    ["smallLandscape", "small landscape"],
  ]) {
    const current = report[name];
    if (
      current.skillGeometry.count !== 4 ||
      !current.skillGeometry.allInside ||
      current.skillGeometry.overflows ||
      current.layout.scrolls ||
      !current.layout.dockInside ||
      !current.layout.selfInsideBoard ||
      !current.layout.communityInsideBoard ||
      !current.layout.communityClearOfInstruments
    ) {
      failures.push(`${label} table layout failed`);
    }
    if (current.hitAudit.failures.length) failures.push(`${label} button hit targets blocked`);
  }
  if (consoleErrors.length) failures.push("browser console errors");
  if (requestErrors.length) failures.push("same-origin resource requests failed");

  console.log(JSON.stringify({
    ok: failures.length === 0,
    failures,
    consoleErrors,
    externalConsoleErrors,
    requestErrors,
    report,
  }, null, 2));
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
