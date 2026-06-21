import { describe, expect, it, vi } from "vitest";
import {
  getSupabaseAnalyticsTypingResults,
  getSupabaseLeaderboardResults,
  toSupabaseTypingResultInsert
} from "./typingResultStorage";
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

  it("loads analytics results with passage categories for the current user", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "result-1",
          passage_title: "Board memo",
          duration_seconds: 60,
          wpm: 72,
          accuracy: 98.5,
          created_at: "2026-06-19T00:00:00.000Z",
          passages: { category: "Business email" }
        },
        {
          id: "result-2",
          passage_title: "Legacy memo",
          duration_seconds: 300,
          wpm: 61,
          accuracy: 99,
          created_at: "2026-06-18T00:00:00.000Z",
          passages: null
        }
      ],
      error: null
    });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    await expect(getSupabaseAnalyticsTypingResults("user-1", 50, { from })).resolves.toEqual([
      {
        id: "result-1",
        passage_title: "Board memo",
        passage_category: "Business email",
        duration_seconds: 60,
        wpm: 72,
        accuracy: 98.5,
        created_at: "2026-06-19T00:00:00.000Z"
      },
      {
        id: "result-2",
        passage_title: "Legacy memo",
        passage_category: null,
        duration_seconds: 300,
        wpm: 61,
        accuracy: 99,
        created_at: "2026-06-18T00:00:00.000Z"
      }
    ]);
    expect(from).toHaveBeenCalledWith("typing_results");
    expect(select).toHaveBeenCalledWith(
      "id,passage_title,duration_seconds,wpm,accuracy,created_at,passages(category)"
    );
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(limit).toHaveBeenCalledWith(50);
  });

  it("applies leaderboard date range filters to created_at", async () => {
    const query: any = {};
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const lt = vi.fn(() => query);
    const gte = vi.fn(() => query);
    const eq = vi.fn(() => query);
    const order = vi.fn(() => query);
    Object.assign(query, { order, limit, eq, gte, lt });
    const select = vi.fn(() => query);
    const from = vi.fn(() => ({ select }));
    const start = new Date("2026-06-21T00:00:00.000Z");
    const end = new Date("2026-06-22T00:00:00.000Z");

    await expect(
      getSupabaseLeaderboardResults(
        {
          durationSeconds: 60,
          category: "Business email",
          dateRange: { start, end }
        },
        { from } as any
      )
    ).resolves.toEqual([]);

    expect(from).toHaveBeenCalledWith("typing_results_leaderboard");
    expect(eq).toHaveBeenCalledWith("duration_seconds", 60);
    expect(eq).toHaveBeenCalledWith("passage_category", "Business email");
    expect(gte).toHaveBeenCalledWith("created_at", start.toISOString());
    expect(lt).toHaveBeenCalledWith("created_at", end.toISOString());
    expect(limit).toHaveBeenCalledWith(25);
  });
});
