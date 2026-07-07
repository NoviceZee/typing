export type PracticeCategory =
  | "Business email"
  | "Tender / proposal writing"
  | "Government / formal English"
  | "News article"
  | "Casual writing"
  | "Legal / contract style"
  | "Random paragraph"
  | "生活"
  | "工作"
  | "教育"
  | "科技"
  | "文化"
  | "社會"
  | "環境"
  | "健康"
  | "香港"
  | "numbers"
  | "symbols"
  | "training_words"
  | "training_numbers"
  | "training_symbols"
  | "training_code"
  | "training_chinese"
  | "training_words_numbers"
  | "training_words_symbols"
  | "training_numbers_symbols"
  | "training_words_numbers_symbols"
  | "Uncategorised";

export type CharacterStatus = "correct" | "wrong" | "current" | "untyped" | "extra";

export type TypingRules = {
  requireTabToStart: boolean;
  requireTwoSpacesAfterPeriod: boolean;
  enforceUppercase: boolean;
  enforceLowercase: boolean;
  caseSensitive: boolean;
  punctuationSensitive: boolean;
  enforceExtraSpaces: boolean;
  enforceMissingSpaces: boolean;
  autoCapitalisationHints: boolean;
  showMistakesImmediately: boolean;
  allowBackspace: boolean;
};

export type CharacterComparison = {
  expected: string;
  actual: string;
  index: number;
  status: CharacterStatus;
};

export type TypingComparison = {
  characters: CharacterComparison[];
  characterStatuses: CharacterComparison[];
  correctCharacters: number;
  incorrectCharacters: number;
  missedCharacters: number;
  extraCharacters: number;
  totalCharacters: number;
  comparableTargetLength: number;
  comparableTypedLength: number;
  accuracy: number;
};

export type ResultInput = {
  target: string;
  typed: string;
  elapsedSeconds: number;
  durationSeconds: number;
  category: PracticeCategory;
  language?: "english" | "chinese";
  rules: TypingRules;
  presetName?: string;
  completionReason?: CompletionReason;
};

export type CompletionReason = "time_up" | "text_completed" | "manual";

export type TypingResult = TypingComparison & {
  wpm: number;
  rawWpm: number;
  timeUsedSeconds: number;
  durationSeconds: number;
  category: PracticeCategory;
  presetName: string;
  completionReason: CompletionReason;
  completedAt: string;
  isRankable: boolean;
};

export const DEFAULT_RULES: TypingRules = {
  requireTabToStart: true,
  requireTwoSpacesAfterPeriod: false,
  enforceUppercase: true,
  enforceLowercase: true,
  caseSensitive: true,
  punctuationSensitive: true,
  enforceExtraSpaces: true,
  enforceMissingSpaces: true,
  autoCapitalisationHints: true,
  showMistakesImmediately: true,
  allowBackspace: true
};

const PUNCTUATION_PATTERN = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

