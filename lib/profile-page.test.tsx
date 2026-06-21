/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../pages/profile";
import { getSupabaseAnalyticsTypingResults } from "@/lib/typingResultStorage";

const mockState = vi.hoisted(() => ({
  user: { id: "user-1", email: "typist@example.com" } as { id: string; email: string } | null,
  isLoading: false,
  isConfigured: true,
  routerPush: vi.fn()
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: mockState.user,
    isLoading: mockState.isLoading,
    isConfigured: mockState.isConfigured
  })
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    push: mockState.routerPush,
    replace: mockState.routerPush,
    asPath: "/profile"
  })
}));

vi.mock("@/lib/typingResultStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/typingResultStorage")>("@/lib/typingResultStorage");

  return {
    ...actual,
    getSupabaseAnalyticsTypingResults: vi.fn().mockResolvedValue([
      makeResult("latest", 60, 72, 98.2, "Business email", "2026-06-21T00:02:00.000Z"),
      makeResult("five-minute", 300, 64, 99.1, "Legal / contract style", "2026-06-20T00:01:00.000Z"),
      makeResult("weak", 60, 45, 96.5, "News article", "2026-06-18T00:01:00.000Z")
    ])
  };
});

const mockedGetSupabaseAnalyticsTypingResults = vi.mocked(getSupabaseAnalyticsTypingResults);

describe("ProfilePage", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockState.isLoading = false;
    mockState.isConfigured = true;
    mockState.routerPush.mockClear();
    mockedGetSupabaseAnalyticsTypingResults.mockClear();
  });

  it("renders progress analytics for an authenticated user", async () => {
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Progress Summary")).toBeTruthy();
    });

    expect(mockedGetSupabaseAnalyticsTypingResults).toHaveBeenCalledWith("user-1");
    expect(screen.getByText("Average WPM last 10")).toBeTruthy();
    expect(screen.getByText("Average WPM last 100")).toBeTruthy();
    expect(screen.getByText("Trends")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Last 90" })).toBeTruthy();
    expect(screen.getByText("Consistency")).toBeTruthy();
    expect(screen.getByText("Not enough data yet")).toBeTruthy();
    expect(screen.getByText("Category Breakdown")).toBeTruthy();
    expect(screen.getByText("Weakest: News article")).toBeTruthy();
    expect(screen.getByText("Activity")).toBeTruthy();
    expect(screen.getByText("Current streak")).toBeTruthy();
    expect(screen.getByText("My Results")).toBeTruthy();
    expect(screen.getByText("Recent attempts")).toBeTruthy();
    expect(screen.getByText("Passage latest")).toBeTruthy();
    expect(screen.queryByText("Profile Settings")).toBeNull();
  });

  it("redirects logged-out users to login without loading profile data", async () => {
    mockState.user = null;

    render(<ProfilePage />);

    await waitFor(() => {
      expect(mockState.routerPush).toHaveBeenCalledWith("/login?redirectTo=/profile");
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
