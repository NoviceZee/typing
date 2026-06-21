/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnalyticsPage from "../pages/analytics";
import { getSupabaseAnalyticsTypingResults } from "@/lib/typingResultStorage";

const mockState = vi.hoisted(() => ({
  user: { id: "user-1", email: "typist@example.com" } as { id: string; email: string } | null,
  isLoading: false,
  routerPush: vi.fn()
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

vi.mock("next/router", () => ({
  useRouter: () => ({
    push: mockState.routerPush,
    asPath: "/analytics"
  })
}));

vi.mock("@/lib/typingResultStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/typingResultStorage")>("@/lib/typingResultStorage");

  return {
    ...actual,
    getSupabaseAnalyticsTypingResults: vi.fn().mockResolvedValue([
      makeResult("one-minute", 60, 72, 98.2, "Business email", "2026-06-19T00:02:00.000Z"),
      makeResult("five-minute", 300, 64, 99.1, "Legal / contract style", "2026-06-19T00:01:00.000Z")
    ])
  };
});

const mockedGetSupabaseAnalyticsTypingResults = vi.mocked(getSupabaseAnalyticsTypingResults);

describe("AnalyticsPage", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockState.isLoading = false;
    mockState.routerPush.mockClear();
    mockedGetSupabaseAnalyticsTypingResults.mockClear();
  });

  it("renders progress analytics for an authenticated user", async () => {
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText("Best WPM")).toBeTruthy();
    });

    expect(mockedGetSupabaseAnalyticsTypingResults).toHaveBeenCalledWith("user-1");
    expect(screen.getByText("Average WPM")).toBeTruthy();
    expect(screen.getByText("Best Accuracy")).toBeTruthy();
    expect(screen.getByText("Total Tests")).toBeTruthy();
    expect(screen.getByText("Total Practice Time")).toBeTruthy();
    expect(screen.getByText("WPM Trend")).toBeTruthy();
    expect(screen.getByText("Accuracy Trend")).toBeTruthy();
    expect(screen.getByText("Personal Records")).toBeTruthy();
    expect(screen.getByText("Fastest 1-minute result")).toBeTruthy();
    expect(screen.getByText("Fastest 5-minute result")).toBeTruthy();
    expect(screen.getByText("Highest Accuracy")).toBeTruthy();
    expect(screen.getByText("Category Breakdown")).toBeTruthy();
    expect(screen.getByText("Business email")).toBeTruthy();
    expect(screen.getByText("Legal / contract style")).toBeTruthy();
  });

  it("redirects logged-out users to login without loading results", async () => {
    mockState.user = null;

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(mockState.routerPush).toHaveBeenCalledWith("/login?redirectTo=/analytics");
    });
    expect(mockedGetSupabaseAnalyticsTypingResults).not.toHaveBeenCalled();
  });
});

function makeResult(
  id: string,
  durationSeconds: number,
  wpm: number,
  accuracy: number,
  category: string | null,
  createdAt: string
) {
  return {
    id,
    passage_title: `Passage ${id}`,
    passage_category: category,
    duration_seconds: durationSeconds,
    wpm,
    accuracy,
    created_at: createdAt
  };
}
