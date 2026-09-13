import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import runtime from "./playwright-runtime.js";

const base = process.env.BASE_URL || "http://127.0.0.1:3002";
const out = path.resolve(process.env.SKILL_FX_ART_DIR || "artifacts/skill-fx-polish-20260913");
const sample = process.argv.includes("--sample");
const only = (process.env.SKILL_FX_ART_ONLY || "").split(",").filter(Boolean);
const previous = only.length && fs.existsSync(path.join(out, "art-report.json"))
  ? JSON.parse(fs.readFileSync(path.join(out, "art-report.json"), "utf8")) : null;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(runtime.chromiumLaunchOptions({ headless: true }));
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(runtime.pinZhCNLocale);
await context.addInitScript(() => {
  localStorage.setItem("overlimit_quickstart_v1", "seen");
  localStorage.setItem("overlimit_audio_enabled", "false");
});
const page = await context.newPage();
const errors = [];
const checks = previous ? previous.checks.filter(c => !only.includes(c.skillId)) : [];
const captures = previous ? previous.captures.filter(c => !only.some(id => c.label.startsWith(id))) : [];
page.on("pageerror", error => errors.push(error.message));
page.on("requestfailed", request => {
  if (request.url().startsWith(base)) errors.push(request.failure()?.errorText + " " + request.url());
});

