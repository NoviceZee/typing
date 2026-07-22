import {
  CompletionReason,
  DEFAULT_RULES,
  PracticeCategory,
  TypingResult,
  TypingRules,
  buildPracticePassage
} from "./typing-engine";
import { isProgressionEligibleResult } from "./resultEligibility";
import {
  installTypingStationStorageDebugHelper,
  runTypingStationStorageMigration,
  safeSetJsonStorageItem,
  safeSetStorageItem
} from "./storageSafety";

export const RULES_STORAGE_KEY = "formaltype.rules.v1";
export const PASSAGE_STORAGE_KEY = "formaltype.passage.v1";
export const PASSAGE_LIBRARY_STORAGE_KEY = "formaltype_passage_library";
export const ACTIVE_PASSAGE_ID_STORAGE_KEY = "formaltype_active_passage_id";
export const CURRENT_PASSAGE_STORAGE_KEY = "formaltype_current_passage";
export const PASSAGE_SELECTION_MODE_STORAGE_KEY = "formaltype_passage_selection_mode";
export const SELECTED_CATEGORY_STORAGE_KEY = "formaltype_selected_category";
export const SELECTED_STYLE_STORAGE_KEY = "formaltype_selected_style";
export const SELECTED_LANGUAGE_STORAGE_KEY = "formaltype_selected_language";
export const PREVIOUS_RESULTS_STORAGE_KEY = "formaltype_previous_results";
export const THEME_SETTINGS_STORAGE_KEY = "formaltype.theme.v1";
export const ALL_FILTER = "All";

export const THEME_SETTING_CHANGE_EVENT = "formaltype-theme-settings-change";

const MAX_STORED_PASSAGES = 150;
const MAX_STORED_PASSAGE_CONTENT_CHARACTERS = 20_000;
const MAX_PREVIOUS_RESULTS = 120;
const MAX_PREVIOUS_PACE_POINTS = 90;

export const CATEGORIES: PracticeCategory[] = [
  "Business email",
  "Tender / proposal writing",
  "Government / formal English",
  "News article",
  "Casual writing",
  "Legal / contract style",
  "Random paragraph",
  "生活",
  "工作",
  "教育",
  "科技",
  "文化",
  "社會",
  "環境",
  "健康",
  "香港",
  "房屋",
  "土地",
  "交通",
  "民生",
  "養老",
  "勞工",
  "財政",
  "醫療",
  "文言文",
  "詩詞",
  "numbers",
  "symbols",
  "training_words",
  "training_numbers",
  "training_symbols",
  "training_code",
  "training_chinese",
  "training_words_numbers",
  "training_words_symbols",
  "training_numbers_symbols",
  "training_words_numbers_symbols",
  "Uncategorised"
];

export const STYLES = [
  "Simple",
  "Intermediate",
  "Advanced",
  "Formal",
  "Concise",
  "Long sentences",
  "Punctuation-heavy",
  "Mixed case practice"
];