const PASSAGE_BANK: Partial<Record<PracticeCategory, string[]>> = {
  "Business email": [
    "The coordination note has been updated to reflect the confirmed responsibilities, outstanding dependencies, and expected response dates for each workstream. Kindly advise if any item should be reclassified before circulation.",
    "The attached summary records the agreed position as of this afternoon, including the revised delivery assumptions and the remaining approvals required before implementation can proceed.",
    "To maintain the current timetable, the project team will consolidate comments, resolve open points, and issue the final version after the responsible reviewers have confirmed their input."
  ],
  "Tender / proposal writing": [
    "The bidder shall submit a complete technical proposal, including methodology, staffing plan, delivery timeline, quality assurance measures, and supporting evidence of relevant project experience.",
    "The proposal should demonstrate a clear understanding of the service requirements, the operational constraints, and the reporting obligations expected throughout the contract period.",
    "Evaluation will consider compliance, capability, value for money, risk management, and the extent to which the proposed approach provides a practical and reliable solution."
  ],
  "Government / formal English": [
    "Applicants are reminded that all declarations must be accurate, complete, and submitted before the stated deadline. Late applications may not be considered unless exceptional circumstances are established.",
    "The department reserves the right to request supplementary information, verify submitted documents, and reject any application that contains misleading, incomplete, or inconsistent information.",
    "All correspondence should quote the application reference number and should be addressed to the responsible officer named in the notice."
  ],
  "News article": [
    "The committee announced new transport measures on Monday, stating that the revised timetable would improve peak-hour capacity and reduce passenger waiting times across major districts.",
    "Officials said the changes followed several months of consultation with operators, passenger groups, and district representatives.",
    "Further adjustments may be introduced after the first review period, during which the department will monitor service reliability, passenger flow, and public feedback."
  ],
  "Casual writing": [
    "I checked the notes again this morning and found a cleaner way to explain the idea. It should make the whole message easier to follow without changing the main point.",
    "The first version felt a little crowded, so I moved the examples closer to the sections they support and removed a few repeated phrases.",
    "If the structure feels natural when read aloud, it will probably work better for people who only have a few minutes to skim it."
  ],
  "Legal / contract style": [
    "Subject to the terms herein, each party shall perform its obligations with due care, skill, and diligence, and shall notify the other party of any material delay.",
    "No waiver of any provision shall be effective unless made in writing and signed by an authorised representative of the party granting such waiver.",
    "If any provision is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect to the maximum extent permitted by law."
  ],
  "Random paragraph": [
    "Precise typing rewards patience. Every comma, capital letter, date, and clause becomes part of the rhythm, especially when the passage demands formal attention.",
    "A careful typist learns to notice structure as well as speed, because formal prose often hides meaning in small marks and measured transitions.",
    "The best practice passages are long enough to expose habits, varied enough to stay useful, and strict enough to make each rule visible."
  ],
  numbers: [
    "483920 193.40 49,382.20 $4,390.00 18.75%",
    "720184 806.15 12,804.90 $8,125.50 42.30%",
    "359001 71.09 904,381.44 $2,018.75 6.25%"
  ],
  symbols: [
    "() [] {} <> \"\" '' `` . , ; : + - * / = == != >= <= += -= *= /= ! @ # $ % ^ & *",
    "(value) [index] {block} <tag> \"text\" 'key' `code` a += b; x != y; rate >= 10%",
    "! @ # $ % ^ & * () [] {} <> == != <= >= += -= *= /="
  ],
  training_words: [
    "market invoice client status approved project report update review budget delivery system process office request confirm"
  ],
  training_numbers: [
    "483920 193.40 49,382.20 $4,390.00 18.75% 720184 806.15 12,804.90"
  ],
  training_symbols: [
    "() [] {} <> \"\" '' `` . , ; : + - * / = == != >= <= += -= *= /= ! @ # $ % ^ & *"
  ],
  training_code: [
    "const result = await fetch(url);\n\nif (result.ok) {\n  return data;\n}"
  ],
  training_chinese: [
    "今天工作時間朋友香港開始完成需要知道可以生活事情地方回家吃飯休息早上晚上"
  ],
  training_words_numbers: [
    "market 493.20 invoice client $2,430.00 status approved 18.75% budget 49,382.20"
  ],
  training_words_symbols: [
    "market invoice >= client status != approved review () budget [] report += update"
  ],
  training_numbers_symbols: [
    "493.20 >= $2,430.00 != 18.75% () 49,382.20 [] 483920 +="
  ],
  training_words_numbers_symbols: [
    "market 493.20 invoice >= client $2,430.00 status != approved"
  ],
  Uncategorised: [
    "This locally uploaded passage has not been assigned to a formal category. It remains available for practice and can be selected from the passage library.",
    "Use the category and style filters before uploading if you want future passages to appear in a more specific library group.",
    "FormalType will still measure speed, accuracy, punctuation, and spacing rules for uncategorised material in exactly the same way."
  ]
};

export function normalizeTargetForRules(target: string, rules: TypingRules): string {
  if (!rules.requireTwoSpacesAfterPeriod) {
    return target;
  }

  let normalised = "";

  for (let index = 0; index < target.length; index += 1) {
    const character = target[index];
    normalised += character;

    if (character !== "." || index === target.length - 1 || target[index + 1] === "\n") {
      continue;
    }

    while (target[index + 1] === " ") {
      index += 1;
    }

    normalised += "  ";
  }

  return normalised;
}

export function enforceBackspacePolicy(previousValue: string, nextValue: string, allowBackspace: boolean): string {
  if (allowBackspace || nextValue.length >= previousValue.length) {
    return nextValue;
  }

  return previousValue;
}

export function validateTypedText({
  targetText,
  typedText,
  rules
}: {
  targetText: string;
  typedText: string;
  rules: TypingRules;
}): TypingComparison {
  return compareTyping(normalizeTargetForRules(targetText, rules), typedText, rules);
}

