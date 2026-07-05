import type { PracticeCategory } from "./typing-engine";
import type { StoredPassage } from "./app-storage";

export type TrainingContentType = "words" | "numbers" | "symbols" | "code" | "chinese";
export type TrainingMode = "time" | "words";
export type TrainingWordDifficulty = "basic" | "intermediate" | "advanced" | "mixed";

export type TrainingTextInput = {
  contentTypes: TrainingContentType[];
  tokenCount: number;
  wordDifficulty?: TrainingWordDifficulty;
};

export type TrainingPassageInput = {
  contentTypes: TrainingContentType[];
  mode: TrainingMode;
  durationSeconds?: number;
  wordCount?: number;
  wordDifficulty?: TrainingWordDifficulty;
};

const CONTENT_ORDER: TrainingContentType[] = ["words", "numbers", "symbols", "code", "chinese"];

const BASIC_WORDS = [
  "able", "also", "area", "away", "back", "base", "best", "bill", "book", "call",
  "card", "care", "case", "city", "come", "cost", "data", "date", "desk", "done",
  "down", "each", "early", "easy", "file", "find", "fine", "firm", "five", "form",
  "four", "free", "from", "give", "goal", "good", "grow", "half", "hand", "hard",
  "help", "hold", "home", "hour", "idea", "item", "keep", "kind", "late", "lead",
  "left", "less", "line", "list", "long", "look", "made", "mail", "main", "make",
  "many", "mark", "meet", "mind", "more", "most", "move", "much", "name", "near",
  "need", "next", "note", "open", "over", "page", "paid", "part", "past", "plan",
  "post", "read", "real", "room", "sale", "save", "send", "show", "side", "sign",
  "site", "step", "task", "team", "term", "test", "text", "time", "type", "unit",
  "user", "view", "week", "well", "work", "year"
];

const INTERMEDIATE_WORDS = [
  "account", "agenda", "analysis", "approval", "balance", "booking", "briefing", "budget",
  "campaign", "capacity", "channel", "client", "comment", "company", "confirm", "contact",
  "contract", "control", "delivery", "department", "design", "details", "document", "estimate",
  "feedback", "forecast", "handover", "invoice", "meeting", "message", "milestone", "monitor",
  "network", "notice", "office", "payment", "pipeline", "policy", "priority", "process",
  "product", "profile", "program", "project", "proposal", "quality", "quarter", "record",
  "report", "request", "resource", "response", "review", "schedule", "service", "session",
  "shipment", "standard", "status", "strategy", "summary", "supplier", "support", "target",
  "timeline", "tracking", "training", "transfer", "update", "vendor", "workflow", "workshop",
  "allocation", "baseline", "calendar", "category", "coverage", "customer", "dashboard", "decision",
  "delivery", "discount", "forecast", "guidance", "handoff", "inventory", "iteration", "manager",
  "objective", "operation", "overview", "planning", "portfolio", "position", "progress", "purchase",
  "revision", "roadmap", "security", "solution", "statement", "template", "tracking", "variance",
  "workload", "approval", "briefing", "campaign", "capacity", "contract", "document", "estimate",
  "feedback", "milestone", "pipeline", "proposal", "resource", "shipment", "strategy", "supplier"
];

const ADVANCED_WORDS = [
  "accountability", "administration", "alignment", "authorisation", "benchmarking", "collaboration",
  "commercialisation", "communication", "compliance", "configuration", "consolidation", "contingency",
  "coordination", "deliverable", "documentation", "effectiveness", "implementation", "infrastructure",
  "institutional", "integration", "interdependency", "intervention", "justification", "methodology",
  "negotiation", "optimisation", "organisation", "performance", "prioritisation", "procurement",
  "professional", "reconciliation", "recommendation", "regulation", "relationship", "representative",
  "requirement", "responsibility", "specification", "standardisation", "stakeholder", "sustainability",
  "transformation", "verification", "assessment", "certification", "classification", "consultation",
  "deployment", "escalation", "governance", "modification", "operational", "presentation",
  "qualification", "realignment", "restructuring", "transparency", "utilisation", "validation",
  "adaptability", "architecture", "authoritative", "capability", "compatibility", "confidential",
  "consideration", "continuity", "dependency", "development", "differentiation", "distribution",
  "evaluation", "facilitation", "feasibility", "harmonisation", "interdepartmental", "jurisdiction",
  "maintainability", "modernisation", "negotiable", "obligation", "participation", "predictability",
  "preparation", "productivity", "reliability", "reputation", "resolution", "scheduling",
  "segmentation", "supervision", "transactional", "transition", "understanding", "workstream",
  "workforce", "assurance", "clarification", "collateral", "endorsement", "engagement",
  "governance", "implementation", "memorandum", "optimisation", "professional", "reconciliation"
];

