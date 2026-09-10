const quality = require("../public/visual-quality");
const { SkillFxManager } = require("../public/skill-fx-manager");
const profiles = require("../public/skill-fx-profiles");

describe("two-tier visual preference migration", () => {
  test.each([
    [{ animation: "high" }, false, "high"],
    [{ animation: "high" }, true, "high"],
    [{ animation: "low" }, false, "low"],
    [{ animation: "medium" }, false, "low"],
    [{ animation: "high", reduceMotion: true }, false, "low"],
    [{ animation: "high", lowPerformance: true }, false, "low"],
    [{ animation: "high", reduceMotion: false, lowPerformance: false }, true, "high"],
    [{ reduceMotion: true }, false, "low"],
    [{ lowPerformance: true }, false, "low"],
    [{}, false, "high"],
    [{}, true, "low"],
    [{ animation: "invalid" }, true, "low"],
    [null, false, "high"],
    [[], true, "low"],
    ["corrupt", true, "low"],
  ])("resolves %j with system reduction %s to %s", (stored, reduced, expected) => {
    const before = JSON.stringify(stored);
    expect(quality.resolveStoredQuality(stored, reduced)).toBe(expected);
    expect(JSON.stringify(stored)).toBe(before);
  });

  test("a migrated user can select high without a deleted legacy switch forcing low again", () => {
    const migrated = { animation: quality.resolveStoredQuality({ animation: "high", lowPerformance: true }) };
    expect(migrated.animation).toBe("low");
    migrated.animation = "high";
    expect(quality.resolveStoredQuality(migrated, true)).toBe("high");
  });
});

describe("visual quality during queued and active effects", () => {
  afterEach(() => jest.useRealTimers());

  test("a queued effect uses the latest quality without replaying its admission", () => {
    jest.useFakeTimers();
    let currentQuality = "high";
    const manager = new SkillFxManager({ getSettings: () => ({ quality: currentQuality }) });
    manager.busy = true;
    expect(manager.play({ skillId: "FAIRNESS", audience: "self", eventId: "queued-quality" })).toBe(true);
    currentQuality = "low";
    manager.render = jest.fn();
    manager.busy = false;
    manager.pump();
    expect(manager.render).toHaveBeenCalledTimes(1);
    expect(manager.activeJob.settings).toEqual({ quality: "low" });
    expect(manager.activeJob.duration).toBe(profiles.fxDuration(profiles.getSkillFxProfile("FAIRNESS"), "low"));
    manager.clear();
  });

  test("changing active quality removes shaking without advancing its deadline", () => {
    let currentQuality = "high";
    const effectLayer = { dataset: {} };
    const manager = new SkillFxManager({ effectLayer, getSettings: () => ({ quality: currentQuality }) });
    manager.activeJob = { settings: { quality: "high" } };
    manager.activeNode = { dataset: { shake: "soft" } };
    manager.activeDeadline = 12345;
    currentQuality = "low";
    manager.refreshQuality();
    expect(manager.activeDeadline).toBe(12345);
    expect(manager.activeNode.dataset).toMatchObject({ quality: "low", motion: "reduced", shake: "none" });
    expect(effectLayer.dataset).toEqual({ fxQuality: "low", fxMotion: "reduced" });
  });
});
