"use strict";

const fs = require("fs");
const path = require("path");
const skills = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", "i18n", "skills-zh-source.json"), "utf8"));

function quote(value) {
  return JSON.stringify(value);
}

const lines = [
  "(function registerZhSkillCopy(root) {",
  '  "use strict";',
  "  const i18n = root.OverlimitI18n || (typeof require === \"function\" ? require(\"./i18n\") : null);",
  "  if (!i18n) return;",
  "  i18n.register(\"zh-CN\", {",
  "    skills: {",
];

Object.keys(skills).forEach((id, index, keys) => {
  const skill = skills[id];
  lines.push(`      ${id}: {`);
  lines.push(`        name: ${quote(skill.name)},`);
  lines.push(`        catalogSummary: ${quote(skill.catalogSummary)},`);
  lines.push(`        shortDescription: ${quote(skill.shortDescription)},`);
  lines.push(`        expertDescription: ${quote(skill.expertDescription)}`);
  lines.push(`      }${index === keys.length - 1 ? "" : ","}`);
});

lines.push("    }");
lines.push("  });");
lines.push("  if (typeof module === \"object\" && module.exports) module.exports = i18n;");
lines.push("})(typeof globalThis !== \"undefined\" ? globalThis : this);");
lines.push("");

fs.writeFileSync(path.join(__dirname, "..", "public", "i18n", "skills-zh-CN.js"), lines.join("\n"), "utf8");
console.log("wrote skills-zh-CN.js");
