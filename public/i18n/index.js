"use strict";

require("./i18n");
require("./catalog-zh-CN");
require("./catalog-en-US");
require("./skills-zh-CN");
require("./skills-en-US");

module.exports = typeof globalThis !== "undefined" ? globalThis.OverlimitI18n : require("./i18n");
