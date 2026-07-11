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
      characters: expect.any(Array),
      timeline: expect.any(Array)
    }));
  });

  it("loads and maps cloud details for the current user", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{
        id: "attempt-1", user_id: "user-1", completed_at: "2026-07-11T00:00:00.000Z",
        duration_seconds: 60, category: "Business email", wpm: "72", accuracy: "98.5",
        characters: [{ expected: "a", actual: "a", index: 0, status: "correct" }], timeline: []
      }],
      error: null
    });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    await expect(getSupabaseTypingAttemptDetails("user-1", 50, { from })).resolves.toEqual([
      expect.objectContaining({ id: "attempt-1", userId: "user-1", wpm: 72, accuracy: 98.5 })
    ]);
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("uploads local fallback details in one bounded batch", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upsert }));

    await syncLocalTypingAttemptDetails([makeDetail(), { ...makeDetail(), id: "attempt-2" }], { from });

    expect(upsert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: "attempt-1", user_id: "user-1" }),
      expect.objectContaining({ id: "attempt-2", user_id: "user-1" })
    ]));
  });
});

function makeDetail(): TypingAttemptDetail {
  return {
    id: "attempt-1",
    userId: "user-1",
    completedAt: "2026-07-11T00:00:00.000Z",
    durationSeconds: 60,
    category: "Business email",
    wpm: 72,
    accuracy: 98.5,
    characters: [{ expected: "a", actual: "a", index: 0, status: "correct", delayMs: 120 }],
    timeline: [{ timeSeconds: 1, wpm: 72 }]
  };
}