async function captureSkill(skillId, mode, options = {}) {
  const data = await page.evaluate(({ skillId, mode, options }) => {
    const control = key => document.getElementById("skill-fx-gallery-" + key);
    const profile = window.OVERLIMIT_SKILL_FX.getSkillFxProfile(skillId);
    control("skill").value = skillId;
    control("quality").value = mode.quality;
    control("perspective").value = options.neutral ? "opponent" : "self";
    control("disclosure").value = options.neutral ? "result" : "self";
    control("status").value = options.status || "SUCCESS";
    control("phase").value = options.phase || "flop";
    control("variant").value = options.variant || "default";
    control("target").value = "profile";
    control("show-stage").checked = false;
    control("show-target").checked = false;
    control("show-caption").checked = true;
    const gallery = window.OverlimitSkillFxGallery;
    gallery.replay();
    const manager = gallery.manager;
    if (options.composite) {
      const event = { ...manager.activeJob.event, eventId: "art-composite:" + Date.now(),
        context: "settlement", phase: "showdown", status: "REVEALED", resultOnly: true, revealIdentity: true,
        compositeSkills: ["PROTOCOL_PAIR", "BLOOD_BATTLE", "DESPERATION", "DEFENSE"],
        compositeLabels: ["PROTOCOL ×2", "BLOOD ×2", "CRITICAL ×3", "DEFENSE ½"],
        effectLabel: "PROTOCOL ×2 · BLOOD ×2 · CRITICAL ×3 · DEFENSE ½" };
      manager.clear();
      manager.play(event);
    }
    if (options.upgrade) {
      manager.play({ ...manager.activeJob.event, eventId: "art-upgrade:" + Date.now(),
        casterId: "OTHER", viewerId: "GALLERY_CASTER", audience: "public", disclosure: "public",
        context: "settlement", phase: "showdown", status: "REVEALED", resultOnly: true, revealIdentity: true });
    }
    clearTimeout(manager.timer);
    manager.timer = 0;
    const node = manager.activeNode;
    if (!node) return { error: "No effect rendered for " + skillId };
    const duration = Number.parseFloat(node.style.getPropertyValue("--fx-duration"));
    const time = duration * (options.beat || .54);
    const animations = node.getAnimations({ subtree: true });
    animations.forEach(animation => { animation.pause(); animation.currentTime = time; });
    const core = node.querySelector(".fx-art");
    const main = core.querySelector("svg");
    const styles = getComputedStyle(main);
    const material = main.querySelector(".fx-crystal, .fx-metal");
    const rootRect = node.getBoundingClientRect();
    const captionRect = node.querySelector(".skill-effect-caption").getBoundingClientRect();
    const ids = [...document.querySelectorAll("[id^='fxm-']")].map(n => n.id);
    const importantNodes = [node, node.querySelector(".skill-effect-core"), core, main];
    const opacity = importantNodes.reduce((product, n) => product * Number(getComputedStyle(n).opacity), 1);
    return {
      skillId, mode: mode.name, variant: options.variant || "default", status: options.status || "SUCCESS",
      artKey: core.dataset.artKey, motion: core.dataset.motion,
      expectedKey: options.neutral ? "result" : skillId.startsWith("PROTOCOL_") ? skillId : profile.family,
      materialFill: material ? getComputedStyle(material).fill : null,
      opacity, display: styles.display,
      graphicCount: main.querySelectorAll("path,ellipse,circle").length,
      duplicateGradientIds: ids.length - new Set(ids).size,
      legacyShapes: node.querySelectorAll(".skill-effect-halo,.skill-effect-line,.skill-effect-card,.skill-impact-outline").length,
      captionInside: captionRect.top >= rootRect.top - 1 && captionRect.bottom <= rootRect.bottom + 1,
      pointerTransparent: getComputedStyle(node).pointerEvents === "none" && styles.pointerEvents === "none",
      lowInternalAnimation: mode.quality === "low" ? core.getAnimations({ subtree: true }).length : 0,
      geometryBounds: (() => { const b = main.getBBox(); return { x: b.x, y: b.y, right: b.x + b.width, bottom: b.y + b.height }; })(),
      impactArt: node.querySelector(".fx-impact-art").dataset.impactArt,
      impactOpacity: [node, node.querySelector(".skill-effect-impact"), node.querySelector(".fx-impact-form")]
        .reduce((product, n) => product * Number(getComputedStyle(n).opacity), 1),
      glyph: node.querySelector(".skill-effect-glyph").textContent,
      upgraded: node.classList.contains("is-upgraded"),
      svgSignature: main.outerHTML.replace(/fxm-\d+/g, "fxm-ID"),
      timings: { duration, time },
    };
  }, { skillId, mode, options });
  const filename = `${mode.name}-${skillId.toLowerCase()}${options.label ? "-" + options.label : ""}.png`;
  await page.locator("#skill-fx-gallery-stage").screenshot({ path: path.join(out, filename) });
  captures.push({ filename, label: `${skillId}${options.label ? " · " + options.label : ""}`, mode: mode.name });
  if (data.error) errors.push(data.error);
  else {
    if (data.artKey !== data.expectedKey) errors.push(`${filename}: wrong art ${data.artKey}`);
    if (data.opacity < .18 || data.display === "none" || data.graphicCount < 2) errors.push(`${filename}: invisible art ${data.opacity}`);
    if (data.duplicateGradientIds) errors.push(`${filename}: duplicate gradient IDs`);
    if (data.legacyShapes) errors.push(`${filename}: legacy frames still mounted`);
    if (!data.captionInside) errors.push(`${filename}: caption overflow`);
    if (!data.pointerTransparent) errors.push(`${filename}: pointer interception`);
    if (data.lowInternalAnimation) errors.push(`${filename}: low internal animation`);
    if (data.geometryBounds && (data.geometryBounds.x < -75 || data.geometryBounds.y < -75
      || data.geometryBounds.right > 315 || data.geometryBounds.bottom > 275)) errors.push(`${filename}: escaped authored geometry`);
    if (options.label === "impact" && data.impactOpacity < .12) errors.push(`${filename}: invisible impact`);
    if (options.upgrade && (!data.upgraded || data.glyph !== "×4")) errors.push(`${filename}: blood upgrade missing`);
  }
  checks.push(data);
  // Keep the original timer/queue cleanup implementation responsible for removal.
  await page.evaluate(() => window.OverlimitSkillFxGallery.manager.clear());
}

