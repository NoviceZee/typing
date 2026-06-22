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
    getSupabaseLeaderboardCategories: vi.fn().mockResolvedValue(["Business email"]),
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
    mockedGetSupabaseLeaderboardResults.mockResolvedValue([
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
    ] as any);
  });

  it("renders public handles and never exposes email", async () => {
    render(<LeaderboardPage />);

    await waitFor(() => {
      expect(screen.getByText("@formal_typist")).toBeTruthy();
    });
    expect(screen.queryByText("typist@example.com")).toBeNull();
  });

  it("links public handles to public profile pages", async () => {
    render(<LeaderboardPage />);

    const profileLink = await screen.findByRole("link", { name: "@formal_typist" });

    expect(profileLink.getAttribute("href")).toBe("/u/formal_typist");
  });

  it("defaults to today with the daily heading", async () => {
    render(<LeaderboardPage />);

    expect(screen.getByRole("heading", { name: "Daily Leaderboard" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Today" }).getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => {
      expect(mockedGetSupabaseLeaderboardResults).toHaveBeenCalledWith(
        expect.objectContaining({ timeRange: "today" })
      );
    });
  });

  it("updates the heading and query range from segmented range buttons", async () => {
    mockedGetSupabaseLeaderboardResults.mockResolvedValue([]);

    render(<LeaderboardPage />);

    const cases = [
      ["Yesterday", "Yesterday Leaderboard", "yesterday"],
      ["Week", "Weekly Leaderboard", "this_week"],
      ["Month", "Monthly Leaderboard", "this_month"],
      ["Year", "Yearly Leaderboard", "this_year"],
      ["All-time", "All-time Leaderboard", "all_time"],
      ["Today", "Daily Leaderboard", "today"]
    ] as const;

    for (const [buttonLabel, heading, timeRange] of cases) {
      fireEvent.click(screen.getByRole("button", { name: buttonLabel }));

      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
      await waitFor(() => {
        expect(mockedGetSupabaseLeaderboardResults).toHaveBeenLastCalledWith(
          expect.objectContaining({ timeRange })
        );
      });
    }

    expect(screen.getByText("No saved typing results match this time range.")).toBeTruthy();
    expect(screen.queryByText("typist@example.com")).toBeNull();
  });

  it("keeps duration and category filters with the selected time range", async () => {
    render(<LeaderboardPage />);

    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    fireEvent.change(screen.getByLabelText("Duration"), { target: { value: "300" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "All" } });

    await waitFor(() => {
      expect(mockedGetSupabaseLeaderboardResults).toHaveBeenLastCalledWith(
        expect.objectContaining({
          timeRange: "this_month",
          durationSeconds: 300,
          category: null
        })
      );
    });
  });

  it("keeps category filters with the selected time range", async () => {
    render(<LeaderboardPage />);

    fireEvent.click(screen.getByRole("button", { name: "Year" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Category")).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Business email" } });

    await waitFor(() => {
      expect(mockedGetSupabaseLeaderboardResults).toHaveBeenLastCalledWith(
        expect.objectContaining({
          timeRange: "this_year",
          category: "Business email"
        })
      );
    });
  });
});
