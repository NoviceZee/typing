import fs from "node:fs";
import path from "node:path";

const homepagePath = path.join(process.cwd(), ".next", "server", "pages", "index.html");
const html = fs.readFileSync(homepagePath, "utf8");
const feedbackPath = path.join(process.cwd(), ".next", "server", "pages", "feedback.html");
const feedbackHtml = fs.readFileSync(feedbackPath, "utf8");

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
  ["feedback page link", /href="\/feedback"/],
  ["current copyright year", new RegExp(`©\\s*(?:<!-- -->)?${new Date().getFullYear()}(?:<!-- -->)?\\s*Typing Station`)]
];

const forbiddenPatterns = [
  ["legacy FormalType share image", /formaltype-share\.png/],
  ["mailto feedback navigation", /href="mailto:feedback@typingstation\.app"/]
];

const requiredFeedbackPatterns = [
  ["feedback semantic main content", /<main\b/],
  ["feedback h1", /<h1\b[^>]*>[^]*?Send us feedback\./],
  ["feedback form", /<form\b/],
  ["feedback category field", /<select\b[^>]*name="category"/],
  ["feedback required message field", /<textarea\b[^>]*name="message"[^>]*required/],
  ["feedback optional reply field", /<input\b[^>]*type="email"[^>]*name="replyEmail"/],
  ["feedback submit action", />Send feedback</],
  ["feedback email address", /feedback@typingstation\.app/],
  ["feedback copy action", />Copy email address</],
  ["feedback noindex directive", /name="robots" content="noindex, nofollow"/]
];

const forbiddenFeedbackPatterns = [
  ["temporary coming-later copy", /built-in feedback form is coming later/i],
  ["feedback mailto navigation", /mailto:/],
  ["feedback window.open dispatch", /window\.open/],
  ["server-only Resend key", /RESEND_API_KEY/]
];

const missing = requiredPatterns
  .filter(([, pattern]) => !pattern.test(html))
  .map(([label]) => label);

const forbidden = forbiddenPatterns
  .filter(([, pattern]) => pattern.test(html))
  .map(([label]) => label);

const missingFeedback = requiredFeedbackPatterns
  .filter(([, pattern]) => !pattern.test(feedbackHtml))
  .map(([label]) => label);

const forbiddenFeedback = forbiddenFeedbackPatterns
  .filter(([, pattern]) => pattern.test(feedbackHtml))
  .map(([label]) => label);

if (missing.length > 0 || forbidden.length > 0 || missingFeedback.length > 0 || forbiddenFeedback.length > 0) {
  const details = [
    missing.length > 0 ? `missing: ${missing.join(", ")}` : "",
    forbidden.length > 0 ? `contains: ${forbidden.join(", ")}` : "",
    missingFeedback.length > 0 ? `feedback missing: ${missingFeedback.join(", ")}` : "",
    forbiddenFeedback.length > 0 ? `feedback contains: ${forbiddenFeedback.join(", ")}` : ""
  ].filter(Boolean).join("; ");
  throw new Error(`Generated public HTML verification failed (${details})`);
}

console.log(`Verified pre-rendered public HTML at ${homepagePath} and ${feedbackPath}`);