export const CHINESE_STARTER_PASSAGES: LibraryPassage[] = [
  makeStarterChinesePassage("zh-life-rest", "忙碌生活中的休息", "生活", "現代城市生活節奏急速，許多人每天需要在工作、家庭與個人安排之間來回奔波。長時間保持忙碌容易令人忽略休息的重要性。適當停下來，不但可以恢復精神，亦有助重新整理思緒，提高之後處理事情的效率。"),
  makeStarterChinesePassage("zh-work-brief", "清晰的工作交代", "工作", "一項工作能否順利完成，往往取決於最初的交代是否清晰。負責人需要說明目標、期限、分工及需要留意的風險。當每個人都明白自己的角色，團隊便能減少重複溝通，把時間放在真正重要的事情上。"),
  makeStarterChinesePassage("zh-education-reading", "閱讀與學習", "教育", "閱讀不只是吸收資料，也是一種訓練思考的方法。學生在閱讀不同題材時，會接觸新的詞語、觀點和表達方式。持續閱讀能夠累積語感，亦能幫助人在寫作和討論時更準確地組織內容。"),
  makeStarterChinesePassage("zh-tech-change", "科技與日常", "科技", "科技逐漸融入日常生活，從交通查詢、網上付款到遙距會議，都改變了人們安排時間的方式。方便之餘，我們亦需要留意私隱、資料安全和使用習慣，避免讓工具反過來支配生活節奏。"),
  makeStarterChinesePassage("zh-culture-memory", "城市中的文化記憶", "文化", "一座城市的文化不只存在於博物館，也藏在街角店舖、節日習俗、家庭飯桌和日常用語之中。當人們願意記錄和分享這些細節，城市記憶便能在新舊之間延續下去。"),
  makeStarterChinesePassage("zh-society-trust", "社會信任", "社會", "社會運作需要一定程度的信任。人們相信規則會被公平執行，相信公共服務能夠回應需要，也相信陌生人在共同空間內會互相尊重。這種信任不是自然出現，而是靠長期透明和負責任的行動建立。"),
  makeStarterChinesePassage("zh-environment-habit", "環保從習慣開始", "環境", "環保不一定是遙遠的大工程，也可以從每天的小習慣開始。減少即棄用品、節約用水、選擇公共交通和妥善分類回收，都能慢慢改變資源使用方式。小改變累積起來，便會形成更大的影響。"),
  makeStarterChinesePassage("zh-health-sleep", "睡眠的重要", "健康", "充足睡眠對身體和情緒都十分重要。睡眠不足會影響專注力、記憶力和判斷力，也會令人較容易感到焦躁。保持固定作息、減少睡前使用電子產品，有助提升睡眠質素。"),
  makeStarterChinesePassage("zh-hk-transport", "香港的交通節奏", "香港", "香港交通網絡密集，市民可以透過港鐵、巴士、小巴、電車和渡輪前往不同地區。高效率帶來方便，也塑造了城市急速的節奏。學會預留時間，反而能在繁忙之中保持從容。"),
  makeStarterChinesePassage("zh-life-market", "街市的早晨", "生活", "清晨的街市充滿聲音和氣味。檔主整理蔬菜，顧客比較價錢，熟客之間簡短問候。這些日常片段看似普通，卻反映了社區的連繫和生活的溫度。"),
  makeStarterChinesePassage("zh-work-meeting", "有效會議", "工作", "有效會議應該有明確目的和簡潔議程。會前列出需要討論的事項，會中集中處理決定和責任分配，會後記錄跟進時間。這樣做可以減少空泛討論，讓會議真正支援工作。"),
  makeStarterChinesePassage("zh-education-practice", "練習的價值", "教育", "學習任何技能都需要反覆練習。第一次可能緩慢而生硬，但每次嘗試都會讓大腦更熟悉步驟。只要方法正確，短時間而持續的練習，往往比偶然一次長時間操練更有效。"),
  makeStarterChinesePassage("zh-tech-ai", "人工智能工具", "科技", "人工智能工具可以協助整理資料、草擬文字和檢查錯漏，但使用者仍然需要判斷內容是否準確。工具提供的是輔助，不是最終答案。懂得提問和驗證，才是有效使用科技的關鍵。"),
  makeStarterChinesePassage("zh-culture-food", "飲食文化", "文化", "飲食文化連接家庭、地方和記憶。一碗湯、一份點心或一道節慶菜式，背後可能包含長輩的習慣、地方材料和共同經驗。食物因此不只是味道，也是一種故事。"),
  makeStarterChinesePassage("zh-society-space", "公共空間", "社會", "公園、圖書館和海濱長廊等公共空間，讓不同年齡和背景的人可以共享城市。良好的公共空間需要安全、整潔和易於到達，也需要使用者共同維持秩序。"),
  makeStarterChinesePassage("zh-environment-weather", "極端天氣", "環境", "近年極端天氣更受關注，暴雨、酷熱和強風都可能影響城市運作。除了完善基建，市民也需要理解預警訊息，準備基本物資，並在惡劣天氣下減少不必要外出。"),
  makeStarterChinesePassage("zh-health-walk", "步行與健康", "健康", "步行是一種容易開始的運動。每天抽出一段時間步行，可以活動筋骨、放鬆心情，也能讓人重新觀察熟悉的街道。只要持之以恆，簡單習慣也能帶來長遠好處。"),
  makeStarterChinesePassage("zh-hk-harbour", "維港兩岸", "香港", "維多利亞港連接香港島和九龍，也承載了城市的歷史想像。白天船隻往來，晚上燈光倒映水面。無論是旅客還是本地居民，都能在海旁感受到香港獨特的節奏。"),
  makeStarterChinesePassage("zh-life-family", "家庭溝通", "生活", "家庭成員之間的溝通不必總是正式安排。一起吃飯、散步或整理家務時，也可以自然分享近況。願意聆聽和回應，比急於給出答案更能令人感到被理解。"),
  makeStarterChinesePassage("zh-work-risk", "風險管理", "工作", "風險管理不是等問題出現後才補救，而是在計劃開始時預先思考可能的阻礙。列出風險、評估影響、準備替代方案，可以讓團隊在變化出現時更快作出反應。"),
  makeStarterChinesePassage("zh-education-question", "提出好問題", "教育", "好問題能推動學習。當學生不只問答案是甚麼，而是追問原因、證據和例外情況，他們便開始建立自己的理解。提問需要勇氣，也需要對知識保持好奇。"),
  makeStarterChinesePassage("zh-tech-balance", "數碼平衡", "科技", "手機和網絡服務提供大量資訊，但過度依賴也會分散注意力。設定通知界線、安排離線時間和有意識地選擇內容，可以幫助人們在便利與專注之間取得平衡。"),
  makeStarterChinesePassage("zh-culture-festival", "節日的意義", "文化", "節日讓人暫時停下平日的節奏，與家人朋友重新連結。不同習俗可能形式各異，但核心往往相似：感謝、團聚、祝願，以及把共同記憶傳給下一代。"),
  makeStarterChinesePassage("zh-hk-neighbourhood", "社區小店", "香港", "社區小店保存了城市的細緻面貌。店主記得熟客需要，街坊在門口交換消息，簡單交易之外還有人情往來。這些小店令高樓之間仍然保留親切感。")
];

export type StoredPassage = {
  id?: string;
  title?: string;
  category: PracticeCategory;
  style: string;
  language?: PassageLanguage;
  text: string;
  comparableText?: string;
  displayTokens?: string[];
  metricUnit?: "wpm" | "cpm";
  source?: PassageSource;
  updatedAt: string;
};

export type PassageSource = "generated" | "pasted" | "uploaded";
export type PassageLanguage = "english" | "chinese";
export type PassageSelectionMode = "specific" | "random";
export type CategoryFilter = typeof ALL_FILTER | PracticeCategory;
export type StyleFilter = typeof ALL_FILTER | string;

export type LibraryPassage = {
  id: string;
  title: string;
  content: string;
  category: PracticeCategory;
  style: string;
  language?: PassageLanguage;
  source: PassageSource;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  characterCount: number;
  isActive: boolean;
};

export type PreviousPaceTimelinePoint = {
  timeSeconds: number;
  characterIndex: number;
  wpm?: number;
};

export type PreviousTypingResult = {
  passageId: string;
  passageTitle: string;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  errors: number;
  correctCharacters: number;
  typedCharacters: number;
  elapsedSeconds: number;
  durationSeconds?: number;
  previousPaceTimeline?: PreviousPaceTimelinePoint[];
  completedAt: string;
  completionReason: CompletionReason;
};

export type PassageLibraryExport = {
  version: 1;
  exportedAt: string;
  passages: unknown[];
  settings: {
    activePassageId: string | null;
    selectedCategory: string | null;
    selectedStyle: string | null;
    selectedLanguage: PassageLanguage | null;
    passageSelectionMode: PassageSelectionMode | null;
  };
};

export type PassageLibraryImportSummary = {
  imported: number;
  skippedDuplicates: number;
  failedInvalidItems: number;
};

export type PassageLibraryImportResult = {
  library: LibraryPassage[];
  summary: PassageLibraryImportSummary;
};

