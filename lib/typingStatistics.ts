import type { CharacterComparison, TypingResult } from "./typing-engine";
import { AnalyticsDomain, getCategoryAnalyticsDomain } from "./analyticsDomain";

export const TYPING_ATTEMPT_DETAILS_STORAGE_KEY = "formaltype.typing_attempt_details.v1";
const MAX_STORED_ATTEMPT_DETAILS = 200;
const DEFAULT_MIN_WEAK_KEY_HITS = 20;

export type TypingAttemptCharacterDetail = Pick<CharacterComparison, "expected" | "actual" | "index" | "status"> & {
  delayMs?: number | null;
};

export type TypingAttemptTimelinePoint = {
  timeSeconds: number;
  wpm: number;
};

export type TypingAttemptDetail = {
  id: string;
  userId: string | null;
  completedAt: string;
  durationSeconds: number;
  category?: string | null;
  wpm: number;
  accuracy: number;
  characters: TypingAttemptCharacterDetail[];
  timeline?: TypingAttemptTimelinePoint[];
};

export type KeyboardLayoutKey = {
  key: string;
  label: string;
  width?: number;
};

export type TypingReplayEvent = {
  id: string;
  key: string;
  expected: string;
  actual: string;
  status: TypingAttemptCharacterDetail["status"];
  index: number;
  timeMs: number;
  isMistake: boolean;
  classification: DetailedMistakeClassification | null;
};

export type KeyStatistic = {
  key: string;
  hitCount: number;
  correctCount: number;
  mistakeCount: number;
  accuracy: number;
  averageDelayMs: number | null;
};

export type CommonMistakeType = "substitution" | "missed" | "extra";

export type CommonMistake = {
  id: string;
  type: CommonMistakeType;
  expected: string;
  actual: string;
  count: number;
};

export type FingerName =
  | "Left Pinky"
  | "Left Ring"
  | "Left Middle"
  | "Left Index"
  | "Thumbs"
  | "Right Index"
  | "Right Middle"
  | "Right Ring"
  | "Right Pinky";

export type FingerStatistic = {
  finger: FingerName;
  hitCount: number;
  correctCount: number;
  mistakeCount: number;
  accuracy: number;
  averageDelayMs: number | null;
};

export type ReactionTimeStatistic = {
  averageKeystrokeMs: number | null;
  correctKeystrokeMs: number | null;
  wrongKeystrokeMs: number | null;
};

export type BurstSpeedStatistic = {
  peak3SecondWpm: number | null;
  peak5SecondWpm: number | null;
  peak10SecondWpm: number | null;
};

export type SpeedDropStatistic = {
  startWpm: number | null;
  middleWpm: number | null;
  endWpm: number | null;
  averageSlowdownPercent: number | null;
};

export type DetailedMistakeClassification =
  | "Adjacent key"
  | "Wrong hand"
  | "Missed Shift"
  | "Punctuation"
  | "Spacing"
  | "Capitalization"
  | "Extra character"
  | "Missed character"
  | "Wrong character";

export type TypingStatistics = {
  keys: KeyStatistic[];
  weakKeys: KeyStatistic[];
  commonMistakes: CommonMistake[];
  fingers: FingerStatistic[];
  reactionTime: ReactionTimeStatistic;
  burstSpeed: BurstSpeedStatistic;
  speedDrop: SpeedDropStatistic;
};

export type TypingStatisticsOptions = {
  minWeakKeyHits?: number;
  domain?: AnalyticsDomain;
};

type MutableKeyStatistic = Omit<KeyStatistic, "accuracy" | "averageDelayMs"> & {
  delayTotalMs: number;
  delayCount: number;
};

type AttemptSpeedDrop = {
  startWpm: number;
  middleWpm: number;
  endWpm: number;
  averageSlowdownPercent: number;
};

