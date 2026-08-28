import { chromium } from "playwright";
import playwrightRuntime from "./playwright-runtime.js";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3002";

async function fit(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const dock = document.querySelector(".action-dock");
    const join = document.getElementById("btn-join");
    const save = document.getElementById("btn-save-loadout");
    const waitPwd = document.getElementById("btn-set-room-password");
    const visible = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.bottom <= window.innerHeight + 2 && r.top >= -2 && r.height > 0;
    };
    return {
      needsScroll: de.scrollHeight > de.clientHeight + 1,
      scrollHeight: de.scrollHeight,
      clientHeight: de.clientHeight,
      bodyOverflow: getComputedStyle(document.body).overflowY,
      dockVisible: visible(dock),
      joinVisible: visible(join),
      saveVisible: visible(save),
      waitPwdVisible: visible(waitPwd),
      active: ["screen-auth", "screen-wait", "screen-game", "screen-skill-lab"].find((id) =>
        document.getElementById(id)?.classList.contains("active")
      ),
    };
  });
}

async function auditLobbyViewport(page, viewport) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(80);
  return page.evaluate(({ width, height }) => {
    const auth = document.getElementById("screen-auth");
    const protocol = document.querySelector(".protocol-section");
    const protocolGrid = document.querySelector(".protocol-grid");
    const panels = [
      document.querySelector(".lobby-hero"),
      document.querySelector(".skill-prep-bar"),
      protocol,
      document.querySelector(".lobby-entry"),
    ].filter(Boolean);
    const interactive = [
      ...document.querySelectorAll(
        "#screen-auth input, #screen-auth button, #screen-auth .protocol-card"
      ),
    ].filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const rect = (node) => node?.getBoundingClientRect();
    const authRect = rect(auth);
    const protocolRect = rect(protocol);
    const gridRect = rect(protocolGrid);
    const overlaps = panels.slice(1).flatMap((panel, index) => {
      const previous = panels[index];
      const previousRect = rect(previous);
      const panelRect = rect(panel);
      return previousRect && panelRect && previousRect.bottom > panelRect.top + 1
        ? [`${previous.className} -> ${panel.className}`]
        : [];
    });
    const clipped = interactive.flatMap((node) => {
      const nodeRect = rect(node);
      return nodeRect &&
        (nodeRect.top < -1 ||
          nodeRect.left < -1 ||
          nodeRect.bottom > innerHeight + 1 ||
          nodeRect.right > innerWidth + 1 ||
          (authRect &&
            (nodeRect.top < authRect.top - 1 ||
              nodeRect.left < authRect.left - 1 ||
              nodeRect.bottom > authRect.bottom + 1 ||
              nodeRect.right > authRect.right + 1)))
        ? [node.id || node.className]
        : [];
    });
    return {
      requested: { width, height },
      actual: { width: innerWidth, height: innerHeight },
      pageScrolls: document.documentElement.scrollHeight > innerHeight + 1,
      authInsideViewport: Boolean(
        authRect &&
          authRect.top >= -1 &&
          authRect.left >= -1 &&
          authRect.bottom <= innerHeight + 1 &&
          authRect.right <= innerWidth + 1
      ),
      protocolTailGap:
        protocolRect && gridRect ? Math.max(0, protocolRect.bottom - gridRect.bottom) : null,
      clipped,
      overlaps,
    };
  }, viewport);
}

async function auditSettlementCardGeometry(page) {
  await page.evaluate(() => {
    const modal = document.getElementById("hand-settle-modal");
    const row = document.getElementById("settle-community");
    row.textContent = "";
    ["4", "3", "2"].forEach((rank, index) => {
      const card = document.createElement("div");
      card.className = "card flip-reveal" + (index === 0 ? " red" : "");
      const rankNode = document.createElement("strong");
      const suitNode = document.createElement("span");
      rankNode.textContent = rank;
      suitNode.textContent = index === 0 ? "♥" : index === 1 ? "♣" : "♠";
      card.append(rankNode, suitNode);
      row.appendChild(card);
    });
    for (let index = 0; index < 2; index += 1) {
      const slot = document.createElement("div");
      slot.className = "card card-slot";
      row.appendChild(slot);
    }
    modal.classList.remove("hidden");
  });
  await page.waitForFunction(() => {
    const revealed = [...document.querySelectorAll("#settle-community .card.flip-reveal")];
    return revealed.length === 3 && revealed.every((card) => (
      card.getAnimations().every((animation) => animation.playState === "finished")
    ));
  }, null, { timeout: 3000 });
  const geometry = await page.evaluate(() => {
    const modal = document.getElementById("hand-settle-modal");
    const row = document.getElementById("settle-community");
    const cards = [...row.children].map((card) => {
      const rect = card.getBoundingClientRect();
      return {
        slot: card.classList.contains("card-slot"),
        width: rect.width,
        height: rect.height,
        ratio: rect.height / rect.width,
      };
    });
    const widths = cards.map((card) => card.width);
    const heights = cards.map((card) => card.height);
    row.textContent = "";
    modal.classList.add("hidden");
    return {
      cards,
      widthSpread: Math.max(...widths) - Math.min(...widths),
      heightSpread: Math.max(...heights) - Math.min(...heights),
    };
  });
  return geometry;
}