const BRACKETS = ["()", "[]", "{}", "<>", "(item)", "[0]", "{key}", "<tag>"];
const QUOTES = ['""', "''", "``", '"value"', "'key'", "`code`"];
const PUNCTUATION = [".", ",", ";", ":", "...", "a,b", "end.", "next:"];
const OPERATORS = ["+", "-", "*", "/", "=", "==", "!=", ">=", "<=", "+=", "-=", "*=", "/="];
const SYMBOL_ROW = ["!", "@", "#", "$", "%", "^", "&", "*", "!important", "@home", "#tag", "$total", "rate%"];
const SYMBOL_GROUPS = [BRACKETS, QUOTES, PUNCTUATION, OPERATORS, SYMBOL_ROW];

const BASIC_CODE_SNIPPETS = [
  "const total = price * quantity;",
  "let count = items.length;",
  "return value ?? fallback;",
  "console.log(item);",
  "const userName = user.name;",
  "items.push(nextItem);",
  "const isReady = status === \"ready\";",
  "return formatCurrency(total);"
];

const INTERMEDIATE_CODE_SNIPPETS = [
  "if (result.ok) {\n  return data;\n}",
  "for (const item of items) {\n  console.log(item);\n}",
  "function calculateTotal(price, quantity) {\n  return price * quantity;\n}",
  "const activeUsers = users.filter((user) => user.active);",
  "if (count >= limit) {\n  throw new Error(\"Limit reached\");\n}",
  "for (let index = 0; index < rows.length; index += 1) {\n  total += rows[index].amount;\n}"
];

const ADVANCED_CODE_SNIPPETS = [
  "async function loadProfile(userId) {\n  const response = await fetch(`/api/users/${userId}`);\n  if (!response.ok) {\n    throw new Error(\"Profile request failed\");\n  }\n  return response.json();\n}",
  "const totals = invoices.reduce((summary, invoice) => {\n  const key = invoice.paid ? \"paid\" : \"open\";\n  summary[key] += invoice.amount;\n  return summary;\n}, { paid: 0, open: 0 });",
  "try {\n  const payload = JSON.parse(message.body);\n  await queue.add({ id: payload.id, retry: false });\n} catch (error) {\n  logger.error(\"Invalid message\", error);\n}",
  "for (const [key, value] of Object.entries(settings)) {\n  if (value == null) {\n    delete settings[key];\n    continue;\n  }\n  normalized[key] = String(value).trim();\n}"
];

const BASIC_CHINESE_TERMS = [
  "今天", "明天", "工作", "時間", "朋友", "公司", "學校", "香港", "開始", "完成",
  "需要", "知道", "可以", "生活", "事情", "地方", "回家", "吃飯", "休息", "早上",
  "晚上", "電話", "電腦", "出門", "回覆", "看看", "聽到", "寫字", "買東西", "見面",
  "家人", "天氣", "路上", "現在", "下次", "一起", "問題", "答案", "名字", "城市",
  "房間", "車站", "老師", "學生", "閱讀", "練習", "清楚", "簡單", "重要", "準備",
  "我", "你", "他", "她", "人", "家", "水", "飯", "車", "天",
  "大", "小", "好", "多", "少", "新", "舊", "高", "低", "快",
  "慢", "前", "後", "左", "右", "上", "下", "中", "內", "外",
  "手", "口", "眼", "心", "書", "門", "路", "街", "樓", "店",
  "茶", "湯", "菜", "魚", "肉", "米", "糖", "奶", "筆", "紙",
  "火", "雨", "風", "月", "日", "夜", "山", "海", "河", "橋",
  "爸", "媽", "哥", "姐", "弟", "妹", "男", "女", "小孩", "老人",
  "媽媽", "爸爸", "哥哥", "姐姐", "弟弟", "妹妹", "同學", "同事", "午飯", "晚飯",
  "上班", "下班", "出去", "回來", "回到", "走路", "坐車", "開車", "上車", "下車",
  "買菜", "買書", "喝水", "喝茶", "看書", "看戲", "聽歌", "唱歌", "說話", "打字",
  "上課", "放學", "睡覺", "起床", "洗手", "開門", "關門", "開燈", "關燈", "拿走",
  "放下", "找到", "想到", "問我", "給你", "給他", "很好", "不好", "很大", "很小",
  "這個", "那個", "這裡", "那裡", "哪裡", "甚麼", "為何", "多少", "每天", "昨天",
  "後天", "今年", "明年", "上午", "下午", "中午", "週末", "生日", "市場", "公園",
  "醫生", "護士", "餐廳", "商店", "銀行", "郵局", "機場", "巴士", "地鐵", "火車"
];

