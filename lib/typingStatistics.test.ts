import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TYPING_ATTEMPT_DETAILS_STORAGE_KEY,
  aggregateTypingStatistics,
  appendTypingAttemptDetail,
  buildTypingReplayEvents,
  classifyDetailedMistake,
  buildTypingAttemptDetail,
  getFingerForKey,
  getFullKeyboardLayout,
  readTypingAttemptDetails,
  rankWeakKeys,
  rankCommonMistakes
} from "./typingStatistics";
import type { TypingResult } from "./typing-engine";

describe("typingStatistics", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key)
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("aggregates per-key hit counts, accuracy, mistakes, and average delay", () => {
    const detail = buildTypingAttemptDetail({
      userId: "user-1",
      result: makeResult([
        { expected: "a", actual: "a", status: "correct", index: 0 },
        { expected: "s", actual: "a", status: "wrong", index: 1 },
        { expected: "s", actual: "s", status: "correct", index: 2 },
        { expected: " ", actual: "", status: "wrong", index: 3 }
      ]),
      typedCharacterDelaysMs: [120, 180, 240]
    });

    const stats = aggregateTypingStatistics([detail], { minWeakKeyHits: 1 });

    expect(stats.keys.find((key) => key.key === "a")).toEqual({
      key: "a",
      hitCount: 1,
      correctCount: 1,
      mistakeCount: 0,
      accuracy: 100,
      averageDelayMs: 120
    });
    expect(stats.keys.find((key) => key.key === "s")).toEqual({
      key: "s",
      hitCount: 2,
      correctCount: 1,
      mistakeCount: 1,
      accuracy: 50,
      averageDelayMs: 210
    });
    expect(stats.keys.find((key) => key.key === " ")).toMatchObject({
      key: " ",
      hitCount: 1,
      mistakeCount: 1,
      accuracy: 0
    });
  });

  it("ranks weak keys by low accuracy first, then high mistake count", () => {
    const weakKeys = rankWeakKeys(
      [
        makeKey("a", 10, 7, 3),
        makeKey("s", 10, 7, 3),
        makeKey("d", 12, 10, 2),
        makeKey("f", 10, 9, 1)
      ],
      { minHits: 1 }
    );

    expect(weakKeys.map((key) => key.key)).toEqual(["a", "s", "d", "f"]);
  });

  it("aggregates common substitution, missed, and extra mistake patterns", () => {
    const mistakes = rankCommonMistakes([
      makeDetail([
        { expected: "e", actual: "r", status: "wrong", index: 0 },
        { expected: "e", actual: "r", status: "wrong", index: 1 },
        { expected: " ", actual: "", status: "wrong", index: 2 },
        { expected: "", actual: "x", status: "extra", index: 3 }
      ])
    ]);

    expect(mistakes).toEqual([
      { id: "substitution:e:r", type: "substitution", expected: "e", actual: "r", count: 2 },
      { id: "missed:space", type: "missed", expected: " ", actual: "", count: 1 },
      { id: "extra:x", type: "extra", expected: "", actual: "x", count: 1 }
    ]);
  });

  it("excludes Chinese attempts from default English weak-key statistics", () => {
    const chineseDetail = buildTypingAttemptDetail({
      userId: "user-1",
      result: makeResult(
        [
          { expected: "答", actual: "竹", status: "wrong", index: 0 },
          { expected: "案", actual: "心", status: "wrong", index: 1 }
        ],
        "training_chinese"
      ),
      typedCharacterDelaysMs: [100, 120]
    });

    const stats = aggregateTypingStatistics([chineseDetail], { minWeakKeyHits: 1 });

    expect(stats.keys).toHaveLength(0);
    expect(stats.weakKeys).toHaveLength(0);
    expect(stats.commonMistakes).toHaveLength(0);
  });

  it("keeps Chinese common mistakes in the Chinese-only statistics domain without weak keys", () => {
    const chineseDetail = buildTypingAttemptDetail({
      userId: "user-1",
      result: makeResult(
        [
          { expected: "答", actual: "竹", status: "wrong", index: 0 },
          { expected: "案", actual: "心", status: "wrong", index: 1 }
        ],
        "training_chinese"
      ),
      typedCharacterDelaysMs: [100, 120]
    });

    const stats = aggregateTypingStatistics([chineseDetail], { minWeakKeyHits: 1, domain: "chinese" });

    expect(stats.keys).toHaveLength(0);
    expect(stats.weakKeys).toHaveLength(0);
    expect(stats.commonMistakes).toEqual([
      { id: "substitution:案:心", type: "substitution", expected: "案", actual: "心", count: 1 },
      { id: "substitution:答:竹", type: "substitution", expected: "答", actual: "竹", count: 1 }
    ]);
  });

  it("filters low-sample keys out of weak-key ranking", () => {
    const weakKeys = rankWeakKeys([makeKey("x", 2, 0, 2), makeKey("j", 5, 3, 2)], { minHits: 5 });

    expect(weakKeys.map((key) => key.key)).toEqual(["j"]);
  });

  it("does not count untyped future characters as weak-key misses", () => {
    const stats = aggregateTypingStatistics(
      [
        buildTypingAttemptDetail({
          userId: "user-1",
          result: makeResult([
            { expected: "e", actual: "e", status: "correct", index: 0 },
            { expected: "e", actual: "", status: "untyped", index: 1 },
            { expected: "e", actual: "", status: "untyped", index: 2 }
          ]),
          typedCharacterDelaysMs: [100]
        })
      ],
      { minWeakKeyHits: 1 }
    );

    expect(stats.keys.find((key) => key.key === "e")).toMatchObject({
      hitCount: 1,
      correctCount: 1,
      mistakeCount: 0,
      accuracy: 100
    });
    expect(stats.weakKeys).toHaveLength(0);
  });

  it("excludes zero-mistake keys and uses a default 20-hit weak-key threshold", () => {
    const weakKeys = rankWeakKeys([
      makeKey("e", 30, 30, 0),
      makeKey("o", 19, 10, 9),
      makeKey("i", 20, 18, 2)
    ]);

    expect(weakKeys.map((key) => key.key)).toEqual(["i"]);
  });

  it("exposes a full QWERTY keyboard layout for heatmaps and replay", () => {
    const layout = getFullKeyboardLayout();
    const labels = layout.flatMap((row) => row.map((key) => key.label));

    expect(labels).toEqual(expect.arrayContaining(["`", "1", "0", "Backspace", "Tab", "Q", "[", "\\", "Caps Lock", "Enter", "Shift", "/", "Space"]));
  });

  it("maps keys to fingers and aggregates accuracy, speed, and hits by finger", () => {
    const stats = aggregateTypingStatistics(
      [
        buildTypingAttemptDetail({
          userId: "user-1",
          result: makeResult([
            { expected: "q", actual: "q", status: "correct", index: 0 },
            { expected: "q", actual: "w", status: "wrong", index: 1 },
            { expected: "l", actual: "l", status: "correct", index: 2 }
          ]),
          typedCharacterDelaysMs: [100, 300, 200]
        })
      ],
      { minWeakKeyHits: 1 }
    );

    expect(getFingerForKey("q")).toBe("Left Pinky");
    expect(stats.fingers.find((finger) => finger.finger === "Left Pinky")).toEqual({
      finger: "Left Pinky",
      hitCount: 2,
      correctCount: 1,
      mistakeCount: 1,
      accuracy: 50,
      averageDelayMs: 200
    });
    expect(stats.fingers.find((finger) => finger.finger === "Right Ring")).toMatchObject({
      hitCount: 1,
      accuracy: 100,
      averageDelayMs: 200
    });
  });

  it("calculates reaction-time averages for all, correct, and wrong keystrokes", () => {
    const stats = aggregateTypingStatistics([
      buildTypingAttemptDetail({
        userId: "user-1",
        result: makeResult([
          { expected: "a", actual: "a", status: "correct", index: 0 },
          { expected: "s", actual: "d", status: "wrong", index: 1 },
          { expected: "", actual: "x", status: "extra", index: 2 },
          { expected: " ", actual: "", status: "wrong", index: 3 }
        ]),
        typedCharacterDelaysMs: [40, 100, 160]
      })
    ]);

    expect(stats.reactionTime).toEqual({
      averageKeystrokeMs: 100,
      correctKeystrokeMs: 40,
      wrongKeystrokeMs: 130
    });
  });

  it("calculates personal-best burst WPM from keystroke timings", () => {
    const stats = aggregateTypingStatistics([
      buildTypingAttemptDetail({
        userId: "user-1",
        result: makeResult(
          Array.from({ length: 25 }, (_, index) => ({
            expected: "a",
            actual: "a",
            status: "correct" as const,
            index
          }))
        ),
        typedCharacterDelaysMs: Array.from({ length: 25 }, () => 100)
      })
    ]);

    expect(stats.burstSpeed).toEqual({
      peak3SecondWpm: 100,
      peak5SecondWpm: 60,
      peak10SecondWpm: 30
    });
  });

  it("calculates average speed drop from attempt timeline thirds", () => {
    const stats = aggregateTypingStatistics([
      buildTypingAttemptDetail({
        userId: "user-1",
        result: makeResult([{ expected: "a", actual: "a", status: "correct", index: 0 }]),
        typedCharacterDelaysMs: [100],
        timeline: [
          { timeSeconds: 10, wpm: 104 },
          { timeSeconds: 20, wpm: 100 },
          { timeSeconds: 30, wpm: 99 },
          { timeSeconds: 40, wpm: 96 },
          { timeSeconds: 50, wpm: 90 },
          { timeSeconds: 60, wpm: 88 }
        ]
      })
    ]);

    expect(stats.speedDrop).toEqual({
      startWpm: 102,
      middleWpm: 97.5,
      endWpm: 89,
      averageSlowdownPercent: 12.75
    });
  });

  it("classifies adjacent-key mistakes separately", () => {
    expect(classifyDetailedMistake({ expected: "e", actual: "r", status: "wrong", index: 0 })).toBe("Adjacent key");
    expect(classifyDetailedMistake({ expected: "a", actual: "l", status: "wrong", index: 0 })).toBe("Wrong hand");
    expect(classifyDetailedMistake({ expected: "A", actual: "a", status: "wrong", index: 0 })).toBe("Missed Shift");
    expect(classifyDetailedMistake({ expected: ".", actual: ",", status: "wrong", index: 0 })).toBe("Punctuation");
  });

  it("builds replay events in timing order and can filter to mistakes", () => {
    const detail = buildTypingAttemptDetail({
      userId: "user-1",
      result: makeResult([
        { expected: "a", actual: "a", status: "correct", index: 0 },
        { expected: "s", actual: "d", status: "wrong", index: 1 },
        { expected: "", actual: "x", status: "extra", index: 2 },
        { expected: " ", actual: "", status: "wrong", index: 3 }
      ]),
      typedCharacterDelaysMs: [100, 250, 400]
    });

    expect(buildTypingReplayEvents(detail)).toEqual([
      expect.objectContaining({ key: "a", expected: "a", actual: "a", timeMs: 100, isMistake: false }),
      expect.objectContaining({ key: "d", expected: "s", actual: "d", timeMs: 350, isMistake: true }),
      expect.objectContaining({ key: "x", expected: "", actual: "x", timeMs: 750, isMistake: true }),
      expect.objectContaining({ key: " ", expected: " ", actual: "", timeMs: 750, isMistake: true })
    ]);
    expect(buildTypingReplayEvents(detail, { onlyMistakes: true }).map((event) => event.key)).toEqual(["d", "x", " "]);
  });

  it("bounds stored fallback attempt details, characters, and timelines", () => {
    const detail = buildTypingAttemptDetail({
      userId: "user-1",
      result: {
        ...makeResult(
          Array.from({ length: 2_000 }, (_, index) => ({
            expected: "a",
            actual: "a",
            status: "correct" as const,
            index
          }))
        ),
        completedAt: "2026-06-21T00:00:00.000Z"
      },
      typedCharacterDelaysMs: Array.from({ length: 2_000 }, () => 20),
      timeline: Array.from({ length: 300 }, (_, index) => ({ timeSeconds: index, wpm: 50 }))
    });

    for (let index = 0; index < 75; index += 1) {
      appendTypingAttemptDetail({
        ...detail,
        id: `attempt-${index}`,
        completedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString()
      });
    }

    const stored = JSON.parse(storage.get(TYPING_ATTEMPT_DETAILS_STORAGE_KEY) ?? "[]");
    expect(stored).toHaveLength(50);
    expect(stored.every((attempt: { characters: unknown[] }) => attempt.characters.length <= 1_500)).toBe(true);
    expect(stored.every((attempt: { timeline: unknown[] }) => attempt.timeline.length <= 120)).toBe(true);
    expect(stored.reduce((total: number, attempt: { characters: unknown[] }) => total + attempt.characters.length, 0)).toBeLessThanOrEqual(15_000);
    expect(stored.reduce((total: number, attempt: { timeline: unknown[] }) => total + attempt.timeline.length, 0)).toBeLessThanOrEqual(3_000);
    expect(readTypingAttemptDetails("user-1")).toHaveLength(50);
  });
});

