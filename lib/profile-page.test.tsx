/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../pages/profile";
import { getSupabaseAnalyticsTypingResults } from "@/lib/typingResultStorage";
import {
  getSupabaseProfile,
  removeSupabaseProfileAvatar,
  updateSupabaseProfileIdentity,
  uploadSupabaseProfileAvatar
} from "@/lib/profileStorage";

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
    getSupabaseAvatarPublicUrl: vi.fn((path: string | null) => (path ? `https://cdn.example.com/${path}` : null)),
    getSupabaseProfile: vi.fn().mockResolvedValue(makeProfile()),
    removeSupabaseProfileAvatar: vi.fn().mockResolvedValue(makeProfile({ avatar_path: null })),
    uploadSupabaseProfileAvatar: vi.fn().mockResolvedValue(makeProfile({ avatar_path: "user-1/avatar.png" })),
    updateSupabaseProfileIdentity: vi.fn().mockResolvedValue(makeProfile({ bio: "Updated bio", avatar_style: "slate" }))
  };
});

const mockedGetSupabaseAnalyticsTypingResults = vi.mocked(getSupabaseAnalyticsTypingResults);
const mockedGetSupabaseProfile = vi.mocked(getSupabaseProfile);
const mockedRemoveSupabaseProfileAvatar = vi.mocked(removeSupabaseProfileAvatar);
const mockedUploadSupabaseProfileAvatar = vi.mocked(uploadSupabaseProfileAvatar);
const mockedUpdateSupabaseProfileIdentity = vi.mocked(updateSupabaseProfileIdentity);

describe("ProfilePage", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockState.isLoading = false;
    mockState.isConfigured = true;
    mockState.routerPush.mockClear();
    mockedGetSupabaseAnalyticsTypingResults.mockClear();
    mockedGetSupabaseProfile.mockClear();
    mockedRemoveSupabaseProfileAvatar.mockClear();
    mockedUploadSupabaseProfileAvatar.mockClear();
    mockedUpdateSupabaseProfileIdentity.mockClear();
    mockedGetSupabaseProfile.mockResolvedValue(makeProfile() as any);
    mockedRemoveSupabaseProfileAvatar.mockResolvedValue(makeProfile({ avatar_path: null }) as any);
    mockedUploadSupabaseProfileAvatar.mockResolvedValue(makeProfile({ avatar_path: "user-1/avatar.png" }) as any);
    mockedUpdateSupabaseProfileIdentity.mockResolvedValue(makeProfile({ bio: "Updated bio", avatar_style: "slate" }) as any);
  });

  it("renders progress analytics for an authenticated user", async () => {
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Summary Stats")).toBeTruthy();
    });

    expect(mockedGetSupabaseAnalyticsTypingResults).toHaveBeenCalledWith("user-1");
    expect(mockedGetSupabaseProfile).toHaveBeenCalledWith("user-1");
    expect(screen.getByText("Profile Identity")).toBeTruthy();
    expect(screen.getByText("@formal_typist")).toBeTruthy();
    expect(screen.getByText("Joined Jun 20, 2026")).toBeTruthy();
    expect(screen.getAllByText("I type with ceremonial precision.").length).toBeGreaterThan(0);
    expect(screen.getByText("https://formaltype.app/u/formal_typist")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy public profile URL" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View public profile" }).getAttribute("href")).toBe("/u/formal_typist");
    expect(screen.queryByRole("link", { name: "Edit identity settings" })).toBeNull();
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
      screen.getByText("Achievements").compareDocumentPosition(screen.getByText("My Results")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.queryByText("Profile Settings")).toBeNull();
    expect(screen.queryByText(/avatar style/i)).toBeNull();
    expect(screen.queryByText("Avatar image")).toBeNull();

    const wpmChart = screen.getByRole("img", { name: "WPM over time" });
    expect(wpmChart.querySelector('[data-testid="profile-trend-line"]')?.getAttribute("stroke")).toBe(
      "rgb(var(--chart-line))"
    );
    expect(wpmChart.querySelector('[data-testid="profile-trend-fill"]')?.getAttribute("fill")).toBe(
      "rgb(var(--chart-fill))"
    );
    expect(wpmChart.querySelector('[data-testid="profile-trend-grid"]')?.getAttribute("stroke")).toBe(
      "rgb(var(--chart-grid))"
    );
    expect(wpmChart.querySelector('[data-testid="profile-trend-axis"]')?.getAttribute("stroke")).toBe(
      "rgb(var(--chart-axis))"
    );
  });

  it("renders uploaded avatar images in the Profile Identity card", async () => {
    mockedGetSupabaseProfile.mockResolvedValueOnce(makeProfile({ avatar_path: "user-1/avatar.png" }) as any);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByAltText("@formal_typist avatar")).toBeTruthy();
    });
    expect(screen.getByAltText("@formal_typist avatar").getAttribute("src")).toBe(
      "https://cdn.example.com/user-1/avatar.png"
    );
    expect(screen.getByRole("button", { name: "Remove avatar" })).toBeTruthy();
    expect(screen.getByLabelText("Change avatar")).toBeTruthy();
    expect(screen.queryByText("Avatar image")).toBeNull();
  });

  it("triggers avatar upload from the avatar itself", async () => {
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Change avatar")).toBeTruthy();
    });

    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Change avatar"), { target: { files: [file] } });

    await waitFor(() => {
      expect(mockedUploadSupabaseProfileAvatar).toHaveBeenCalledWith("user-1", file);
    });
    expect(screen.getByText("Avatar uploaded.")).toBeTruthy();
  });

  it("removes an uploaded avatar from the Profile Identity card", async () => {
    mockedGetSupabaseProfile.mockResolvedValueOnce(makeProfile({ avatar_path: "user-1/avatar.png" }) as any);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Remove avatar" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove avatar" }));

    await waitFor(() => {
      expect(mockedRemoveSupabaseProfileAvatar).toHaveBeenCalledWith("user-1", "user-1/avatar.png");
    });
    expect(screen.getByText("Avatar removed.")).toBeTruthy();
    expect(screen.queryByAltText("@formal_typist avatar")).toBeNull();
  });

  it("renders editable identity fields and saves changes", async () => {
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Bio")).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "Updated bio" } });
    fireEvent.change(screen.getByLabelText("Fallback avatar"), { target: { value: "slate" } });
    fireEvent.click(screen.getByLabelText("Public profile visible"));
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
    expect(screen.queryByText("Summary Stats")).toBeNull();
  });
});

function makeProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    user_id: "user-1",
    display_name: "Formal Typist",
    handle: "formal_typist",
    bio: "I type with ceremonial precision.",
    avatar_style: "amber",
    avatar_path: null,
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