const INTERMEDIATE_CHINESE_TERMS = [
  "安排", "確認", "處理", "更新", "聯絡", "會議", "文件", "資料", "申請", "批准",
  "進度", "方案", "報告", "通知", "部門", "客戶", "項目", "系統", "要求", "改善",
  "協調", "跟進", "提交", "回覆", "審核", "預算", "合約", "流程", "培訓", "支援",
  "紀錄", "服務", "目標", "責任", "期限", "風險", "變更", "查詢", "表格", "指引",
  "成員", "主管", "團隊", "內容", "狀態", "建議", "成本", "質量", "版本", "測試",
  "管理", "行政", "人事", "財務", "採購", "銷售", "市場", "營運", "物流", "庫存",
  "訂單", "付款", "收款", "發票", "報價", "條款", "細節", "附件", "備註", "草稿",
  "摘要", "重點", "背景", "原因", "影響", "範圍", "標準", "政策", "規定", "程序",
  "角色", "權限", "帳戶", "密碼", "登入", "平台", "頁面", "功能", "設定", "選項",
  "篩選", "排序", "搜尋", "下載", "上載", "備份", "安全", "權責", "分工", "交付",
  "驗收", "維護", "監察", "評估", "統計", "分析", "指標", "效率", "效益", "表現",
  "能力", "需求", "資源", "人手", "排期", "時程", "節點", "里程碑", "優先", "延誤",
  "異常", "錯誤", "修正", "核對", "覆核", "存檔", "歸檔", "分類", "標籤", "清單",
  "清理", "整合", "轉交", "協助", "查核", "確認書", "申請表", "通知書", "工作表", "記錄表",
  "報告書", "會議室", "工作坊", "培訓班", "負責人", "聯絡人", "管理員", "使用者", "供應商", "承辦商",
  "合作方", "服務台", "支援組", "審批人", "截止日", "生效日", "到期日", "更新日", "參考號", "文件夾"
];

const ADVANCED_CHINESE_TERMS = [
  "行政管理", "項目協調", "資源分配", "風險評估", "工作流程", "持續改善", "執行情況", "整體效益",
  "統籌安排", "具體措施", "長遠規劃", "綜合評估", "循序漸進", "精益求精", "一絲不苟", "全力以赴",
  "隨機應變", "事半功倍", "未雨綢繆", "持之以恆", "迎刃而解", "實事求是", "按部就班", "井然有序",
  "深思熟慮", "當機立斷", "融會貫通", "舉一反三", "與時並進", "相輔相成", "有條不紊", "集思廣益",
  "溝通協調", "策略規劃", "績效評估", "資源整合", "流程優化", "持續發展", "實施方案", "管理制度",
  "運作效率", "應變能力", "專業判斷", "政策分析", "跨部門合作", "優先次序", "執行細節", "成效檢討",
  "制度完善", "職能分工", "權責清晰", "程序合規", "監督機制", "質量保證", "服務承諾", "客戶關係",
  "財務監控", "預算管理", "成本控制", "採購策略", "合約管理", "供應鏈管理", "資料治理", "資訊安全",
  "系統整合", "平台優化", "流程再造", "變更管理", "知識管理", "人才培訓", "團隊建設", "績效指標",
  "營運模式", "市場定位", "品牌形象", "服務設計", "使用者體驗", "需求分析", "可行性研究", "風險控制",
  "危機處理", "應急方案", "決策支援", "數據分析", "趨勢研判", "政策配套", "法規遵循", "審計追蹤",
  "內部控制", "持續監察", "整體部署", "階段目標", "核心能力", "長效機制", "跨界合作", "利益相關者",
  "審慎評估", "務實推進", "統一標準", "分層負責", "精準執行", "穩步落實", "全面檢討", "重點突破",
  "因地制宜", "循證決策", "多方協作", "前瞻思維", "穩中求進", "以人為本", "公開透明", "嚴謹細緻",
  "寬嚴有度", "善用資源", "化繁為簡", "反覆推敲", "融通中外", "承先啟後", "因勢利導", "見微知著",
  "厚積薄發", "精準到位", "環環相扣", "層層把關", "審時度勢", "群策群力", "高瞻遠矚", "落地執行"
];