async function auditDesktopSettlementLayout(page, viewport, variant) {
  await page.setViewportSize(viewport);
  await page.evaluate(({ variant }) => {
    const modal = document.getElementById("hand-settle-modal");
    const writeCards = (selector, cards) => {
      const row = modal.querySelector(selector);
      row.textContent = "";
      cards.forEach(([rank, suit]) => {
        const card = document.createElement("div");
        card.className = `card${"♥♦".includes(suit) ? " red" : ""}`;
        const rankNode = document.createElement("strong");
        const suitNode = document.createElement("span");
        rankNode.textContent = rank;
        suitNode.textContent = suit;
        card.append(rankNode, suitNode);
        row.appendChild(card);
      });
    };
    writeCards("#settle-community", [
      ["5", "♠"], ["K", "♥"], ["10", "♦"], ["5", "♣"], ["7", "♠"],
    ]);
    writeCards("#settle-self-cards", [["3", "♣"], ["7", "♥"]]);
    writeCards("#settle-opp-cards", [["6", "♦"], ["J", "♠"]]);
    modal.querySelector("#settle-verdict").textContent = "胜利";
    modal.querySelector("#settle-detail").textContent = "你赢得本手，筹码与能量已经完成结算";
    modal.querySelector("#settle-self-label").textContent = "PLAYER1";
    modal.querySelector("#settle-opp-label").textContent = "超限AI";
    modal.querySelector("#settle-self-hand").textContent = "两对";
    modal.querySelector("#settle-opp-hand").textContent = "一对";
    modal.querySelector("#settle-hand-name").textContent = "你：两对 ｜ 超限AI：一对";
    const ledger = modal.querySelector("#settle-chip-ledger");
    const steps = modal.querySelector("#settle-chip-steps");
    const lines = variant === "rich"
      ? [
          "底池 1650",
          "标准收益 +825",
          "标准筹码转移 825",
          "牌型奖励 +25",
          "血战倍率 ×2",
          "防守修正 −50",
          "协议奖励不触发",
          "未匹配投入退回 100",
          "技能结算差额 +25",
          "最终筹码转移 900",
        ]
      : ["底池 1650", "标准收益 +825", "标准筹码转移 825", "最终筹码转移 825"];
    steps.textContent = "";
    lines.forEach((line) => {
      const item = document.createElement("li");
      item.textContent = line;
      steps.appendChild(item);
    });
    ledger.classList.remove("hidden");
    modal.querySelector("#settle-chip-total").textContent = variant === "rich"
      ? "本手实际获得 900"
      : "本手实际获得 825";
    const energy = modal.querySelector("#settle-opp-energy");
    energy.classList.remove("hidden");
    energy.textContent = "对方剩余能量 3";
    modal.querySelector("#settle-next").textContent = "下一手即将开始";
    modal.classList.remove("hidden");
  }, { variant });
  await page.waitForTimeout(120);
  const audit = await page.evaluate(({ width, height, variant }) => {
    const modal = document.getElementById("hand-settle-modal");
    const panel = modal.querySelector(".settle-panel");
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect() || null;
    const insideViewport = (bounds) => Boolean(
      bounds &&
      bounds.width > 1 &&
      bounds.height > 1 &&
      bounds.left >= -1 &&
      bounds.top >= -1 &&
      bounds.right <= innerWidth + 1 &&
      bounds.bottom <= innerHeight + 1
    );
    const overlaps = (left, right) => Boolean(
      left &&
      right &&
      left.right > right.left + 1 &&
      left.left < right.right - 1 &&
      left.bottom > right.top + 1 &&
      left.top < right.bottom - 1
    );
    const panelBounds = panel.getBoundingClientRect();
    const modalStyle = getComputedStyle(modal);
    const panelStyle = getComputedStyle(panel);
    const header = rect("#hand-settle-modal .settle-header");
    const detail = rect("#settle-detail");
    const board = rect("#settle-board");
    const outcome = rect("#hand-settle-modal .settle-outcome");
    const community = [...document.querySelectorAll("#settle-community .card")]
      .map((card) => card.getBoundingClientRect());
    const selfCards = [...document.querySelectorAll("#settle-self-cards .card")]
      .map((card) => card.getBoundingClientRect());
    const opponentCards = [...document.querySelectorAll("#settle-opp-cards .card")]
      .map((card) => card.getBoundingClientRect());
    const allCards = [...community, ...selfCards, ...opponentCards];
    const widths = allCards.map((card) => card.width);
    const selfHand = rect("#hand-settle-modal .settle-hand:first-child");
    const opponentHand = rect("#hand-settle-modal .settle-hand:last-child");
    const steps = document.getElementById("settle-chip-steps");
    const energy = rect("#settle-opp-energy");
    const next = rect("#settle-next");
    const coreSelectors = [
      "#settle-community",
      "#settle-self-cards",
      "#settle-opp-cards",
      "#settle-self-hand",
      "#settle-opp-hand",
      "#settle-hand-name",
      "#settle-chip-ledger",
      "#settle-chip-total",
      "#settle-opp-energy",
      "#settle-next",
    ];
    const sections = [header, detail, board, outcome];
    return {
      requested: { width, height },
      actual: { width: innerWidth, height: innerHeight },
      variant,
      panelInsideViewport: insideViewport(panelBounds),
      coreInsideViewport: coreSelectors.every((selector) => insideViewport(rect(selector))),
      noPageScroll:
        document.documentElement.scrollHeight <= innerHeight + 1 &&
        document.body.scrollHeight <= innerHeight + 1,
      modalDoesNotScroll:
        modalStyle.overflowY === "hidden" &&
        modal.scrollHeight <= modal.clientHeight + 1,
      panelDoesNotScrollOrClip:
        panelStyle.overflowY === "hidden" &&
        panel.scrollHeight <= panel.clientHeight + 1,
      sectionsDoNotOverlap: sections.every((section, index) => (
        index === 0 || !overlaps(sections[index - 1], section)
      )),
      communityOneRow:
        community.length === 5 &&
        new Set(community.map((card) => Math.round(card.top))).size === 1,
      handsSideBySide: Boolean(
        selfHand &&
        opponentHand &&
        Math.abs(selfHand.top - opponentHand.top) <= 1 &&
        selfHand.right <= opponentHand.left + 1
      ),
      completeCardSet: community.length === 5 && selfCards.length === 2 && opponentCards.length === 2,
      cardSizeDelta: widths.length
        ? (Math.max(...widths) - Math.min(...widths)) / Math.max(...widths)
        : 1,
      cardsInsideViewport: allCards.every(insideViewport),
      metaOnOneRow: Boolean(
        energy &&
        next &&
        Math.abs((energy.top + energy.bottom) / 2 - (next.top + next.bottom) / 2) <= 1
      ),
      ledgerScrollsInternally: steps.scrollHeight > steps.clientHeight + 1,
      ledgerInsidePanel: Boolean(
        rect("#settle-chip-ledger") &&
        rect("#settle-chip-ledger").left >= panelBounds.left - 1 &&
        rect("#settle-chip-ledger").right <= panelBounds.right + 1 &&
        rect("#settle-chip-ledger").bottom <= panelBounds.bottom + 1
      ),
    };
  }, { ...viewport, variant });
  await page.evaluate(() => {
    const modal = document.getElementById("hand-settle-modal");
    modal.classList.add("hidden");
    ["settle-community", "settle-self-cards", "settle-opp-cards", "settle-chip-steps"]
      .forEach((id) => {
        const node = document.getElementById(id);
        if (node) node.textContent = "";
      });
    document.getElementById("settle-chip-ledger")?.classList.add("hidden");
    document.getElementById("settle-opp-energy")?.classList.add("hidden");
  });
  return audit;
}

