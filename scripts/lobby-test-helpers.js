const assert = require("node:assert/strict");

async function stable(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const finite = document.getAnimations().filter((animation) =>
      animation.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(finite.map((animation) => animation.finished.catch(() => {})));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function selectLobbyMode(page, gameMode, skillMode) {
  await page.locator("#screen-auth.active").waitFor();
  await page.locator(`[data-lobby-mode-card="${skillMode}"]`).click();
  const modifier = page.locator("#lobby-overdrive");
  if ((await modifier.getAttribute("aria-checked") === "true") !== (gameMode === "overdrive")) await modifier.click();
  assert.equal(await page.locator(`[data-lobby-mode-card="${skillMode}"]`).getAttribute("aria-checked"), "true");
  assert.equal(await modifier.getAttribute("aria-checked"), String(gameMode === "overdrive"));
}

async function startLobbyAction(page, gameMode, skillMode, action) {
  await selectLobbyMode(page, gameMode, skillMode);
  await page.locator(`[data-room-action="${action}"]`).click();
}

async function openLobbyLab(page) {
  await page.locator('[data-lobby-mode-card="abyss"]').click();
  await page.locator("#btn-open-skill-lab").click();
  await page.locator("#screen-skill-lab.active").waitFor();
}

async function editLobbyName(page, value) {
  await page.locator("#btn-edit-name").click();
  await page.locator("#nickname-input").fill(value);
  await page.locator("#btn-save-name").click();
  await page.locator("#nickname-modal").waitFor({ state: "hidden" });
}

// The lobby must fit in one viewport. Inspect every hit target at scroll zero;
// scrolling a clipped control into view would conceal a layout regression.
async function auditLobbyLayout(page, viewport) {
  if (viewport) await page.setViewportSize(viewport);
  await page.evaluate(() => window.scrollTo(0, 0));
  await stable(page);
  const geometry = await page.evaluate(() => {
    const auth = document.getElementById("screen-auth");
    const parts = [auth.querySelector(".lobby-hero"), auth.querySelector(".lobby-main"), auth.querySelector(".lobby-identity-row")];
    const overlaps = parts.slice(1).flatMap((node, i) => parts[i].getBoundingClientRect().bottom > node.getBoundingClientRect().top + 1 ? [node.className] : []);
    const clippedParts = parts.filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1;
    }).map((node) => node.className);
    const textClipped = [...auth.querySelectorAll(".lobby-mode-card strong, .lobby-mode-desc, .lobby-mode-card small, .lobby-modifier-copy, #lobby-overdrive-state")]
      .filter((node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1)
      .map((node) => node.id || node.className);
    return {
      width: innerWidth, height: innerHeight,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1,
      pageScrolls: document.documentElement.scrollHeight > innerHeight + 1,
      overlaps, textClipped, clippedParts,
      footerInFlow: !["fixed", "absolute"].includes(getComputedStyle(parts[2]).position),
      oldControls: auth.querySelectorAll('.protocol-card, .protocol-btn, input[name="protocol"], input[name="game-mode"], input[name="skill-mode"], #input-name, #protocol-summary, #selected-mode-tag, #selected-skill-tag').length,
    };
  });
  const inaccessible = [];
  const controls = page.locator("#screen-auth button");
  for (let i = 0; i < await controls.count(); i++) {
    const node = controls.nth(i);
    if (!(await node.isVisible())) continue;
    const result = await node.evaluate((target) => {
      const r = target.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { name: target.id || target.textContent.trim(), reachable: r.left >= -1 && r.right <= innerWidth + 1
        && r.top >= -1 && r.bottom <= innerHeight + 1 && r.height >= 43.5 && Boolean(hit && target.contains(hit)) };
    });
    if (!result.reachable) inaccessible.push(result.name);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return { ...geometry, inaccessible, ok: !geometry.overflowX && !geometry.pageScrolls && !geometry.overlaps.length
    && !geometry.textClipped.length && !geometry.clippedParts.length && geometry.footerInFlow && geometry.oldControls === 0 && !inaccessible.length };
}

module.exports = { stable, selectLobbyMode, startLobbyAction, openLobbyLab, editLobbyName, auditLobbyLayout };
