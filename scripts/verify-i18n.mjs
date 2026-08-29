import { chromium } from "playwright";
import playwrightRuntime from "./playwright-runtime.js";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3002";
const HAN = /[\u4e00-\u9fff]/;
const ALLOWED_VISIBLE = new Set(["中文", "简体中文", "|"]);
const DESKTOP = [
  { width: 1920, height: 1080 },
  { width: 1600, height: 900 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
];
const MOBILE = [
  { width: 320, height: 700 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

async function clickProtocol(page, gameMode, skillMode, action) {
  await page.evaluate(({ gameMode, skillMode, action }) => {
    const card = document.querySelector(
      `.protocol-card[data-game-mode="${gameMode}"][data-skill-mode="${skillMode}"]`
    );
    const btn = card?.querySelector(`.protocol-btn[data-room-action="${action}"]`);
    if (!btn) throw new Error("protocol button missing");
    btn.click();
  }, { gameMode, skillMode, action });
}

async function setLocale(page, locale) {
  await page.evaluate((next) => {
    const btn = document.querySelector(`.lang-btn[data-locale="${next}"]`);
    if (btn) {
      btn.click();
      return;
    }
    const select = document.getElementById("setting-language");
    if (select) {
      select.value = next;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, locale);
  await page.waitForTimeout(80);
}

function residueCollector() {
  const HAN = /[\u4e00-\u9fff]/;
  const allowedExact = new Set(["中文", "简体中文"]);
  const skipClosest = ".action-zh, script, style, noscript, template";
  const nicknameIds = new Set([
    "input-name",
    "opponent-name",
    "self-name",
    "wait-host-name",
    "wait-guest-name",
  ]);
  const hits = [];

  const isSkipped = (el) => {
    if (!el || el.nodeType !== 1) return true;
    if (el.closest(skipClosest)) return true;
    if (el.closest(".hidden, [hidden]")) return true;
    if (el.closest(".screen") && !el.closest(".screen.active")) return true;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return true;
    return false;
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const raw = String(walker.currentNode.nodeValue || "").trim();
    if (!HAN.test(raw)) continue;
    const el = walker.currentNode.parentElement;
    if (isSkipped(el)) continue;
    if (nicknameIds.has(el.id) || nicknameIds.has(el.closest("[id]")?.id)) continue;
    const compact = raw.replace(/\s+/g, "");
    if (allowedExact.has(compact)) continue;
    hits.push({
      kind: "text",
      text: raw.slice(0, 80),
      id: el.id || el.closest("[id]")?.id || "",
      className: String(el.className || "").slice(0, 80),
    });
  }

  document.querySelectorAll("[aria-label], [title], [placeholder], [alt]").forEach((el) => {
    if (isSkipped(el)) return;
    ["aria-label", "title", "placeholder", "alt"].forEach((attr) => {
      const value = el.getAttribute(attr);
      if (!value || !HAN.test(value)) return;
      if (allowedExact.has(value.trim())) return;
      hits.push({
        kind: attr,
        text: value.slice(0, 80),
        id: el.id || "",
        className: String(el.className || "").slice(0, 80),
      });
    });
  });

  const before = getComputedStyle(document.querySelector(".quickstart-shot[data-quickstart-zoom]") || document.body, "::before").content || "";
  if (HAN.test(before)) hits.push({ kind: "css-before", text: before, id: "", className: "quickstart-shot" });

  return hits;
}

async function collectResidue(page) {
  return page.evaluate(residueCollector);
}

async function overflowAudit(page, viewport, label) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(60);
  return page.evaluate(({ viewport, label }) => {
    const doc = document.documentElement;
    const overflowX = doc.scrollWidth > innerWidth + 1;
    const clipped = [...document.querySelectorAll("button, .mode-pill, .action-button, .intel-edit-button")]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return false;
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (node.closest(".hidden, [hidden], .screen:not(.active)")) return false;
        return rect.right > innerWidth + 2 || rect.bottom > innerHeight + 2 || rect.left < -2;
      })
      .map((node) => node.id || node.className)
      .slice(0, 8);
    return {
      label,
      viewport,
      overflowX,
      scrollWidth: doc.scrollWidth,
      innerWidth,
      clipped,
    };
  }, { viewport, label });
}

async function main() {
  const failures = [];
  const report = {};
  const browser = await chromium.launch(playwrightRuntime.chromiumLaunchOptions({ headless: true }));
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(playwrightRuntime.pinEnUSLocaleUnlessChosen);
  await context.addInitScript(() => localStorage.setItem("overlimit_quickstart_v1", "seen"));
  const page = await context.newPage();
  await page.goto(BASE + "/?verify=1", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  report.htmlLang = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    locale: document.documentElement.getAttribute("data-locale"),
    title: document.title,
  }));
  if (report.htmlLang.lang !== "en" || report.htmlLang.locale !== "en-US") {
    failures.push("boot locale is not en-US");
  }

  const lobbyResidue = await collectResidue(page);
  report.lobbyResidue = lobbyResidue.slice(0, 40);
  if (lobbyResidue.length) failures.push(`lobby English residue: ${lobbyResidue.length}`);

  await page.click("#btn-settings");
  await page.waitForTimeout(80);
  const settingsResidue = await collectResidue(page);
  report.settingsResidue = settingsResidue.slice(0, 20);
  if (settingsResidue.length) failures.push(`settings English residue: ${settingsResidue.length}`);
  await page.click("#btn-close-settings");

  await page.click("#btn-open-rules");
  await page.waitForTimeout(200);
  const rulesResidue = await collectResidue(page);
  report.rulesResidueCount = rulesResidue.length;
  report.rulesSample = rulesResidue.slice(0, 12);
  if (rulesResidue.length) failures.push(`rules English residue: ${rulesResidue.length}`);
  await page.click("#btn-close-rules");

  await page.click("#btn-open-quickstart");
  await page.waitForTimeout(120);
  const qsResidue = await collectResidue(page);
  report.quickstartResidueCount = qsResidue.length;
  report.quickstartSample = qsResidue.slice(0, 12);
  if (qsResidue.length) failures.push(`quickstart English residue: ${qsResidue.length}`);
  const tutorialSrcs = await page.evaluate(() =>
    [...document.querySelectorAll("#quickstart-modal img[data-tutorial-src-en]")].map((img) => img.getAttribute("src") || "")
  );
  report.tutorialSrcs = tutorialSrcs;
  if (tutorialSrcs.length !== 5 || tutorialSrcs.some((src) => !src.includes("/tutorial/en-US/"))) {
    failures.push("English quickstart still using Chinese tutorial images");
  }
  await page.click("#btn-close-quickstart");

  await page.click("#btn-open-skill-lab");
  await page.waitForSelector("#screen-skill-lab.active", { timeout: 8000 });
  await page.waitForTimeout(600);
  const labResidue = await collectResidue(page);
  report.labResidueCount = labResidue.length;
  report.labSample = labResidue.slice(0, 12);
  if (labResidue.length) failures.push(`skill lab English residue: ${labResidue.length}`);

  const labSwitch = [];
  for (const locale of ["zh-CN", "en-US", "zh-CN", "en-US"]) {
    await setLocale(page, locale);
    labSwitch.push(await page.evaluate((expected) => ({
      locale: document.documentElement.getAttribute("data-locale"),
      lang: document.documentElement.lang,
      labActive: document.getElementById("screen-skill-lab")?.classList.contains("active"),
      title: document.getElementById("skill-lab-title")?.textContent,
      expected,
    }), locale));
  }
  report.labSwitch = labSwitch;
  if (labSwitch.some((row) => row.locale !== row.expected || !row.labActive)) {
    failures.push("skill lab live language switch lost screen or locale");
  }
  await page.click("#btn-back-skill-lab");
  await page.waitForSelector("#screen-auth.active");

  const lobbySwitch = [];
  for (const locale of ["zh-CN", "en-US", "zh-CN", "en-US"]) {
    await setLocale(page, locale);
    lobbySwitch.push(await page.evaluate((expected) => ({
      locale: document.documentElement.getAttribute("data-locale"),
      authActive: document.getElementById("screen-auth")?.classList.contains("active"),
      brand: document.getElementById("brand-title")?.textContent,
      bannerHidden: document.getElementById("connection-banner")?.classList.contains("hidden"),
      expected,
    }), locale));
  }
  report.lobbySwitch = lobbySwitch;
  if (lobbySwitch.some((row) => row.locale !== row.expected || !row.authActive)) {
    failures.push("lobby live language switch failed");
  }
  if (lobbySwitch.some((row) => !row.bannerHidden)) {
    failures.push("language switch flashed connection restored banner");
  }

  await page.evaluate(() => {
    localStorage.setItem(
      "abyss_skill_loadout_v2",
      JSON.stringify(["DEEP_BREATH", "RECYCLE"])
    );
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.waitForSelector("#screen-auth.active");
  await setLocale(page, "en-US");
  await clickProtocol(page, "standard", "abyss", "solo");
  await page.waitForSelector("#screen-game.active", { timeout: 12000 });
  await page.waitForTimeout(700);
  const roomBefore = await page.evaluate(() => document.getElementById("game-room-id")?.textContent || "");
  const tableResidue = await collectResidue(page);
  report.tableResidueCount = tableResidue.length;
  report.tableSample = tableResidue.slice(0, 16);
  if (tableResidue.length) failures.push(`game table English residue: ${tableResidue.length}`);

  const tableSwitch = [];
  for (const locale of ["zh-CN", "en-US", "zh-CN", "en-US"]) {
    await setLocale(page, locale);
    tableSwitch.push(await page.evaluate((expected) => ({
      locale: document.documentElement.getAttribute("data-locale"),
      gameActive: document.getElementById("screen-game")?.classList.contains("active"),
      roomId: document.getElementById("game-room-id")?.textContent || "",
      fold: document.querySelector("button[data-action='fold'] .action-en")?.textContent,
      expected,
    }), locale));
  }
  report.tableSwitch = tableSwitch;
  if (
    tableSwitch.some((row) => row.locale !== row.expected || !row.gameActive || row.roomId !== roomBefore)
  ) {
    failures.push("game table live language switch lost match state");
  }

  await page.evaluate(() => {
    const modal = document.getElementById("hand-settle-modal");
    modal?.classList.remove("hidden");
  });
  await setLocale(page, "en-US");
  const settleCopy = await page.evaluate(() => ({
    verdict: document.getElementById("settle-verdict")?.textContent,
    community: document.querySelector("#settle-board .settle-label")?.textContent,
    next: document.getElementById("settle-next")?.textContent,
  }));
  report.settleCopy = settleCopy;
  if (HAN.test(String(settleCopy.verdict || "")) || HAN.test(String(settleCopy.community || ""))) {
    failures.push("settlement shell still has Chinese after English switch");
  }
  const settleSwitch = [];
  for (const locale of ["zh-CN", "en-US"]) {
    await setLocale(page, locale);
    settleSwitch.push(await page.evaluate((expected) => ({
      locale: document.documentElement.getAttribute("data-locale"),
      gameActive: document.getElementById("screen-game")?.classList.contains("active"),
      verdict: document.getElementById("settle-verdict")?.textContent,
      expected,
    }), locale));
  }
  report.settleSwitch = settleSwitch;
  await page.evaluate(() => document.getElementById("hand-settle-modal")?.classList.add("hidden"));

  await page.click("#btn-settings");
  await page.waitForTimeout(80);
  const settingsSwitch = [];
  for (const locale of ["zh-CN", "en-US", "zh-CN", "en-US"]) {
    await page.selectOption("#setting-language", locale);
    await page.waitForTimeout(80);
    settingsSwitch.push(await page.evaluate((expected) => ({
      locale: document.documentElement.getAttribute("data-locale"),
      title: document.getElementById("settings-title")?.textContent,
      expected,
    }), locale));
  }
  report.settingsSwitch = settingsSwitch;
  if (settingsSwitch.some((row) => row.locale !== row.expected)) {
    failures.push("settings language select did not persist as the single source");
  }
  await page.click("#btn-close-settings");

  const desktopOverflow = [];
  for (const viewport of DESKTOP) {
    desktopOverflow.push(await overflowAudit(page, viewport, "desktop-table"));
  }
  report.desktopOverflow = desktopOverflow.filter((row) => row.overflowX || row.clipped.length);
  if (report.desktopOverflow.length) failures.push("desktop English overflow");

  const mobileOverflow = [];
  for (const viewport of MOBILE) {
    mobileOverflow.push(await overflowAudit(page, viewport, "mobile-table"));
  }
  report.mobileOverflow = mobileOverflow.filter((row) => row.overflowX || row.clipped.length);
  if (report.mobileOverflow.length) failures.push("mobile English overflow");

  await page.setViewportSize({ width: 1440, height: 900 });
  await setLocale(page, "en-US");
  const storedBeforeReload = await page.evaluate(() => JSON.parse(localStorage.getItem("abyss_ui_settings_v2") || "{}"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const afterEnReload = await page.evaluate(() => ({
    locale: document.documentElement.getAttribute("data-locale"),
    lang: document.documentElement.lang,
    stored: JSON.parse(localStorage.getItem("abyss_ui_settings_v2") || "{}"),
  }));
  report.persistenceEn = { storedBeforeReload, afterEnReload };
  if (afterEnReload.locale !== "en-US" || afterEnReload.stored.language !== "en-US" || afterEnReload.stored.languageChosen !== true) {
    failures.push("English language did not persist across reload");
  }

  await setLocale(page, "zh-CN");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const afterZhReload = await page.evaluate(() => ({
    locale: document.documentElement.getAttribute("data-locale"),
    stored: JSON.parse(localStorage.getItem("abyss_ui_settings_v2") || "{}"),
  }));
  report.persistenceZh = afterZhReload;
  if (afterZhReload.locale !== "zh-CN" || afterZhReload.stored.language !== "zh-CN") {
    failures.push("Chinese language did not persist across reload");
  }

  console.log(JSON.stringify({ ok: failures.length === 0, failures, report }, null, 2));
  await browser.close();
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
