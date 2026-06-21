/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LeaderboardPage from "../pages/leaderboard";
import { getSupabaseLeaderboardResults } from "@/lib/typingResultStorage";

const mockState = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  isLoading: false
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: mockState.user,
    isLoading: mockState.isLoading
  })
}));

vi.mock("@/lib/typingResultStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/typingResultStorage")>("@/lib/typingResultStorage");

  return {
    ...actual,
    getSupabaseLeaderboardCategories: vi.fn().mockResolvedValue([]),
    getSupabaseOwnTypingResultIds: vi.fn().mockResolvedValue(new Set()),
    getSupabaseLeaderboardResults: vi.fn().mockResolvedValue([
      {
        id: "result-1",
        display_name: "@formal_typist",
        passage_title: "Board memo",
        passage_category: "Business email",
        duration_seconds: 60,
        wpm: 72,
        accuracy: 98.2,
        created_at: "2026-06-21T00:00:00.000Z"
      }
    ])
  };
});

const mockedGetSupabaseLeaderboardResults = vi.mocked(getSupabaseLeaderboardResults);

describe("LeaderboardPage", () => {
  beforeEach(() => {
    mockState.user = null;
    mockState.isLoading = false;
    mockedGetSupabaseLeaderboardResults.mockClear();
  });

  it("renders public handles and never exposes email", async () => {
    render(<LeaderboardPage />);

    await waitFor(() => {
      expect(screen.getByText("@formal_typist")).toBeTruthy();
    });
    expect(screen.queryByText("typist@example.com")).toBeNull();
  });

  it("defaults to this week and reloads when the time range changes", async () => {
    mockedGetSupabaseLeaderboardResults
      .mockResolvedValueOnce([
        {
          id: "result-1",
          display_name: "@formal_typist",
          passage_title: "Board memo",
          passage_category: "Business email",
          duration_seconds: 60,
          wpm: 72,
          accuracy: 98.2,
          created_at: "2026-06-21T00:00:00.000Z"
        }
      ] as any)
      .mockResolvedValueOnce([]);

    render(<LeaderboardPage />);

    await waitFor(() => {
      expect(mockedGetSupabaseLeaderboardResults).toHaveBeenCalledWith(
        expect.objectContaining({ timeRange: "this_week" })
      );
    });

    fireEvent.change(screen.getByLabelText("Time range"), { target: { value: "this_month" } });

    await waitFor(() => {
      expect(mockedGetSupabaseLeaderboardResults).toHaveBeenLastCalledWith(
        expect.objectContaining({ timeRange: "this_month" })
      );
    });
    await waitFor(() => {
      expect(screen.getByText("No saved typing results match this time range.")).toBeTruthy();
    });
  });
});