export type ThemeMode = "dark" | "light" | "system";
export type AccentColor = "blue" | "purple" | "emerald" | "rose" | "amber" | "cyan" | "lime" | "red" | "orange";
export type AppFont = "system" | "sans" | "serif" | "rounded" | "humanist" | "grotesk" | "mono" | "editorial";
export type TypingFont = "system-mono" | "serif" | "code" | "humanist-mono" | "geometric-mono" | "accessible" | "cjk";
export type TypingTextSize = "small" | "medium" | "large";
export type TypingWidth = "compact" | "comfortable" | "wide";
export type ThemePreset =
  | "default-dark"
  | "light"
  | "dracula"
  | "nord"
  | "catppuccin-mocha"
  | "tokyo-night"
  | "rose-pine-dawn"
  | "solarized-light"
  | "tangerine"
  | "matcha"
  | "milkshake"
  | "paper"
  | "gruvbox-dark"
  | "rose-pine-moon"
  | "terminal"
  | "modern-ink"
  | "serika"
  | "copper"
  | "iceberg";
export type CaretStyle = "bar" | "block" | "underline";
export type CaretBlink = "on" | "off";
export type TypingColorStyle = "theme-default" | "high-contrast" | "soft";

export type ThemeSettings = {
  themePreset: ThemePreset;
  mode: ThemeMode;
  accentColor: AccentColor;
  appFont: AppFont;
  typingFont: TypingFont;
  typingTextSize: TypingTextSize;
  typingWidth: TypingWidth;
  caretStyle: CaretStyle;
  caretBlink: CaretBlink;
  typingColorStyle: TypingColorStyle;
};

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  themePreset: "default-dark",
  mode: "dark",
  accentColor: "amber",
  appFont: "system",
  typingFont: "system-mono",
  typingTextSize: "medium",
  typingWidth: "comfortable",
  caretStyle: "bar",
  caretBlink: "on",
  typingColorStyle: "theme-default"
};

export type ThemePresetOption = {
  value: ThemePreset;
  label: string;
  mode: ThemeMode;
  accentColor: AccentColor;
  preview: {
    background: string;
    surface: string;
    text: string;
    accent: string;
    muted: string;
  };
};

export const THEME_PRESET_OPTIONS: ThemePresetOption[] = [
  {
    value: "default-dark",
    label: "Default Dark",
    mode: "dark",
    accentColor: "amber",
    preview: {
      background: "#070807",
      surface: "#191d18",
      text: "#ece7d7",
      accent: "#caa45d",
      muted: "#7f7a6a"
    }
  },
  {
    value: "light",
    label: "Light",
    mode: "light",
    accentColor: "blue",
    preview: {
      background: "#f8f6ef",
      surface: "#fffaf0",
      text: "#212520",
      accent: "#5b9dff",
      muted: "#9b927f"
    }
  },
  {
    value: "dracula",
    label: "Dracula",
    mode: "dark",
    accentColor: "purple",
    preview: {
      background: "#191622",
      surface: "#282436",
      text: "#f8f8f2",
      accent: "#bd93f9",
      muted: "#8a839d"
    }
  },
  {
    value: "nord",
    label: "Nord",
    mode: "dark",
    accentColor: "blue",
    preview: {
      background: "#111827",
      surface: "#243142",
      text: "#eceff4",
      accent: "#88c0d0",
      muted: "#8f9bad"
    }
  },
  {
    value: "catppuccin-mocha",
    label: "Catppuccin Mocha",
    mode: "dark",
    accentColor: "rose",
    preview: {
      background: "#11111b",
      surface: "#1e1e2e",
      text: "#cdd6f4",
      accent: "#f5c2e7",
      muted: "#7f849c"
    }
  },
  {
    value: "tokyo-night",
    label: "Tokyo Night",
    mode: "dark",
    accentColor: "blue",
    preview: {
      background: "#0f172a",
      surface: "#1a1b26",
      text: "#c0caf5",
      accent: "#7aa2f7",
      muted: "#6f7aa6"
    }
  },
  {
    value: "rose-pine-dawn",
    label: "Rose Pine Dawn",
    mode: "light",
    accentColor: "rose",
    preview: {
      background: "#faf4ed",
      surface: "#fffaf3",
      text: "#575279",
      accent: "#d7827e",
      muted: "#9893a5"
    }
  },
  {
    value: "solarized-light",
    label: "Solarized Light",
    mode: "light",
    accentColor: "blue",
    preview: {
      background: "#fdf6e3",
      surface: "#eee8d5",
      text: "#586e75",
      accent: "#268bd2",
      muted: "#93a1a1"
    }
  },
  {
    value: "tangerine",
    label: "Tangerine",
    mode: "light",
    accentColor: "amber",
    preview: {
      background: "#fff3e6",
      surface: "#ffe3c2",
      text: "#4a2a11",
      accent: "#f97316",
      muted: "#a15c24"
    }
  },
  {
    value: "matcha",
    label: "Matcha",
    mode: "light",
    accentColor: "emerald",
    preview: {
      background: "#f2f7e8",
      surface: "#dcecc8",
      text: "#273c26",
      accent: "#5f9f63",
      muted: "#71856a"
    }
  },
  {
    value: "milkshake",
    label: "Milkshake",
    mode: "light",
    accentColor: "rose",
    preview: {
      background: "#fff0f7",
      surface: "#ffe1ee",
      text: "#4a2840",
      accent: "#ec4899",
      muted: "#a46a8a"
    }
  },
  {
    value: "paper",
    label: "Paper",
    mode: "light",
    accentColor: "amber",
    preview: {
      background: "#fbf7ec",
      surface: "#eee3cc",
      text: "#2f2a22",
      accent: "#b7791f",
      muted: "#8d806d"
    }
  },
  {
    value: "gruvbox-dark", label: "Gruvbox Dark", mode: "dark", accentColor: "amber",
    preview: { background: "#282828", surface: "#3c3836", text: "#ebdbb2", accent: "#fabd2f", muted: "#928374" }
  },
  {
    value: "rose-pine-moon", label: "Rose Pine Moon", mode: "dark", accentColor: "rose",
    preview: { background: "#232136", surface: "#2a273f", text: "#e0def4", accent: "#ea9a97", muted: "#6e6a86" }
  },
  {
    value: "terminal", label: "Terminal", mode: "dark", accentColor: "emerald",
    preview: { background: "#07110a", surface: "#0d1c11", text: "#b8d8bd", accent: "#4ade80", muted: "#52705a" }
  },
  {
    value: "modern-ink", label: "Modern Ink", mode: "light", accentColor: "red",
    preview: { background: "#f4f1ea", surface: "#e6e1d7", text: "#181817", accent: "#dc2626", muted: "#858078" }
  },
  {
    value: "serika", label: "Serika", mode: "dark", accentColor: "amber",
    preview: { background: "#323437", surface: "#2c2e31", text: "#d1d0c5", accent: "#e2b714", muted: "#646669" }
  },
  {
    value: "copper", label: "Copper", mode: "dark", accentColor: "orange",
    preview: { background: "#17120f", surface: "#2b211b", text: "#eaded3", accent: "#d97745", muted: "#806b5e" }
  },
  {
    value: "iceberg", label: "Iceberg", mode: "light", accentColor: "cyan",
    preview: { background: "#e8eef3", surface: "#d7e1e8", text: "#26384a", accent: "#0e7490", muted: "#718393" }
  }
];