function makeDetail(characters: TypingResult["characters"]) {
  return buildTypingAttemptDetail({
    userId: "user-1",
    result: makeResult(characters),
    typedCharacterDelaysMs: []
  });
}

function makeKey(key: string, hitCount: number, correctCount: number, mistakeCount: number) {
  return {
    key,
    hitCount,
    correctCount,
    mistakeCount,
    accuracy: Math.round((correctCount / hitCount) * 10000) / 100,
    averageDelayMs: null
  };
}

function makeResult(characters: TypingResult["characters"], category: TypingResult["category"] = "Business email"): TypingResult {
  return {
    characters,
    characterStatuses: characters,
    correctCharacters: characters.filter((character) => character.status === "correct" && character.expected).length,
    incorrectCharacters: characters.filter((character) => character.status === "wrong" || character.status === "extra").length,
    missedCharacters: characters.filter((character) => character.status === "wrong" && !character.actual).length,
    extraCharacters: characters.filter((character) => character.status === "extra").length,
    totalCharacters: characters.length,
    comparableTargetLength: characters.length,
    comparableTypedLength: characters.filter((character) => character.actual).length,
    accuracy: 100,
    wpm: 50,
    rawWpm: 52,
    timeUsedSeconds: 60,
    durationSeconds: 60,
    category,
    presetName: "Custom rules",
    completionReason: "manual",
    completedAt: "2026-06-21T00:00:00.000Z",
    isRankable: true
  };
}