export function buildTypingAttemptDetail({
  userId,
  result,
  typedCharacterDelaysMs = [],
  timeline = []
}: {
  userId?: string | null;
  result: TypingResult;
  typedCharacterDelaysMs?: Array<number | null | undefined>;
  timeline?: TypingAttemptTimelinePoint[];
}): TypingAttemptDetail {
  let typedCharacterIndex = 0;

  return {
    id: `${result.completedAt}-${Math.random().toString(36).slice(2, 10)}`,
    userId: userId ?? null,
    completedAt: result.completedAt,
    durationSeconds: result.durationSeconds,
    category: result.category,
    wpm: result.wpm,
    accuracy: result.accuracy,
    timeline: timeline.map((point) => ({
      timeSeconds: point.timeSeconds,
      wpm: point.wpm
    })),
    characters: result.characters.map((character) => {
      const delayMs = character.actual ? typedCharacterDelaysMs[typedCharacterIndex++] : null;

      return {
        expected: character.expected,
        actual: character.actual,
        index: character.index,
        status: character.status,
        delayMs: typeof delayMs === "number" && Number.isFinite(delayMs) ? Math.max(0, Math.round(delayMs)) : null
      };
    })
  };
}

export function aggregateTypingStatistics(
  attempts: TypingAttemptDetail[],
  options: TypingStatisticsOptions = {}
): TypingStatistics {
  const domain = options.domain ?? "english";
  const scopedAttempts = attempts.filter((attempt) => getCategoryAnalyticsDomain(attempt.category) === domain);
  const keysByCharacter = new Map<string, MutableKeyStatistic>();

  if (domain === "chinese") {
    return {
      keys: [],
      weakKeys: [],
      commonMistakes: rankCommonMistakes(scopedAttempts),
      fingers: [],
      reactionTime: calculateReactionTime(scopedAttempts),
      burstSpeed: calculateBurstSpeed(scopedAttempts),
      speedDrop: calculateSpeedDrop(scopedAttempts)
    };
  }

  scopedAttempts.forEach((attempt) => {
    attempt.characters.forEach((character) => {
      if (!character.expected || !isAttemptedExpectedCharacter(character)) {
        return;
      }

      const key = normaliseKey(character.expected);
      const keyStatistic = keysByCharacter.get(key) ?? {
        key,
        hitCount: 0,
        correctCount: 0,
        mistakeCount: 0,
        delayTotalMs: 0,
        delayCount: 0
      };

      keyStatistic.hitCount += 1;

      if (character.status === "correct") {
        keyStatistic.correctCount += 1;
      } else if (character.status === "wrong") {
        keyStatistic.mistakeCount += 1;
      }

      if (typeof character.delayMs === "number" && Number.isFinite(character.delayMs)) {
        keyStatistic.delayTotalMs += character.delayMs;
        keyStatistic.delayCount += 1;
      }

      keysByCharacter.set(key, keyStatistic);
    });
  });

  const keys = Array.from(keysByCharacter.values())
    .map((keyStatistic) => ({
      key: keyStatistic.key,
      hitCount: keyStatistic.hitCount,
      correctCount: keyStatistic.correctCount,
      mistakeCount: keyStatistic.mistakeCount,
      accuracy: roundPercentage(keyStatistic.correctCount, keyStatistic.hitCount),
      averageDelayMs:
        keyStatistic.delayCount > 0 ? Math.round(keyStatistic.delayTotalMs / keyStatistic.delayCount) : null
    }))
    .sort((first, second) => first.key.localeCompare(second.key));

  return {
    keys,
    weakKeys: rankWeakKeys(keys, { minHits: options.minWeakKeyHits }),
    commonMistakes: rankCommonMistakes(scopedAttempts),
    fingers: aggregateFingerStatistics(scopedAttempts),
    reactionTime: calculateReactionTime(scopedAttempts),
    burstSpeed: calculateBurstSpeed(scopedAttempts),
    speedDrop: calculateSpeedDrop(scopedAttempts)
  };
}

export function rankWeakKeys(keys: KeyStatistic[], options: { minHits?: number } = {}): KeyStatistic[] {
  const minHits = options.minHits ?? DEFAULT_MIN_WEAK_KEY_HITS;

  return keys
    .filter((key) => key.hitCount >= minHits && key.mistakeCount > 0)
    .sort((first, second) => {
      if (first.accuracy !== second.accuracy) {
        return first.accuracy - second.accuracy;
      }

      if (first.mistakeCount !== second.mistakeCount) {
        return second.mistakeCount - first.mistakeCount;
      }

      return second.hitCount - first.hitCount || first.key.localeCompare(second.key);
    })
    .slice(0, 8);
}

export function getFullKeyboardLayout(): KeyboardLayoutKey[][] {
  return FULL_KEYBOARD_LAYOUT.map((row) => row.map((key) => ({ ...key })));
}

