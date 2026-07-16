/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../pages/profile";
import { getSupabaseAnalyticsTypingResults } from "@/lib/typingResultStorage";
import { TYPING_ATTEMPT_DETAILS_STORAGE_KEY } from "@/lib/typingStatistics";
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

vi.mock("@/lib/typingAttemptStorage", () => ({
  getSupabaseTypingAttemptDetails: vi.fn().mockResolvedValue([]),
  syncLocalTypingAttemptDetails: vi.fn().mockResolvedValue(undefined)
}));

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
    window.localStorage.clear();
  });

  it("renders progress analytics for an authenticated user", async () => {
    window.localStorage.setItem(
      TYPING_ATTEMPT_DETAILS_STORAGE_KEY,
      JSON.stringify([
        {
          id: "detail-1",
          userId: "user-1",
          completedAt: "2026-06-21T00:02:00.000Z",
          durationSeconds: 60,
          wpm: 72,
          accuracy: 98.2,
          timeline: [
            { timeSeconds: 10, wpm: 104 },
            { timeSeconds: 20, wpm: 100 },
            { timeSeconds: 30, wpm: 99 },
            { timeSeconds: 40, wpm: 96 },
            { timeSeconds: 50, wpm: 90 },
            { timeSeconds: 60, wpm: 88 }
          ],
          characters: [
            ...Array.from({ length: 20 }, (_, index) => ({
              expected: "q",
              actual: "q",
              index,
              status: "correct",
              delayMs: 100
            })),
            { expected: "q", actual: "w", index: 20, status: "wrong", delayMs: 260 },
            { expected: "q", actual: "w", index: 21, status: "wrong", delayMs: 240 },
            { expected: " ", actual: "", index: 22, status: "wrong", delayMs: null },
            { expected: "", actual: "a", index: 23, status: "extra", delayMs: 180 },
            { expected: "", actual: "b", index: 24, status: "extra", delayMs: 180 },
            { expected: "", actual: "c", index: 25, status: "extra", delayMs: 180 },
            { expected: "", actual: "d", index: 26, status: "extra", delayMs: 180 }
          ]
        }
      ])
    );

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
    expect(screen.getByText("https://typing-puce-one.vercel.app/u/formal_typist")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy public profile URL" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View public profile" }).getAttribute("href")).toBe("/u/formal_typist");
    expect(screen.queryByRole("link", { name: "Edit identity settings" })).toBeNull();
    expect(screen.getByText("Average WPM last 10")).toBeTruthy();
    expect(screen.getByText("Average WPM last 100")).toBeTruthy();
    expect(screen.getByText("Trends")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Last 90" })).toBeTruthy();
    expect(screen.getByText("Consistency")).toBeTruthy();
    expect(screen.getAllByText("Latest").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Average").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Best").length).toBeGreaterThan(0);
    expect(screen.getByText("Recent change")).toBeTruthy();
    expect(screen.getByText("Typing Insights")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accuracy" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Speed" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mistakes" })).toBeTruthy();
    expect(screen.getByTestId("keyboard-heatmap")).toBeTruthy();
    expect(screen.getByTestId("keyboard-key-q").textContent).toContain("Q");
    expect(screen.getByTestId("keyboard-key-backspace").textContent).toContain("Backspace");
    expect(screen.getByTestId("keyboard-key-enter").textContent).toContain("Enter");
    expect(screen.getByText("Legend")).toBeTruthy();
    expect(screen.getByTestId("keyboard-key-space").getAttribute("title")).toContain("Not enough data");
    expect(screen.getByTestId("keyboard-key-space").getAttribute("title")).toContain("1 hit");
    expect(screen.getByTestId("keyboard-key-space").getAttribute("style")).toContain("--color-paper");
    expect(screen.getByText("Weak Keys")).toBeTruthy();
    expect(screen.getByText("Common Mistakes")).toBeTruthy();
    expect(screen.queryByText("Recent Error Replay")).toBeNull();
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    expect(screen.queryByLabelText("Replay timeline")).toBeNull();
    expect(screen.getByRole("button", { name: "Show advanced insights" })).toBeTruthy();
    expect(screen.queryByText("Finger Analysis")).toBeNull();
    expect(screen.queryByText("Reaction Time")).toBeNull();
    expect(screen.queryByText("Burst Speed")).toBeNull();
    expect(screen.queryByText("Speed Drop")).toBeNull();
    expect(screen.getByText("expected q, typed w")).toBeTruthy();
    expect(screen.getByText("missed space")).toBeTruthy();
    expect(screen.getByText("extra a")).toBeTruthy();
    expect(screen.getByText("extra b")).toBeTruthy();
    expect(screen.getByText("extra c")).toBeTruthy();
    expect(screen.queryByText("extra d")).toBeNull();
    expect(screen.queryByText("25.0%")).toBeNull();
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
      screen.getByText("Typing Insights").compareDocumentPosition(screen.getByText("My Results")) &
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

  it("keeps keyboard key elements stable when switching heatmap modes", async () => {
    window.localStorage.setItem(
      TYPING_ATTEMPT_DETAILS_STORAGE_KEY,
      JSON.stringify([
        {
          id: "detail-1",
          userId: "user-1",
          completedAt: "2026-06-21T00:02:00.000Z",
          durationSeconds: 60,
          wpm: 72,
          accuracy: 98.2,
          characters: [
            ...Array.from({ length: 20 }, (_, index) => ({
              expected: "e",
              actual: "e",
              index,
              status: "correct",
              delayMs: 90
            })),
            { expected: "e", actual: "r", index: 20, status: "wrong", delayMs: 210 }
          ]
        }
      ])
    );

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId("keyboard-key-e")).toBeTruthy();
    });

    const eKey = screen.getByTestId("keyboard-key-e");
    expect(eKey.className).toContain("duration-200");
    fireEvent.click(screen.getByRole("button", { name: "Speed" }));
    expect(screen.getByTestId("keyboard-key-e")).toBe(eKey);
    fireEvent.click(screen.getByRole("button", { name: "Mistakes" }));
    expect(screen.getByTestId("keyboard-key-e")).toBe(eKey);
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

  it("scopes Profile stats and result lists by selected analytics domain", async () => {
    mockedGetSupabaseAnalyticsTypingResults.mockResolvedValueOnce([
      makeResult("english", 60, 50, 98, "Business email", "2026-06-21T00:01:00.000Z"),
      makeResult("chinese", 60, 120, 99, "training_chinese", "2026-06-21T00:02:00.000Z"),
      makeResult("legacy-chinese", 60, 80, 97, null, "2026-06-21T00:04:00.000Z", "Training Chinese"),
      makeResult("code", 60, 90, 97, "training_code", "2026-06-21T00:03:00.000Z")
    ]);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "English" }).getAttribute("aria-pressed")).toBe("true");
    });
    expect(screen.getByText("Passage english")).toBeTruthy();
    expect(screen.queryByText("Passage chinese")).toBeNull();
    expect(screen.queryByText("Passage code")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Chinese" }));

    expect(screen.getByText("Passage chinese")).toBeTruthy();
    expect(screen.getByText("Training Chinese")).toBeTruthy();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("120.0").length).toBeGreaterThan(0);
    expect(screen.getAllByText("100.0").length).toBeGreaterThan(0);
    expect(screen.queryByText("Passage english")).toBeNull();
    expect(screen.queryByText("Passage code")).toBeNull();
    expect(screen.queryByText("Weak Keys")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Code" }));

    expect(screen.getByText("Passage code")).toBeTruthy();
    expect(screen.queryByText("Passage english")).toBeNull();
    expect(screen.queryByText("Passage chinese")).toBeNull();
  });

  it("keeps the current display preference when device storage rejects the change", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<ProfilePage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "CPM" })).toBeTruthy());
    const storageSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("Storage full", "QuotaExceededError");
    });

    fireEvent.click(screen.getByRole("button", { name: "CPM" }));

    expect(screen.getByRole("alert").textContent).toContain("Display preferences could not be saved");
    expect(screen.getByRole("button", { name: "WPM" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "CPM" }).getAttribute("aria-pressed")).toBe("false");
    storageSpy.mockRestore();
    warnSpy.mockRestore();
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
  createdAt: string,
  title = `Passage ${id}`
) {
  return {
    id,
    passage_title: title,
    passage_category: category,
    duration_seconds: durationSeconds,
    wpm,
    accuracy,
    correct_chars: Math.round(wpm * 5 * Math.max(durationSeconds, 60) / 60),
    created_at: createdAt
  };
}
