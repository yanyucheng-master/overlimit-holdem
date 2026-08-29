"use strict";

const fs = require("fs");
const path = require("path");
const { listSkillDefinitions } = require("../game/skills/definitions");

const skills = {};
listSkillDefinitions().forEach((skill) => {
  skills[skill.id] = {
    name: skill.name,
    catalogSummary: skill.catalogSummary,
    shortDescription: skill.shortDescription,
    expertDescription: skill.expertDescription,
  };
});
fs.writeFileSync(
  path.join(__dirname, "..", "public", "i18n", "skills-zh-source.json"),
  JSON.stringify(skills, null, 2),
  "utf8"
);
console.log(Object.keys(skills).length);