export function buildTypingReplayEvents(
  attempt: TypingAttemptDetail | null | undefined,
  options: { onlyMistakes?: boolean } = {}
): TypingReplayEvent[] {
  if (!attempt?.characters?.length) {
    return [];
  }

  let currentTimeMs = 0;
  const events: TypingReplayEvent[] = [];

  attempt.characters.forEach((character, order) => {
    if (character.actual) {
      currentTimeMs += typeof character.delayMs === "number" && Number.isFinite(character.delayMs) ? character.delayMs : 0;
    }

    if (!character.actual && character.status !== "wrong") {
      return;
    }

    const isMistake = character.status === "wrong" || character.status === "extra";

    if (options.onlyMistakes && !isMistake) {
      return;
    }

    events.push({
      id: `${attempt.id}-${order}`,
      key: normaliseKey(character.actual || character.expected),
      expected: character.expected,
      actual: character.actual,
      status: character.status,
      index: character.index,
      timeMs: currentTimeMs,
      isMistake,
      classification: isMistake ? classifyDetailedMistake(character) : null
    });
  });

  return events;
}

export function rankCommonMistakes(attempts: TypingAttemptDetail[]): CommonMistake[] {
  const mistakesById = new Map<string, CommonMistake>();

  attempts.forEach((attempt) => {
    attempt.characters.forEach((character) => {
      const mistake = toCommonMistake(character);

      if (!mistake) {
        return;
      }

      const existingMistake = mistakesById.get(mistake.id);
      mistakesById.set(mistake.id, {
        ...mistake,
        count: (existingMistake?.count ?? 0) + 1
      });
    });
  });

  return Array.from(mistakesById.values())
    .sort(
      (first, second) =>
        second.count - first.count ||
        mistakeTypeRank(first.type) - mistakeTypeRank(second.type) ||
        first.id.localeCompare(second.id)
    )
    .slice(0, 10);
}

export function getFingerForKey(key: string): FingerName | null {
  return KEYBOARD_FINGERS.get(normaliseKey(key)) ?? null;
}

export function classifyDetailedMistake(character: TypingAttemptCharacterDetail): DetailedMistakeClassification {
  const expected = character.expected;
  const actual = character.actual;

  if (!expected && actual) {
    return "Extra character";
  }

  if (expected && !actual) {
    return isSpacingKey(expected) ? "Spacing" : "Missed character";
  }

  if (isSpacingKey(expected) || isSpacingKey(actual)) {
    return "Spacing";
  }

  if (isPunctuationKey(expected) || isPunctuationKey(actual)) {
    return "Punctuation";
  }

  if (
    expected &&
    actual &&
    expected !== actual &&
    expected.toLocaleLowerCase() === actual.toLocaleLowerCase() &&
    isLetterKey(expected) &&
    isLetterKey(actual)
  ) {
    return expected === expected.toLocaleUpperCase() ? "Missed Shift" : "Capitalization";
  }

  if (areAdjacentKeys(expected, actual)) {
    return "Adjacent key";
  }

  const expectedFinger = getFingerForKey(expected);
  const actualFinger = getFingerForKey(actual);

  if (expectedFinger && actualFinger && getHandForFinger(expectedFinger) !== getHandForFinger(actualFinger)) {
    return "Wrong hand";
  }

  return "Wrong character";
}

export function appendTypingAttemptDetail(detail: TypingAttemptDetail) {
  if (typeof window === "undefined") {
    return;
  }

  const nextDetails = [detail, ...readTypingAttemptDetails()]
    .sort((first, second) => Date.parse(second.completedAt) - Date.parse(first.completedAt))
    .slice(0, MAX_STORED_ATTEMPT_DETAILS);
  window.localStorage.setItem(TYPING_ATTEMPT_DETAILS_STORAGE_KEY, JSON.stringify(nextDetails));
}

export function readTypingAttemptDetails(userId?: string | null): TypingAttemptDetail[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(TYPING_ATTEMPT_DETAILS_STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as unknown) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((detail): detail is TypingAttemptDetail => {
      if (!isTypingAttemptDetail(detail)) {
        return false;
      }

      return userId ? detail.userId === userId : true;
    });
  } catch {
    return [];
  }
}