async function captureEndgame(kind, mode) {
  await page.evaluate(({ kind, quality }) => {
    document.getElementById("skill-fx-gallery-quality").value = quality;
    window.OverlimitSkillFxGallery.previewEndgame(kind);
    const node = document.querySelector(".skill-fx-gallery-endgame");
    node.getAnimations({ subtree: true }).forEach(animation => { animation.pause(); animation.currentTime = 1500; });
  }, { kind, quality: mode.quality });
  const result = await page.locator(".skill-fx-gallery-endgame").evaluate(node => {
    const art = node.querySelector(".fx-endgame-art");
    const ids = [...document.querySelectorAll("[id^='fxm-']")].map(n => n.id);
    return { art: Boolean(art), opacity: getComputedStyle(art).opacity, display: getComputedStyle(art).display,
      duplicateIds: ids.length - new Set(ids).size, liveOverlaysHidden: [...document.querySelectorAll("#flash-endgame-declare,#flash-endgame-kill")].every(n => n.classList.contains("hidden")) };
  });
  const filename = `${mode.name}-endgame-${kind}.png`;
  await page.locator("#skill-fx-gallery-stage").screenshot({ path: path.join(out, filename) });
  captures.push({ filename, label: "ENDGAME · " + kind, mode: mode.name });
  if (!result.art || result.display === "none" || Number(result.opacity) < .2 || result.duplicateIds || !result.liveOverlaysHidden) errors.push(`${filename}: endgame preview integrity`);
  await page.locator(".skill-fx-gallery-endgame").evaluate(node => {
    node.classList.add("is-restored-hold", "is-result-hold");
  });
  const restored = await page.locator(".skill-fx-gallery-endgame .fx-endgame-art").evaluate(node => ({
    animations: node.getAnimations({ subtree: true }).length, opacity: getComputedStyle(node).opacity,
  }));
  if (restored.animations || Number(restored.opacity) < .2) errors.push(`${filename}: restored hold replayed or invisible`);
  checks.push({ skillId: "ENDGAME", mode: mode.name, kind, ...result, restored });
  await page.locator("#btn-stop-skill-fx").click();
}

