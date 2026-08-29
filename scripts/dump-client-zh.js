"use strict";

const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "public", "client.js"), "utf8");
const strings = new Set();
for (const match of src.matchAll(/["'`]([^"'`]*[\u4e00-\u9fff][^"'`]*)["'`]/g)) {
  strings.add(match[1]);
}
process.stdout.write([...strings].sort().join("\n"));