export function compareTyping(target: string, typed: string, rules: TypingRules): TypingComparison {
  const characters: CharacterComparison[] = [];
  let correctCharacters = 0;
  let incorrectCharacters = 0;
  let missedCharacters = 0;
  let extraCharacters = 0;

  let targetIndex = 0;
  let typedIndex = 0;

  while (targetIndex < target.length || typedIndex < typed.length) {
    const expected = target[targetIndex] ?? "";
    const actual = typed[typedIndex] ?? "";

    if (expected === "" && actual !== "") {
      const countsAsError = shouldCountExtraCharacter(actual, rules);
      if (countsAsError) {
        incorrectCharacters += 1;
        extraCharacters += 1;
      }
      characters.push({ expected: "", actual, index: targetIndex, status: countsAsError ? "extra" : "correct" });
      typedIndex += 1;
      continue;
    }

    if (actual === "") {
      const isCurrent = typedIndex === typed.length && targetIndex === typed.length;
      characters.push({ expected, actual: "", index: targetIndex, status: isCurrent ? "current" : "untyped" });
      targetIndex += 1;
      continue;
    }

    if (!rules.punctuationSensitive && isPunctuation(expected) && expected !== actual) {
      characters.push({ expected, actual: "", index: targetIndex, status: "correct" });
      targetIndex += 1;
      continue;
    }

    if (!rules.punctuationSensitive && isPunctuation(actual) && expected !== actual) {
      characters.push({ expected: "", actual, index: targetIndex, status: "correct" });
      typedIndex += 1;
      continue;
    }

    if (expected === "\n" && actual !== "\n") {
      incorrectCharacters += 1;
      missedCharacters += 1;
      characters.push({ expected, actual: "", index: targetIndex, status: "wrong" });
      targetIndex += 1;
      continue;
    }

    if (expected !== actual && typed[typedIndex + 1] === expected) {
      const countsAsError = shouldCountExtraCharacter(actual, rules);
      if (countsAsError) {
        incorrectCharacters += 1;
        extraCharacters += 1;
      }
      characters.push({ expected: "", actual, index: targetIndex, status: countsAsError ? "extra" : "correct" });
      typedIndex += 1;
      continue;
    }

    if (expected !== actual && target[targetIndex + 1] === actual) {
      if (rules.enforceMissingSpaces || expected !== " ") {
        incorrectCharacters += 1;
        missedCharacters += 1;
        characters.push({ expected, actual: "", index: targetIndex, status: "wrong" });
      } else {
        characters.push({ expected, actual: "", index: targetIndex, status: "correct" });
      }
      targetIndex += 1;
      continue;
    }

    if (
      expected !== actual &&
      actual === " " &&
      expected !== " " &&
      target[targetIndex + 1] === " " &&
      !rules.enforceExtraSpaces
    ) {
      characters.push({ expected: "", actual, index: targetIndex, status: "correct" });
      typedIndex += 1;
      continue;
    }

    if (expected === " " && actual !== " ") {
      if (rules.enforceMissingSpaces) {
        incorrectCharacters += 1;
        missedCharacters += 1;
        characters.push({ expected, actual: "", index: targetIndex, status: "wrong" });
      } else {
        characters.push({ expected, actual: "", index: targetIndex, status: "correct" });
      }
      targetIndex += 1;
      continue;
    }

    if (actual === " " && expected !== " ") {
      const countsAsError = rules.enforceExtraSpaces;
      if (countsAsError) {
        incorrectCharacters += 1;
        extraCharacters += 1;
      }
      characters.push({ expected: "", actual, index: targetIndex, status: countsAsError ? "extra" : "correct" });
      typedIndex += 1;
      continue;
    }

    const isCorrect = charactersEquivalent(expected, actual, rules);
    if (isCorrect) {
      correctCharacters += 1;
    } else {
      incorrectCharacters += 1;
    }
    characters.push({ expected, actual, index: targetIndex, status: isCorrect ? "correct" : "wrong" });
    targetIndex += 1;
    typedIndex += 1;
  }

  const comparableTargetLength = getComparableTextLength(target, rules);
  const comparableTypedLength = getComparableTextLength(typed, rules);

  return {
    characters,
    characterStatuses: characters,
    correctCharacters,
    incorrectCharacters,
    missedCharacters,
    extraCharacters,
    totalCharacters: target.length,
    comparableTargetLength,
    comparableTypedLength,
    accuracy: roundPercentage(correctCharacters, correctCharacters + incorrectCharacters)
  };
}

