const fs = require("fs");
const path = require("path");

const profiles = require("../public/skill-fx-profiles");
const manager = require("../public/skill-fx-manager");

const publicDir = path.join(__dirname, "..", "public");

function createQueuedFxManager() {
  const instance = new manager.SkillFxManager();
  // Keep jobs observable without a DOM. Production pump semantics are covered
  // by the Gallery verification; these tests exercise admission and identity.
  instance.busy = true;
  return instance;
}

describe("launch skill FX system contract", () => {
  test("exactly 23 non-Endgame launch skills have data-driven profiles", () => {
    const entries = Object.values(profiles.SKILL_FX_PROFILES);
    expect(entries).toHaveLength(23);
    expect(entries.map((entry) => entry.id)).not.toContain("ENDGAME");
    expect(profiles.getSkillFxProfile("ENDGAME")).toBeNull();
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(23);
  });

  test("every profile stays inside its declared FX tier budget", () => {
    Object.values(profiles.SKILL_FX_PROFILES).forEach((entry) => {
      const tier = profiles.FX_TIERS[entry.tier];
      expect(tier).toBeDefined();
      expect(tier.defaultMs).toBeGreaterThanOrEqual(tier.min);
      expect(tier.defaultMs).toBeLessThanOrEqual(tier.max);
      expect(profiles.fxDuration(entry, "high", false)).toBeLessThanOrEqual(tier.max);
      expect(profiles.fxDuration(entry, "low", false)).toBeGreaterThanOrEqual(tier.min);
      expect(profiles.fxDuration(entry, "high", true)).toBeLessThanOrEqual(360);
    });
  });

  test("journey readability budgets and the Deep Breath refund budget are data driven", () => {
    const deepBreath = profiles.getSkillFxProfile("DEEP_BREATH");
    const recycle = profiles.getSkillFxProfile("RECYCLE");
    const probe = profiles.getSkillFxProfile("PROBE");
    const alert = profiles.getSkillFxProfile("ALERT");
    expect(deepBreath).toMatchObject({ tier: "FX2", durationMs: 680, presentation: "journey" });
    expect(recycle).toMatchObject({ tier: "FX2", durationMs: 650, presentation: "journey" });
    expect(probe).toMatchObject({ tier: "FX2", durationMs: 680, presentation: "journey" });
    expect(alert).toMatchObject({ tier: "FX1", presentation: "pulse" });
    [deepBreath, recycle, probe].forEach((profile) => {
      expect(profiles.fxDuration(profile, "high", false)).toBeGreaterThanOrEqual(profiles.JOURNEY_MIN_MS);
      expect(profiles.fxDuration(profile, "low", false)).toBeGreaterThanOrEqual(profiles.JOURNEY_MIN_MS);
    });
    expect(profiles.fxDuration(deepBreath, "high", false, "refund")).toBe(820);
    expect(profiles.fxDuration(deepBreath, "low", false, "refund")).toBeGreaterThanOrEqual(750);
    expect(profiles.fxDuration(deepBreath, "high", true, "refund")).toBeLessThanOrEqual(360);
    expect(profiles.fxDuration(alert, "high", false)).toBe(460);
  });

  test("approved launch hierarchy uses the intended tiers and physical anchors", () => {
    expect(profiles.getSkillFxProfile("DEEP_BREATH")).toMatchObject({ tier: "FX2", anchor: "energy", impact: "energy" });
    expect(profiles.getSkillFxProfile("PERCEPTION")).toMatchObject({ tier: "FX2", anchor: "target" });
    expect(profiles.getSkillFxProfile("INTEL_ONE")).toMatchObject({ tier: "FX3", anchor: "target" });
    expect(profiles.getSkillFxProfile("BLOOD_BATTLE")).toMatchObject({ tier: "FX3", anchor: "pot" });
    expect(profiles.getSkillFxProfile("DESTINY")).toMatchObject({ tier: "FX4", anchor: "river" });
    expect(profiles.getSkillFxProfile("RETREAT")).toMatchObject({ tier: "FX3", anchor: "pot" });
    expect(profiles.getSkillFxProfile("INTIMIDATION")).toMatchObject({ tier: "FX4", impact: "board" });
    expect(profiles.getSkillFxProfile("FAIRNESS")).toMatchObject({ tier: "FX4", impact: "board" });
    expect(profiles.getSkillFxProfile("DEAD_END")).toMatchObject({ tier: "FX4", impact: "board" });
  });

  test("secret events are suppressed for ordinary opponents but public results remain visible", () => {
    const deepBreath = profiles.getSkillFxProfile("DEEP_BREATH");
    expect(profiles.canRenderSkillFx({
      skillId: "DEEP_BREATH", audience: "self", disclosure: "self",
    }, deepBreath)).toBe(true);
    expect(profiles.canRenderSkillFx({
      skillId: "DEEP_BREATH", audience: "opponent", disclosure: "secret",
    }, deepBreath)).toBe(false);
    expect(profiles.canRenderSkillFx({
      skillId: "DEFENSE", audience: "opponent", disclosure: "result",
    }, profiles.getSkillFxProfile("DEFENSE"))).toBe(true);
    expect(profiles.canRenderSkillFx({
      skillId: "TOP_SECRET", audience: "opponent", disclosure: "public",
    }, profiles.getSkillFxProfile("TOP_SECRET"))).toBe(true);
    expect(profiles.canRenderSkillFx({
      skillId: "PERCEPTION", audience: "opponent", disclosure: "self", authorized: false,
    }, profiles.getSkillFxProfile("PERCEPTION"))).toBe(false);
  });

  test("all nine protocols resolve to one shared showdown template", () => {
    const protocolIds = [
      "PROTOCOL_HIGH_CARD", "PROTOCOL_PAIR", "PROTOCOL_TWO_PAIR", "PROTOCOL_TRIPS",
      "PROTOCOL_STRAIGHT", "PROTOCOL_FLUSH", "PROTOCOL_FULL_HOUSE", "PROTOCOL_QUADS",
      "PROTOCOL_STRAIGHT_FLUSH",
    ];
    protocolIds.forEach((id) => {
      expect(profiles.isProtocolSkillId(id)).toBe(true);
      expect(profiles.getSkillFxProfile(id)).toBe(profiles.PROTOCOL_SHOWDOWN_PROFILE);
    });
    expect(profiles.PROTOCOL_SHOWDOWN_PROFILE.family).toBe("protocol");
  });

  test("only the three approved skills may request table shake", () => {
    expect([...manager.SHAKE_ALLOWLIST].sort()).toEqual([
      "BLOOD_BATTLE", "DEAD_END", "FAIRNESS",
    ]);
    const requestingShake = Object.values(profiles.SKILL_FX_PROFILES)
      .filter((entry) => entry.shake !== "none")
      .map((entry) => entry.id)
      .sort();
    expect(requestingShake).toEqual([...manager.SHAKE_ALLOWLIST].sort());
  });

  test("dedupe keys prefer server correlation IDs and never depend on translated copy", () => {
    expect(manager.semanticSkillFxKey({ requestId: "req_123", skillId: "CHEAT" })).toBe("req_123");
    expect(manager.semanticSkillFxKey({ resultId: "result_456", skillId: "FORTUNE" })).toBe("result_456");
    const base = {
      handNo: 4, skillId: "ALERT", casterId: "P2", status: "TRIGGERED",
      disclosure: "self", at: 1234, targetKey: "opponent",
    };
    expect(manager.semanticSkillFxKey(base)).toBe(manager.semanticSkillFxKey({
      ...base, safeMessage: "任意玩家文案变化不应改变去重键",
    }));
    expect(manager.semanticSkillFxKey(base)).not.toBe(manager.semanticSkillFxKey({ ...base, handNo: 5 }));
    expect(manager.semanticSkillFxKey(base)).not.toBe(manager.semanticSkillFxKey({ ...base, targetKey: "river" }));
    expect(manager.semanticSkillFxKey(base)).not.toBe(manager.semanticSkillFxKey({ ...base, status: "REFUNDED" }));
  });

  test("FX-DEDUPE-01 one server event public/self delivery copies render once", () => {
    const fx = createQueuedFxManager();
    const shared = { eventId: "evt-shared", skillId: "FAIRNESS", casterId: "P1", handNo: 7 };
    expect(fx.play({ ...shared, audience: "public", disclosure: "public" })).toBe(true);
    expect(fx.play({ ...shared, audience: "self", disclosure: "self" })).toBe(false);
    expect(fx.queue).toHaveLength(1);
  });

  test("FX-DEDUPE-02 different Loan request IDs are both admitted", () => {
    const fx = createQueuedFxManager();
    const base = {
      skillId: "LOAN", casterId: "P1", handNo: 8, audience: "self", disclosure: "self",
      phase: "pre_flop", status: "SUCCESS", targetKey: "chip",
    };
    expect(fx.play({ ...base, requestId: "loan-v2-a" })).toBe(true);
    expect(fx.play({ ...base, requestId: "loan-v2-b" })).toBe(true);
    expect(fx.queue.map((job) => job.event.requestId)).toEqual(["loan-v2-a", "loan-v2-b"]);
  });

  test("FX-DEDUPE-03 the same fallback event shape in different hands is not merged", () => {
    const fx = createQueuedFxManager();
    const base = {
      skillId: "FAIRNESS", casterId: "P1", audience: "public", disclosure: "public",
      phase: "flop", status: "SUCCESS", targetKey: "board", at: 9000,
    };
    expect(fx.play({ ...base, handNo: 9 })).toBe(true);
    expect(fx.play({ ...base, handNo: 10 })).toBe(true);
    expect(fx.queue).toHaveLength(2);
  });

  test("FX-DEDUPE-04 different targets and result stages remain distinct", () => {
    const fx = createQueuedFxManager();
    const base = {
      handNo: 11, skillId: "NULLIFICATION", casterId: "P1", audience: "self", disclosure: "self",
      phase: "turn", at: 9100,
    };
    expect(fx.play({ ...base, targetKey: "board:3", status: "SUCCESS" })).toBe(true);
    expect(fx.play({ ...base, targetKey: "board:4", status: "SUCCESS" })).toBe(true);
    expect(fx.play({ ...base, targetKey: "board:4", status: "REVEALED", resultOnly: true })).toBe(true);
    expect(fx.queue).toHaveLength(3);
  });

  test("FX-DEDUPE-05 queue rejection does not mark an event as played", () => {
    const fx = createQueuedFxManager();
    for (let index = 0; index < manager.MAX_QUEUE_LENGTH; index += 1) {
      expect(fx.play({
        requestId: `queue-${index}`, skillId: "ALERT", casterId: "P1",
        audience: "self", disclosure: "self", handNo: 12,
      })).toBe(true);
    }
    const rejected = {
      requestId: "queue-retry", skillId: "ALERT", casterId: "P1",
      audience: "self", disclosure: "self", handNo: 12,
    };
    expect(fx.play(rejected)).toBe(false);
    expect(fx.dedupeKeys.has("queue-retry")).toBe(false);
    fx.queue.shift();
    expect(fx.play(rejected)).toBe(true);
    expect(fx.dedupeKeys.has("queue-retry")).toBe(true);
  });

  test("CSS implements every registered effect family and reduced-motion fallback", () => {
    const css = fs.readFileSync(path.join(publicDir, "skill-effects.css"), "utf8");
    const families = new Set(Object.values(profiles.SKILL_FX_PROFILES).map((entry) => entry.family));
    families.add(profiles.PROTOCOL_SHOWDOWN_PROFILE.family);
    families.forEach((family) => {
      expect(css).toContain(`[data-effect="${family}"]`);
    });
    expect(css).toContain('[data-fx-motion="reduced"]');
    expect(css).toContain('[data-fx-quality="low"]');
    expect(css).toContain(".skill-state-layer");
  });

  test("the debug gallery is present but production-hidden by default", () => {
    const html = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
    const gallery = fs.readFileSync(path.join(publicDir, "skill-fx-gallery.js"), "utf8");
    expect(html).toContain('id="skill-fx-gallery-modal"');
    expect(html).toContain('id="btn-skill-fx-gallery"');
    expect(html).toContain('class="skill-fx-gallery-launcher hidden"');
    expect(gallery).toContain('query.get("skillfx") === "1"');
    expect(gallery).toContain("launcher.remove()");
    expect(gallery).toContain("SUPPRESSED // 此视角无权看到该事件");
  });

  test("FX-STAGE-01 manager separates the table stage from the physical target", () => {
    const source = fs.readFileSync(path.join(publicDir, "skill-fx-manager.js"), "utf8");
    expect(source).toContain("resolveStage(job)");
    expect(source).toContain("resolveTarget(job)");
    expect(source).toContain('setProperty("--fx-stage-x"');
    expect(source).toContain('setProperty("--fx-target-x"');
    expect(source).toContain('makeAtom("div", "skill-effect-stage")');
    expect(source).toContain('makeAtom("div", "skill-effect-impact")');
  });

  test("FX-STAGE-02 Deep Breath stages centrally and follows through to energy", () => {
    const client = fs.readFileSync(path.join(publicDir, "client.js"), "utf8");
    expect(client).toContain("stageCenter: el.tableCenter || el.community || el.board");
    expect(client).toContain('["DEEP_BREATH", "RECYCLE"].includes(id)) targetElement = casterEnergy');
    expect(profiles.getSkillFxProfile("DEEP_BREATH")).toMatchObject({ tier: "FX2", impact: "energy" });
  });

  test("FX-STAGE-03 Cheat retains an exact card target after the central stage", () => {
    const client = fs.readFileSync(path.join(publicDir, "client.js"), "utf8");
    expect(client).toContain('if (id === "CHEAT")');
    expect(client).toContain('el.opponentCards?.children?.[Number(target.index)]');
    expect(profiles.getSkillFxProfile("CHEAT")).toMatchObject({ tier: "FX3", impact: "card" });
  });

  test("FX-STAGE-04 Nullification retains board-slot targeting", () => {
    const client = fs.readFileSync(path.join(publicDir, "client.js"), "utf8");
    expect(client).toContain('skillFxBoardTarget(index)');
    expect(client).toContain('targetElement: skillFxBoardTarget(index) || el.community');
    expect(profiles.getSkillFxProfile("NULLIFICATION")).toMatchObject({ impact: "card" });
  });

  test("FX-STAGE-05 Loan directs chip and energy branches to different targets", () => {
    const client = fs.readFileSync(path.join(publicDir, "client.js"), "utf8");
    expect(client).toContain('if (id === "LOAN") targetElement = zone === "energy" ? casterEnergy : casterArea');
    expect(client).toContain('payload.publicData?.take');
    expect(profiles.getSkillFxProfile("LOAN")).toMatchObject({ impact: "chip" });
  });

  test("FX-STAGE-06 Fairness uses a major central stage and board impact", () => {
    expect(profiles.getSkillFxProfile("FAIRNESS")).toMatchObject({ tier: "FX4", anchor: "board", impact: "board" });
    const css = fs.readFileSync(path.join(publicDir, "skill-effects.css"), "utf8");
    expect(css).toContain('[data-effect="fairness"]');
    expect(css).toContain('[data-impact="board"] .skill-effect-impact');
  });

  test("FX-STAGE-07 ordinary opponents receive no secret stage side channel", () => {
    const secretIds = ["DEEP_BREATH", "CHEAT", "PERCEPTION", "INTEL_ONE", "DEFENSE", "NULLIFICATION", "DESTINY", "RESTART"];
    secretIds.forEach((skillId) => {
      expect(profiles.canRenderSkillFx({ skillId, audience: "opponent", disclosure: "secret" }, profiles.getSkillFxProfile(skillId))).toBe(false);
    });
  });

  test("FX-STAGE-08 result-only captions use safe results unless identity is explicitly revealed", () => {
    const source = fs.readFileSync(path.join(publicDir, "skill-fx-manager.js"), "utf8");
    expect(source).toContain('node.dataset.identity = revealIdentity ? "revealed" : "result-only"');
    expect(source).toContain('revealIdentity ? profile.name : cleanToken(event.resultTitle || profile.resultLabel)');
    expect(source).toContain('event.revealIdentity === true');
  });

  test("FX-STAGE-09 persistent state markers remain target-positioned", () => {
    const source = fs.readFileSync(path.join(publicDir, "skill-fx-manager.js"), "utf8");
    expect(source).toContain("positionStateMarkers()");
    expect(source).toContain('marker.style.setProperty("--state-x"');
    expect(source).not.toContain('marker.style.setProperty("--fx-stage-x"');
  });

  test("FX-STAGE-10 Endgame remains outside the ordinary stage manager", () => {
    const fakeManager = new manager.SkillFxManager();
    expect(fakeManager.play({ skillId: "ENDGAME", force: true })).toBe(false);
    expect(profiles.getSkillFxProfile("ENDGAME")).toBeNull();
  });

  test("FX-STAGE-11 Dead End still owns the forced All In presentation", () => {
    const client = fs.readFileSync(path.join(publicDir, "client.js"), "utf8");
    expect(client).toContain('getSkillFxManager()?.isPlaying("DEAD_END")');
    expect(client).toContain("if (!deadEndOwnsPresentation) playAllInEffect(payload.playerId)");
  });

  test("FX-STAGE-12 semantic request IDs dedupe the entire stage job", () => {
    const event = { requestId: "same-request", skillId: "FAIRNESS", casterId: "P1" };
    expect(manager.semanticSkillFxKey(event)).toBe("same-request");
    expect(manager.semanticSkillFxKey({ ...event, safeMessage: "changed" })).toBe("same-request");
  });

  test("FX-STAGE-13 restored and replayed events never enter the stage queue", () => {
    const fakeManager = new manager.SkillFxManager();
    expect(fakeManager.play({ skillId: "FAIRNESS", restored: true, force: true })).toBe(false);
    expect(fakeManager.play({ skillId: "FAIRNESS", replay: true, force: true })).toBe(false);
  });

  test("FX-STAGE-14 reduced motion preserves stage and target impact", () => {
    const css = fs.readFileSync(path.join(publicDir, "skill-effects.css"), "utf8");
    expect(css).toContain('[data-fx-motion="reduced"] .skill-effect-impact');
    expect(css).not.toContain('[data-fx-motion="reduced"] .skill-effect-stage {\n  display: none');
  });

  test("FX-STAGE-15 low performance preserves central identity and target impact", () => {
    const css = fs.readFileSync(path.join(publicDir, "skill-effects.css"), "utf8");
    expect(css).toContain('[data-fx-quality="low"] .skill-effect-impact');
    expect(css).toContain('[data-fx-quality="low"] .route-packet');
    expect(css).not.toContain('[data-fx-quality="low"] .skill-effect-stage {\n  display: none');
  });
});