export const THEME_MODE_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" }
];

export const ACCENT_COLOR_OPTIONS: Array<{ value: AccentColor; label: string }> = [
  { value: "blue", label: "Blue" },
  { value: "purple", label: "Purple" },
  { value: "emerald", label: "Emerald" },
  { value: "rose", label: "Rose" },
  { value: "amber", label: "Amber" },
  { value: "cyan", label: "Cyan" },
  { value: "lime", label: "Lime" },
  { value: "red", label: "Red" },
  { value: "orange", label: "Orange" }
];

export const APP_FONT_OPTIONS: Array<{ value: AppFont; label: string }> = [
  { value: "system", label: "System" },
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "rounded", label: "Rounded" },
  { value: "humanist", label: "Humanist" },
  { value: "grotesk", label: "Grotesk" },
  { value: "mono", label: "Monospace" },
  { value: "editorial", label: "Editorial" }
];

export const TYPING_FONT_OPTIONS: Array<{ value: TypingFont; label: string }> = [
  { value: "system-mono", label: "System Mono" },
  { value: "serif", label: "Serif" },
  { value: "code", label: "Code" },
  { value: "humanist-mono", label: "Humanist Mono" },
  { value: "geometric-mono", label: "Geometric Mono" },
  { value: "accessible", label: "Accessible" },
  { value: "cjk", label: "CJK Sans" }
];

export const TYPING_TEXT_SIZE_OPTIONS: Array<{ value: TypingTextSize; label: string }> = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" }
];

export const TYPING_WIDTH_OPTIONS: Array<{ value: TypingWidth; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "wide", label: "Wide" }
];

export const CARET_STYLE_OPTIONS: Array<{ value: CaretStyle; label: string }> = [
  { value: "bar", label: "Bar" },
  { value: "block", label: "Block" },
  { value: "underline", label: "Underline" }
];

export const CARET_BLINK_OPTIONS: Array<{ value: CaretBlink; label: string }> = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" }
];

export const TYPING_COLOR_STYLE_OPTIONS: Array<{ value: TypingColorStyle; label: string }> = [
  { value: "theme-default", label: "Theme default" },
  { value: "high-contrast", label: "High contrast" },
  { value: "soft", label: "Soft" }
];

export function readStoredRules(): TypingRules {
  if (typeof window === "undefined") {
    return DEFAULT_RULES;
  }

  installTypingStationStorageDebugHelper();

  try {
    const stored = window.localStorage.getItem(RULES_STORAGE_KEY);
    return stored ? { ...DEFAULT_RULES, ...JSON.parse(stored) } : DEFAULT_RULES;
  } catch {
    return DEFAULT_RULES;
  }
}

export function writeStoredRules(rules: TypingRules) {
  safeSetJsonStorageItem(RULES_STORAGE_KEY, rules, { context: "writeStoredRules" });
}

export function readThemeSettings(): ThemeSettings {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_SETTINGS;
  }

  try {
    const stored = window.localStorage.getItem(THEME_SETTINGS_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};

    return normaliseThemeSettings(parsed);
  } catch {
    return DEFAULT_THEME_SETTINGS;
  }
}

export function writeThemeSettings(settings: ThemeSettings) {
  safeSetJsonStorageItem(THEME_SETTINGS_STORAGE_KEY, settings, { context: "writeThemeSettings" });
  if (typeof window.dispatchEvent === "function" && typeof CustomEvent !== "undefined") {
    window.dispatchEvent(new CustomEvent(THEME_SETTING_CHANGE_EVENT, { detail: settings }));
  }
}

export function getDefaultPassage(durationSeconds = 60): StoredPassage {
  return {
    id: "default-generated",
    title: "Generated business email practice",
    category: "Business email",
    style: "Formal",
    text: buildPracticePassage("Business email", durationSeconds),
    source: "generated",
    updatedAt: new Date().toISOString()
  };
}

export function readStoredPassage(durationSeconds = 60): StoredPassage {
  if (typeof window === "undefined") {
    return getDefaultPassage(durationSeconds);
  }

  const libraryPassage = readPracticePassageFromLibrary(durationSeconds);
  if (libraryPassage) {
    writeStoredPassage(libraryPassage);
    return libraryPassage;
  }

  const fallback = getDefaultPassage(durationSeconds);
  writeStoredPassage(fallback);
  return fallback;
}

export function writeStoredPassage(passage: StoredPassage) {
  safeSetJsonStorageItem(CURRENT_PASSAGE_STORAGE_KEY, passage, { context: "writeStoredPassage" });
}

export function readPassageLibrary(): LibraryPassage[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(PASSAGE_LIBRARY_STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as LibraryPassage[]) : [];
    return Array.isArray(parsed) ? parsed.map(normaliseLibraryPassage).filter((passage) => passage.content?.trim()) : [];
  } catch {
    return [];
  }
}

export function writePassageLibrary(passages: LibraryPassage[]) {
  safeSetJsonStorageItem(PASSAGE_LIBRARY_STORAGE_KEY, preparePassageLibraryForStorage(passages), {
    context: "writePassageLibrary"
  });
}

export function createPassageLibraryExport(): PassageLibraryExport {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    passages: readPassageLibrary(),
    settings: {
      activePassageId: readLocalStorageValue(ACTIVE_PASSAGE_ID_STORAGE_KEY),
      selectedCategory: readLocalStorageValue(SELECTED_CATEGORY_STORAGE_KEY),
      selectedStyle: readLocalStorageValue(SELECTED_STYLE_STORAGE_KEY),
      selectedLanguage: readSelectedLanguage(),
      passageSelectionMode: readPassageSelectionMode()
    }
  };
}

