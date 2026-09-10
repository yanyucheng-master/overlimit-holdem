import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import runtime from "./playwright-runtime.js";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3002";
const OUTPUT = path.resolve(process.env.VISUAL_QUALITY_DIR || "artifacts/visual-quality");
const KEY = "abyss_ui_settings_v2";
const retained = {
  language: "en-US", languageChosen: true, sfx: 35, music: 60,
  allInStyle: "royal", proPlayerMode: true, proFontStyle: "chrome", skillExpertText: true,
};
const cases = [
  { name: "first-visit", quality: "high" },
  { name: "system-default", reduced: true, quality: "low" },
  { name: "legacy-medium", saved: { ...retained, animation: "medium" }, quality: "low" },
  { name: "legacy-motion", saved: { ...retained, animation: "high", reduceMotion: true }, quality: "low" },
  { name: "legacy-performance", saved: { ...retained, animation: "high", lowPerformance: true }, quality: "low" },
  { name: "explicit-high-over-system", reduced: true, saved: { ...retained, animation: "high" }, quality: "high" },
  { name: "explicit-low", saved: { ...retained, animation: "low" }, quality: "low" },
  { name: "malformed-storage", reduced: true, raw: "{", quality: "low" },
  { name: "invalid-array", raw: "[]", quality: "high" },
  { name: "blocked-storage", reduced: true, blocked: true, quality: "low" },
];

async function inspect(page) {
  return page.evaluate((key) => {
    const modal = document.querySelector(".settings-panel");
    const style = getComputedStyle(modal);
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(key)); } catch (_error) {}
    return {
      quality: document.documentElement.dataset.animation,
      selected: document.getElementById("setting-animation").value,
      options: [...document.getElementById("setting-animation").options].map((option) => option.value),
      obsoleteControls: document.querySelectorAll("#setting-reduce-motion, #setting-low-performance, #skill-fx-gallery-reduced").length,
      galleryOptions: [...document.getElementById("skill-fx-gallery-quality").options].map((option) => option.value),
      backdropFilter: style.backdropFilter,
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      modalTransition: getComputedStyle(document.getElementById("settings-modal")).transitionDuration,
      panelTransition: style.transitionDuration,
      panelTransform: style.transform,
      motionFactor: getComputedStyle(document.body).getPropertyValue("--motion-factor").trim(),
      stored,
    };
  }, KEY);
}

function assertQuality(actual, expected) {
  assert.equal(actual.quality, expected);
  assert.equal(actual.selected, expected);
  assert.deepEqual(actual.options, ["high", "low"]);
  assert.deepEqual(actual.galleryOptions, ["high", "low"]);
  assert.equal(actual.obsoleteControls, 0);
  assert.equal(actual.motionFactor, "1");
  if (expected === "low") {
    assert.equal(actual.backdropFilter, "none");
    assert.equal(actual.animationName, "none");
    assert.equal(actual.modalTransition, "0.08s");
    assert.equal(actual.panelTransition, "0.08s, 0.08s");
    assert.equal(actual.panelTransform, "none");
  } else {
    assert.notEqual(actual.backdropFilter, "none");
    assert.notEqual(actual.animationName, "visual-low-fade");
  }
}

await fs.mkdir(OUTPUT, { recursive: true });
const report = { ok: false, cases: [], screenshots: [], failures: [] };
const browser = await chromium.launch(runtime.chromiumLaunchOptions({ headless: true }));
try {
  for (const sample of cases) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }, locale: "zh-CN",
      reducedMotion: sample.reduced ? "reduce" : "no-preference",
    });
    try {
      await context.addInitScript(({ sample, key }) => {
        if (!sessionStorage.getItem("visual-quality-test-seeded")) {
          if (sample.raw !== undefined) localStorage.setItem(key, sample.raw);
          else if (sample.saved) localStorage.setItem(key, JSON.stringify(sample.saved));
          localStorage.setItem("overlimit_quickstart_v1", "seen");
          sessionStorage.setItem("visual-quality-test-seeded", "1");
        }
        if (sample.blocked) {
          for (const method of ["getItem", "setItem", "removeItem"]) {
            Storage.prototype[method] = () => { throw new DOMException("Storage unavailable", "SecurityError"); };
          }
        }
      }, { sample, key: KEY });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("requestfailed", (request) => {
        if (request.url().startsWith(BASE)) errors.push(request.url() + " " + request.failure()?.errorText);
      });
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.locator("#btn-settings").click();
      const initial = await inspect(page);
      assertQuality(initial, sample.quality);
      if (!sample.blocked) {
        assert.equal(initial.stored.animation, sample.quality);
        assert.equal("reduceMotion" in initial.stored, false);
        assert.equal("lowPerformance" in initial.stored, false);
        if (sample.saved) {
          for (const [key, value] of Object.entries(retained)) assert.equal(initial.stored[key], value, key);
        }
      }

      const next = sample.quality === "high" ? "low" : "high";
      await page.locator("#setting-animation").selectOption(next);
      assertQuality(await inspect(page), next);
      await page.reload({ waitUntil: "networkidle" });
      await page.locator("#btn-settings").click();
      const reloaded = await inspect(page);
      assertQuality(reloaded, sample.blocked ? sample.quality : next);

      if (sample.name === "first-visit") {
        for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 700 }]) {
          await page.setViewportSize(viewport);
          for (const quality of ["high", "low"]) {
            await page.locator("#setting-animation").selectOption(quality);
            assertQuality(await inspect(page), quality);
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
            assert.equal(overflow, false, `horizontal overflow at ${viewport.width}`);
            const screenshot = path.join(OUTPUT, `settings-${viewport.width}-${quality}.png`);
            await page.waitForFunction(() => {
              const panel = document.querySelector(".settings-panel");
              return getComputedStyle(panel).opacity === "1"
                && !panel.getAnimations().some((animation) => animation.playState === "running");
            });
            await page.screenshot({ path: screenshot, fullPage: true });
            report.screenshots.push(screenshot);
          }
        }
        // Leave this isolated browser profile in English and prove relocalized labels.
        await page.locator("#setting-language").selectOption("en-US");
        assert.equal(await page.locator('[data-i18n="settings.animation"]').textContent(), "Visual effects");
        assert.deepEqual(await page.locator("#setting-animation option").allTextContents(), ["High", "Low"]);
      }
      assert.deepEqual(errors, []);
      report.cases.push({ name: sample.name, initial: initial.quality, reloaded: reloaded.quality, ok: true });
    } catch (error) {
      report.failures.push({ name: sample.name, message: error.stack || String(error) });
    } finally {
      await context.close();
    }
  }
  report.ok = report.failures.length === 0;
} finally {
  await browser.close();
  await fs.writeFile(path.join(OUTPUT, "report.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
if (!report.ok) process.exitCode = 1;
