import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import runtime from "./playwright-runtime.js";

const base = process.env.BASE_URL || "http://127.0.0.1:3002";
const out = path.resolve("artifacts/skill-fx-polish-20260913");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(runtime.chromiumLaunchOptions({ headless: true }));
const context = await browser.newContext({ viewport: { width: 1440, height: 900 },
  recordVideo: { dir: out, size: { width: 1440, height: 900 } } });
await context.addInitScript(runtime.pinZhCNLocale);
await context.addInitScript(() => {
  localStorage.setItem("overlimit_quickstart_v1", "seen");
  localStorage.setItem("overlimit_audio_enabled", "false");
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const chapters = [];
try {
  await page.goto(base + "/?skillfx=gallery", { waitUntil: "networkidle" });
  await page.waitForSelector("#skill-fx-gallery-modal:not(.hidden)");
  await page.locator("#skill-fx-gallery-quality").selectOption("high");
  await page.locator("#skill-fx-gallery-show-stage").uncheck();
  await page.locator("#skill-fx-gallery-show-target").uncheck();
  // Only the recording composition changes. It renders the real gallery and
  // real manager at their real speed, with all original event timers running.
  await page.addStyleTag({ content: `
    .skill-fx-gallery-modal {padding:0!important;background:#050a12!important}
    .skill-fx-gallery-panel {width:100vw!important;max-width:none!important;height:100vh!important;max-height:none!important;border-radius:0!important;padding:24px!important;display:flex!important;flex-direction:column!important}
    .skill-fx-gallery-workspace{flex:1!important;min-height:0!important;grid-template-columns:1fr!important}
    .skill-fx-gallery-controls{display:none!important}
    .skill-fx-gallery-stage{height:100%!important;min-height:0!important}
  ` });
  const ids = await page.locator("#skill-fx-gallery-skill option").evaluateAll(nodes => nodes.map(n => n.value));
  const start = Date.now();
  for (let index = 0; index < ids.length; index++) {
    const id = ids[index];
    const duration = await page.evaluate(({ id, index, total }) => {
      const control = key => document.getElementById("skill-fx-gallery-" + key);
      control("skill").value = id;
      control("perspective").value = "self";
      control("disclosure").value = "self";
      control("status").value = "SUCCESS";
      control("target").value = "profile";
      control("variant").value = "default";
      const option = [...control("skill").options].find(n => n.value === id);
      document.getElementById("skill-fx-gallery-title").textContent = `${index + 1}/${total + 1} · ${option.textContent}`;
      window.OverlimitSkillFxGallery.replay();
      return window.OverlimitSkillFxGallery.manager.activeJob?.duration || 1200;
    }, { id, index, total: ids.length });
    chapters.push({ skillId: id, ms: Date.now() - start, duration });
    await page.waitForTimeout(duration + 150);
    if ((index + 1) % 8 === 0) console.log(`Recorded ${index + 1}/${ids.length} standard/protocol effects`);
  }
  for (const kind of ["declare", "execution"]) {
    chapters.push({ skillId: "ENDGAME", kind, ms: Date.now() - start });
    await page.evaluate(kind => {
      document.getElementById("skill-fx-gallery-title").textContent = kind === "declare" ? "33/33 · 终局 · 宣告" : "33/33 · 终局 · 执行";
      window.OverlimitSkillFxGallery.previewEndgame(kind);
    }, kind);
    await page.waitForTimeout(kind === "declare" ? 2750 : 2950);
  }
  const residue = await page.locator(".skill-fx-gallery-endgame,#skill-fx-gallery-effect-layer .skill-effect-instance").count();
  if (residue) errors.push("Effect residue at end of continuous playback");
  const video = page.video();
  await page.close();
  await video.saveAs(path.join(out, "all-33-skills.webm"));
  await video.delete();
  fs.writeFileSync(path.join(out, "playback-report.json"), JSON.stringify({ errors, chapters }, null, 2));
  console.log(JSON.stringify({ output: path.join(out, "all-33-skills.webm"), chapters: chapters.length, errors }));
  if (errors.length) process.exitCode = 1;
} finally { await context.close(); await browser.close(); }
