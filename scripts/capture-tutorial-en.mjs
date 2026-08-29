#!/usr/bin/env node
/**
 * Recapture English Quick Start screenshots from a live en-US session.
 * Writes public/assets/tutorial/en-US/shot-0X-*.png without touching Chinese assets.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import playwrightRuntime from "./playwright-runtime.js";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3002";
const OUTPUT = path.resolve("public/assets/tutorial/en-US");
const LOADOUT = ["DESTINY", "LOAN"];
const SHOTS = {
  preflop: path.join(OUTPUT, "shot-01-preflop.png"),
  flop: path.join(OUTPUT, "shot-02-flop.png"),
  showdown: path.join(OUTPUT, "shot-03-showdown.png"),
  loadout: path.join(OUTPUT, "shot-04-loadout.png"),
  skillTable: path.join(OUTPUT, "shot-05-skill-table.png"),
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function prepareCaptureChrome(page) {
  await page.addStyleTag({
    content: "#connection-banner, #toast-region { display: none !important; }",
  });
  await page.evaluate(() => {
    const input = document.getElementById("input-name");
    if (input) input.value = "player1";
    sessionStorage.setItem("abyss_player_name", "player1");
  });
  await page.waitForFunction(() => document.documentElement.getAttribute("data-locale") === "en-US");
  await page.waitForSelector("body.i18n-ready");
}

function clickProtocol(page, gameMode, skillMode, action) {
  return page.evaluate(({ gameMode, skillMode, action }) => {
    const card = document.querySelector(
      `.protocol-card[data-game-mode="${gameMode}"][data-skill-mode="${skillMode}"]`
    );
    const btn = card?.querySelector(`.protocol-btn[data-room-action="${action}"]`);
    if (!btn) throw new Error(`protocol button missing: ${gameMode}/${skillMode}/${action}`);
    btn.click();
  }, { gameMode, skillMode, action });
}

async function startSolo(page, gameMode, skillMode) {
  await page.waitForSelector("#screen-auth.active", { timeout: 15000 });
  if (skillMode === "abyss") await waitForLoadoutReady(page);
  await clickProtocol(page, gameMode, skillMode, "solo");
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    const active = await page.evaluate(() =>
      document.getElementById("screen-game")?.classList.contains("active")
    );
    if (active) return;
    await page.evaluate(() => {
      const confirm = document.getElementById("btn-confirm-loadout");
      if (confirm && !confirm.disabled) confirm.click();
    });
    await sleep(200);
  }
  throw new Error(`solo game did not start (${gameMode}/${skillMode})`);
}

async function leaveTable(page) {
  await page.evaluate(() => {
    document.getElementById("btn-back-game")?.click();
    document.getElementById("btn-leave-confirm")?.click();
  });
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const atLobby = await page.evaluate(() =>
      document.getElementById("screen-auth")?.classList.contains("active")
    );
    if (atLobby) return;
    await page.evaluate(() => {
      document.getElementById("btn-back-game")?.click();
      document.getElementById("btn-leave-confirm")?.click();
    });
    await sleep(250);
  }
  throw new Error("failed to return to lobby");
}

function readTable() {
  return {
    gameActive: document.getElementById("screen-game")?.classList.contains("active") || false,
    locale: document.documentElement.getAttribute("data-locale") || "",
    opponent: (document.getElementById("opponent-name")?.textContent || "").trim(),
    phase: (document.getElementById("phase-text")?.textContent || "").trim(),
    board: [...document.querySelectorAll("#community-cards .card")].filter(
      (card) => !card.classList.contains("card-slot") && !card.classList.contains("back")
    ).length,
    myTurn: ["check", "call", "allin"].some((action) => {
      const btn = document.querySelector(`button[data-action="${action}"]`);
      return Boolean(btn && !btn.disabled);
    }),
    settleOpen: !document.getElementById("hand-settle-modal")?.classList.contains("hidden"),
    settleBoard: document.querySelectorAll("#settle-community .card").length,
    settleOppCards: document.querySelectorAll("#settle-opp-cards .card").length,
    settleText: (document.getElementById("hand-settle-modal")?.innerText || "").replace(/\s+/g, " "),
    skillNames: [...document.querySelectorAll("#skill-bar .skill-use-btn")].map((btn) =>
      (btn.textContent || "").replace(/\s+/g, " ").trim()
    ),
    gameOver: !document.getElementById("game-over-modal")?.classList.contains("hidden"),
  };
}

function actPassively() {
  for (const action of ["check", "call", "allin"]) {
    const btn = document.querySelector(`button[data-action="${action}"]`);
    if (btn && !btn.disabled) {
      btn.click();
      return action;
    }
  }
  return null;
}

async function screenshotViewport(page, dest) {
  await page.screenshot({ path: dest, fullPage: false, type: "png" });
}

async function waitForLoadoutReady(page) {
  await page.waitForFunction(
    () => document.getElementById("skill-prep-status")?.classList.contains("ready"),
    null,
    { timeout: 15000 }
  );
}

async function captureLoadout(page) {
  await waitForLoadoutReady(page);
  await page.click("#btn-open-skill-lab");
  await page.waitForSelector("#screen-skill-lab.active");
  await page.waitForSelector('.skill-card[data-skill-id="LOAN"]');
  await page.evaluate(() => {
    for (const id of ["DESTINY", "LOAN"]) {
      const card = document.querySelector(`.skill-card[data-skill-id="${id}"]`);
      if (card && !card.classList.contains("selected")) {
        card.querySelector(".skill-card-select")?.click();
      }
    }
  });
  await page.waitForSelector('.skill-card[data-skill-id="LOAN"].selected');
  await page.waitForSelector('.skill-card[data-skill-id="DESTINY"].selected');
  await page.evaluate(() => {
    document.querySelector('.skill-card[data-skill-id="LOAN"]')?.scrollIntoView({ block: "center", inline: "nearest" });
  });
  await sleep(400);
  const copy = await page.evaluate(() => ({
    title: (document.getElementById("skill-lab-title")?.textContent || "").trim(),
    status: (document.getElementById("skill-lab-status")?.textContent || "").trim(),
    destiny: (document.querySelector('.skill-card[data-skill-id="DESTINY"] strong')?.textContent || "").trim(),
    loan: (document.querySelector('.skill-card[data-skill-id="LOAN"] strong')?.textContent || "").trim(),
  }));
  if (copy.destiny !== "Destiny" || copy.loan !== "Loan") {
    throw new Error(`skill lab not English: ${JSON.stringify(copy)}`);
  }
  if (/[\u4e00-\u9fff]/.test(`${copy.title} ${copy.status}`)) {
    throw new Error(`skill lab still has Chinese copy: ${JSON.stringify(copy)}`);
  }
  await screenshotViewport(page, SHOTS.loadout);
  await page.click("#btn-back-skill-lab");
  await page.waitForSelector("#screen-auth.active");
  return copy;
}

async function captureNoSkillShots(page) {
  const got = { preflop: false, flop: false, showdown: false };
  let matches = 0;
  while (matches < 4 && (!got.preflop || !got.flop || !got.showdown)) {
    matches += 1;
    await startSolo(page, "standard", "off");
    const handDeadline = Date.now() + 120000;
    while (Date.now() < handDeadline && (!got.preflop || !got.flop || !got.showdown)) {
      const snap = await page.evaluate(readTable);
      if (snap.locale !== "en-US") throw new Error("table locale drifted away from en-US");
      if (snap.gameOver) break;
      if (snap.settleOpen) {
        const isShowdown = snap.settleBoard >= 3 && snap.settleOppCards >= 2 && !/Folded|folded|弃牌/.test(snap.settleText);
        if (isShowdown && !got.showdown) {
          if (snap.settleText.includes("超限AI")) {
            throw new Error("showdown still shows Chinese bot name");
          }
          await sleep(180);
          await screenshotViewport(page, SHOTS.showdown);
          got.showdown = true;
        }
        await page.waitForFunction(
          () => document.getElementById("hand-settle-modal")?.classList.contains("hidden"),
          null,
          { timeout: 9000 }
        ).catch(() => {});
        continue;
      }
      if (snap.opponent && snap.opponent !== "Overlimit AI") {
        throw new Error(`expected Overlimit AI, got ${snap.opponent}`);
      }
      if (snap.myTurn && snap.phase === "PRE-FLOP" && snap.board === 0 && !got.preflop) {
        await sleep(220);
        await screenshotViewport(page, SHOTS.preflop);
        got.preflop = true;
      }
      if (snap.myTurn && snap.phase === "FLOP" && snap.board >= 3 && !got.flop) {
        await sleep(220);
        await screenshotViewport(page, SHOTS.flop);
        got.flop = true;
      }
      if (snap.myTurn) await page.evaluate(actPassively);
      await sleep(180);
    }
    await leaveTable(page);
  }
  if (!got.preflop || !got.flop || !got.showdown) {
    throw new Error(`missing no-skill shots: ${JSON.stringify(got)}`);
  }
  return got;
}

async function captureSkillTable(page) {
  await startSolo(page, "standard", "abyss");
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const snap = await page.evaluate(readTable);
    if (snap.gameOver) break;
    if (snap.settleOpen) {
      await page.waitForFunction(
        () => document.getElementById("hand-settle-modal")?.classList.contains("hidden"),
        null,
        { timeout: 9000 }
      ).catch(() => {});
      continue;
    }
    const hasSkills = snap.skillNames.some((name) => /Destiny/i.test(name))
      && snap.skillNames.some((name) => /Loan/i.test(name));
    const flopReady = snap.myTurn && snap.phase === "FLOP" && snap.board >= 3 && hasSkills;
    const fallbackReady = snap.myTurn && hasSkills && snap.phase !== "WAIT" && snap.phase !== "等待";
    if (flopReady || (Date.now() + 8000 > deadline && fallbackReady)) {
      if (snap.opponent !== "Overlimit AI") throw new Error(`skill table opponent is ${snap.opponent}`);
      if (snap.skillNames.some((name) => /[\u4e00-\u9fff]/.test(name))) {
        throw new Error(`skill bar still Chinese: ${snap.skillNames.join(" | ")}`);
      }
      await sleep(220);
      await screenshotViewport(page, SHOTS.skillTable);
      await leaveTable(page);
      return { phase: snap.phase, skills: snap.skillNames };
    }
    if (snap.myTurn) await page.evaluate(actPassively);
    await sleep(180);
  }
  await leaveTable(page).catch(() => {});
  throw new Error("failed to capture skill table");
}

async function main() {
  await fs.mkdir(OUTPUT, { recursive: true });
  const browser = await chromium.launch(playwrightRuntime.chromiumLaunchOptions({ headless: true }));
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(playwrightRuntime.pinEnUSLocale);
  await context.addInitScript((loadout) => {
    localStorage.setItem("overlimit_quickstart_v1", "seen");
    localStorage.setItem("abyss_skill_loadout_v2", JSON.stringify(loadout));
    sessionStorage.setItem("abyss_player_name", "player1");
  }, LOADOUT);

  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("#screen-auth.active");
  await prepareCaptureChrome(page);
  await waitForLoadoutReady(page);

  const report = {
    loadout: await captureLoadout(page),
    noSkill: await captureNoSkillShots(page),
    skillTable: await captureSkillTable(page),
    files: {},
  };
  for (const [key, filePath] of Object.entries(SHOTS)) {
    const stat = await fs.stat(filePath);
    report.files[key] = { path: filePath, bytes: stat.size };
    if (stat.size < 20_000) throw new Error(`${key} screenshot too small`);
  }

  await browser.close();
  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