export function importPassageLibraryExport(payload: unknown, replaceExisting: boolean): PassageLibraryImportSummary {
  if (!isRecord(payload) || !Array.isArray(payload.passages)) {
    throw new Error("Import file must contain a passages array.");
  }

  const existingLibrary = replaceExisting ? [] : readPassageLibrary();
  const result = mergeImportedPassages(existingLibrary, payload.passages, replaceExisting);

  writePassageLibrary(result.library);
  restoreImportedSettings(payload.settings, result.library);

  return result.summary;
}

export function mergeImportedPassages(
  existingLibrary: LibraryPassage[],
  importedItems: unknown[],
  replaceExisting = false
): PassageLibraryImportResult {
  const importedLibrary: LibraryPassage[] = [];
  const existingIds = new Set(existingLibrary.map((passage) => passage.id));
  const importedIds = new Set<string>();
  const summary: PassageLibraryImportSummary = {
    imported: 0,
    skippedDuplicates: 0,
    failedInvalidItems: 0
  };

  for (const item of importedItems) {
    const passage = normaliseImportedLibraryPassage(item);

    if (!passage) {
      summary.failedInvalidItems += 1;
      continue;
    }

    if ((!replaceExisting && existingIds.has(passage.id)) || importedIds.has(passage.id)) {
      summary.skippedDuplicates += 1;
      continue;
    }

    importedIds.add(passage.id);
    importedLibrary.push(passage);
    summary.imported += 1;
  }

  return {
    library: replaceExisting ? importedLibrary : [...importedLibrary, ...existingLibrary],
    summary
  };
}

export function addPassagesToLibrary(passages: LibraryPassage[]) {
  const currentLibrary = readPassageLibrary();
  writePassageLibrary([...passages, ...currentLibrary]);
}

export function deleteLibraryPassage(id: string) {
  const nextLibrary = readPassageLibrary().filter((passage) => passage.id !== id);
  writePassageLibrary(nextLibrary);

  if (readActivePassageId() === id) {
    window.localStorage.removeItem(ACTIVE_PASSAGE_ID_STORAGE_KEY);
  }
}

export function clearPassageLibrary() {
  window.localStorage.removeItem(PASSAGE_LIBRARY_STORAGE_KEY);
  window.localStorage.removeItem(ACTIVE_PASSAGE_ID_STORAGE_KEY);
  window.localStorage.removeItem(PASSAGE_SELECTION_MODE_STORAGE_KEY);
}

export function readActivePassageId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACTIVE_PASSAGE_ID_STORAGE_KEY);
}

export function writeActivePassageId(id: string) {
  safeSetStorageItem(ACTIVE_PASSAGE_ID_STORAGE_KEY, id, { context: "writeActivePassageId" });
}

export function readPassageSelectionMode(): PassageSelectionMode {
  if (typeof window === "undefined") {
    return "random";
  }

  return window.localStorage.getItem(PASSAGE_SELECTION_MODE_STORAGE_KEY) === "specific" ? "specific" : "random";
}

export function writePassageSelectionMode(mode: PassageSelectionMode) {
  safeSetStorageItem(PASSAGE_SELECTION_MODE_STORAGE_KEY, mode, { context: "writePassageSelectionMode" });
}

export function readSelectedCategory(): CategoryFilter {
  if (typeof window === "undefined") {
    return ALL_FILTER;
  }

  return (window.localStorage.getItem(SELECTED_CATEGORY_STORAGE_KEY) || ALL_FILTER) as CategoryFilter;
}

export function writeSelectedCategory(category: CategoryFilter) {
  safeSetStorageItem(SELECTED_CATEGORY_STORAGE_KEY, category, { context: "writeSelectedCategory" });
}

export function readSelectedStyle(): StyleFilter {
  if (typeof window === "undefined") {
    return ALL_FILTER;
  }

  return window.localStorage.getItem(SELECTED_STYLE_STORAGE_KEY) || ALL_FILTER;
}

export function writeSelectedStyle(style: StyleFilter) {
  safeSetStorageItem(SELECTED_STYLE_STORAGE_KEY, style, { context: "writeSelectedStyle" });
}

export function readSelectedLanguage(): PassageLanguage {
  if (typeof window === "undefined") {
    return "english";
  }

  return toPassageLanguage(window.localStorage.getItem(SELECTED_LANGUAGE_STORAGE_KEY));
}

export function writeSelectedLanguage(language: PassageLanguage) {
  safeSetStorageItem(SELECTED_LANGUAGE_STORAGE_KEY, language, { context: "writeSelectedLanguage" });
}

export function createLibraryPassage({
  title,
  content,
  category,
  style,
  source,
  language = "english"
}: {
  title: string;
  content: string;
  category: PracticeCategory;
  style: string;
  source: PassageSource;
  language?: PassageLanguage;
}): LibraryPassage {
  const cleanContent = content.trim();
  const now = new Date().toISOString();

  return {
    id: createId(),
    title: title.trim() || "Untitled passage",
    content: cleanContent,
    category,
    style,
    language,
    source,
    createdAt: now,
    updatedAt: now,
    wordCount: countWords(cleanContent),
    characterCount: cleanContent.length,
    isActive: true
  };
}

export type StoredPassageTextMode = "timed" | "single";

export function toStoredPassage(
  passage: LibraryPassage,
  durationSeconds = 60,
  library = readPassageLibrary(),
  textMode: StoredPassageTextMode = "timed"
): StoredPassage {
  return {
    id: passage.id,
    title: passage.title,
    category: passage.category,
    style: passage.style,
    language: passage.language ?? "english",
    source: passage.source,
    text: textMode === "single" ? passage.content : buildTimedPassageText(passage, library, durationSeconds),
    updatedAt: new Date().toISOString()
  };
}

