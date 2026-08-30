import fs from "node:fs";
import path from "node:path";

const homepagePath = path.join(process.cwd(), ".next", "server", "pages", "index.html");
const html = fs.readFileSync(homepagePath, "utf8");
const feedbackPath = path.join(process.cwd(), ".next", "server", "pages", "feedback.html");
const feedbackHtml = fs.readFileSync(feedbackPath, "utf8");

const indexableRouteRequirements = [
  {
    route: "/practice",
    file: "practice.html",
    patterns: [
      ["semantic main content", /<main\b/],
      ["visible descriptive h1", /<h1\b(?![^>]*\bsr-only\b)[^>]*>Typing practice and speed test<\/h1>/],
      ["concise practice introduction", /Choose English or Chinese, select a timed or infinite session, and begin\. No account is required\./],
      ["practice language controls", /Practice language/]
    ]
  },
  {
    route: "/training",
    file: "training.html",
    patterns: [
      ["semantic main content", /<main\b/],
      ["visible descriptive h1", /<h1\b(?![^>]*\bsr-only\b)[^>]*>Focused typing training<\/h1>/],
      ["concise training introduction", /Choose the content, session length, and difficulty you want to isolate\./],
      ["training controls", /Training controls/]
    ]
  },
  {
    route: "/passages",
    file: "passages.html",
    patterns: [
      ["semantic main content", /<main\b/],
      ["visible descriptive h1", /<h1\b(?![^>]*\bsr-only\b)[^>]*>English and Chinese typing passages<\/h1>/],
      ["concise passage introduction", /Browse by language and category, then open any passage in Practice\./],
      ["passage search", /Search passages/]
    ]
  },
  {
    route: "/chinese-typing",
    file: "chinese-typing.html",
    patterns: [
      ["semantic main content", /<main\b/],
      ["Traditional Chinese content language", /<article\b[^>]*lang="zh-Hant"/],
      ["visible Traditional Chinese h1", /<h1\b(?![^>]*\bsr-only\b)[^>]*>繁體中文打字練習<\/h1>/],
      ["Traditional Chinese introduction", /選擇計時或不限時練習，使用你慣用的中文輸入法完成文章；毋須登入即可開始。/],
      ["one-minute Chinese practice link", /href="\/practice\?language=chinese&amp;mode=1m"/],
      ["infinite Chinese practice link", /href="\/practice\?language=chinese&amp;mode=infinite"/],
      ["Chinese passages link", /href="\/passages\?language=chinese"/],
      ["Chinese training link", /href="\/training\?content=chinese"/],
      ["IME guidance", /組字和選字期間，Typing Station 會等待文字確認後才與目標內容比對/],
      ["results explanation", /可查看輸入速度、準確度、穩定度和錯誤/]
    ]
  },
  {
    route: "/leaderboard",
    file: "leaderboard.html",
    patterns: [
      ["semantic main content", /<main\b/],
      ["leaderboard h1", /<h1\b[^>]*>Daily Leaderboard<\/h1>/],
      ["leaderboard explanation", /Ranked by WPM, then accuracy\. Only public handles are shown\./],
      ["leaderboard filters", /Leaderboard filters/]
    ]
  },
  {
    route: "/faq",
    file: "faq.html",
    patterns: [
      ["semantic main content", /<main\b/],
      ["descriptive faq h1", /<h1\b[^>]*>[^]*?Typing Station FAQ\./],
      ["faq practice answer", /Do I need an account to start typing\?/],
      ["faq Chinese IME answer", /Does Chinese input work with an IME\?/]
    ]
  }
].map((entry) => ({
  ...entry,
  path: path.join(process.cwd(), ".next", "server", "pages", entry.file)
}));

const requiredPatterns = [
  ["semantic main content", /<main\b/],
  ["homepage h1", /<h1\b[^>]*>[^]*?Type with purpose\./],
  ["English and Chinese typing-practice description", /English and Chinese typing practice/],
  ["Traditional Chinese typing-practice description", /英文及中文打字練習/],
  ["Practice link", /href="\/practice"/],
  ["Training link", /href="\/training"/],
  ["Library link", /href="\/passages"/],
  ["Leaderboard link", /href="\/leaderboard"/],
  ["Traditional Chinese typing guide link", /href="\/chinese-typing"[^>]*>中文打字練習<\/a>/],
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

const missingIndexableRouteContent = indexableRouteRequirements.flatMap(({ route, path: routePath, patterns }) => {
  const routeHtml = fs.readFileSync(routePath, "utf8");
  return patterns
    .filter(([, pattern]) => !pattern.test(routeHtml))
    .map(([label]) => `${route}: ${label}`);
});

if (
  missing.length > 0 ||
  forbidden.length > 0 ||
  missingFeedback.length > 0 ||
  forbiddenFeedback.length > 0 ||
  missingIndexableRouteContent.length > 0
) {
  const details = [
    missing.length > 0 ? `missing: ${missing.join(", ")}` : "",
    forbidden.length > 0 ? `contains: ${forbidden.join(", ")}` : "",
    missingFeedback.length > 0 ? `feedback missing: ${missingFeedback.join(", ")}` : "",
    forbiddenFeedback.length > 0 ? `feedback contains: ${forbiddenFeedback.join(", ")}` : "",
    missingIndexableRouteContent.length > 0 ? `indexable routes missing: ${missingIndexableRouteContent.join(", ")}` : ""
  ].filter(Boolean).join("; ");
  throw new Error(`Generated public HTML verification failed (${details})`);
}

console.log(`Verified pre-rendered public HTML for /, /practice, /training, /passages, /chinese-typing, /leaderboard, /faq, and /feedback`);