async function clickProtocol(page, gameMode, skillMode, action) {
  await page.evaluate(
    ({ gameMode, skillMode, action }) => {
      const card = document.querySelector(
        `.protocol-card[data-game-mode="${gameMode}"][data-skill-mode="${skillMode}"]`
      );
      const btn = card?.querySelector(`.protocol-btn[data-room-action="${action}"]`);
      if (!btn) throw new Error("protocol button missing");
      btn.click();
    },
    { gameMode, skillMode, action }
  );
}

const SKILL_LAB_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1600, height: 900 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
  { width: 320, height: 700 },
];

async function setSkillLabSelection(page, skillIds) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.click("#btn-clear-loadout");
  for (const skillId of skillIds) {
    await page.click(`#skill-lab-catalog .skill-card[data-skill-id="${skillId}"] .skill-card-select`);
  }
}

async function auditSkillLabViewport(page, viewport, expectedSelectionCount, expectedLoad) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(50);
  return page.evaluate(({ viewport, expectedSelectionCount, expectedLoad }) => {
    const screen = document.getElementById("screen-skill-lab");
    const header = screen?.querySelector(".skill-lab-bar");
    const catalog = document.getElementById("skill-lab-catalog");
    const footer = screen?.querySelector(".skill-lab-actions");
    const clear = document.getElementById("btn-clear-loadout");
    const save = document.getElementById("btn-save-loadout");
    const settings = document.getElementById("btn-settings");
    const filters = document.getElementById("skill-lab-filters");
    const loadMeter = document.getElementById("lab-load-meter");
    const cards = [...(catalog?.querySelectorAll(".skill-card") || [])];
    const selected = cards.filter((card) => card.classList.contains("selected"));
    const rect = (node) => node?.getBoundingClientRect() || null;
    const screenRect = rect(screen);
    const headerRect = rect(header);
    const catalogRect = rect(catalog);
    const footerRect = rect(footer);
    const clearRect = rect(clear);
    const saveRect = rect(save);
    const firstRect = rect(cards[0]);
    const firstRowCount = firstRect
      ? cards.filter((card) => Math.abs(card.getBoundingClientRect().top - firstRect.top) < 1).length
      : 0;
    const firstCopy = cards[0]?.querySelector(".skill-card-copy");
    const copyStyle = firstCopy ? getComputedStyle(firstCopy) : null;
    const loadMeterNumbers = String(loadMeter?.textContent || "").match(/\d+/g) || [];
    const loadUsed = Number(
      loadMeterNumbers.length >= 3
        ? loadMeterNumbers[loadMeterNumbers.length - 2]
        : (loadMeterNumbers[0] || 0)
    );
    const fullyVisibleCards = catalogRect
      ? cards.filter((card) => {
          const bounds = card.getBoundingClientRect();
          return bounds.top >= catalogRect.top - 1 && bounds.bottom <= catalogRect.bottom + 1;
        }).length
      : 0;
    const insideViewport = (bounds) => Boolean(
      bounds &&
      bounds.left >= -1 &&
      bounds.top >= -1 &&
      bounds.right <= innerWidth + 1 &&
      bounds.bottom <= innerHeight + 1
    );
    const overlaps = (left, right) => Boolean(
      left && right &&
      left.left < right.right - 1 &&
      left.right > right.left + 1 &&
      left.top < right.bottom - 1 &&
      left.bottom > right.top + 1
    );
    const selectedHeadersClear = selected.every((card) => {
      const nameRect = rect(card.querySelector("strong"));
      const markRect = rect(card.querySelector(".skill-selection-mark"));
      const zoomRect = rect(card.querySelector(".skill-zoom-button"));
      return !overlaps(nameRect, markRect) && !overlaps(nameRect, zoomRect) && !overlaps(markRect, zoomRect);
    });
    return {
      viewport,
      expectedSelectionCount,
      expectedLoad,
      selectedCount: selected.length,
      loadUsed,
      pageOverflowX: document.documentElement.scrollWidth > innerWidth + 1,
      pageOverflowY: document.documentElement.scrollHeight > innerHeight + 1,
      screenInsideViewport: insideViewport(screenRect),
      headerInsideViewport: insideViewport(headerRect),
      footerInsideViewport: insideViewport(footerRect),
      settingsHidden: !settings || getComputedStyle(settings).display === "none",
      catalogOwnsScroll: Boolean(
        catalog &&
        getComputedStyle(catalog).overflowY === "auto" &&
        catalog.scrollHeight > catalog.clientHeight + 1
      ),
      catalogNoHorizontalOverflow: Boolean(catalog && catalog.scrollWidth <= catalog.clientWidth + 1),
      filterNoPageOverflow: Boolean(filters && filters.getBoundingClientRect().right <= innerWidth + 1),
      columns: firstRowCount,
      cardHeight: firstRect?.height || 0,
      copyLineClamp: copyStyle?.webkitLineClamp || "",
      fullyVisibleCards,
      selectedHeadersClear,
      cardTextContained: cards.every((card) => card.scrollWidth <= card.clientWidth + 1),
      footerSameRow: Boolean(
        clearRect && saveRect && Math.abs(clearRect.top - saveRect.top) < 1 && Math.abs(clearRect.height - saveRect.height) < 1
      ),
      footerButtonsReachable: Boolean(
        clearRect && saveRect &&
        clearRect.height >= (viewport.width <= 640 ? 43.5 : 39.5) &&
        saveRect.height >= (viewport.width <= 640 ? 43.5 : 39.5)
      ),
      saveDisabled: Boolean(save?.disabled),
    };
  }, { viewport, expectedSelectionCount, expectedLoad });
}