export function readPracticePassageFromLibrary(durationSeconds = 60): StoredPassage | null {
  const library = readActivePassageLibrary();
  const filteredLibrary = filterLibraryPassages(
    filterLibraryPassagesByLanguage(library, readSelectedLanguage()),
    readSelectedCategory(),
    readSelectedStyle()
  );
  const selectableLibrary = filteredLibrary;

  if (selectableLibrary.length === 0) {
    window.localStorage.removeItem(ACTIVE_PASSAGE_ID_STORAGE_KEY);
    return null;
  }

  const activeId = readActivePassageId();
  if (readPassageSelectionMode() === "random") {
    const randomPassage = selectRandomLibraryPassage(activeId ?? undefined, selectableLibrary) ?? selectableLibrary[0];
    writeActivePassageId(randomPassage.id);
    return toStoredPassage(randomPassage, durationSeconds, selectableLibrary);
  }

  const activePassage = activeId ? selectableLibrary.find((passage) => passage.id === activeId) : null;
  const selectedPassage = activePassage ?? selectableLibrary[0];

  if (selectedPassage.id !== activeId) {
    writeActivePassageId(selectedPassage.id);
  }

  return toStoredPassage(selectedPassage, durationSeconds, selectableLibrary);
}

export function selectDifferentLibraryPassage(currentId?: string, library = readPassageLibrary()): LibraryPassage | null {
  if (library.length === 0) {
    return null;
  }

  if (library.length === 1) {
    return library[0];
  }

  const currentIndex = currentId ? library.findIndex((passage) => passage.id === currentId) : -1;
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % library.length : 0;
  return library[nextIndex];
}

export function selectRandomLibraryPassage(currentId?: string, library = readPassageLibrary()): LibraryPassage | null {
  if (library.length === 0) {
    return null;
  }

  if (library.length === 1) {
    return library[0];
  }

  const choices = library.filter((passage) => passage.id !== currentId);
  return choices[Math.floor(Math.random() * choices.length)] ?? library[0];
}

export function filterLibraryPassages(
  library: LibraryPassage[],
  category: CategoryFilter = ALL_FILTER,
  style: StyleFilter = ALL_FILTER
): LibraryPassage[] {
  return library.filter((passage) => {
    const categoryMatches = category === ALL_FILTER || passage.category === category;
    const styleMatches = style === ALL_FILTER || passage.style === style;
    return categoryMatches && styleMatches;
  });
}

export function filterLibraryPassagesByLanguage(
  library: LibraryPassage[],
  language: PassageLanguage = "english"
): LibraryPassage[] {
  return library.filter((passage) => (passage.language ?? "english") === language);
}

export function withBuiltInSamplePassages(library: LibraryPassage[]): LibraryPassage[] {
  const passageIds = new Set(library.map((passage) => passage.id));
  return [...library, ...CHINESE_STARTER_PASSAGES.filter((passage) => !passageIds.has(passage.id))];
}

export function readActivePassageLibrary(): LibraryPassage[] {
  const storedPassages = readPassageLibrary().filter((passage) => passage.isActive);
  return withBuiltInSamplePassages(storedPassages);
}