export function calculateResult(input: ResultInput): TypingResult {
  const comparison = validateTypedText({
    targetText: input.target,
    typedText: input.typed,
    rules: input.rules
  });
  const minutes = Math.max(input.elapsedSeconds, 1) / 60;
  const usesCharacterPace = input.language === "chinese" || input.category === "training_chinese" || isChinesePracticeCategory(input.category);
  const grossWpm = usesCharacterPace ? comparison.correctCharacters / minutes : comparison.correctCharacters / 5 / minutes;
  const rawWpm = usesCharacterPace ? input.typed.length / minutes : input.typed.length / 5 / minutes;

  return {
    ...comparison,
    wpm: roundOne(grossWpm),
    rawWpm: roundOne(rawWpm),
    timeUsedSeconds: Math.round(input.elapsedSeconds),
    durationSeconds: input.durationSeconds,
    category: input.category,
    presetName: input.presetName ?? "Custom rules",
    completionReason: input.completionReason ?? "manual",
    completedAt: new Date().toISOString(),
    isRankable: comparison.accuracy >= 70 && input.elapsedSeconds >= 15
  };
}

export function isChinesePracticeCategory(category: string | null | undefined) {
  return category === "生活" || category === "工作" || category === "教育" || category === "科技" || category === "文化" || category === "社會" || category === "環境" || category === "健康" || category === "香港";
}

export function getRequiredWordCount(durationSeconds: number): number {
  if (durationSeconds <= 60) {
    return 300;
  }

  if (durationSeconds <= 300) {
    return 1100;
  }

  if (durationSeconds <= 600) {
    return 2200;
  }

  return Math.ceil((durationSeconds / 60) * 220);
}

export function buildPracticePassage(category: PracticeCategory, durationSeconds: number): string {
  const targetWordCount = getRequiredWordCount(durationSeconds);
  const paragraphs = PASSAGE_BANK[category] ?? PASSAGE_BANK["Business email"] ?? [];
  const output: string[] = [];
  let wordCount = 0;
  let index = 0;

  while (wordCount < targetWordCount) {
    const paragraph = paragraphs[index % paragraphs.length];
    output.push(paragraph);
    wordCount += countWords(paragraph);
    index += 1;
  }

  return output.join("\n\n");
}

export function isTypedTextComplete(targetText: string, typedText: string, rules: TypingRules): boolean {
  const preparedTarget = normalizeTargetForRules(targetText, rules);

  return getComparableTextLength(typedText, rules) >= getComparableTextLength(preparedTarget, rules);
}

function charactersEquivalent(expected: string, actual: string, rules: TypingRules): boolean {
  if (!rules.punctuationSensitive && (isPunctuation(expected) || isPunctuation(actual))) {
    return true;
  }

  if (isLetter(expected) && isLetter(actual)) {
    if (!rules.caseSensitive) {
      return expected.toLocaleLowerCase() === actual.toLocaleLowerCase();
    }

    if (!rules.enforceUppercase && isUppercase(expected) && actual.toLocaleLowerCase() === expected.toLocaleLowerCase()) {
      return true;
    }

    if (!rules.enforceLowercase && isLowercase(expected) && actual.toLocaleLowerCase() === expected) {
      return true;
    }
  }

  return expected === actual;
}

function shouldCountExtraCharacter(character: string, rules: TypingRules): boolean {
  if (character === " ") {
    return rules.enforceExtraSpaces;
  }

  if (!rules.punctuationSensitive && isPunctuation(character)) {
    return false;
  }

  return true;
}

function getComparableTextLength(text: string, rules: TypingRules): number {
  if (rules.punctuationSensitive) {
    return text.length;
  }

  return Array.from(text).filter((character) => !isPunctuation(character)).length;
}

function isPunctuation(character: string): boolean {
  return PUNCTUATION_PATTERN.test(character);
}

function isLetter(character: string): boolean {
  return /^[a-z]$/i.test(character);
}

function isUppercase(character: string): boolean {
  return isLetter(character) && character === character.toLocaleUpperCase();
}

function isLowercase(character: string): boolean {
  return isLetter(character) && character === character.toLocaleLowerCase();
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundPercentage(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 100;
  }

  return Math.round((numerator / denominator) * 10000) / 100;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
