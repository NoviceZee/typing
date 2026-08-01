import { describe, expect, it, vi } from "vitest";
import {
  getSupabaseTypingAttemptDetails,
  saveSupabaseTypingAttemptDetail,
  syncLocalTypingAttemptDetails
} from "./typingAttemptStorage";
import type { TypingAttemptDetail } from "./typingStatistics";

describe("typingAttemptStorage", () => {
  it("saves private attempt detail with its typing result id", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upsert }));

    await saveSupabaseTypingAttemptDetail(makeDetail(), "result-1", { from });

    expect(from).toHaveBeenCalledWith("typing_attempt_details");
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: "attempt-1",
      user_id: "user-1",
      typing_result_id: "result-1",
      mode_duration_seconds: 60,
      elapsed_seconds: 23,
      characters: expect.any(Array),
      timeline: expect.any(Array)
    }));
  });

  it("loads and maps cloud details for the current user", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "attempt-1", user_id: "user-1", completed_at: "2026-07-11T00:00:00.000Z",
          duration_seconds: 60, category: "Business email", wpm: "72", accuracy: "98.5",
          characters: [{ expected: "a", actual: "a", index: 0, status: "correct" }], timeline: []
        },
        {
          id: "invalid-random", user_id: "user-1", completed_at: "2026-07-11T00:01:00.000Z",
          duration_seconds: 60, category: "Business email", wpm: "200", accuracy: "5",
          characters: [{ expected: "a", actual: "z", index: 0, status: "wrong" }], timeline: []
        }
      ],
      error: null
    });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    await expect(getSupabaseTypingAttemptDetails("user-1", 50, { from })).resolves.toEqual([
      expect.objectContaining({
        id: "attempt-1",
        userId: "user-1",
        modeDurationSeconds: 60,
        elapsedSeconds: 60,
        wpm: 72,
        accuracy: 98.5
      })
    ]);
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("uploads local fallback details in one bounded batch", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upsert }));

    await syncLocalTypingAttemptDetails([
      makeDetail(),
      { ...makeDetail(), id: "attempt-2" },
      { ...makeDetail(), id: "invalid-random", wpm: 200, accuracy: 5 }
    ], { from });

    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "attempt-1", user_id: "user-1" }),
        expect.objectContaining({ id: "attempt-2", user_id: "user-1" })
      ]),
      { onConflict: "id", ignoreDuplicates: true }
    );
    expect(upsert.mock.calls[0][0]).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: "invalid-random" })]));
  });
});

function makeDetail(): TypingAttemptDetail {
  return {
    id: "attempt-1",
    userId: "user-1",
    completedAt: "2026-07-11T00:00:00.000Z",
    modeDurationSeconds: 60,
    elapsedSeconds: 23,
    category: "Business email",
    wpm: 72,
    accuracy: 98.5,
    characters: [{ expected: "a", actual: "a", index: 0, status: "correct", delayMs: 120 }],
    timeline: [{ timeSeconds: 1, wpm: 72 }]
  };
}
