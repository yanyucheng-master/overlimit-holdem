const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "..", "public");

function collectMatches(text, regex) {
  const values = [];
  for (const match of text.matchAll(regex)) values.push(match[1]);
  return values;
}

describe("frontend DOM contract", () => {
  const html = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
  const client = fs.readFileSync(path.join(publicDir, "client.js"), "utf8");
  const rulebookData = fs.readFileSync(path.join(publicDir, "rulebook-data.js"), "utf8");
  const style = fs.readFileSync(path.join(publicDir, "style.css"), "utf8");
  const salon = fs.readFileSync(path.join(publicDir, "salon.css"), "utf8");
  const tableV2 = fs.readFileSync(path.join(publicDir, "table-v2.css"), "utf8");
  const skillEffects = fs.readFileSync(path.join(publicDir, "skill-effects.css"), "utf8");
  const skillFxProfiles = fs.readFileSync(path.join(publicDir, "skill-fx-profiles.js"), "utf8");
  const skillFxManager = fs.readFileSync(path.join(publicDir, "skill-fx-manager.js"), "utf8");

  test("HTML id 唯一", () => {
    const ids = collectMatches(html, /\bid=["']([^"']+)["']/g);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(duplicates).toEqual([]);
  });

  test("client.js 的 getElementById 引用均存在", () => {
    const htmlIds = new Set(collectMatches(html, /\bid=["']([^"']+)["']/g));
    const referenced = new Set(
      collectMatches(client, /(?:byId|getElementById)\(["']([^"']+)["']\)/g)
    );
    const missing = [...referenced].filter((id) => !htmlIds.has(id));
    expect(referenced.size).toBeGreaterThan(100);
    expect(missing).toEqual([]);
  });

  test("所有静态按钮均声明 type 且不存在按钮嵌套", () => {
    const buttonTags = [...html.matchAll(/<button\b[^>]*>/g)].map((match) => match[0]);
    expect(buttonTags.length).toBeGreaterThan(30);
    expect(buttonTags.filter((tag) => !/\btype=["']button["']/.test(tag))).toEqual([]);

    let depth = 0;
    let nested = false;
    for (const match of html.matchAll(/<\/?button\b[^>]*>/g)) {
      if (match[0].startsWith("</")) depth -= 1;
      else {
        if (depth > 0) nested = true;
        depth += 1;
      }
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
    expect(nested).toBe(false);
    expect(html).toContain('id="btn-back-game" class="button button-ghost back-button" aria-label="离开牌桌"');
    expect(html).toContain('class="history-restore-icon" width="16" height="16"');
    expect(html).toContain('<span class="history-label">历史</span>');
    expect(tableV2).toContain(".salon-ui #screen-game .table-tools-left");
    expect(tableV2).toContain("flex-direction: row;");
    expect(tableV2).toContain(".salon-ui #screen-game .history-restore-icon");
    expect(client).toContain('el.btnHandHistory.removeAttribute("data-count")');
  });

  test("技能放大、四技能栏与单击加注控件已接入", () => {
    expect(html).toContain('id="skill-preview-modal"');
    expect(html).toContain('id="btn-close-skill-preview"');
    expect(html).toContain('id="btn-raise-options"');
    expect(html).toContain('id="deck-fx-anchor"');
    expect(client).toContain('className = "skill-zoom-button"');
    expect(client).toContain('className = "skill-selection-mark"');
    expect(client).toContain('className = "skill-slot is-"');
    expect(client).toContain('beginRealtimeRequest("action"');
    expect(client).toContain('beginRealtimeRequest("room"');
    expect(client).toContain('beginRealtimeRequest("skill"');
    expect(client).toContain("socket.connected &&");
  });

  test("V6 牌桌保持三栏竞技结构、单层操作区与隐私安全的对手构筑入口", () => {
    const boardStageStart = html.indexOf('<section class="table-center"');
    const boardStageEnd = html.indexOf('</section>', boardStageStart) + '</section>'.length;
    const boardStageMarkup = html.slice(boardStageStart, boardStageEnd);
    expect(boardStageStart).toBeGreaterThan(-1);
    expect(boardStageEnd).toBeGreaterThan(boardStageStart);
    expect(boardStageMarkup).toContain('class="board-stage-line"');
    expect(boardStageMarkup).toContain('id="phase-text"');
    expect(boardStageMarkup).toContain('id="pot-core"');
    expect(boardStageMarkup).toContain('id="action-countdown"');
    expect(boardStageMarkup).toContain('id="community-cards"');
    expect(boardStageMarkup).toContain('id="deck-fx-anchor"');
    expect(boardStageMarkup).toContain('id="deck-stack"');
    expect(boardStageMarkup).toContain('id="skill-fx-stage-anchor"');
    expect(boardStageMarkup).toContain('id="action-log" class="action-log sr-only"');
    expect(boardStageMarkup).toContain('class="turn-status"');
    expect(boardStageMarkup).not.toContain('id="skill-hud"');
    expect(boardStageMarkup.indexOf('id="pot-core"')).toBeLessThan(
      boardStageMarkup.indexOf('id="community-cards"')
    );
    expect(boardStageMarkup.indexOf('id="action-countdown"')).toBeLessThan(
      boardStageMarkup.indexOf('id="community-cards"')
    );

    const telemetryStart = html.indexOf('id="table-telemetry"');
    const telemetryEnd = html.indexOf('</aside>', telemetryStart) + '</aside>'.length;
    const telemetryMarkup = html.slice(telemetryStart, telemetryEnd);
    expect(telemetryEnd).toBeGreaterThan(telemetryStart);
    expect(telemetryMarkup).toContain('id="skill-broadcast"');
    expect(telemetryMarkup).toContain('id="skill-log"');
    expect(telemetryMarkup).not.toContain('id="pot-core"');
    expect(telemetryMarkup).not.toContain('id="phase-text"');
    expect(telemetryMarkup).not.toContain('id="deck-stack"');
    expect(telemetryMarkup).not.toContain('LIVE');

    const ownSkillsStart = html.indexOf('id="own-skill-arsenal"');
    const ownSkillsEnd = html.indexOf('</aside>', ownSkillsStart) + '</aside>'.length;
    const ownSkillsMarkup = html.slice(ownSkillsStart, ownSkillsEnd);
    expect(ownSkillsMarkup).toContain('id="skill-hud"');
    expect(ownSkillsMarkup).toContain('id="skill-bar"');

    const actionDockStart = html.indexOf('<section class="action-dock"');
    const actionDockEnd = html.indexOf('</section>', actionDockStart) + '</section>'.length;
    const actionDockMarkup = html.slice(actionDockStart, actionDockEnd);
    expect(actionDockMarkup).toContain('class="poker-actions-layer"');
    expect(actionDockMarkup).not.toContain('id="skill-hud"');
    expect(actionDockMarkup).not.toContain('class="turn-status"');

    const opponentSummaryStart = html.indexOf('id="btn-toggle-opponent-intel"');
    const opponentSummaryEnd = html.indexOf('</button>', opponentSummaryStart) + '</button>'.length;
    const opponentSummaryMarkup = html.slice(opponentSummaryStart, opponentSummaryEnd);
    expect(opponentSummaryMarkup).toContain('aria-controls="opponent-skill-field"');
    expect(opponentSummaryMarkup).toContain('id="opponent-intel-slots"');
    expect(opponentSummaryMarkup).toContain('class="opponent-intel-tags is-empty"');
    expect(opponentSummaryMarkup).not.toContain('class="is-unknown"');
    expect(opponentSummaryMarkup).not.toMatch(/<i\b/);
    expect(html).toContain('id="opponent-intel-live"');
    const intelClusterStart = html.indexOf('<div class="opponent-intel-cluster">');
    const intelClusterEnd = html.indexOf('</div>', html.indexOf('id="btn-mark-opponent-skills"'));
    const intelClusterMarkup = html.slice(intelClusterStart, intelClusterEnd);
    expect(intelClusterMarkup.indexOf('id="btn-toggle-opponent-intel"')).toBeLessThan(
      intelClusterMarkup.indexOf('id="opponent-skill-field"')
    );
    expect(intelClusterMarkup).toContain('id="opponent-skill-bar"');
    expect(intelClusterMarkup).toContain('id="btn-mark-opponent-skills"');
    expect(html).toContain('id="btn-close-opponent-intel"');
    expect(html).toContain('id="btn-close-skill-feed"');

    expect(client).toContain('el.skillBar.dataset.count = String(equippedSkillIds.length)');
    expect(client).toContain('function syncOpponentIntelSummary(opponent, known, suspected)');
    const summaryFunction = client.slice(
      client.indexOf('function syncOpponentIntelSummary'),
      client.indexOf('function renderOpponentSkillIntel')
    );
    expect(summaryFunction).not.toMatch(/\d+\s*\/\s*4/);
    expect(summaryFunction).not.toContain('负载');
    expect(summaryFunction).toContain('...confirmedIds.map');
    expect(summaryFunction).toContain('...suspectedIds.map');
    expect(summaryFunction).toContain('.filter((skillId) => !confirmedIds.includes(skillId))');
    expect(summaryFunction).toContain('"opponent-intel-tag is-" + entry.certainty');
    expect(summaryFunction).toContain('confirmed ? "✓" : "?"');
    expect(client).toContain('function syncOpponentIntelToggleAccessibility(accessibleDetails = null)');
    expect(client).toContain('(expanded ? "关闭详情。" : "打开详情。")');
    expect(tableV2).toContain('.salon-ui #screen-game .opponent-intel-tags');
    expect(tableV2).toContain('.salon-ui #screen-game .opponent-intel-tag.is-confirmed');
    expect(tableV2).toContain('.salon-ui #screen-game .opponent-intel-tag.is-suspected');
    expect(tableV2).toContain(
      'body.pro-player-mode.salon-ui #screen-game .action-button .action-en'
    );
    expect(tableV2).toContain('TABLE V7 / ADAPTIVE TACTICAL TRAY');
    expect(tableV2).toContain('--table-skill-tray: clamp(220px, 15vw, 238px)');
    expect(tableV2).toContain('--table-right-rail: clamp(184px, 13vw, 214px)');
    expect(tableV2).toContain('grid-template-columns: minmax(470px, 1fr) var(--table-right-rail)');
    expect(tableV2).toContain('.salon-ui #screen-game .own-skill-arsenal');
    expect(tableV2).toMatch(/TABLE V7[\s\S]*?\.own-skill-arsenal\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?bottom:\s*10px;[\s\S]*?width:\s*var\(--table-skill-tray\);[\s\S]*?height:\s*auto;/);
    expect(tableV2).toMatch(/TABLE V7[\s\S]*?\.skill-bar\[data-count="4"\][\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);[\s\S]*?grid-auto-rows:\s*40px;/);
    expect(tableV2).toContain('.salon-ui #screen-game .opponent-intel-summary');
    expect(tableV2).toContain('grid-template-columns: minmax(0, 1fr) minmax(224px, 0.36fr)');
    expect(tableV2).toContain('.skill-bar[data-count="3"]');
    expect(tableV2).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(tableV2).toContain('.skill-bar[data-count="4"]');
    expect(tableV2).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(tableV2).toContain('--card-w: var(--table-card-w)');
    expect(tableV2).not.toMatch(/\.self-cards \.card:nth-child\(2\)[^{]*\{[^}]*margin-left:\s*-/s);
    expect(tableV2).toContain('bottom: calc(100% + 8px)');
    const releaseResponsiveStart = tableV2.indexOf('/* Portrait and narrow tablets');
    const intelDropdownStart = tableV2.lastIndexOf(
      '.salon-ui #screen-game .opponent-skill-field {',
      releaseResponsiveStart
    );
    const intelDropdownStyles = tableV2.slice(
      intelDropdownStart,
      tableV2.indexOf('.salon-ui #screen-game .table-telemetry {', intelDropdownStart)
    );
    expect(intelDropdownStyles).toContain('top: calc(100% + 7px)');
    expect(intelDropdownStyles).toContain('clip-path: inset(0 0 100% 0 round 13px)');
    expect(intelDropdownStyles).toContain('transform: translateY(-8px)');
    expect(intelDropdownStyles).not.toContain('translateX');
    expect(client).toContain('if (el.opponentSkillField.contains(event.target)) return');
    expect(client).toContain('if (el.btnToggleOpponentIntel?.contains(event.target)) return');
    expect(client).toContain('opponentEnergy: el.opponentEnergy?.closest(".skill-energy-row") || el.opponentArea');

    expect(html).toContain('class="settle-community-block"');
    expect(html).toContain('class="settle-outcome"');
    expect(html).toContain('class="settle-meta-row"');
    expect(style).toContain('SETTLEMENT V2 / DESKTOP ONE-SCREEN REVIEW');
    expect(style).toMatch(/\.hand-settle-modal\s*\{[\s\S]*?overflow:\s*hidden;/);
    expect(style).toMatch(/\.hand-settle-modal \.settle-panel\s*\{[\s\S]*?max-height:\s*calc\(100dvh[\s\S]*?overflow:\s*hidden;/);
    expect(style).toMatch(/\.hand-settle-modal \.settle-hands-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,/);
    expect(style).toMatch(/\.hand-settle-modal \.settle-chip-steps\s*\{[\s\S]*?overflow-y:\s*auto;[\s\S]*?scrollbar-gutter:\s*stable;/);
  });

  test("对手技能标记弹窗使用固定壳层和独立滚动列表", () => {
    expect(tableV2).toContain('#skill-choice-modal[data-variant="dossier"] .skill-command-panel');
    expect(tableV2).toContain('grid-template-rows: 56px 52px minmax(0, 1fr) 62px');
    expect(tableV2).toContain('height: min(760px, calc(100dvh - 28px))');
    expect(tableV2).toContain('#skill-choice-modal[data-variant="dossier"] .skill-choice-body');
    expect(tableV2).toContain('scrollbar-gutter: stable');
    expect(tableV2).toContain('grid-auto-rows: 58px');
    expect(tableV2).toContain('grid-auto-rows: 52px');
    expect(client).toContain('el.skillChoiceBody.scrollTop = 0');
    expect(client).toContain('focus({ preventScroll: true })');
  });

  test("storage failures and modal focus are handled defensively", () => {
    expect(client).toContain("function safeStorageGet");
    expect(client).toContain("function safeStorageSet");
    expect(client).not.toMatch(/\b(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)/);
    expect(client).toContain("mainContent.inert = hasModal");
    expect(client).toContain('event.key !== "Tab"');
  });

  test("四页快速入门复用大厅、规则与技能入口，实机素材均可放大查看", () => {
    const start = html.indexOf('id="quickstart-modal"');
    const end = html.indexOf('id="rules-handbook-modal"', start);
    const markup = html.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect((markup.match(/data-quickstart-page="[1-4]"/g) || []).length).toBe(4);
    expect((markup.match(/data-quickstart-zoom(?:\s|>)/g) || []).length).toBe(5);
    expect((markup.match(/aria-label="放大查看/g) || []).length).toBe(5);
    expect(html).toContain('id="btn-open-quickstart"');
    expect(html).toContain('id="quickstart-page-status"');
    expect(markup).toContain('id="quickstart-image-modal"');
    expect(markup).toContain('id="quickstart-image-expanded"');
    expect(markup).toContain('id="btn-close-quickstart-image"');
    expect(client).toContain('quickStart: "overlimit_quickstart_v1"');
    expect(client).toContain("function renderQuickStartPage");
    expect(client).toContain("function releaseQuickStartPointer");
    expect(client).toContain("function openQuickStartImage");
    expect(client).toContain("function closeQuickStartImage");
    expect(client).toContain('top === el.quickStartImageModal');
    expect(client).not.toContain("!hasPendingReconnect && !state.quickStartSeen");
    expect(client).toContain('el.btnOpenQuickStart?.addEventListener("click", () => openQuickStart({ page: 1 }))');
    expect(client).toContain('openRulesFromQuickStart("rule-hands")');
    expect(client).toContain("openSkillsFromQuickStart");
    expect(salon).toContain(".salon-ui .quickstart-entry");
    expect(salon).toContain(".salon-ui .quickstart-track");
    expect(salon).toContain(".salon-ui .quickstart-shot[data-quickstart-zoom]");
    expect(salon).toContain(".salon-ui .quickstart-image-layer");
    expect(salon).toContain(".salon-ui .quickstart-image-stage img");
    expect(salon).toContain("touch-action: pan-y");
    [
      "shot-01-preflop.png",
      "shot-02-flop.png",
      "shot-03-showdown.png",
      "shot-04-loadout.png",
      "shot-05-skill-table.png",
    ].forEach((filename) => {
      const asset = path.join(publicDir, "assets", "tutorial", filename);
      expect(fs.existsSync(asset)).toBe(true);
      expect(fs.statSync(asset).size).toBeGreaterThan(20_000);
      expect(markup).toContain(`./assets/tutorial/${filename}`);
    });
    ["+25", "+50", "+75", "+100", "+250", "+400", "+500"].forEach((bonus) => {
      expect(markup).toContain(`<strong>${bonus}</strong>`);
    });
  });

  test("完整规则 V1.0 接入结构化数据、全文搜索与移动目录", () => {
    const dataScript = html.indexOf('<script src="./rulebook-data.js"></script>');
    const clientScript = html.indexOf('<script src="./client.js"></script>');
    expect(dataScript).toBeGreaterThan(-1);
    expect(dataScript).toBeLessThan(clientScript);
    [
      "rules-search-results",
      "rules-search-results-list",
      "btn-rules-menu",
      "rules-toc-backdrop",
      "btn-rules-top",
    ].forEach((id) => expect(html).toContain(`id="${id}"`));
    expect(client).toContain("function renderRulesHandbook");
    expect(client).toContain("function rebuildRulesSearchIndex");
    expect(client).toContain("function scrollToRulesTarget");
    expect(client).toContain("function highlightRulesTarget");
    expect(client).toContain("function setRulesTocOpen");
    expect(client).toContain('target.querySelector(".rules-chapter-heading")');
    expect(client).toContain("highlight: Boolean(query)");
    expect(client).toContain("RULEBOOK_DATA.sections.length !== 18");
    expect(rulebookData).toContain('id: "rule-skills"');
    expect(rulebookData).toContain('id: "rule-protocols"');
    expect(salon).toContain(".salon-ui .rules-search-results-list");
    expect(salon).toContain(".salon-ui .rules-toc.is-open");
    expect(salon).toContain(".salon-ui .rules-table-wrap");
    expect(salon).toContain(".salon-ui .rules-skill-index");
    expect(salon).toContain('html.has-modal-layer');
  });

  test("按钮装饰层不拦截邻近按钮点击", () => {
    const decorativeRule = style.match(/\.button::before,\s*\.action-button::before\s*\{[^}]+\}/s)?.[0];
    expect(decorativeRule).toBeTruthy();
    expect(decorativeRule).toContain("pointer-events: none");
    expect(decorativeRule).toContain("transform: none");
    expect(decorativeRule).not.toMatch(/translateX\(/);
    expect(salon).toMatch(/\.salon-ui \.button::before,\s*\.salon-ui \.action-button::before\s*\{[^}]*content:\s*none/s);
  });

  test("已发出的公共牌不会继承空牌位样式", () => {
    const renderCardRow = client.match(
      /function renderCardRow\(container, cards, options\) \{[\s\S]+?\n\}/
    )?.[0];
    expect(renderCardRow).toBeTruthy();
    expect(renderCardRow).toContain("slot: false");
    expect(renderCardRow).toContain("slot: Boolean(settings.slot)");
  });

  test("ALL IN 逻辑计时与视觉时长保持一致", () => {
    expect(client).toContain("const ALL_IN_EFFECT_MS = 1800");
    expect(style).toContain("--allin-duration: 1800ms");
  });

  test("ALL IN 提供四种可持久化样式且演出文字仅保留 ALL IN", () => {
    const styles = ["abyss", "verdict", "royal", "singularity"];
    expect(client).toContain(
      'const ALL_IN_STYLES = Object.freeze(["abyss", "verdict", "royal", "singularity"])'
    );
    expect(client).toContain("ALL_IN_STYLES.includes(stored.allInStyle)");
    expect(client).toContain("document.documentElement.dataset.allinStyle");
    expect(client).toContain("el.flash.dataset.allinStyle = state.settings.allInStyle");
    styles.forEach((styleId) => {
      expect(html).toContain(`name="allin-style" value="${styleId}"`);
      expect(style).toContain(`.flash-overlay[data-allin-style="${styleId}"]`);
    });

    const effectStart = html.lastIndexOf("<div", html.indexOf('id="flash-allin"'));
    const effectEnd = html.lastIndexOf("<div", html.indexOf('id="river-overload"'));
    const effectMarkup = html.slice(effectStart, effectEnd);
    const visibleText = effectMarkup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    expect(visibleText).toBe("ALL IN");
    expect(effectMarkup).not.toMatch(/[\u3400-\u9fff]/);
  });

  test("手机端 ALL IN 触觉反馈具备兼容降级", () => {
    expect(client).toContain("const ALL_IN_VIBRATION_PATTERN");
    expect(client).toContain("function playAllInHaptics()");
    expect(client).toContain('typeof navigator.vibrate !== "function"');
    expect(client).toContain("state.settings.reduceMotion");
    expect(client).toContain("navigator.vibrate(pattern)");
    expect(client).toContain("playFxHaptics(ALL_IN_VIBRATION_PATTERN)");
    expect(client).toMatch(/playAllInHaptics\(\);\s+playTone\("allin"\)/);
    expect(client).toContain("if (!preview) playAllInHaptics()");
  });

  test("V2 精确目标选择已替代旧式反制弹窗", () => {
    expect(html).not.toContain('id="skill-reaction-modal"');
    expect(client).not.toContain('socket.emit("skill:counter:skip"');
    expect(client).toContain("function openSkillTargetOptions");
    ["INTEL_ONE", "CHEAT", "NULLIFICATION", "DESTINY"].forEach((skillId) => {
      expect(client).toContain(`skillId === "${skillId}"`);
    });
    expect(html).toContain('id="btn-cancel-skill-target"');
    expect(client).toContain("function beginNullifyTargeting");
    expect(client).toContain('type: "NULLIFY_BOARD"');
    expect(client).not.toContain('variant: "nullification"');
    expect(client).toContain("is-nullify-targeting");
    expect(tableV2).toContain("is-nullify-targeting");
    expect(html).toContain('id="opponent-skill-field"');
    expect(html).toContain('id="btn-mark-opponent-skills"');
    expect(html).toContain('id="skill-choice-filters"');
    expect(client).toContain('el.skillChoiceSelection.textContent = "剩余可用 "');
    expect(client).toContain('skillMatchesLabFilter(skill, activeFilter)');
    expect(client).toContain("function renderOpponentSkillIntel()");
    expect(client).toContain('skillLoadout: "abyss_skill_loadout_v2"');
    expect(html).toContain('id="self-energy"');
    expect(html).toContain('id="self-energy-cap"');
    expect(html).toContain('id="opponent-visible-energy"');
    expect(html).toContain('id="settle-opp-energy"');
    expect(html).toContain('id="settle-chip-ledger"');
    expect(html).toContain('id="btn-hand-history"');
    expect(html).toContain('id="hand-history-modal"');
    expect(client).toContain("function renderSettleChipLedger");
    expect(client).toContain("牌型奖励");
    expect(client).toContain("handRankBonusValue");
    expect(client).toContain("只结算 50% 筹码");
    expect(client).toContain("function openHandHistoryModal()");
    expect(html).toContain('id="opponent-energy-pop"');
    expect(html).toContain('id="btn-energy-pop-confirm"');
    expect(html).toContain('id="btn-energy-pop-close"');
    expect(client).toContain("function getOpponentVisibleEnergy()");
    expect(client).toContain("function getKnownOpponentEnergy()");
    expect(client).toContain("function getConfirmedInferredEnergy()");
    expect(client).toContain("function confirmOpponentEnergyInference()");
    expect(client).toContain("function clearConfirmedInferredEnergy()");
    expect(client).toMatch(/function getOpponentVisibleEnergy\(\) \{\s*return getPublicOpponentEnergy\(\);\s*\}/);
    expect(client).toContain("state.confirmedInferredEnergy");
    expect(client).toContain("is-inferred");
    expect(client).toContain("clearConfirmedInferredEnergy()");
    expect(style).toContain("#opponent-visible-energy.is-inferred");
    expect(style).toContain("#opponent-energy.is-inferred");
    expect(client).toContain("state.knownOpponentEnergy");
    expect(client).toContain("function showHandSettlementReview");
    expect(client).toContain("function fillHandSettleModal");
    expect(client).not.toContain("Math.max(0, Number(opponent");
    expect(html).toContain('id="btn-skill-preview-novice"');
    expect(html).toContain('id="btn-skill-preview-expert"');
    expect(html).toContain(">简易</button>");
    expect(html).toContain(">详细</button>");
    expect(html).not.toContain(">新手</button>");
    expect(html).not.toContain(">专家规则</button>");
    expect(client).toContain("shortDescription");
    expect(client).toContain("skillExpertText");
  });

  test("首发技能特效由数据配置驱动，公开与秘密通道保持隔离", () => {
    expect(html).toContain('id="skill-fx-public"');
    expect(html).toContain('id="skill-fx-secret"');
    expect(html).toContain('id="skill-effect-layer"');
    expect(html).toContain('id="skill-state-layer"');
    expect(html).toContain('id="skill-fx-name"');
    expect(client).toContain("const SKILL_FX_STALE_MS = 2500");
    expect(skillFxManager).toContain("profilesApi.fxDuration");
    expect(skillFxManager).toContain("Math.min(1100, Math.max(700, duration))");
    expect(client).toContain("function announceSkillResolved");
    expect(client).toContain("function announcePrivateSkillResult");
    expect(client).toContain("function getSkillFxManager");
    expect(client).toContain("rememberSkillFxRequest");
    expect(client).toContain("announceNullificationReveals");
    expect(client).toContain("payload.restored");
    expect(html).toContain("SELF ONLY");
    expect(skillEffects).toContain("pointer-events: none");
    expect(skillEffects).toContain('.skill-effect-instance[data-effect="blood"]');
    expect(skillEffects).toContain('[data-fx-motion="reduced"]');
    expect(style).toContain(".skill-fx-public");
    expect(style).toContain(".skill-fx-secret");
    expect(skillFxProfiles).toContain("PROTOCOL_SHOWDOWN_PROFILE");
    expect(skillFxProfiles).toContain('id: "DISGUISE"');
    expect(skillFxProfiles).not.toContain('id: "ENDGAME",');
    expect(skillFxManager).toContain("canRenderSkillFx");
    expect(skillFxManager).toContain("SHAKE_ALLOWLIST");
  });

  test("技能选择随权威回合失效，移动技能抽屉不会穿透或污染无技能局", () => {
    expect(client).toContain("function invalidateSkillChoiceIfStale");
    expect(client).toContain("context.turnId !== (state.turnId || null)");
    expect(client).toContain("pending.type !== \"SKILL_TARGET\" && pending.type !== \"NULLIFY_BOARD\"");
    expect(client).toContain("cancelNullifyTargeting({ restoreFocus: false })");
    expect(client).toContain("closeSkillChoiceModal({ render: false, restoreFocus: false })");
    expect(client).toContain("function syncTableRailAccessibility");
    expect(client).toContain("el.opponentSkillField.inert = intelHidden");
    expect(client).toContain("el.skillBroadcast.inert = feedHidden");
    expect(client).toContain("rememberPublicSkillIntel(payload)");
    expect(html).not.toContain('id="btn-toggle-cards"');
    expect(client).toContain("renderCardRow(el.selfCards, state.myCards");
    expect(client).toContain("function applySkillRuntimeUi()");
    expect(client).toContain("container.dataset.rowSignature === signature");
    expect(tableV2).toContain(".poker-board.skills-disabled .table-rail-tab");
    expect(tableV2).toMatch(/\.poker-board\.skills-disabled \.table-rail-tab\s*\{\s*display:\s*none;/);
    expect(tableV2).toMatch(/\.salon-ui #screen-game \.skill-log\s*\{[^}]*overflow-y:\s*auto/s);
    expect(tableV2).toContain("max-height: none");
  });

  test("技能牌堆审计包含最终牌区守恒检查", () => {
    expect(client).toContain("const finalZoneCodes = [");
    expect(client).toContain("finalZoneCodes.length === 52");
    expect(client).toContain("技能审计发现牌张守恒异常");
  });

  test("设置面板提供安全返回大厅入口且设置触发器无边框", () => {
    expect(html).toContain('id="btn-settings-lobby"');
    expect(html).toContain('id="settings-navigation"');
    expect(client).toContain("el.btnSettingsLobby?.addEventListener");
    const triggerRule = salon.match(/\.salon-ui \.settings-trigger\s*\{[^}]+\}/s)?.[0];
    expect(triggerRule).toBeTruthy();
    expect(triggerRule).toContain("border: 0");
  });

  test("ALL IN 后仍完整展示按牌面分级的结算时长", () => {
    expect(client).toContain("const HAND_SETTLE_MS = 2000");
    expect(client).toContain("settleMs: totalSettleMs");
    expect(client).not.toContain("totalSettleMs - remainingEffectMs");
  });

  test("入口资源与模式选择控件存在", () => {
    expect(html).toContain('<script src="./client.js"></script>');
    expect(html).toContain('name="game-mode" value="standard"');
    expect(html).toContain('name="game-mode" value="overdrive"');
    expect(html).toContain('name="skill-mode" value="off"');
    expect(html).toContain('name="skill-mode" value="abyss"');
    expect(html).toContain('name="protocol" value="standard-off"');
    expect(html).toContain('name="protocol" value="overdrive-off"');
    expect(html).toContain('name="protocol" value="standard-abyss"');
    expect(html).toContain('name="protocol" value="overdrive-abyss"');
    expect(html).toContain('data-room-action="solo"');
    expect(html).toContain('data-room-action="create"');
    expect(html).toContain('id="btn-open-skill-lab"');
    expect(html).toContain('id="btn-open-rules"');
    expect(html).toContain('id="btn-settings-rules"');
    expect(html).toContain('id="rules-handbook-modal"');
    expect(html).toContain('id="rules-search"');
    expect(client).toContain("function openRulesHandbook");
    expect(client).toContain("function filterRulesHandbook");
    expect(html).toContain('id="screen-skill-lab"');
    expect(html).toContain('id="skill-lab-catalog"');
    expect(html).toContain('id="skill-lab-filters"');
    expect(client).toContain("function compareSkillLabOrder");
    expect(client).toContain("function visibleSkillLabCatalog");
    expect(client).toContain('label: "情报"');
    expect(client).toContain('label: "协议"');
    expect(html).toContain('data-raise-preset="max"');
    expect(html).toContain('id="skill-draft-panel"');
    expect(html).toContain('id="skill-hud"');
    expect(html).toContain('id="join-password-modal"');
    expect(html).toContain('id="input-wait-password"');
    expect(html).toContain('id="btn-set-room-password"');
    expect(html).not.toContain('id="input-password"');
    expect(html).not.toContain('id="input-join-password"');
  });

  test("技能播报保留本人私有结果，情报看到的牌写入本机 feed", () => {
    expect(client).toContain("function rememberPrivateSkillFeed");
    expect(client).toContain("skillSelfLog");
    expect(client).toContain("暂无公开技能事件");
    expect(client).not.toContain("等待公开技能事件");
    expect(client).toContain('time + " · 我 · " + skillName');
    expect(client).toContain("rememberPrivateSkillFeed({");
    expect(client).toContain("isGenericSecretSummary");
    expect(tableV2).toContain(".skill-feed-entry.is-self");
    expect(client).toMatch(/applyAuthoritativeSkillLog[\s\S]*state\.skillRecentLog = \[\];[\s\S]*entries\.forEach\(rememberSkillFeedEntry\)/);
    expect(client).not.toMatch(/function applyAuthoritativeSkillLog[\s\S]*skillSelfLog = \[\]/);
  });
});
