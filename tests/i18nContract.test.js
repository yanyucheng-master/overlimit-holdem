const path = require("path");

require(path.join(__dirname, "..", "public", "i18n", "index.js"));
const incoming = require(path.join(__dirname, "..", "public", "i18n", "incoming-map.js"));

const i18n = globalThis.OverlimitI18n;
const SKILL_IDS = [
  "DEEP_BREATH", "RECYCLE", "INTIMIDATION", "DESPERATION", "BLOOD_BATTLE", "DEFENSE",
  "PERCEPTION", "INTEL_ONE", "TOP_SECRET", "COUNTER", "FAIRNESS", "CHEAT", "DEAD_END",
  "CLAIRVOYANCE", "NULLIFICATION", "FORTUNE", "DESTINY", "LOAN", "ALERT", "RETREAT",
  "RESTART", "PROBE", "DISGUISE", "ENDGAME",
];
const PROTOCOL_IDS = [
  "PROTOCOL_HIGH_CARD", "PROTOCOL_PAIR", "PROTOCOL_TWO_PAIR", "PROTOCOL_TRIPS",
  "PROTOCOL_STRAIGHT", "PROTOCOL_FLUSH", "PROTOCOL_FULL_HOUSE", "PROTOCOL_QUADS",
  "PROTOCOL_STRAIGHT_FLUSH",
];
const HAND_KEYS = [
  "hand.highCard", "hand.onePair", "hand.twoPair", "hand.threeOfAKind", "hand.straight",
  "hand.flush", "hand.fullHouse", "hand.fourOfAKind", "hand.straightFlush", "hand.royalFlush",
];
const ACTION_EN = {
  "action.fold": "FOLD",
  "action.check": "CHECK",
  "action.call": "CALL",
  "action.bet": "BET",
  "action.raise": "RAISE",
  "action.raiseTo": "Raise To",
  "action.allin": "ALL IN",
};
const PLACEHOLDER = /TODO|TRANSLATE|TBD|English text here/i;
const HAN = /[\u4e00-\u9fff]/;
const ALLOWED_EN_HAN_KEYS = new Set(["a11y.languageZh"]);