async function main() {
  const browser = await chromium.launch(playwrightRuntime.chromiumLaunchOptions({ headless: true }));
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const report = [];

  await page.goto(BASE + "/?verify=1", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("overlimit_quickstart_v1", "seen");
    localStorage.setItem(
      "abyss_skill_loadout_v2",
      JSON.stringify(["DEEP_BREATH", "RECYCLE"])
    );
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const lobbyFields = await page.evaluate(() => ({
    hasCreatePwd: Boolean(document.getElementById("input-password")),
    hasJoinPwd: Boolean(document.getElementById("input-join-password")),
    hasName: Boolean(document.getElementById("input-name")),
    hasRoom: Boolean(document.getElementById("input-room")),
    hasPwdModal: Boolean(document.getElementById("join-password-modal")),
    hasWaitPwd: Boolean(document.getElementById("input-wait-password")),
    status: document.getElementById("skill-prep-status")?.textContent || "",
  }));
  const lobbyViewports = [];
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1638, height: 1024 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 900, height: 700 },
    { width: 390, height: 844 },
    { width: 375, height: 667 },
    { width: 360, height: 640 },
    { width: 320, height: 568 },
  ]) {
    lobbyViewports.push(await auditLobbyViewport(page, viewport));
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const settlementCards = await auditSettlementCardGeometry(page);
  const settlementLayouts = [];
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1600, height: 900 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
  ]) {
    settlementLayouts.push(await auditDesktopSettlementLayout(page, viewport, "normal"));
    settlementLayouts.push(await auditDesktopSettlementLayout(page, viewport, "rich"));
  }
  report.push({
    step: "lobby",
    lobbyFields,
    lobbyFit: await fit(page),
    lobbyViewports,
    settlementCards,
    settlementLayouts,
  });

  await page.click("#btn-open-skill-lab");
  await page.waitForSelector("#screen-skill-lab.active", { timeout: 5000 });
  await page.waitForTimeout(700);
  const lab = await page.evaluate(() => ({
    active: document.getElementById("screen-skill-lab")?.classList.contains("active"),
    cards: document.querySelectorAll("#skill-lab-catalog .skill-card").length,
  }));
  const skillLabLayouts = [];
  for (const scenario of [
    { name: "empty", ids: [], load: 0 },
    { name: "two", ids: ["DEEP_BREATH", "PROBE"], load: 2 },
    { name: "four-max-load", ids: ["NULLIFICATION", "ALERT", "DEEP_BREATH", "PROBE"], load: 8 },
  ]) {
    await setSkillLabSelection(page, scenario.ids);
    for (const viewport of SKILL_LAB_VIEWPORTS) {
      skillLabLayouts.push({
        scenario: scenario.name,
        ...(await auditSkillLabViewport(page, viewport, scenario.ids.length, scenario.load)),
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  report.push({ step: "skill-lab", lab, labFit: await fit(page), skillLabLayouts });
  await page.click("#btn-back-skill-lab");
  await page.waitForSelector("#screen-auth.active");

  await clickProtocol(page, "standard", "off", "create");
  await page.waitForSelector("#screen-wait.active", { timeout: 8000 });
  await page.waitForTimeout(500);
  const wait = await page.evaluate(() => ({
    active: document.getElementById("screen-wait")?.classList.contains("active"),
    roomId: document.getElementById("wait-room-id")?.textContent || "",
    pwdPanelHidden: document.getElementById("wait-password-panel")?.classList.contains("hidden"),
    pwdStatus: document.getElementById("wait-password-status")?.textContent || "",
  }));
  report.push({ step: "wait-create", wait, waitFit: await fit(page) });

  if (!wait.pwdPanelHidden) {
    await page.fill("#input-wait-password", "secret1");
    await page.click("#btn-set-room-password");
    await page.waitForTimeout(500);
    report.push({
      step: "set-password",
      pwdUpdated: await page.evaluate(
        () => document.getElementById("wait-password-status")?.textContent || ""
      ),
    });
  }

  await page.click("#btn-back-wait");
  await page.waitForSelector("#screen-auth.active");
  await page.waitForTimeout(300);

  await clickProtocol(page, "standard", "abyss", "solo");
  await page.waitForSelector("#screen-game.active", { timeout: 10000 });
  await page.waitForTimeout(1200);
  const game = await page.evaluate(() => ({
    active: document.getElementById("screen-game")?.classList.contains("active"),
    phase: document.getElementById("phase-text")?.textContent || "",
    skills: [...document.querySelectorAll("#skill-bar .skill-use-btn")].map((b) =>
      b.textContent.trim()
    ),
    energy: document.getElementById("self-energy")?.textContent || "",
    hudHidden: document.getElementById("skill-hud")?.classList.contains("hidden"),
  }));
  report.push({ step: "abyss-solo", game, gameFit: await fit(page) });

  const acted = await page.evaluate(() => {
    const check = document.querySelector('[data-action="check"]');
    const call = document.querySelector('[data-action="call"]');
    if (check && !check.disabled) {
      check.click();
      return "check";
    }
    if (call && !call.disabled) {
      call.click();
      return "call";
    }
    return "none";
  });
  await page.waitForTimeout(1200);
  report.push({
    step: "action",
    acted,
    after: await page.evaluate(() => ({
      phase: document.getElementById("phase-text")?.textContent || "",
      pot: document.getElementById("pot-value")?.textContent || "",
      skillLog: document.getElementById("skill-log")?.textContent || "",
    })),
  });

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.addInitScript(() => localStorage.setItem("overlimit_quickstart_v1", "seen"));
  await mobilePage.goto(BASE + "/?mobile=1", { waitUntil: "networkidle" });
  await mobilePage.waitForSelector("#screen-auth.active", { timeout: 5000 });
  await mobilePage.waitForTimeout(400);
  report.push({ step: "mobile-lobby", mobileLobby: await fit(mobilePage) });
  await mobileContext.close();

  await browser.close();

  const failures = [];
  const lobbyFit = report.find((r) => r.step === "lobby")?.lobbyFit;
  const lobbyViewportAudits = report.find((r) => r.step === "lobby")?.lobbyViewports || [];
  const settlementCardAudit = report.find((r) => r.step === "lobby")?.settlementCards;
  const settlementLayoutAudits = report.find((r) => r.step === "lobby")?.settlementLayouts || [];
  const labFit = report.find((r) => r.step === "skill-lab")?.labFit;
  const skillLabLayoutAudits = report.find((r) => r.step === "skill-lab")?.skillLabLayouts || [];
  const waitFit = report.find((r) => r.step === "wait-create")?.waitFit;
  const gameFit = report.find((r) => r.step === "abyss-solo")?.gameFit;
  const mobileLobby = report.find((r) => r.step === "mobile-lobby")?.mobileLobby;
  const setPwd = report.find((r) => r.step === "set-password");
  const actionAudit = report.find((r) => r.step === "action");
  if (actionAudit) {
    // Bot loadouts may validly resolve only secret skills in this short random
    // window. Keep public observation as diagnostics, not a pass/fail gate.
    actionAudit.botPublicSkillObserved = /深渊AI.*血战/.test(
      actionAudit.after?.skillLog || ""
    );
  }

  if (lobbyFields.hasCreatePwd || lobbyFields.hasJoinPwd) failures.push("lobby still has password fields");
  if (!lobbyFields.hasName || !lobbyFields.hasRoom || !lobbyFields.hasPwdModal || !lobbyFields.hasWaitPwd) {
    failures.push("missing required lobby/wait/modal controls");
  }
  if (lobbyFit?.needsScroll) failures.push("lobby scrolls");
  if (
    lobbyViewportAudits.some(
      (audit) =>
        audit.pageScrolls ||
        !audit.authInsideViewport ||
        audit.clipped.length ||
        audit.overlaps.length ||
        audit.protocolTailGap == null ||
        audit.protocolTailGap > 24
    )
  ) {
    failures.push("lobby does not fit cleanly across required viewports");
  }
  if (
    settlementCardAudit?.cards?.length !== 5 ||
    settlementCardAudit.widthSpread > 0.75 ||
    settlementCardAudit.heightSpread > 0.75 ||
    settlementCardAudit.cards.some((card) => Math.abs(card.ratio - 1.42) > 0.03)
  ) {
    failures.push("settlement cards and empty slots do not share one geometry");
  }
  if (
    settlementLayoutAudits.length !== 8 ||
    settlementLayoutAudits.some((audit) => (
      !audit.panelInsideViewport ||
      !audit.coreInsideViewport ||
      !audit.noPageScroll ||
      !audit.modalDoesNotScroll ||
      !audit.panelDoesNotScrollOrClip ||
      !audit.sectionsDoNotOverlap ||
      !audit.communityOneRow ||
      !audit.handsSideBySide ||
      !audit.completeCardSet ||
      audit.cardSizeDelta > 0.1 ||
      !audit.cardsInsideViewport ||
      !audit.metaOnOneRow ||
      !audit.ledgerInsidePanel ||
      (audit.variant === "rich" && !audit.ledgerScrollsInternally)
    ))
  ) {
    failures.push("desktop settlement does not fit one screen across required viewports");
  }
  if (!lab.active || lab.cards < 8) failures.push("skill lab incomplete");
  if (labFit?.needsScroll && labFit?.bodyOverflow !== "hidden") failures.push("skill lab page scrolls");
  if (
    skillLabLayoutAudits.length !== SKILL_LAB_VIEWPORTS.length * 3 ||
    skillLabLayoutAudits.some((audit) => {
      const expectedColumns = audit.viewport.width >= 1200 ? 4 : 1;
      const minimumVisible = audit.viewport.width >= 1200 ? 12 : 3;
      return (
        audit.selectedCount !== audit.expectedSelectionCount ||
        audit.loadUsed !== audit.expectedLoad ||
        audit.pageOverflowX ||
        audit.pageOverflowY ||
        !audit.screenInsideViewport ||
        !audit.headerInsideViewport ||
        !audit.footerInsideViewport ||
        !audit.settingsHidden ||
        !audit.catalogOwnsScroll ||
        !audit.catalogNoHorizontalOverflow ||
        !audit.filterNoPageOverflow ||
        audit.columns !== expectedColumns ||
        audit.cardHeight < 100 ||
        audit.cardHeight > 112 ||
        audit.copyLineClamp !== "2" ||
        audit.fullyVisibleCards < minimumVisible ||
        !audit.selectedHeadersClear ||
        !audit.cardTextContained ||
        !audit.footerSameRow ||
        !audit.footerButtonsReachable ||
        audit.saveDisabled !== (audit.expectedSelectionCount === 0)
      );
    })
  ) {
    failures.push("skill lab compact layout regressed across selections or required viewports");
  }
  if (!wait.active || !wait.roomId || wait.roomId === "——") failures.push("wait screen failed");
  if (waitFit?.needsScroll) failures.push("wait screen scrolls");
  if (setPwd && setPwd.pwdUpdated !== "已设置") failures.push("password set failed");
  if (!game.active || game.hudHidden || game.skills.length < 2) failures.push("abyss solo skills missing");
  if (gameFit?.needsScroll || gameFit?.dockVisible === false) failures.push("game screen overflow");
  if (mobileLobby?.active !== "screen-auth") failures.push("mobile lobby assertion ran on the wrong screen");
  if (mobileLobby?.needsScroll) failures.push("mobile lobby scrolls");

  console.log(JSON.stringify({ ok: failures.length === 0, failures, report }, null, 2));
  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