function toCommonMistake(character: TypingAttemptCharacterDetail): CommonMistake | null {
  if (character.status === "wrong" && character.expected && character.actual) {
    const expected = normaliseKey(character.expected);
    const actual = normaliseKey(character.actual);

    return {
      id: `substitution:${mistakeToken(expected)}:${mistakeToken(actual)}`,
      type: "substitution",
      expected,
      actual,
      count: 0
    };
  }

  if (character.status === "wrong" && character.expected && !character.actual) {
    const expected = normaliseKey(character.expected);

    return {
      id: `missed:${mistakeToken(expected)}`,
      type: "missed",
      expected,
      actual: "",
      count: 0
    };
  }

  if (character.status === "extra" && !character.expected && character.actual) {
    const actual = normaliseKey(character.actual);

    return {
      id: `extra:${mistakeToken(actual)}`,
      type: "extra",
      expected: "",
      actual,
      count: 0
    };
  }

  return null;
}

function aggregateFingerStatistics(attempts: TypingAttemptDetail[]): FingerStatistic[] {
  const fingers = new Map<FingerName, MutableKeyStatistic>();

  attempts.forEach((attempt) => {
    attempt.characters.forEach((character) => {
      if (!character.expected || !isAttemptedExpectedCharacter(character)) {
        return;
      }

      const finger = getFingerForKey(character.expected);

      if (!finger) {
        return;
      }

      const statistic = fingers.get(finger) ?? {
        key: finger,
        hitCount: 0,
        correctCount: 0,
        mistakeCount: 0,
        delayTotalMs: 0,
        delayCount: 0
      };

      statistic.hitCount += 1;

      if (character.status === "correct") {
        statistic.correctCount += 1;
      } else if (character.status === "wrong") {
        statistic.mistakeCount += 1;
      }

      if (typeof character.delayMs === "number" && Number.isFinite(character.delayMs)) {
        statistic.delayTotalMs += character.delayMs;
        statistic.delayCount += 1;
      }

      fingers.set(finger, statistic);
    });
  });

  return FINGER_ORDER.map((finger) => {
    const statistic = fingers.get(finger);

    return {
      finger,
      hitCount: statistic?.hitCount ?? 0,
      correctCount: statistic?.correctCount ?? 0,
      mistakeCount: statistic?.mistakeCount ?? 0,
      accuracy: statistic ? roundPercentage(statistic.correctCount, statistic.hitCount) : 100,
      averageDelayMs:
        statistic && statistic.delayCount > 0 ? Math.round(statistic.delayTotalMs / statistic.delayCount) : null
    };
  }).filter((finger) => finger.hitCount > 0);
}

function calculateReactionTime(attempts: TypingAttemptDetail[]): ReactionTimeStatistic {
  const allDelays: number[] = [];
  const correctDelays: number[] = [];
  const wrongDelays: number[] = [];

  attempts.forEach((attempt) => {
    attempt.characters.forEach((character) => {
      if (!character.actual || typeof character.delayMs !== "number" || !Number.isFinite(character.delayMs)) {
        return;
      }

      allDelays.push(character.delayMs);

      if (character.status === "correct") {
        correctDelays.push(character.delayMs);
      } else if (character.status === "wrong" || character.status === "extra") {
        wrongDelays.push(character.delayMs);
      }
    });
  });

  return {
    averageKeystrokeMs: averageRounded(allDelays),
    correctKeystrokeMs: averageRounded(correctDelays),
    wrongKeystrokeMs: averageRounded(wrongDelays)
  };
}

function calculateBurstSpeed(attempts: TypingAttemptDetail[]): BurstSpeedStatistic {
  return {
    peak3SecondWpm: maxBurstWpm(attempts, 3),
    peak5SecondWpm: maxBurstWpm(attempts, 5),
    peak10SecondWpm: maxBurstWpm(attempts, 10)
  };
}

function calculateSpeedDrop(attempts: TypingAttemptDetail[]): SpeedDropStatistic {
  const drops = attempts.map(calculateAttemptSpeedDrop).filter((drop): drop is AttemptSpeedDrop =>
    Boolean(drop)
  );

  return {
    startWpm: averageOneDecimal(drops.map((drop) => drop.startWpm)),
    middleWpm: averageOneDecimal(drops.map((drop) => drop.middleWpm)),
    endWpm: averageOneDecimal(drops.map((drop) => drop.endWpm)),
    averageSlowdownPercent: averageTwoDecimal(drops.map((drop) => drop.averageSlowdownPercent))
  };
}

