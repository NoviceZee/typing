/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LeaderboardPage, { formatLeaderboardDuration } from "../pages/leaderboard";
import { getSupabaseLeaderboardResults } from "@/lib/typingResultStorage";

const mockState = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  isLoading: false,
  ownResultIds: new Set<string>()
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
    getSupabaseOwnTypingResultIds: vi.fn().mockImplementation(() => Promise.resolve(mockState.ownResultIds)),
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
    mockState.ownResultIds = new Set();
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

  it("formats short and exact-minute durations without rounding them into the wrong bucket", () => {
    expect(formatLeaderboardDuration(15)).toBe("15 sec");
    expect(formatLeaderboardDuration(30)).toBe("30 sec");
    expect(formatLeaderboardDuration(60)).toBe("1 min");
    expect(formatLeaderboardDuration(90)).toBe("1:30");
    expect(formatLeaderboardDuration(59.6)).toBe("1 min");
    expect(formatLeaderboardDuration(119.8)).toBe("2 min");
    expect(formatLeaderboardDuration(0)).toBe("—");
  });

  it("renders public handles and never exposes email", async () => {
    render(<LeaderboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText("@formal_typist")).toHaveLength(2);
    });
    expect(screen.queryByText("typist@example.com")).toBeNull();
  });

  it("links public handles to public profile pages", async () => {
    render(<LeaderboardPage />);

    const profileLinks = await screen.findAllByRole("link", { name: "@formal_typist" });

    expect(profileLinks).toHaveLength(2);
    expect(profileLinks.every((link) => link.getAttribute("href") === "/u/formal_typist")).toBe(true);
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

  it("exposes named filter groups with selected-state and focus contracts", async () => {
    render(<LeaderboardPage />);

    const groups = [
      "Leaderboard domain",
      "Leaderboard time range",
      "Leaderboard duration",
      "Leaderboard category"
    ];

    for (const name of groups) {
      expect(await screen.findByRole("group", { name })).toBeTruthy();
    }

    const today = screen.getByRole("button", { name: "Today" });
    today.focus();
    expect(document.activeElement).toBe(today);
    expect(today.getAttribute("aria-pressed")).toBe("true");
    expect(today.getAttribute("data-selected-indicator")).toBe("underline");
    expect(today.getAttribute("data-focus-ring")).toBe("standard");
  });

  it("updates the heading and query range from segmented range buttons", async () => {
    mockedGetSupabaseLeaderboardResults.mockResolvedValue([]);

    render(<LeaderboardPage />);

    const cases = [
      ["Yesterday", "Yesterday Leaderboard", "yesterday"],
      ["Week", "Weekly Leaderboard", "this_week"],
      ["Month", "Monthly Leaderboard", "this_month"],
      ["Year", "Yearly Leaderboard", "this_year"],
      ["All Time", "All Time Leaderboard", "all_time"],
      ["Today", "Daily Leaderboard", "today"]
    ] as const;

    for (const [buttonLabel, heading, timeRange] of cases) {
      fireEvent.click(screen.getByRole("button", { name: buttonLabel }));

      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
      expect(screen.getByRole("button", { name: buttonLabel }).getAttribute("aria-pressed")).toBe("true");
      await waitFor(() => {
        expect(mockedGetSupabaseLeaderboardResults).toHaveBeenLastCalledWith(
          expect.objectContaining({ timeRange })
        );
      });
    }

    expect(screen.getByText("No saved typing results match this time range.")).toBeTruthy();
    expect(screen.queryByText("typist@example.com")).toBeNull();
  });

  it("announces loading, error, and empty states with the correct semantics", async () => {
    mockedGetSupabaseLeaderboardResults.mockImplementationOnce(() => new Promise(() => undefined));
    const loadingView = render(<LeaderboardPage />);
    expect(screen.getByRole("status", { name: "Loading leaderboard" })).toBeTruthy();
    loadingView.unmount();

    mockedGetSupabaseLeaderboardResults.mockRejectedValueOnce(new Error("Leaderboard could not be loaded."));
    const errorView = render(<LeaderboardPage />);
    expect((await screen.findByRole("alert")).textContent).toContain("Leaderboard could not be loaded.");
    expect(screen.queryByRole("region", { name: "Ranked results" })).toBeNull();
    errorView.unmount();

    mockedGetSupabaseLeaderboardResults.mockResolvedValueOnce([]);
    render(<LeaderboardPage />);
    expect((await screen.findByRole("status", { name: "No leaderboard results" })).textContent).toContain(
      "No saved typing results match this time range."
    );
  });

  it("renders a mobile stacked list and a desktop table without fixed mobile width", async () => {
    render(<LeaderboardPage />);

    const mobileResults = await screen.findByRole("list", { name: "Leaderboard results" });
    const desktopResults = screen.getByRole("table", { name: "Leaderboard results table" });

    expect(within(mobileResults).getByRole("listitem")).toBeTruthy();
    expect(within(desktopResults).getByRole("columnheader", { name: "Rank" })).toBeTruthy();
    expect(mobileResults.getAttribute("data-responsive-layout")).toBe("stacked");
    expect(mobileResults.querySelector('[style*="min-width"]')).toBeNull();
  });

  it("keeps an authenticated user's row visibly identified with the You cue", async () => {
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockState.ownResultIds = new Set(["result-1"]);

    render(<LeaderboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText("You").length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getAllByText("You").every((cue) => cue.getAttribute("data-own-row-cue") === "true")).toBe(true);
  });

  it("uses direct text choices for duration and category filters", async () => {
    const { container } = render(<LeaderboardPage />);

    expect(container.querySelector("select")).toBeNull();
    expect(screen.getByRole("group", { name: "Leaderboard duration" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Leaderboard category" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "1m" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "5m" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "10m" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "All" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    fireEvent.click(screen.getByRole("button", { name: "5m" }));
    fireEvent.click(screen.getByRole("button", { name: "All category" }));

    await waitFor(() => {
      expect(mockedGetSupabaseLeaderboardResults).toHaveBeenLastCalledWith(
        expect.objectContaining({
          timeRange: "this_month",
          modeDurationSeconds: 300,
          category: null
        })
      );
    });
  });

  it("keeps category filters with the selected time range", async () => {
    render(<LeaderboardPage />);

    fireEvent.click(screen.getByRole("button", { name: "Year" }));
    await waitFor(() => {
      expect(screen.getByRole("group", { name: "Leaderboard category" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Business email category" }));

    await waitFor(() => {
      expect(mockedGetSupabaseLeaderboardResults).toHaveBeenLastCalledWith(
        expect.objectContaining({
          timeRange: "this_year",
          category: "Business email"
        })
      );
    });
  });

  it("queries separate leaderboard domains from the domain selector", async () => {
    render(<LeaderboardPage />);

    await waitFor(() => {
      expect(mockedGetSupabaseLeaderboardResults).toHaveBeenCalledWith(
        expect.objectContaining({ domain: "english" })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Chinese" }));

    await waitFor(() => {
      expect(mockedGetSupabaseLeaderboardResults).toHaveBeenLastCalledWith(
        expect.objectContaining({
          domain: "chinese",
          modeDurationSeconds: 60,
          category: null
        })
      );
    });
    expect(screen.queryByLabelText("Category")).toBeNull();
    expect(screen.getByRole("button", { name: "15" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "30" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "60" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "120" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Code" }));

    await waitFor(() => {
      expect(mockedGetSupabaseLeaderboardResults).toHaveBeenLastCalledWith(
        expect.objectContaining({
          domain: "code",
          modeDurationSeconds: 60,
          category: null
        })
      );
    });
  });
});
