const fs = require("fs");
const path = require("path");

require("./validate-static");
require("./test-homepage");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "public");
const staticDirectories = ["assets", "templates"];
const staticExtensions = new Set([".html", ".js", ".css", ".json", ".xml", ".txt", ".webmanifest", ".svg", ".ico"]);
const excludedFiles = new Set(["package.json", "package-lock.json", "vercel.json"]);

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isFile() || excludedFiles.has(entry.name)) continue;
  if (!staticExtensions.has(path.extname(entry.name))) continue;
  fs.copyFileSync(path.join(root, entry.name), path.join(output, entry.name));
}

for (const directory of staticDirectories) {
  const source = path.join(root, directory);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(output, directory), { recursive: true });
}

console.log("Static output generated in public/");
