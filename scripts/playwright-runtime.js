const fs = require("fs");

function findChromiumExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function chromiumLaunchOptions(overrides = {}) {
  const executablePath = findChromiumExecutable();
  return executablePath ? { ...overrides, executablePath } : { ...overrides };
}

function pinEnUSLocale() {
  try {
    const key = "abyss_ui_settings_v2";
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(key) || "{}") || {};
    } catch (_error) {
      stored = {};
    }
    localStorage.setItem(key, JSON.stringify({
      ...stored,
      language: "en-US",
      languageChosen: true,
    }));
  } catch (_error) {
    // Ignore storage failures in verification browsers.
  }
}

function pinZhCNLocale() {
  try {
    const key = "abyss_ui_settings_v2";
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(key) || "{}") || {};
    } catch (_error) {
      stored = {};
    }
    localStorage.setItem(key, JSON.stringify({
      ...stored,
      language: "zh-CN",
      languageChosen: true,
    }));
  } catch (_error) {
    // Ignore storage failures in verification browsers.
  }
}

function pinEnUSLocaleUnlessChosen() {
  try {
    const key = "abyss_ui_settings_v2";
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(key) || "{}") || {};
    } catch (_error) {
      stored = {};
    }
    if (stored.languageChosen === true && (stored.language === "zh-CN" || stored.language === "en-US")) {
      return;
    }
    localStorage.setItem(key, JSON.stringify({
      ...stored,
      language: "en-US",
      languageChosen: true,
    }));
  } catch (_error) {
    // Ignore storage failures in verification browsers.
  }
}

module.exports = { chromiumLaunchOptions, findChromiumExecutable, pinZhCNLocale, pinEnUSLocale, pinEnUSLocaleUnlessChosen };
