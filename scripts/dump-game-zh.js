"use strict";

const fs = require("fs");
const path = require("path");

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory() && name !== "node_modules") walk(full, acc);
    else if (/\.js$/.test(name)) acc.push(full);
  }
  return acc;
}

const files = walk(path.join(__dirname, "..", "game")).concat(walk(path.join(__dirname, "..", "socket")));
const set = new Set();
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  for (const match of src.matchAll(/["'`]([^"'`]*[\u4e00-\u9fff][^"'`]*)["'`]/g)) {
    if (match[1].length <= 90) set.add(match[1]);
  }
}
process.stdout.write([...set].sort().join("\n"));
