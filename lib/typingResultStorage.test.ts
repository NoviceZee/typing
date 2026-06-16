import { describe, expect, it } from "vitest";
import { toSupabaseTypingResultInsert } from "./typingResultStorage";
import type { StoredPassage } from "./app-storage";
import type { TypingResult } from "./typing-engine";

describe("typingResultStorage", () => {
  it("builds a Supabase insert payload and omits non-uuid passage ids", () => {
    const passage: StoredPassage = {
      id: "default-generated",
      title: "Generated business email practice",
      category: "Business email",
      style: "Formal",
      text: "Sample passage text.",
      source: "generated",
      updatedAt: "2026-06-14T00:00:00.000Z"
    };
    const result: TypingResult = {
      characters: [],
      characterStatuses: [],
      correctCharacters: 120,
      incorrectCharacters: 3,
      missedCharacters: 1,
      extraCharacters: 2,
      totalCharacters: 140,
      comparableTargetLength: 140,
      comparableTypedLength: 123,
      accuracy: 97.6,
      wpm: 48,
      rawWpm: 49.2,
      timeUsedSeconds: 30,
      durationSeconds: 60,
      category: "Business email",
      presetName: "Custom rules",
      completionReason: "text_completed",
      completedAt: "2026-06-14T00:01:00.000Z",
      isRankable: true
    };

    expect(
      toSupabaseTypingResultInsert({
        userId: "6dc3f88f-d1c1-4d99-921d-6c388ef8d9b3",
        passage,
        result,
        typedCharacters: 123
      })
    ).toEqual({
      user_id: "6dc3f88f-d1c1-4d99-921d-6c388ef8d9b3",
      passage_id: null,
      passage_title: "Generated business email practice",
      duration_seconds: 60,
      wpm: 48,
      accuracy: 97.6,
      correct_chars: 120,
      typed_chars: 123
    });
  });

  it("stores ten-minute result durations as 600 seconds", () => {
    const passage: StoredPassage = {
      id: "default-generated",
      title: "Generated IELTS practice",
      category: "Business email",
      style: "Formal",
      text: "Sample passage text.",
      source: "generated",
      updatedAt: "2026-06-14T00:00:00.000Z"
    };
    const result: TypingResult = {
      characters: [],
      characterStatuses: [],
      correctCharacters: 400,
      incorrectCharacters: 5,
      missedCharacters: 0,
      extraCharacters: 0,
      totalCharacters: 420,
      comparableTargetLength: 420,
      comparableTypedLength: 405,
      accuracy: 98.8,
      wpm: 42,
      rawWpm: 43,
      timeUsedSeconds: 600,
      durationSeconds: 600,
      category: "Business email",
      presetName: "Custom rules",
      completionReason: "time_up",
      completedAt: "2026-06-14T00:10:00.000Z",
      isRankable: true
    };

    const insert = toSupabaseTypingResultInsert({
      userId: "6dc3f88f-d1c1-4d99-921d-6c388ef8d9b3",
      passage,
      result,
      typedCharacters: 405
    });

    expect(insert.duration_seconds).toBe(600);
  });
});