export function buildTrainingText({ contentTypes, tokenCount, wordDifficulty = "intermediate" }: TrainingTextInput): string {
  const selectedTypes = normaliseContentTypes(contentTypes);

  if (selectedTypes.includes("code")) {
    return buildCodeText(tokenCount, wordDifficulty);
  }

  if (selectedTypes.includes("chinese")) {
    return buildChineseTokensByCount(tokenCount, wordDifficulty).join("");
  }

  const tokens: string[] = [];
  const nextWord = createWordGenerator(wordDifficulty);

  for (const contentType of selectedTypes) {
    tokens.push(buildToken(contentType, nextWord));
  }

  while (tokens.length < tokenCount) {
    tokens.push(buildToken(selectedTypes[tokens.length % selectedTypes.length], nextWord));
  }

  return shuffleInWindows(tokens, selectedTypes.length).join(" ");
}

export function buildTrainingPassage({
  contentTypes,
  mode,
  durationSeconds = 60,
  wordCount,
  wordDifficulty = "intermediate"
}: TrainingPassageInput): StoredPassage {
  const selectedTypes = normaliseContentTypes(contentTypes);
  const tokenCount = mode === "words" ? wordCount ?? 25 : getTimedTokenCount(durationSeconds);
  const category = getTrainingCategory(selectedTypes);
  const isChinese = selectedTypes.includes("chinese");
  const displayTokens = isChinese ? buildChineseTokensByCount(tokenCount, wordDifficulty) : undefined;
  const text = displayTokens ? displayTokens.join("") : buildTrainingText({ contentTypes: selectedTypes, tokenCount, wordDifficulty });

  return {
    id: `training-${selectedTypes.join("-")}`,
    title: getTrainingPassageTitle(selectedTypes),
    category,
    style: mode === "words" ? `${tokenCount} words` : `${durationSeconds}s`,
    source: "generated",
    text,
    comparableText: isChinese ? text : undefined,
    displayTokens,
    metricUnit: "wpm",
    updatedAt: new Date().toISOString()
  };
}

function getTrainingPassageTitle(contentTypes: TrainingContentType[]): string {
  const labels = contentTypes.map((contentType) => contentType[0].toUpperCase() + contentType.slice(1));
  return `Training ${labels.join(" ")}`;
}

export function getTrainingCategory(contentTypes: TrainingContentType[]): PracticeCategory {
  const selectedTypes = normaliseContentTypes(contentTypes);
  return `training_${selectedTypes.join("_")}` as PracticeCategory;
}

function normaliseContentTypes(contentTypes: TrainingContentType[]): TrainingContentType[] {
  if (contentTypes.includes("code")) {
    return ["code"];
  }

  if (contentTypes.includes("chinese")) {
    return ["chinese"];
  }

  const selected = CONTENT_ORDER.filter((contentType) => contentTypes.includes(contentType));
  return selected.length > 0 ? selected : ["words"];
}

function getTimedTokenCount(durationSeconds: number): number {
  return Math.max(75, Math.min(600, Math.ceil(durationSeconds * 5)));
}

function buildToken(contentType: TrainingContentType, nextWord: () => string): string {
  if (contentType === "words") {
    return nextWord();
  }

  if (contentType === "numbers") {
    return buildNumberToken();
  }

  if (contentType === "code") {
    return pickRandom(getCodePool("intermediate"));
  }

  if (contentType === "chinese") {
    return pickRandom(getChinesePool("intermediate"));
  }

  return pickRandom(pickRandom(SYMBOL_GROUPS));
}

function buildChineseTokensByCount(tokenCount: number, difficulty: TrainingWordDifficulty): string[] {
  const nextChineseTerm = createChineseGenerator(difficulty);
  return Array.from({ length: tokenCount }, () => nextChineseTerm());
}

