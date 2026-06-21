/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../pages/profile";
import { getSupabaseProfile, upsertSupabaseProfile } from "@/lib/profileStorage";
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

vi.mock("@/lib/profileStorage", () => ({
  getSupabaseProfile: vi.fn().mockResolvedValue({ display_name: "Formal Typist" }),
  upsertSupabaseProfile: vi.fn().mockResolvedValue({ display_name: "Updated Typist" })
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

const mockedGetSupabaseProfile = vi.mocked(getSupabaseProfile);
const mockedUpsertSupabaseProfile = vi.mocked(upsertSupabaseProfile);
const mockedGetSupabaseAnalyticsTypingResults = vi.mocked(getSupabaseAnalyticsTypingResults);

describe("ProfilePage", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockState.isLoading = false;
    mockState.isConfigured = true;
    mockState.routerPush.mockClear();
    mockedGetSupabaseProfile.mockClear();
    mockedUpsertSupabaseProfile.mockClear();
    mockedGetSupabaseAnalyticsTypingResults.mockClear();
  });

  it("renders profile settings and progress analytics for an authenticated user", async () => {
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Formal Typist")).toBeTruthy();
    });

    expect(mockedGetSupabaseProfile).toHaveBeenCalledWith("user-1");
    expect(mockedGetSupabaseAnalyticsTypingResults).toHaveBeenCalledWith("user-1");
    expect(screen.getByText("Profile Settings")).toBeTruthy();
    expect(screen.getByText("This public name appears on leaderboard rows. Your email stays private.")).toBeTruthy();
    expect(screen.getByText("Progress Summary")).toBeTruthy();
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
  });

  it("saves the display name from the profile page", async () => {
    render(<ProfilePage />);

    const input = await screen.findByDisplayValue("Formal Typist");
    fireEvent.change(input, { target: { value: "Updated Typist" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));

    await waitFor(() => {
      expect(mockedUpsertSupabaseProfile).toHaveBeenCalledWith("user-1", "Updated Typist");
    });
    expect(screen.getByText("Display name saved.")).toBeTruthy();
  });

  it("redirects logged-out users to login without loading profile data", async () => {
    mockState.user = null;

    render(<ProfilePage />);

    await waitFor(() => {
      expect(mockState.routerPush).toHaveBeenCalledWith("/login?redirectTo=/profile");
    });
    expect(mockedGetSupabaseProfile).not.toHaveBeenCalled();
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
