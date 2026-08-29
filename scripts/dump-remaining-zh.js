const fs = require("fs");
const file = process.argv[2] || "public/client.js";
const src = fs.readFileSync(file, "utf8");
const han = /[\u4e00-\u9fff]/;
src.split(/\n/).forEach((line, index) => {
  if (!han.test(line)) return;
  console.log(String(index + 1).padStart(5) + ": " + line.trim().slice(0, 200));
});