function buildCodeText(tokenCount: number, difficulty: TrainingWordDifficulty): string {
  const pool = getCodePool(difficulty);
  const targetCharacterCount = Math.max(500, Math.min(1_800, tokenCount * 6));
  const snippets: string[] = [];
  let characterCount = 0;

  while (characterCount < targetCharacterCount || snippets.length < Math.max(4, Math.ceil(tokenCount / 12))) {
    const snippet = pickRandom(pool);
    snippets.push(snippet);
    characterCount += snippet.length + 2;
  }

  return snippets.join("\n\n");
}

function createWordGenerator(difficulty: TrainingWordDifficulty): () => string {
  let deck = shuffle(getWordPool(difficulty));

  return () => {
    if (deck.length === 0) {
      deck = shuffle(getWordPool(difficulty));
    }

    return deck.pop() ?? pickRandom(getWordPool(difficulty));
  };
}

function createChineseGenerator(difficulty: TrainingWordDifficulty): () => string {
  const pool = getChinesePool(difficulty);
  let deck = shuffle(pool);
  let previousTerm = "";

  return () => {
    if (deck.length === 0) {
      deck = shuffle(pool);
    }

    let term = deck.pop() ?? pickRandom(pool);
    if (term === previousTerm && deck.length > 0) {
      const alternate = deck.pop() ?? term;
      deck.unshift(term);
      term = alternate;
    }
    previousTerm = term;
    return term;
  };
}

function getWordPool(difficulty: TrainingWordDifficulty): string[] {
  if (difficulty === "basic") {
    return uniqueWords(BASIC_WORDS);
  }

  if (difficulty === "advanced") {
    return uniqueWords(ADVANCED_WORDS);
  }

  if (difficulty === "mixed") {
    return uniqueWords([...BASIC_WORDS, ...INTERMEDIATE_WORDS, ...ADVANCED_WORDS]);
  }

  return uniqueWords(INTERMEDIATE_WORDS);
}

function getCodePool(difficulty: TrainingWordDifficulty): string[] {
  if (difficulty === "basic") {
    return BASIC_CODE_SNIPPETS;
  }

  if (difficulty === "advanced") {
    return ADVANCED_CODE_SNIPPETS;
  }

  if (difficulty === "mixed") {
    return [...BASIC_CODE_SNIPPETS, ...INTERMEDIATE_CODE_SNIPPETS, ...ADVANCED_CODE_SNIPPETS];
  }

  return INTERMEDIATE_CODE_SNIPPETS;
}

function getChinesePool(difficulty: TrainingWordDifficulty): string[] {
  if (difficulty === "basic") {
    return uniqueWords(BASIC_CHINESE_TERMS);
  }

  if (difficulty === "advanced") {
    return uniqueWords(ADVANCED_CHINESE_TERMS);
  }

  if (difficulty === "mixed") {
    return uniqueWords([...BASIC_CHINESE_TERMS, ...INTERMEDIATE_CHINESE_TERMS, ...ADVANCED_CHINESE_TERMS]);
  }

  return uniqueWords(INTERMEDIATE_CHINESE_TERMS);
}

export function getChineseTrainingPool(difficulty: TrainingWordDifficulty): string[] {
  return getChinesePool(difficulty);
}

function uniqueWords(words: string[]): string[] {
  return Array.from(new Set(words));
}

function buildNumberToken(): string {
  const format = randomInteger(0, 4);

  if (format === 0) {
    return String(randomInteger(10_000, 999_999));
  }

  if (format === 1) {
    return `${randomInteger(1, 999)}.${padTwo(randomInteger(0, 99))}`;
  }

  if (format === 2) {
    return formatCommaAmount(randomInteger(1_000, 999_999), randomInteger(0, 99));
  }

  if (format === 3) {
    return `$${formatCommaAmount(randomInteger(100, 999_999), randomInteger(0, 99))}`;
  }

  return `${randomInteger(0, 99)}.${padTwo(randomInteger(0, 99))}%`;
}

function formatCommaAmount(dollars: number, cents: number): string {
  return `${dollars.toLocaleString("en-US")}.${padTwo(cents)}`;
}

function padTwo(value: number): string {
  return String(value).padStart(2, "0");
}

function randomInteger(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(items: T[]): T {
  return items[randomInteger(0, items.length - 1)];
}

function shuffleInWindows<T>(items: T[], windowSize: number): T[] {
  const shuffled: T[] = [];

  for (let index = 0; index < items.length; index += windowSize) {
    shuffled.push(...shuffle(items.slice(index, index + windowSize)));
  }

  return shuffled;
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(0, index);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}
