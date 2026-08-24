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
  ["Leaderboard link", /href="\/leaderboard"/],
  ["Typing Station share image", /https:\/\/typingstation\.app\/typingstation-share\.png/],
  ["feedback email link", /href="mailto:feedback@typingstation\.app"/],
  ["current copyright year", new RegExp(`©\\s*(?:<!-- -->)?${new Date().getFullYear()}(?:<!-- -->)?\\s*Typing Station`)]
];

const forbiddenPatterns = [
  ["legacy FormalType share image", /formaltype-share\.png/]
];

const missing = requiredPatterns
  .filter(([, pattern]) => !pattern.test(html))
  .map(([label]) => label);

const forbidden = forbiddenPatterns
  .filter(([, pattern]) => pattern.test(html))
  .map(([label]) => label);

if (missing.length > 0 || forbidden.length > 0) {
  const details = [
    missing.length > 0 ? `missing: ${missing.join(", ")}` : "",
    forbidden.length > 0 ? `contains: ${forbidden.join(", ")}` : ""
  ].filter(Boolean).join("; ");
  throw new Error(`Generated homepage HTML verification failed (${details})`);
}

console.log(`Verified pre-rendered homepage HTML at ${homepagePath}`);