describe("i18n contract", () => {
  test("zh-CN 与 en-US key 集一致", () => {
    const zh = i18n.catalogKeys("zh-CN");
    const en = i18n.catalogKeys("en-US");
    expect(zh.length).toBeGreaterThan(200);
    expect(en.sort()).toEqual(zh.sort());
  });

  test("English keys 非空且无占位", () => {
    i18n.setLocale("en-US", { silent: true });
    i18n.resetMissingKeys();
    const empties = [];
    const placeholders = [];
    i18n.catalogKeys("en-US").forEach((key) => {
      const value = i18n.t(key);
      if (!String(value || "").trim()) empties.push(key);
      if (PLACEHOLDER.test(value)) placeholders.push(key);
    });
    expect(empties).toEqual([]);
    expect(placeholders).toEqual([]);
  });

  test("English catalog 无非预期中文", () => {
    i18n.setLocale("en-US", { silent: true });
    const leaked = i18n.catalogKeys("en-US").filter((key) => {
      if (ALLOWED_EN_HAN_KEYS.has(key)) return false;
      return HAN.test(i18n.t(key));
    });
    expect(leaked).toEqual([]);
  });

  test("24 主体技能英文三层文案完整", () => {
    i18n.setLocale("en-US", { silent: true });
    SKILL_IDS.forEach((id) => {
      ["name", "catalogSummary", "shortDescription", "expertDescription"].forEach((field) => {
        const key = `skills.${id}.${field}`;
        const value = i18n.t(key);
        expect(value).not.toMatch(/^\[missing:/);
        expect(String(value).trim().length).toBeGreaterThan(0);
        expect(HAN.test(value)).toBe(false);
      });
    });
  });

  test("9 协议英文三层文案完整", () => {
    i18n.setLocale("en-US", { silent: true });
    PROTOCOL_IDS.forEach((id) => {
      ["name", "catalogSummary", "shortDescription", "expertDescription"].forEach((field) => {
        const value = i18n.t(`skills.${id}.${field}`);
        expect(value).not.toMatch(/^\[missing:/);
        expect(String(value).trim().length).toBeGreaterThan(0);
        expect(HAN.test(value)).toBe(false);
      });
    });
  });

  test("Hand Rank 与 Poker Action 锁定术语", () => {
    i18n.setLocale("en-US", { silent: true });
    expect(i18n.t("hand.royalFlush")).toBe("Royal Flush");
    expect(i18n.t("hand.straightFlush")).toBe("Straight Flush");
    expect(i18n.t("hand.fourOfAKind")).toBe("Four of a Kind");
    expect(i18n.t("hand.fullHouse")).toBe("Full House");
    expect(i18n.t("hand.flush")).toBe("Flush");
    expect(i18n.t("hand.straight")).toBe("Straight");
    expect(i18n.t("hand.threeOfAKind")).toBe("Three of a Kind");
    expect(i18n.t("hand.twoPair")).toBe("Two Pair");
    expect(i18n.t("hand.onePair")).toBe("One Pair");
    expect(i18n.t("hand.highCard")).toBe("High Card");
    HAND_KEYS.forEach((key) => expect(i18n.t(key)).not.toMatch(/Quads|Trips|Boat/));
    Object.entries(ACTION_EN).forEach(([key, expected]) => {
      expect(i18n.t(key)).toBe(expected);
    });
    expect(i18n.t("phase.pre_flop")).toBe("PRE-FLOP");
    expect(i18n.t("phase.flop")).toBe("FLOP");
    expect(i18n.t("phase.turn")).toBe("TURN");
    expect(i18n.t("phase.river")).toBe("RIVER");
    expect(i18n.t("phase.showdown")).toBe("SHOWDOWN");
    expect(i18n.t("lab.filterEdit")).toBe("Card Manipulation");
    expect(i18n.t("intel.title")).toBe("Loadout Intel");
    expect(i18n.t("intel.feedTitle")).toBe("Tactical Feed");
    expect(i18n.t("modal.loadoutLine")).toBe("{name}: {skills}");
    expect(i18n.t("game.botName")).toBe("Overlimit AI");
  });

  test("Energy 恢复与退款语义保持区分", () => {
    i18n.setLocale("en-US", { silent: true });
    expect(i18n.t("skills.DEEP_BREATH.catalogSummary")).toContain("recover 2 Energy");
    expect(i18n.t("skills.DEEP_BREATH.expertDescription")).toContain("pending recovery");
    expect(i18n.t("skills.DESPERATION.shortDescription")).toContain("recovers 1 extra Energy");
    expect(i18n.t("skills.FORTUNE.shortDescription")).toContain("recover 1 Energy");
    expect(i18n.t("skills.FAIRNESS.shortDescription")).toContain("Energy recovery is cancelled");
    expect(i18n.t("skills.RECYCLE.shortDescription")).toContain("refunded at half price");
    expect(i18n.t("skills.COUNTER.expertDescription")).toContain("refund 1 Energy");
  });

  test("incoming message 规则保留玩家昵称并只本地化系统术语", () => {
    i18n.setLocale("en-US", { silent: true });
    const t = i18n.t.bind(i18n);
    expect(incoming.localize("玩家 同花王 连接中断", t, "en-US"))
      .toBe("Player 同花王 disconnected");
    expect(incoming.localize("同花王 发动「深呼吸」", t, "en-US"))
      .toBe("同花王 launched Deep Breath");
    expect(incoming.localize("同花王 宣告「公平」：清除未完成技能状态，并封锁后续技能与结束恢复", t, "en-US"))
      .toBe("同花王 declared Fairness: unfinished skill states cleared; later skills and end-of-hand recovery locked");
    expect(incoming.localize("同花王 发动「深呼吸」", t, "zh-CN"))
      .toBe("同花王 发动「深呼吸」");
  });

  test("浏览器首选语言检测", () => {
    expect(i18n.detectBrowserLanguage(["zh-CN"])).toBe("zh-CN");
    expect(i18n.detectBrowserLanguage(["zh"])).toBe("zh-CN");
    expect(i18n.detectBrowserLanguage(["zh-SG"])).toBe("zh-CN");
    expect(i18n.detectBrowserLanguage(["en-US"])).toBe("en-US");
    expect(i18n.detectBrowserLanguage(["ja-JP"])).toBe("en-US");
    expect(i18n.detectBrowserLanguage(["zh-TW"])).toBe("en-US");
    expect(i18n.detectBrowserLanguage([])).toBe("zh-CN");
  });

  test("缺失 key 可诊断", () => {
    i18n.setLocale("en-US", { silent: true });
    i18n.resetMissingKeys();
    expect(i18n.t("definitely.missing.key")).toBe("[missing:definitely.missing.key]");
    expect(i18n.missingKeys).toContain("definitely.missing.key");
  });
});
