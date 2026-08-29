(function initOverlimitI18n(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OverlimitI18n = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildOverlimitI18n() {
  "use strict";

  const LOCALES = Object.freeze(["zh-CN", "en-US"]);
  const FALLBACK_LOCALE = "zh-CN";
  const catalogs = Object.create(null);
  const missingKeys = [];
  let locale = FALLBACK_LOCALE;
  let onChange = null;

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function flatten(source, prefix, target) {
    Object.keys(source || {}).forEach((key) => {
      const path = prefix ? prefix + "." + key : key;
      const value = source[key];
      if (isPlainObject(value)) flatten(value, path, target);
      else target[path] = value == null ? "" : String(value);
    });
    return target;
  }

  function register(localeId, dictionary) {
    if (!LOCALES.includes(localeId) || !dictionary) return;
    catalogs[localeId] = Object.assign(catalogs[localeId] || Object.create(null), flatten(dictionary, "", Object.create(null)));
  }

  function interpolate(template, vars) {
    if (!vars || typeof template !== "string") return template;
    return template.replace(/\{(\w+)\}/g, (match, name) => (
      Object.prototype.hasOwnProperty.call(vars, name) && vars[name] != null ? String(vars[name]) : match
    ));
  }

  function lookup(localeId, key) {
    const table = catalogs[localeId];
    if (!table || !Object.prototype.hasOwnProperty.call(table, key)) return null;
    return table[key];
  }

  function t(key, vars) {
    const id = String(key || "");
    let value = lookup(locale, id);
    if (value == null && locale !== FALLBACK_LOCALE) value = lookup(FALLBACK_LOCALE, id);
    if (value == null) {
      if (!missingKeys.includes(id)) missingKeys.push(id);
      return "[missing:" + id + "]";
    }
    return interpolate(value, vars);
  }

  function has(key) {
    return lookup(locale, key) != null || lookup(FALLBACK_LOCALE, key) != null;
  }

  function catalogKeys(localeId) {
    return Object.keys(catalogs[localeId] || {}).sort();
  }

  function isChineseTag(tag) {
    const value = String(tag || "").trim().toLowerCase();
    if (!value) return false;
    if (value === "zh" || value === "zh-cn" || value === "zh-sg") return true;
    if (value.startsWith("zh-hans") || value.startsWith("zh-cn") || value.startsWith("zh-sg")) return true;
    return false;
  }

  function detectBrowserLanguage(languages) {
    const list = Array.isArray(languages) && languages.length
      ? languages
      : (typeof navigator !== "undefined"
        ? [].concat(navigator.languages || [], navigator.language || [])
        : []);
    const first = String(list[0] || "").trim();
    if (!first) return FALLBACK_LOCALE;
    return isChineseTag(first) ? "zh-CN" : "en-US";
  }

  function htmlLang(localeId) {
    return localeId === "en-US" ? "en" : "zh-CN";
  }

  function setLocale(nextLocale, { silent = false } = {}) {
    const resolved = LOCALES.includes(nextLocale) ? nextLocale : FALLBACK_LOCALE;
    const changed = resolved !== locale;
    locale = resolved;
    if (!silent && changed && typeof onChange === "function") onChange(locale);
    return locale;
  }

  function applyDom(root) {
    if (typeof document === "undefined") return;
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (!key) return;
      const text = t(key);
      node.textContent = text;
      if (node.hasAttribute("data-char")) node.setAttribute("data-char", text);
    });
    scope.querySelectorAll("[data-i18n-html]").forEach((node) => {
      const key = node.getAttribute("data-i18n-html");
      if (!key) return;
      node.innerHTML = t(key);
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      const key = node.getAttribute("data-i18n-placeholder");
      if (key) node.setAttribute("placeholder", t(key));
    });
    scope.querySelectorAll("[data-i18n-attr]").forEach((node) => {
      String(node.getAttribute("data-i18n-attr") || "").split(/\s+/).forEach((pair) => {
        const split = pair.indexOf(":");
        if (split < 1) return;
        const attr = pair.slice(0, split);
        const key = pair.slice(split + 1);
        if (attr && key) node.setAttribute(attr, t(key));
      });
    });
  }

  function bindChange(handler) {
    onChange = typeof handler === "function" ? handler : null;
  }

  function resetMissingKeys() {
    missingKeys.length = 0;
  }

  return {
    LOCALES,
    FALLBACK_LOCALE,
    register,
    t,
    has,
    catalogKeys,
    flatten,
    detectBrowserLanguage,
    htmlLang,
    getLocale() { return locale; },
    setLocale,
    applyDom,
    bindChange,
    missingKeys,
    resetMissingKeys,
  };
});
