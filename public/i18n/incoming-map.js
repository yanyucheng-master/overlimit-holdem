(function initIncomingI18n(root) {
  "use strict";

  const SKILL_ZH_TO_ID = Object.freeze({
    深呼吸: "DEEP_BREATH",
    回收利用: "RECYCLE",
    恐吓: "INTIMIDATION",
    绝境: "DESPERATION",
    血战: "BLOOD_BATTLE",
    防守: "DEFENSE",
    感知: "PERCEPTION",
    情报: "INTEL_ONE",
    绝密: "TOP_SECRET",
    反制: "COUNTER",
    公平: "FAIRNESS",
    千术: "CHEAT",
    绝路: "DEAD_END",
    灵视: "CLAIRVOYANCE",
    零化: "NULLIFICATION",
    强运: "FORTUNE",
    天命: "DESTINY",
    贷款: "LOAN",
    警觉: "ALERT",
    撤退: "RETREAT",
    重启: "RESTART",
    试探: "PROBE",
    伪装: "DISGUISE",
    终局: "ENDGAME",
    "协议--高牌": "PROTOCOL_HIGH_CARD",
    "协议--对子": "PROTOCOL_PAIR",
    "协议--两对": "PROTOCOL_TWO_PAIR",
    "协议--三条": "PROTOCOL_TRIPS",
    "协议--顺子": "PROTOCOL_STRAIGHT",
    "协议--同花": "PROTOCOL_FLUSH",
    "协议--葫芦": "PROTOCOL_FULL_HOUSE",
    "协议--四条": "PROTOCOL_QUADS",
    "协议--同花顺": "PROTOCOL_STRAIGHT_FLUSH",
  });

  const HAND_ZH_TO_KEY = Object.freeze({
    皇家同花顺: "hand.royalFlush",
    同花顺: "hand.straightFlush",
    四条: "hand.fourOfAKind",
    葫芦: "hand.fullHouse",
    同花: "hand.flush",
    顺子: "hand.straight",
    三条: "hand.threeOfAKind",
    两对: "hand.twoPair",
    一对: "hand.onePair",
    高牌: "hand.highCard",
    口袋对子: "hand.pocketPair",
    未成牌: "hand.none",
    无效牌型: "hand.invalid",
    已弃牌: "hand.folded",
    "已弃牌（未成牌）": "hand.foldedNone",
    未公开: "hand.hidden",
  });

  const EXACT = Object.freeze({
    "超限AI": "game.botName",
    "请求过于频繁，请稍后再试": "server.rateLimited",
    "匹配服务不可用": "server.matchUnavailable",
    "玩家标识缺失": "server.missingPlayer",
    "当前未加入房间": "server.notInRoom",
    "牌局状态异常，请等待同步后重试": "server.badState",
    "重连凭证错误": "server.reconnectToken",
    "密码错误": "server.passwordWrong",
    "房间密码错误": "server.roomPasswordWrong",
    "房间不存在": "server.roomMissing",
    "房间已满": "server.roomFull",
    "房间已满或不存在": "server.roomFullOrMissing",
    "匹配房间不可设置密码": "server.matchNoPassword",
    "对局开始后不能修改密码": "server.passwordLocked",
    "仅房主可设置房间密码": "server.hostOnlyPassword",
    "房间密码长度不能超过 16": "server.passwordTooLong",
    "匹配房间不可直接加入": "server.matchNoDirectJoin",
    "技能局需双方有效构筑": "server.needBothLoadouts",
    "技能局需有效构筑": "server.needLoadout",
    "当前房间未启用技能": "server.skillsOff",
    "未知技能": "server.unknownSkill",
    "该技能为自动触发技能": "server.passiveSkill",
    "未装备该技能": "server.notEquipped",
    "当前牌局阶段不可发动技能": "server.skillPhase",
    "本手技能已被封锁": "server.skillsLocked",
    "负能量时除强运外不能发动技能": "server.negativeEnergy",
    "当前已退出本手": "server.exitedHand",
    "当前阶段不可发动该技能": "server.skillStreet",
    "该技能只能在你的下注行动回合发动": "server.needActionTurn",
    "本手已使用过该技能": "server.handUsed",
    "本场使用次数已耗尽": "server.gameUsed",
    "能量不足": "server.noEnergy",
    "已有玩家本手投入超过 500，恐吓不能发动": "server.intimidationCap",
    "对手底牌尚未就绪": "server.holeNotReady",
    "底牌尚未就绪": "server.holeNotReady",
    "请选择有效的未来公共牌位置": "server.needFutureBoard",
    "请选择有效的情报目标": "server.needIntelTarget",
    "请选择有效的公共牌位置": "server.needBoardSeat",
    "该公共牌位置当前不可指定": "server.boardSeatUnavailable",
    "请选择精确有效的目标牌": "server.needExactCard",
    "未来河牌位置已经不存在": "server.noRiverSeat",
    "请选择自己的一张底牌": "server.needOwnHole",
    "请选择千术交换目标": "server.needCheatTarget",
    "请选择有效的对手底牌位置": "server.needOppHoleSeat",
    "请选择已经公开的公共牌": "server.needPublicBoard",
    "当前没有下一张有效发牌": "server.noNextDeal",
    "当前没有可暗抽的非顶部牌": "server.noHiddenDraw",
    "请选择筹码贷款或能量贷款": "server.needLoanMode",
    "贷款债务尚未清偿": "server.loanDebt",
    "贷款信用已违约": "server.loanDefault",
    "本手筹码贷款已用完": "server.chipLoanCap",
    "本手能量贷款已用完": "server.energyLoanCap",
    "本手贷款次数已用完": "loan.handCap",
    "信用受限：本手贷款只能发动 1 次": "loan.restricted",
    "已有未偿还的能量贷款": "server.energyLoanOpen",
    "不能重复装备同名技能": "server.duplicateSkill",
    "当前技能构筑包含重复或无效技能，请重新配置。": "lab.duplicate",
    "技能构筑格式错误": "server.badLoadout",
    "对局开始后不能更换技能": "server.loadoutLocked",
    "不支持的游戏模式": "server.badGameMode",
    "不支持的技能模式": "server.badSkillMode",
    "当前不可行动": "server.cannotAct",
    "当前阶段不可行动": "server.cannotActStreet",
    "未轮到你行动": "server.notYourTurn",
    "未知操作": "server.unknownAction",
    "加注金额必须是整数": "server.raiseInt",
    "加注必须高于当前注": "server.raiseHigher",
    "当前不可全押": "server.cannotAllIn",
    "当前不可过牌": "server.cannotCheck",
    "当前投入上限下不可全押": "server.allInCapped",
    "对手已All In，不能再加注": "server.oppAllInNoRaise",
    "对手已All In，只能过牌或等待": "server.oppAllInWait",
    "恐吓生效期间不能弃牌": "server.noFoldIntimidation",
    "终局已关闭下注": "server.bettingClosed",
    "终局已经发动": "server.endgameDone",
    "当前不是你的终局响应窗口": "server.notEndgameWindow",
    "当前只能响应终局": "server.endgameOnly",
    "请选择发动终局或放弃": "server.chooseEndgame",
    "该操作已过期，请按当前回合重新选择": "server.staleAction",
    "该技能请求已过期，请按当前回合重新发动": "server.staleSkill",
    "当前不可再来一局": "server.noRematch",
    "离线玩家不能确认再来一局": "server.offlineRematch",
    "本轮匹配已结束，是否继续匹配？": "server.matchRoundEnded",
    "匹配冲突，已重新排队": "server.matchConflict",
    "对手已离线，已重新进入匹配": "server.oppOfflineRematch",
    "邀请不存在或已失效": "server.inviteMissing",
    "邀请已失效": "server.inviteExpired",
    "无权接受该邀请": "server.cannotAcceptInvite",
    "无权拒绝该邀请": "server.cannotDeclineInvite",
    "玩家标识格式错误": "server.badPlayerId",
    "房间号格式错误": "server.badRoomId",
    "牌局状态异常，本局已中止": "server.aborted",
    "牌局状态异常，无法继续": "server.cannotContinue",
    "牌局动作处理异常": "server.actionFault",
    "牌局席位状态异常，请重新进入房间": "server.seatFault",
    "房间经济状态异常，已中止后续结算": "server.economyFault",
    "秘密技能已结算": "skill.secretDone",
    "牌序受到一次隐秘干预": "feed.hiddenDeck",
    "防守已秘密生效。": "private.defenseArmed",
    "反制已秘密布置。": "private.counterArmed",
    "撤退已秘密生效。": "private.retreatArmed",
    "试探已秘密生效。": "private.probeArmed",
    "情报目标受到绝密保护，本次读取失败。": "private.intelBlocked",
    "千术目标受到绝密保护，交换失败。": "private.cheatBlocked",
    "零化底牌受到绝密保护，技能失败。": "private.nullifyBlocked",
    "零化已秘密锁定对手一张底牌。": "private.nullifyHole",
    "天命失败：未来河牌位置已不存在。": "private.destinyNoRiver",
    "天命失败：目标牌当前在对手底牌中。": "private.destinyOppHole",
    "天命失败：目标牌已离开可控制牌堆。": "private.destinyGone",
    "你隐约察觉到对手似乎进行了秘密行动。": "private.alertHint",
    "高爆协议已启用": "fx.protocolEnabled",
    "实时连接尚未恢复，请稍候再试": "connection.offlineAction",
    "自动重连失败，请刷新页面": "connection.reconnectFailed",
    "你的连接超时，本局判负": "connection.timeoutLoss",
    "对手断线超时，你获得胜利": "connection.opponentTimeoutWin",
    "网络连接已中断，正在尝试恢复牌局…": "connection.lost",
    "连接已恢复，正在同步服务器状态": "connection.restored",
    "无法连接服务器，正在重试…": "connection.retrying",
    "正在恢复实时连接…": "connection.recovering",
  });

  function skillName(id, t) {
    const key = "skills." + id + ".name";
    return t(key);
  }

  function localizeQuotedSkills(text, t) {
    return String(text || "").replace(/「([^」]+)」/g, (match, name) => {
      const id = SKILL_ZH_TO_ID[name];
      return id ? skillName(id, t) : match;
    });
  }

  function localizeHands(text, t) {
    let next = String(text || "");
    Object.keys(HAND_ZH_TO_KEY).sort((a, b) => b.length - a.length).forEach((zh) => {
      next = next.split(zh).join(t(HAND_ZH_TO_KEY[zh]));
    });
    return next;
  }

  function localize(text, t, locale) {
    if (text == null) return "";
    const raw = String(text);
    if (!raw) return "";
    if (locale !== "en-US") return raw;
    if (Object.prototype.hasOwnProperty.call(EXACT, raw)) return t(EXACT[raw]);
    if (Object.prototype.hasOwnProperty.call(HAND_ZH_TO_KEY, raw)) return t(HAND_ZH_TO_KEY[raw]);
    if (Object.prototype.hasOwnProperty.call(SKILL_ZH_TO_ID, raw)) return skillName(SKILL_ZH_TO_ID[raw], t);

    let m;
    if ((m = raw.match(/^(.+) 发动「(.+)」$/))) return t("feed.launched", { name: m[1], skill: localizeQuotedSkills("「" + m[2] + "」", t) });
    if ((m = raw.match(/^(.+) 发动「恐吓」：本手禁止弃牌，投入上限 500$/))) return t("feed.intimidation", { name: m[1] });
    if ((m = raw.match(/^(.+) 发动「贷款」：取得 (.+) 筹码$/))) return t("feed.loanChips", { name: m[1], amount: m[2] });
    if ((m = raw.match(/^(.+) 发动「贷款」并完成斩杀$/))) return t("feed.loanKill", { name: m[1] });
    if ((m = raw.match(/^(.+) 宣告「血战」$/))) return t("feed.bloodBattle", { name: m[1] });
    if ((m = raw.match(/^(.+) 宣告「公平」：清除未完成技能状态，并封锁后续技能与结束恢复$/))) return t("feed.fairness", { name: m[1] });
    if ((m = raw.match(/^(.+) 宣告「终局」：进入处决$/))) return t("feed.endgameKill", { name: m[1] });
    if ((m = raw.match(/^(.+) 宣告「终局」$/))) return t("feed.endgame", { name: m[1] });
    if ((m = raw.match(/^(.+) 进入绝境$/))) return t("feed.desperation", { name: m[1] });
    if ((m = raw.match(/^(.+) 触发「回收利用」$/))) return t("feed.recycle", { name: m[1] });
    if ((m = raw.match(/^(.+) 的「绝密」生效$/))) return t("feed.topSecret", { name: m[1] });
    if ((m = raw.match(/^(.+) 的「反制」生效$/))) return t("feed.counter", { name: m[1] });
    if ((m = raw.match(/^(.+) 的技能被反制$/))) return t("feed.wasCountered", { name: m[1] });
    if ((m = raw.match(/^(.+) 的技能结算失败$/))) return t("feed.skillFailed", { name: m[1] });
    if ((m = raw.match(/^(.+) 以「千术」交换一张公共牌$/))) return t("feed.cheatBoard", { name: m[1] });
    if ((m = raw.match(/^(.+) 的「防守」将公开损失减半$/))) return t("feed.defenseHalf", { name: m[1] });
    if ((m = raw.match(/^(.+) 发动「贷款」$/))) return t("feed.loan", { name: m[1] });
    if ((m = raw.match(/^情报：对手的一张底牌是 (.+)$/))) return t("private.intelHole", { card: m[1] });
    if ((m = raw.match(/^情报：第 (.+) 张公共牌将是 (.+)$/))) return t("private.intelBoard", { n: m[1], card: m[2] });
    if ((m = raw.match(/^千术完成：你的底牌变为 (.+)$/))) return t("private.cheatDone", { card: m[1] });
    if ((m = raw.match(/^零化已秘密锁定第 (.+) 张公共牌。$/))) return t("private.nullifyBoard", { n: m[1] });
    if ((m = raw.match(/^天命已锁定：(.+) 将成为河牌。$/))) return t("private.destinyLock", { card: m[1] });
    if ((m = raw.match(/^能量贷款：立即获得 (.+) 点能量，下一手结束偿还 (.+)。$/))) return t("private.energyLoan", { gained: m[1], repay: m[2] });
    if ((m = raw.match(/^深呼吸：恢复 (.+) 点能量。$/))) return t("private.deepBreath", { amount: m[1] });
    if ((m = raw.match(/^强运：额外恢复 1 能量。$/))) return t("private.fortuneEnergy");
    if ((m = raw.match(/^重启完成：(.+)$/))) return t("private.restart", { detail: m[1] });
    if ((m = raw.match(/^感知 · (.+)$/))) return t("perception.prefix", { message: localize(m[1], t, locale) });
    if ((m = raw.match(/^玩家 (.+) 连接中断$/))) return t("toast.playerDropped", { playerId: m[1] });
    if ((m = raw.match(/^玩家 (.+) 已离开$/))) return t("toast.playerLeft", { playerId: m[1] });
    if ((m = raw.match(/^最小加注到 (.+)$/))) return t("action.minValue", { value: m[1] });

    return localizeHands(localizeQuotedSkills(raw, t), t);
  }

  const api = { localize, SKILL_ZH_TO_ID, HAND_ZH_TO_KEY, EXACT };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OverlimitIncomingI18n = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
