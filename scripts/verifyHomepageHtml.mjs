import fs from "node:fs";
import path from "node:path";

const homepagePath = path.join(process.cwd(), ".next", "server", "pages", "index.html");
const html = fs.readFileSync(homepagePath, "utf8");

const requiredPatterns = [
  ["semantic main content", /<main\b/],
  ["homepage h1", /<h1\b[^>]*>[^]*?Type with purpose\./],
  ["English and Chinese typing-practice description", /English and Chinese typing practice/],
  ["Traditional Chinese typing-practice description", /英文及中文打字練習/],
  ["Practice link", /href="\/practice"/],
  ["Training link", /href="\/training"/],
  ["Library link", /href="\/passages"/],
  ["Leaderboard link", /href="\/leaderboard"/]
];

const missing = requiredPatterns
  .filter(([, pattern]) => !pattern.test(html))
  .map(([label]) => label);

if (missing.length > 0) {
  throw new Error(`Generated homepage HTML is missing: ${missing.join(", ")}`);
}

console.log(`Verified pre-rendered homepage HTML at ${homepagePath}`);
