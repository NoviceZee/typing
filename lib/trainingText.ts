import type { PracticeCategory } from "./typing-engine";
import type { StoredPassage } from "./app-storage";

export type TrainingContentType = "words" | "numbers" | "symbols";
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

const CONTENT_ORDER: TrainingContentType[] = ["words", "numbers", "symbols"];

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

export function buildTrainingText({ contentTypes, tokenCount, wordDifficulty = "intermediate" }: TrainingTextInput): string {
  const selectedTypes = normaliseContentTypes(contentTypes);
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

  return {
    id: `training-${selectedTypes.join("-")}`,
    title: "Training",
    category,
    style: mode === "words" ? `${tokenCount} words` : `${durationSeconds}s`,
    source: "generated",
    text: buildTrainingText({ contentTypes: selectedTypes, tokenCount, wordDifficulty }),
    updatedAt: new Date().toISOString()
  };
}

export function getTrainingCategory(contentTypes: TrainingContentType[]): PracticeCategory {
  const selectedTypes = normaliseContentTypes(contentTypes);
  return `training_${selectedTypes.join("_")}` as PracticeCategory;
}

function normaliseContentTypes(contentTypes: TrainingContentType[]): TrainingContentType[] {
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

  return pickRandom(pickRandom(SYMBOL_GROUPS));
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