export function readPreviousResults(): Record<string, PreviousTypingResult> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const stored = window.localStorage.getItem(PREVIOUS_RESULTS_STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as Record<string, PreviousTypingResult>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export type PreviousResultScope = number | string | null | undefined;

export function getPreviousResultStorageKey(passageId: string, scope?: PreviousResultScope) {
  if (typeof scope === "number") {
    return `${passageId}::${Math.round(scope)}s`;
  }

  if (typeof scope === "string" && scope.trim()) {
    return `${passageId}::${scope.trim()}`;
  }

  return passageId;
}

export function readPreviousResult(passageId?: string, scope?: PreviousResultScope): PreviousTypingResult | null {
  if (!passageId) {
    return null;
  }

  const previousResults = readPreviousResults();
  const scopedKey = getPreviousResultStorageKey(passageId, scope);
  const previousResult = previousResults[scopedKey] ?? previousResults[passageId] ?? null;
  return previousResult && isProgressionEligibleResult(previousResult) ? previousResult : null;
}

export function writePreviousResult(
  passage: StoredPassage,
  result: TypingResult,
  typedCharacters: number,
  scope?: PreviousResultScope,
  previousPaceTimeline?: PreviousPaceTimelinePoint[]
) {
  if (!passage.id || !isProgressionEligibleResult(result)) {
    return;
  }

  const previousResults = prunePreviousResults(readPreviousResults());
  previousResults[getPreviousResultStorageKey(passage.id, scope ?? result.durationSeconds)] = {
    passageId: passage.id,
    passageTitle: passage.title ?? "Untitled passage",
    wpm: result.wpm,
    rawWpm: result.rawWpm,
    accuracy: result.accuracy,
    errors: result.incorrectCharacters,
    correctCharacters: result.correctCharacters,
    typedCharacters,
    elapsedSeconds: result.timeUsedSeconds,
    durationSeconds: result.durationSeconds,
    previousPaceTimeline: downsamplePreviousPaceTimeline(previousPaceTimeline),
    completedAt: result.completedAt,
    completionReason: result.completionReason
  };
  safeSetJsonStorageItem(PREVIOUS_RESULTS_STORAGE_KEY, prunePreviousResults(previousResults), {
    context: "writePreviousResult"
  });
}

export function updateLibraryPassage(updatedPassage: LibraryPassage) {
  const nextLibrary = readPassageLibrary().map((passage) =>
    passage.id === updatedPassage.id
      ? {
          ...updatedPassage,
          content: updatedPassage.content.trim(),
          title: updatedPassage.title.trim() || "Untitled passage",
          updatedAt: new Date().toISOString(),
          wordCount: countWords(updatedPassage.content),
          characterCount: updatedPassage.content.trim().length,
          isActive: updatedPassage.isActive
        }
      : passage
  );
  writePassageLibrary(nextLibrary);
}

export function splitTextIntoPassages(text: string): string[] {
  const normalisedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  return normalisedText
    .split(/^\s*(?:---|###|===|\[new passage\])\s*$/gim)
    .map((passage) => passage.trim())
    .filter(Boolean);
}

export function splitPastedPassages(text: string): string[] {
  return splitTextIntoPassages(text);
}

export function extractPassageTitle(content: string, fallbackTitle: string): { title: string; content: string } {
  const normalisedContent = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalisedContent.split("\n");
  const firstContentLineIndex = lines.findIndex((line) => line.trim().length > 0);

  if (firstContentLineIndex === -1) {
    return {
      title: fallbackTitle,
      content: ""
    };
  }

  const firstContentLine = lines[firstContentLineIndex];
  const headingMatch = firstContentLine.match(/^\s*##(?!#)\s*(.*)$/);

  if (!headingMatch) {
    return {
      title: fallbackTitle,
      content: normalisedContent.trim()
    };
  }

  const extractedTitle = headingMatch[1].trim();
  const remainingLines = [...lines.slice(0, firstContentLineIndex), ...lines.slice(firstContentLineIndex + 1)];

  return {
    title: extractedTitle || fallbackTitle,
    content: remainingLines.join("\n").trim()
  };
}

export function countWords(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  const hanCharacters = text.match(/[\u3400-\u9fff\uf900-\ufaff]/g)?.length ?? 0;

  if (hanCharacters > 0 && words.length <= 1) {
    return hanCharacters;
  }

  return words.length;
}

export function formatPassageLength(passage: Pick<LibraryPassage, "language" | "wordCount" | "characterCount">): string {
  if (passage.language === "chinese") {
    return `${passage.characterCount} chars`;
  }

  return `${passage.wordCount} words · ${passage.characterCount} chars`;
}

function preparePassageLibraryForStorage(passages: LibraryPassage[]): LibraryPassage[] {
  return passages
    .map((passage) => normaliseLibraryPassage(passage))
    .slice(0, MAX_STORED_PASSAGES)
    .map((passage) => {
      const content = passage.content.slice(0, MAX_STORED_PASSAGE_CONTENT_CHARACTERS);
      return {
        ...passage,
        content,
        wordCount: countWords(content),
        characterCount: content.length
      };
    });
}

function prunePreviousResults(previousResults: Record<string, PreviousTypingResult>): Record<string, PreviousTypingResult> {
  return Object.fromEntries(
    Object.entries(previousResults)
      .map(([key, value]) => [
        key,
        {
          ...value,
          previousPaceTimeline: downsamplePreviousPaceTimeline(value.previousPaceTimeline)
        }
      ] as const)
      .sort(([, first], [, second]) => Date.parse(second.completedAt) - Date.parse(first.completedAt))
      .slice(0, MAX_PREVIOUS_RESULTS)
  );
}

function downsamplePreviousPaceTimeline(
  timeline: PreviousPaceTimelinePoint[] | null | undefined
): PreviousPaceTimelinePoint[] | undefined {
  if (!timeline?.length) {
    return undefined;
  }

  if (timeline.length <= MAX_PREVIOUS_PACE_POINTS) {
    return timeline;
  }

  const step = Math.ceil(timeline.length / MAX_PREVIOUS_PACE_POINTS);
  const sampled = timeline.filter((_, index) => index % step === 0);
  const lastPoint = timeline[timeline.length - 1];

  if (lastPoint && sampled[sampled.length - 1] !== lastPoint) {
    sampled.push(lastPoint);
  }

  return sampled.slice(0, MAX_PREVIOUS_PACE_POINTS);
}

function makeStarterChinesePassage(
  id: string,
  title: string,
  category: PracticeCategory,
  content: string
): LibraryPassage {
  const createdAt = "2026-07-05T00:00:00.000Z";

  return {
    id,
    title,
    content,
    category,
    style: "一般",
    language: "chinese",
    source: "uploaded",
    createdAt,
    updatedAt: createdAt,
    wordCount: countWords(content),
    characterCount: content.length,
    isActive: true
  };
}

function buildTimedPassageText(basePassage: LibraryPassage, library: LibraryPassage[], _durationSeconds: number): string {
  if (isLiteraryPassage(basePassage) || !isTooShortForStandalonePractice(basePassage)) {
    return basePassage.content;
  }

  const minimumUnitCount = getMinimumStandaloneUnitCount(basePassage);
  const selected: LibraryPassage[] = [basePassage];
  let unitCount = getTimedPassageUnitCount(basePassage);
  const compatibleShortPassages = library.filter(
    (passage) =>
      passage.id !== basePassage.id &&
      passage.language === basePassage.language &&
      passage.category === basePassage.category &&
      !isLiteraryPassage(passage) &&
      isTooShortForStandalonePractice(passage) &&
      getTimedPassageUnitCount(passage) > 0
  );

  for (const nextPassage of compatibleShortPassages) {
    if (unitCount >= minimumUnitCount) {
      break;
    }
    selected.push(nextPassage);
    unitCount += getTimedPassageUnitCount(nextPassage);
  }

  return selected.map((passage) => passage.content).join("\n\n");
}

function isLiteraryPassage(passage: LibraryPassage) {
  return passage.category === "文言文" || passage.category === "詩詞" || passage.style === "Classical" || passage.style === "Poetry";
}

function getMinimumStandaloneUnitCount(passage: LibraryPassage) {
  return passage.language === "chinese" ? 60 : 40;
}

function isTooShortForStandalonePractice(passage: LibraryPassage) {
  return getTimedPassageUnitCount(passage) < getMinimumStandaloneUnitCount(passage);
}

function getTimedPassageUnitCount(passage: LibraryPassage) {
  if (passage.language === "chinese") {
    return Array.from(passage.content).filter((character) => !/\s/.test(character)).length;
  }

  return passage.wordCount > 0 ? passage.wordCount : countWords(passage.content);
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readLocalStorageValue(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(key);
}

function restoreImportedSettings(settings: unknown, library: LibraryPassage[]) {
  if (typeof window === "undefined" || !isRecord(settings)) {
    return;
  }

  runTypingStationStorageMigration();

  if (typeof settings.selectedCategory === "string") {
    safeSetStorageItem(SELECTED_CATEGORY_STORAGE_KEY, settings.selectedCategory, { context: "restoreImportedSettings" });
  }

  if (typeof settings.selectedStyle === "string") {
    safeSetStorageItem(SELECTED_STYLE_STORAGE_KEY, settings.selectedStyle, { context: "restoreImportedSettings" });
  }

  if (settings.selectedLanguage === "english" || settings.selectedLanguage === "chinese") {
    safeSetStorageItem(SELECTED_LANGUAGE_STORAGE_KEY, settings.selectedLanguage, { context: "restoreImportedSettings" });
  }

  if (settings.passageSelectionMode === "specific" || settings.passageSelectionMode === "random") {
    safeSetStorageItem(PASSAGE_SELECTION_MODE_STORAGE_KEY, settings.passageSelectionMode, {
      context: "restoreImportedSettings"
    });
  }

  if (typeof settings.activePassageId === "string") {
    if (library.some((passage) => passage.id === settings.activePassageId)) {
      safeSetStorageItem(ACTIVE_PASSAGE_ID_STORAGE_KEY, settings.activePassageId, {
        context: "restoreImportedSettings"
      });
    } else {
      window.localStorage.removeItem(ACTIVE_PASSAGE_ID_STORAGE_KEY);
    }
  } else if (settings.activePassageId === null) {
    window.localStorage.removeItem(ACTIVE_PASSAGE_ID_STORAGE_KEY);
  }
}

function normaliseThemeSettings(settings: unknown): ThemeSettings {
  if (!isRecord(settings)) {
    return DEFAULT_THEME_SETTINGS;
  }

  return {
    themePreset: isThemePreset(settings.themePreset) ? settings.themePreset : DEFAULT_THEME_SETTINGS.themePreset,
    mode: isThemeMode(settings.mode) ? settings.mode : DEFAULT_THEME_SETTINGS.mode,
    accentColor: isAccentColor(settings.accentColor) ? settings.accentColor : DEFAULT_THEME_SETTINGS.accentColor,
    appFont: isAppFont(settings.appFont) ? settings.appFont : DEFAULT_THEME_SETTINGS.appFont,
    typingFont: isTypingFont(settings.typingFont) ? settings.typingFont : DEFAULT_THEME_SETTINGS.typingFont,
    typingTextSize: isTypingTextSize(settings.typingTextSize)
      ? settings.typingTextSize
      : DEFAULT_THEME_SETTINGS.typingTextSize,
    typingWidth: isTypingWidth(settings.typingWidth) ? settings.typingWidth : DEFAULT_THEME_SETTINGS.typingWidth,
    caretStyle: isCaretStyle(settings.caretStyle) ? settings.caretStyle : DEFAULT_THEME_SETTINGS.caretStyle,
    caretBlink: isCaretBlink(settings.caretBlink) ? settings.caretBlink : DEFAULT_THEME_SETTINGS.caretBlink,
    typingColorStyle: isTypingColorStyle(settings.typingColorStyle)
      ? settings.typingColorStyle
      : DEFAULT_THEME_SETTINGS.typingColorStyle
  };
}

function isThemePreset(value: unknown): value is ThemePreset {
  return (
    value === "default-dark" ||
    value === "light" ||
    value === "dracula" ||
    value === "nord" ||
    value === "catppuccin-mocha" ||
    value === "tokyo-night" ||
    value === "rose-pine-dawn" ||
    value === "solarized-light" ||
    value === "tangerine" ||
    value === "matcha" ||
    value === "milkshake" ||
    value === "paper" ||
    value === "gruvbox-dark" ||
    value === "rose-pine-moon" ||
    value === "terminal" ||
    value === "modern-ink" ||
    value === "serika" ||
    value === "copper" ||
    value === "iceberg"
  );
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "dark" || value === "light" || value === "system";
}

function isAccentColor(value: unknown): value is AccentColor {
  return (
    value === "blue" ||
    value === "purple" ||
    value === "emerald" ||
    value === "rose" ||
    value === "amber" ||
    value === "cyan" ||
    value === "lime" ||
    value === "red" ||
    value === "orange"
  );
}

function isAppFont(value: unknown): value is AppFont {
  return value === "system" || value === "sans" || value === "serif" || value === "rounded" || value === "humanist" || value === "grotesk" || value === "mono" || value === "editorial";
}

function isTypingFont(value: unknown): value is TypingFont {
  return value === "system-mono" || value === "serif" || value === "code" || value === "humanist-mono" || value === "geometric-mono" || value === "accessible" || value === "cjk";
}

function isTypingTextSize(value: unknown): value is TypingTextSize {
  return value === "small" || value === "medium" || value === "large";
}

function isTypingWidth(value: unknown): value is TypingWidth {
  return value === "compact" || value === "comfortable" || value === "wide";
}

function isCaretStyle(value: unknown): value is CaretStyle {
  return value === "bar" || value === "block" || value === "underline";
}

function isCaretBlink(value: unknown): value is CaretBlink {
  return value === "on" || value === "off";
}

function isTypingColorStyle(value: unknown): value is TypingColorStyle {
  return value === "theme-default" || value === "high-contrast" || value === "soft";
}

function normaliseImportedLibraryPassage(item: unknown): LibraryPassage | null {
  if (!isRecord(item) || typeof item.content !== "string" || item.content.trim().length === 0) {
    return null;
  }

  const content = item.content.trim();
  const createdAt = typeof item.createdAt === "string" && item.createdAt.trim() ? item.createdAt : new Date().toISOString();
  const source = item.source === "generated" || item.source === "pasted" || item.source === "uploaded" ? item.source : "uploaded";

  return normaliseLibraryPassage({
    id: typeof item.id === "string" && item.id.trim() ? item.id : createId(),
    title: typeof item.title === "string" ? item.title : "Untitled passage",
    content,
    category: typeof item.category === "string" && item.category.trim() ? (item.category as PracticeCategory) : "Uncategorised",
    style: typeof item.style === "string" && item.style.trim() ? item.style : "General",
    language: toPassageLanguage(typeof item.language === "string" ? item.language : null),
    source,
    createdAt,
    updatedAt: typeof item.updatedAt === "string" && item.updatedAt.trim() ? item.updatedAt : createdAt,
    wordCount: typeof item.wordCount === "number" ? item.wordCount : countWords(content),
    characterCount: typeof item.characterCount === "number" ? item.characterCount : content.length,
    isActive: typeof item.isActive === "boolean" ? item.isActive : true
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normaliseLibraryPassage(passage: LibraryPassage): LibraryPassage {
  const content = passage.content?.trim() ?? "";
  const createdAt = passage.createdAt ?? new Date().toISOString();

  return {
    ...passage,
    content,
    title: passage.title?.trim() || "Untitled passage",
    category: passage.category ?? "Uncategorised",
    style: passage.style || "General",
    language: toPassageLanguage(passage.language),
    createdAt,
    updatedAt: passage.updatedAt ?? createdAt,
    wordCount: typeof passage.wordCount === "number" ? passage.wordCount : countWords(content),
    characterCount: typeof passage.characterCount === "number" ? passage.characterCount : content.length,
    isActive: passage.isActive ?? true
  };
}

function toPassageLanguage(value: string | null | undefined): PassageLanguage {
  return value === "chinese" ? "chinese" : "english";
}
