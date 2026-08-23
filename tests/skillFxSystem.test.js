const fs = require("fs");
const path = require("path");

const profiles = require("../public/skill-fx-profiles");
const manager = require("../public/skill-fx-manager");

const publicDir = path.join(__dirname, "..", "public");

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

  test("approved launch hierarchy uses the intended tiers and physical anchors", () => {
    expect(profiles.getSkillFxProfile("DEEP_BREATH")).toMatchObject({ tier: "FX2", anchor: "energy" });
    expect(profiles.getSkillFxProfile("PERCEPTION")).toMatchObject({ tier: "FX2", anchor: "target" });
    expect(profiles.getSkillFxProfile("INTEL_ONE")).toMatchObject({ tier: "FX3", anchor: "target" });
    expect(profiles.getSkillFxProfile("BLOOD_BATTLE")).toMatchObject({ tier: "FX3", anchor: "pot" });
    expect(profiles.getSkillFxProfile("DESTINY")).toMatchObject({ tier: "FX4", anchor: "river" });
    expect(profiles.getSkillFxProfile("RETREAT")).toMatchObject({ tier: "FX3", anchor: "pot" });
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
});
