/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../pages/profile";
import { getSupabaseAnalyticsTypingResults } from "@/lib/typingResultStorage";
import { getSupabaseProfile, updateSupabaseProfileIdentity } from "@/lib/profileStorage";

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

vi.mock("@/lib/profileStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/profileStorage")>("@/lib/profileStorage");

  return {
    ...actual,
    getSupabaseProfile: vi.fn().mockResolvedValue(makeProfile()),
    updateSupabaseProfileIdentity: vi.fn().mockResolvedValue(makeProfile({ bio: "Updated bio", avatar_style: "slate" }))
  };
});

const mockedGetSupabaseAnalyticsTypingResults = vi.mocked(getSupabaseAnalyticsTypingResults);
const mockedGetSupabaseProfile = vi.mocked(getSupabaseProfile);
const mockedUpdateSupabaseProfileIdentity = vi.mocked(updateSupabaseProfileIdentity);

describe("ProfilePage", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockState.isLoading = false;
    mockState.isConfigured = true;
    mockState.routerPush.mockClear();
    mockedGetSupabaseAnalyticsTypingResults.mockClear();
    mockedGetSupabaseProfile.mockClear();
    mockedUpdateSupabaseProfileIdentity.mockClear();
    mockedGetSupabaseProfile.mockResolvedValue(makeProfile() as any);
    mockedUpdateSupabaseProfileIdentity.mockResolvedValue(makeProfile({ bio: "Updated bio", avatar_style: "slate" }) as any);
  });

  it("renders progress analytics for an authenticated user", async () => {
    render(<ProfilePage />);

    await waitFor(() => {
    expect(screen.getByText("Progress Summary")).toBeTruthy();
    });

    expect(mockedGetSupabaseAnalyticsTypingResults).toHaveBeenCalledWith("user-1");
    expect(mockedGetSupabaseProfile).toHaveBeenCalledWith("user-1");
    expect(screen.getByText("Profile Identity")).toBeTruthy();
    expect(screen.getByText("@formal_typist")).toBeTruthy();
    expect(screen.getByText("https://formaltype.app/u/formal_typist")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy public profile URL" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View public profile" }).getAttribute("href")).toBe("/u/formal_typist");
    expect(screen.getByRole("link", { name: "Edit identity settings" }).getAttribute("href")).toBe("#identity-settings");
    expect(screen.getByText("Average WPM last 10")).toBeTruthy();
    expect(screen.getByText("Average WPM last 100")).toBeTruthy();
    expect(screen.getByText("Trends")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Last 90" })).toBeTruthy();
    expect(screen.getByText("Consistency")).toBeTruthy();
    expect(screen.getByText("Not enough data yet")).toBeTruthy();
    expect(screen.getAllByText("Level").length).toBeGreaterThan(0);
    expect(screen.getByText("Total XP")).toBeTruthy();
    expect(screen.getByText("Daily Challenge")).toBeTruthy();
    expect(screen.getByText("Weekly Challenge")).toBeTruthy();
    expect(screen.getByText("Achievements")).toBeTruthy();
    expect(screen.getByText("6 / 23 unlocked")).toBeTruthy();
    expect(screen.getByText("First Test")).toBeTruthy();
    expect(screen.getByText("Getting Started")).toBeTruthy();
    expect(screen.getByText("100-Day Streak")).toBeTruthy();
    expect(screen.getByText("1,000 Words")).toBeTruthy();
    expect(screen.getByText("Category Breakdown")).toBeTruthy();
    expect(screen.getByText("Weakest: News article")).toBeTruthy();
    expect(screen.getByText("Activity")).toBeTruthy();
    expect(screen.getAllByText("Current streak").length).toBeGreaterThan(0);
    expect(screen.getByText("My Results")).toBeTruthy();
    expect(screen.getByText("Recent attempts")).toBeTruthy();
    expect(screen.getByText("Passage latest")).toBeTruthy();
    expect(
      screen.getByText("Activity").compareDocumentPosition(screen.getByText("My Results")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.queryByText("Profile Settings")).toBeNull();
  });

  it("renders editable identity fields and saves changes", async () => {
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Bio")).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "Updated bio" } });
    fireEvent.change(screen.getByLabelText("Avatar style"), { target: { value: "slate" } });
    fireEvent.click(screen.getByLabelText("Public profile enabled"));
    fireEvent.click(screen.getByRole("button", { name: "Save identity" }));

    await waitFor(() => {
      expect(mockedUpdateSupabaseProfileIdentity).toHaveBeenCalledWith("user-1", {
        bio: "Updated bio",
        avatar_style: "slate",
        public_profile_enabled: false
      });
    });
    expect(screen.getByText("Identity settings saved.")).toBeTruthy();
  });

  it("redirects logged-out users to login without loading profile data", async () => {
    mockState.user = null;

    render(<ProfilePage />);

    await waitFor(() => {
      expect(mockState.routerPush).toHaveBeenCalledWith("/login?redirectTo=/profile");
    });
    expect(mockedGetSupabaseAnalyticsTypingResults).not.toHaveBeenCalled();
  });

  it("renders locked achievements for an authenticated user with no saved results", async () => {
    mockedGetSupabaseAnalyticsTypingResults.mockResolvedValueOnce([]);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText(/No saved results yet/)).toBeTruthy();
    });

    expect(screen.getByText("Achievements")).toBeTruthy();
    expect(screen.getAllByText("Level").length).toBeGreaterThan(0);
    expect(screen.getByText("Daily Challenge")).toBeTruthy();
    expect(screen.getByText("Weekly Challenge")).toBeTruthy();
    expect(screen.getByText("0 / 23 unlocked")).toBeTruthy();
    expect(screen.getByText("First Test")).toBeTruthy();
    expect(screen.getAllByText("Locked").length).toBeGreaterThan(0);
    expect(screen.queryByText("Progress Summary")).toBeNull();
  });
});

function makeProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    user_id: "user-1",
    display_name: "Formal Typist",
    handle: "formal_typist",
    bio: "I type with ceremonial precision.",
    avatar_style: "amber",
    public_profile_enabled: true,
    created_at: "2026-06-20T00:00:00.000Z",
    updated_at: "2026-06-21T00:00:00.000Z",
    ...overrides
  };
}

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
    correct_chars: Math.round(wpm * 5 * Math.max(durationSeconds, 60) / 60),
    created_at: createdAt
  };
}