function calculateAttemptSpeedDrop(attempt: TypingAttemptDetail): AttemptSpeedDrop | null {
  const timeline = attempt.timeline?.filter((point) => Number.isFinite(point.wpm) && point.timeSeconds > 0) ?? [];

  if (timeline.length < 3) {
    return null;
  }

  const chunkSize = Math.max(1, Math.floor(timeline.length / 3));
  const start = averageOneDecimal(timeline.slice(0, chunkSize).map((point) => point.wpm));
  const middleStart = Math.floor((timeline.length - chunkSize) / 2);
  const middle = averageOneDecimal(timeline.slice(middleStart, middleStart + chunkSize).map((point) => point.wpm));
  const end = averageOneDecimal(timeline.slice(-chunkSize).map((point) => point.wpm));

  if (start === null || middle === null || end === null || start === 0) {
    return null;
  }

  return {
    startWpm: start,
    middleWpm: middle,
    endWpm: end,
    averageSlowdownPercent: roundTwo(((start - end) / start) * 100)
  };
}

function maxBurstWpm(attempts: TypingAttemptDetail[], windowSeconds: number): number | null {
  let peak: number | null = null;

  attempts.forEach((attempt) => {
    const keyTimes = getActualKeyTimesMs(attempt);

    keyTimes.forEach((startTime, startIndex) => {
      const endTime = startTime + windowSeconds * 1000;
      let endIndex = startIndex;

      while (endIndex < keyTimes.length && keyTimes[endIndex] <= endTime) {
        endIndex += 1;
      }

      const characters = endIndex - startIndex;
      const wpm = roundOne((characters / 5 / windowSeconds) * 60);
      peak = peak === null ? wpm : Math.max(peak, wpm);
    });
  });

  return peak;
}

function getActualKeyTimesMs(attempt: TypingAttemptDetail): number[] {
  let currentTime = 0;
  const keyTimes: number[] = [];

  attempt.characters.forEach((character) => {
    if (!character.actual) {
      return;
    }

    currentTime += typeof character.delayMs === "number" && Number.isFinite(character.delayMs) ? character.delayMs : 0;
    keyTimes.push(currentTime);
  });

  return keyTimes;
}

function isTypingAttemptDetail(value: unknown): value is TypingAttemptDetail {
  if (!value || typeof value !== "object") {
    return false;
  }

  const detail = value as Partial<TypingAttemptDetail>;
  return (
    typeof detail.id === "string" &&
    typeof detail.completedAt === "string" &&
    Array.isArray(detail.characters)
  );
}

const FINGER_ORDER: FingerName[] = [
  "Left Pinky",
  "Left Ring",
  "Left Middle",
  "Left Index",
  "Thumbs",
  "Right Index",
  "Right Middle",
  "Right Ring",
  "Right Pinky"
];

const FULL_KEYBOARD_LAYOUT: KeyboardLayoutKey[][] = [
  [
    { key: "`", label: "`" },
    { key: "1", label: "1" },
    { key: "2", label: "2" },
    { key: "3", label: "3" },
    { key: "4", label: "4" },
    { key: "5", label: "5" },
    { key: "6", label: "6" },
    { key: "7", label: "7" },
    { key: "8", label: "8" },
    { key: "9", label: "9" },
    { key: "0", label: "0" },
    { key: "-", label: "-" },
    { key: "=", label: "=" },
    { key: "Backspace", label: "Backspace", width: 2 }
  ],
  [
    { key: "Tab", label: "Tab", width: 1.5 },
    { key: "q", label: "Q" },
    { key: "w", label: "W" },
    { key: "e", label: "E" },
    { key: "r", label: "R" },
    { key: "t", label: "T" },
    { key: "y", label: "Y" },
    { key: "u", label: "U" },
    { key: "i", label: "I" },
    { key: "o", label: "O" },
    { key: "p", label: "P" },
    { key: "[", label: "[" },
    { key: "]", label: "]" },
    { key: "\\", label: "\\" }
  ],
  [
    { key: "CapsLock", label: "Caps Lock", width: 1.8 },
    { key: "a", label: "A" },
    { key: "s", label: "S" },
    { key: "d", label: "D" },
    { key: "f", label: "F" },
    { key: "g", label: "G" },
    { key: "h", label: "H" },
    { key: "j", label: "J" },
    { key: "k", label: "K" },
    { key: "l", label: "L" },
    { key: ";", label: ";" },
    { key: "'", label: "'" },
    { key: "Enter", label: "Enter", width: 1.8 }
  ],
  [
    { key: "Shift", label: "Shift", width: 2.3 },
    { key: "z", label: "Z" },
    { key: "x", label: "X" },
    { key: "c", label: "C" },
    { key: "v", label: "V" },
    { key: "b", label: "B" },
    { key: "n", label: "N" },
    { key: "m", label: "M" },
    { key: ",", label: "," },
    { key: ".", label: "." },
    { key: "/", label: "/" },
    { key: "ShiftRight", label: "Shift", width: 2.3 }
  ],
  [
    { key: "Control", label: "Ctrl", width: 1.5 },
    { key: "Alt", label: "Alt", width: 1.3 },
    { key: " ", label: "Space", width: 7.8 },
    { key: "AltRight", label: "Alt", width: 1.3 },
    { key: "ControlRight", label: "Ctrl", width: 1.5 }
  ]
];