try {
  await page.goto(base + "/?skillfx=gallery", { waitUntil: "networkidle" });
  await page.waitForSelector("#skill-fx-gallery-modal:not(.hidden)");
  const ids = await page.locator("#skill-fx-gallery-skill option").evaluateAll(nodes => nodes.map(n => n.value));
  const modes = sample ? [{ name: "sample", quality: "high", viewport: { width: 1440, height: 900 } }] : [
    { name: "desktop-high", quality: "high", viewport: { width: 1440, height: 900 } },
    { name: "mobile-high", quality: "high", viewport: { width: 390, height: 844 } },
    { name: "mobile-low", quality: "low", viewport: { width: 390, height: 844 } },
  ];
  const variants = [
    ["DEEP_BREATH", { variant: "refund", status: "REFUNDED", label: "refund" }],
    ["LOAN", { variant: "energy", label: "energy" }], ["LOAN", { variant: "chip", label: "chip" }],
    ["CHEAT", { variant: "hole", label: "hole" }], ["CHEAT", { variant: "board", label: "board" }],
    ["CHEAT", { status: "COUNTERED", beat: .70, label: "countered" }],
    ["INTEL_ONE", { status: "FAILED", beat: .70, label: "failed" }],
    ["BLOOD_BATTLE", { phase: "showdown", upgrade: true, label: "dual" }],
    ["PROTOCOL_PAIR", { composite: true, label: "composite" }],
    ["TOP_SECRET", { neutral: true, label: "neutral" }], ["CHEAT", { neutral: true, label: "neutral" }],
    ["TOP_SECRET", { neutral: true, status: "FAILED", label: "neutral-failed" }],
    ["CHEAT", { neutral: true, status: "FAILED", label: "neutral-failed" }],
  ];
  for (const mode of modes) {
    await page.setViewportSize(mode.viewport);
    await page.locator("#skill-fx-gallery-quality").selectOption(mode.quality);
    await page.waitForTimeout(110); // Let the dialog's quality-change fade settle.
    const selectedIds = sample ? ["DEFENSE", "FAIRNESS", "CHEAT", "CLAIRVOYANCE", "DISGUISE", "PROTOCOL_STRAIGHT_FLUSH"] : only.length ? ids.filter(id => only.includes(id)) : ids;
    for (const skill of selectedIds) await captureSkill(skill, mode);
    if (!sample && mode.name === "desktop-high") for (const skill of selectedIds) await captureSkill(skill, mode, { beat: .77, label: "impact" });
    if (!sample) for (const [skill, options] of variants) if (!only.length || only.includes(skill)) await captureSkill(skill, mode, options);
    if (!only.length || only.includes("ENDGAME")) for (const kind of ["declare", "execution"]) await captureEndgame(kind, mode);
    console.log(`${mode.name}: ${captures.filter(c => c.mode === mode.name).length} rendered captures`);
  }
  if (!sample) {
    const catalog = await page.request.get(base + "/api/skills");
    const payload = await catalog.json();
    const serverIds = (Array.isArray(payload) ? payload : payload.skills).map(s => s.id);
    const renderedIds = new Set(checks.map(c => c.skillId));
    if (serverIds.length !== 33 || serverIds.some(id => !renderedIds.has(id))) errors.push("Authoritative skill catalog coverage mismatch");
    const neutral = checks.filter(c => c.artKey === "result" && ["TOP_SECRET", "CHEAT"].includes(c.skillId));
    for (const status of ["SUCCESS", "FAILED"]) {
      if (new Set(neutral.filter(c => c.status === status).map(c => c.svgSignature)).size !== 1) errors.push("Anonymous results leak their origin through artwork: " + status);
    }
    await page.evaluate(() => window.OverlimitSkillFxGallery.close());
    const residue = await page.locator(".skill-fx-gallery-endgame,#skill-fx-gallery-effect-layer .skill-effect-instance").count();
    if (residue) errors.push("Gallery left active effects after close");
  }
  const sheets = [];
  for (const mode of modes) {
    const cards = captures.filter(c => c.mode === mode.name);
    for (let start = 0; start < cards.length; start += 12) {
      const name = `${mode.name}-sheet-${Math.floor(start / 12) + 1}`;
      const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Skill FX review</title><style>body{margin:0;padding:22px;background:#071018;color:#dce9f5;font:14px system-ui}h1{font-size:22px;margin:0 0 16px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}figure{margin:0;background:#101c27;border:1px solid #243748;border-radius:10px;overflow:hidden}img{width:100%;display:block}figcaption{padding:9px;font-size:12px;color:#b9ccda}</style><h1>全技能精修 · ${mode.name}</h1><div class="grid">${cards.slice(start, start + 12).map(c => `<figure><img src="data:image/png;base64,${fs.readFileSync(path.join(out, c.filename)).toString("base64")}"><figcaption>${c.label}</figcaption></figure>`).join("")}</div></html>`;
      fs.writeFileSync(path.join(out, name + ".html"), html);
      const sheet = await context.newPage();
      await sheet.setViewportSize({ width: 1500, height: 900 });
      await sheet.setContent(html, { waitUntil: "load" });
      await sheet.screenshot({ path: path.join(out, name + ".png"), fullPage: true });
      await sheet.close();
      sheets.push(name + ".png");
    }
  }
  fs.writeFileSync(path.join(out, sample ? "sample-report.json" : "art-report.json"), JSON.stringify({ sample, errors, checks, captures, sheets }, null, 2));
  console.log(JSON.stringify({ sample, checks: checks.length, captures: captures.length, errors, sheets }, null, 2));
  if (errors.length) process.exitCode = 1;
} finally { await browser.close(); }