const KEYBOARD_FINGERS = new Map<string, FingerName>([
  ...["q", "a", "z", "1"].map((key) => [key, "Left Pinky"] as const),
  ...["w", "s", "x", "2"].map((key) => [key, "Left Ring"] as const),
  ...["e", "d", "c", "3"].map((key) => [key, "Left Middle"] as const),
  ...["r", "t", "f", "g", "v", "b", "4", "5"].map((key) => [key, "Left Index"] as const),
  [" ", "Thumbs"],
  ...["y", "u", "h", "j", "n", "m", "6", "7"].map((key) => [key, "Right Index"] as const),
  ...["i", "k", ",", "8"].map((key) => [key, "Right Middle"] as const),
  ...["o", "l", ".", "9"].map((key) => [key, "Right Ring"] as const),
  ...["p", ";", "'", "/", "0", "-","="].map((key) => [key, "Right Pinky"] as const)
]);

const KEY_COORDINATES = new Map<string, { row: number; column: number }>();
[
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"]
].forEach((row, rowIndex) => {
  row.forEach((key, column) => {
    KEY_COORDINATES.set(key, { row: rowIndex, column: column + rowIndex * 0.5 });
  });
});

function normaliseKey(key: string) {
  return key.length === 1 && key !== " " ? key.toLocaleLowerCase() : key;
}

function isAttemptedExpectedCharacter(character: TypingAttemptCharacterDetail) {
  return character.status === "correct" || character.status === "wrong";
}

function mistakeToken(key: string) {
  return key === " " ? "space" : key;
}

function mistakeTypeRank(type: CommonMistakeType) {
  return type === "substitution" ? 0 : type === "missed" ? 1 : 2;
}

function roundPercentage(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 100;
  }

  return Math.round((numerator / denominator) * 10000) / 100;
}

function areAdjacentKeys(expected: string, actual: string) {
  const expectedCoordinate = KEY_COORDINATES.get(normaliseKey(expected));
  const actualCoordinate = KEY_COORDINATES.get(normaliseKey(actual));

  if (!expectedCoordinate || !actualCoordinate) {
    return false;
  }

  const rowDistance = Math.abs(expectedCoordinate.row - actualCoordinate.row);
  const columnDistance = Math.abs(expectedCoordinate.column - actualCoordinate.column);

  return rowDistance <= 1 && columnDistance <= 1.5 && (rowDistance > 0 || columnDistance > 0);
}

function getHandForFinger(finger: FingerName) {
  if (finger === "Thumbs") {
    return "thumbs";
  }

  return finger.startsWith("Left") ? "left" : "right";
}

function isSpacingKey(key: string) {
  return key === " " || key === "\n" || key === "\t";
}

function isPunctuationKey(key: string) {
  return /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/.test(key);
}

function isLetterKey(key: string) {
  return /^[a-z]$/i.test(key);
}

function averageRounded(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function averageOneDecimal(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return roundOne(values.reduce((total, value) => total + value, 0) / values.length);
}

function averageTwoDecimal(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return roundTwo(values.reduce((total, value) => total + value, 0) / values.length);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function roundTwo(value: number) {
  return Math.round(value * 100) / 100;
}
