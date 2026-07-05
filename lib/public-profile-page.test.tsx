/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicUserProfilePage from "../pages/u/[handle]";
import {
  getSupabasePublicTypingResultsByHandle
} from "@/lib/typingResultStorage";
import { getSupabasePublicProfileByHandle } from "@/lib/profileStorage";
import { getSupabaseProfile } from "@/lib/profileStorage";
import { getFriendshipWithProfileHandle } from "@/lib/friendStorage";

const mockState = vi.hoisted(() => ({
  handle: "Formal_Typist",
  user: { id: "user-1", email: "typist@example.com" } as { id: string; email: string } | null
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    isReady: true,
    query: { handle: mockState.handle }
  })
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: mockState.user,
    isLoading: false,
    isConfigured: true
  })
}));

vi.mock("@/lib/profileStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/profileStorage")>("@/lib/profileStorage");

  return {
    ...actual,
    getSupabaseAvatarPublicUrl: vi.fn((path: string | null) => (path ? `https://cdn.example.com/${path}` : null)),
    getSupabasePublicProfileByHandle: vi.fn().mockResolvedValue(makePublicProfile()),
    getSupabaseProfile: vi.fn().mockResolvedValue({ user_id: "user-1", display_name: "Formal Typist", handle: "own_handle" })
  };
});

vi.mock("@/lib/friendStorage", () => ({
  getFriendshipWithProfileHandle: vi.fn().mockResolvedValue(null),
  sendFriendRequestByProfileHandle: vi.fn()
}));

vi.mock("@/lib/typingResultStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/typingResultStorage")>("@/lib/typingResultStorage");

  return {
    ...actual,
    getSupabasePublicTypingResultsByHandle: vi.fn().mockResolvedValue([
      makeResult("recent", 60, 72, 98.2, "Business email", "2026-06-21T00:02:00.000Z", 360),
      makeResult("perfect", 60, 64, 100, "Legal", "2026-06-20T00:01:00.000Z", 320)
    ])
  };
});

const mockedGetProfile = vi.mocked(getSupabasePublicProfileByHandle);
const mockedGetOwnProfile = vi.mocked(getSupabaseProfile);
const mockedGetResults = vi.mocked(getSupabasePublicTypingResultsByHandle);
const mockedGetFriendship = vi.mocked(getFriendshipWithProfileHandle);

describe("PublicUserProfilePage", () => {
  beforeEach(() => {
    mockState.handle = "Formal_Typist";
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockedGetProfile.mockClear();
    mockedGetOwnProfile.mockClear();
    mockedGetResults.mockClear();
    mockedGetFriendship.mockClear();
    mockedGetProfile.mockResolvedValue(makePublicProfile());
    mockedGetOwnProfile.mockResolvedValue({ user_id: "user-1", display_name: "Formal Typist", handle: "own_handle" } as any);
    mockedGetFriendship.mockResolvedValue(null);
    mockedGetResults.mockResolvedValue([
      makeResult("recent", 60, 72, 98.2, "Business email", "2026-06-21T00:02:00.000Z", 360),
      makeResult("perfect", 60, 64, 100, "Legal", "2026-06-20T00:01:00.000Z", 320)
    ]);
  });

  it("renders a compact public profile with stats without exposing email", async () => {
    render(<PublicUserProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("@formal_typist")).toBeTruthy();
    });

    expect(screen.getByText("Public typist")).toBeTruthy();
    expect(screen.getByText("Joined Jun 20, 2026")).toBeTruthy();
    expect(screen.getByText("I type with ceremonial precision.")).toBeTruthy();
    expect(screen.queryByText(/avatar style/i)).toBeNull();
    expect(screen.getByText("Level")).toBeTruthy();
    expect(screen.getByText("XP progress")).toBeTruthy();
    expect(screen.getByText("Total XP")).toBeTruthy();
    expect(screen.getByText("Tests completed")).toBeTruthy();
    expect(screen.getAllByText("English WPM").length).toBeGreaterThan(0);
    expect(screen.queryByText("Best WPM")).toBeNull();
    expect(screen.queryByText("Best accuracy")).toBeNull();
    expect(screen.getByText("Current streak")).toBeTruthy();
    expect(screen.getByText("Achievements")).toBeTruthy();
    expect(screen.queryByText("Recent Results")).toBeNull();
    expect(screen.queryByText("Passage recent")).toBeNull();
    expect(screen.queryByText("Passage perfect")).toBeNull();
    expect(screen.getByRole("button", { name: "Add friend" })).toBeTruthy();
    expect(screen.queryByText(/typist@example.com/i)).toBeNull();
    expect(screen.queryByText(/user-1/i)).toBeNull();
  });

  it("renders an intentional empty state with no public results", async () => {
    mockedGetResults.mockResolvedValueOnce([]);

    render(<PublicUserProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("@formal_typist")).toBeTruthy();
    });
    expect(screen.queryByText("No public typing results yet.")).toBeNull();
    expect(screen.queryByText("This profile is ready; saved public results will appear here.")).toBeNull();
    expect(screen.queryByText("Recent Results")).toBeNull();
    expect(screen.getByText("No best result yet.")).toBeTruthy();
    expect(screen.queryByText("0.0")).toBeNull();
    expect(screen.queryByText("0.0%")).toBeNull();
  });

  it("shows public WPM bests by domain instead of one mixed headline", async () => {
    mockedGetResults.mockResolvedValueOnce([
      makeResult("english", 60, 50, 98, "Business email", "2026-06-21T00:01:00.000Z", 250),
      makeResult("chinese", 60, 120, 99, "training_chinese", "2026-06-21T00:02:00.000Z", 120),
      makeResult("code", 60, 90, 97, "training_code", "2026-06-21T00:03:00.000Z", 450)
    ]);

    render(<PublicUserProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("@formal_typist")).toBeTruthy();
    });

    expect(screen.getByText("English WPM")).toBeTruthy();
    expect(screen.getByText("Chinese WPM")).toBeTruthy();
    expect(screen.getByText("Code WPM")).toBeTruthy();
    expect(screen.getAllByText("50.0").length).toBeGreaterThan(0);
    expect(screen.getByText("120.0")).toBeTruthy();
    expect(screen.getByText("90.0")).toBeTruthy();
    expect(screen.queryByText("Best WPM")).toBeNull();
    expect(screen.queryByText("Recent Results")).toBeNull();
  });

  it("renders bio and avatar fallbacks when identity fields are null", async () => {
    mockedGetProfile.mockResolvedValueOnce(makePublicProfile({ bio: null, avatar_style: null, avatar_path: null }) as any);

    render(<PublicUserProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("@formal_typist")).toBeTruthy();
    });
    expect(screen.queryByText("No bio yet.")).toBeNull();
    expect(screen.queryByText(/avatar style/i)).toBeNull();
  });

  it("renders uploaded avatar images on public profiles", async () => {
    mockedGetProfile.mockResolvedValueOnce(makePublicProfile({ avatar_path: "user-1/avatar.png" }) as any);

    render(<PublicUserProfilePage />);

    await waitFor(() => {
      expect(screen.getByAltText("@formal_typist avatar")).toBeTruthy();
    });
    expect(screen.getByAltText("@formal_typist avatar").getAttribute("src")).toBe(
      "https://cdn.example.com/user-1/avatar.png"
    );
  });

  it("uses case-insensitive handle lookup", async () => {
    mockState.handle = "FORMAL_TYPIST";

    render(<PublicUserProfilePage />);

    await waitFor(() => {
      expect(mockedGetProfile).toHaveBeenCalledWith("FORMAL_TYPIST");
    });
    expect(mockedGetResults).toHaveBeenCalledWith("formal_typist");
  });

  it("shows a not found state for a missing handle", async () => {
    mockedGetProfile.mockResolvedValueOnce(null);

    render(<PublicUserProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Profile not found")).toBeTruthy();
    });
    expect(screen.queryByText("@formal_typist")).toBeNull();
  });

  it("shows a private profile state for disabled public profiles", async () => {
    mockState.user = null;
    mockedGetProfile.mockResolvedValueOnce(
      makePublicProfile({ public_profile_enabled: false, bio: null, avatar_path: null }) as any
    );

    render(<PublicUserProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("This profile is private.")).toBeTruthy();
    });
    expect(screen.getByText("@formal_typist")).toBeTruthy();
    expect(screen.queryByText("I type with ceremonial precision.")).toBeNull();
    expect(screen.queryByText("Public Stats")).toBeNull();
    expect(screen.queryByText("Recent Results")).toBeNull();
    expect(screen.queryByText("Achievements")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
    expect(mockedGetResults).not.toHaveBeenCalled();
  });

  it("shows a private profile state with a profile settings hint for the owner", async () => {
    mockedGetProfile.mockResolvedValueOnce(
      makePublicProfile({ public_profile_enabled: false, bio: null, avatar_path: "user-1/private-avatar.png" }) as any
    );
    mockedGetOwnProfile.mockResolvedValueOnce({
      user_id: "user-1",
      display_name: "Formal Typist",
      handle: "formal_typist",
      bio: "Keeping this quiet for now.",
      avatar_style: "ember",
      avatar_path: "user-1/private-avatar.png",
      public_profile_enabled: false,
      created_at: "2026-06-18T00:00:00.000Z",
      updated_at: "2026-06-19T00:00:00.000Z"
    } as any);

    render(<PublicUserProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("This profile is private.")).toBeTruthy();
    });
    expect(screen.getByText("@formal_typist")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Manage visibility" }).getAttribute("href")).toBe("/profile");
    expect(screen.queryByText("Public Stats")).toBeNull();
    expect(screen.queryByText("Recent Results")).toBeNull();
    expect(screen.queryByText("Achievements")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
    expect(mockedGetResults).not.toHaveBeenCalled();
  });

  it("shows pending friend state for outgoing requests", async () => {
    mockedGetFriendship.mockResolvedValueOnce(makeFriendship({ direction: "outgoing", status: "pending" }) as any);

    render(<PublicUserProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Request pending")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
  });

  it("shows friends state for accepted friendships", async () => {
    mockedGetFriendship.mockResolvedValueOnce(makeFriendship({ direction: "accepted", status: "accepted" }) as any);

    render(<PublicUserProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Friends")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
  });

  it("does not show add friend on the current user's own profile", async () => {
    mockedGetOwnProfile.mockResolvedValueOnce({ user_id: "user-1", display_name: "Formal Typist", handle: "formal_typist" } as any);

    render(<PublicUserProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("@formal_typist")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
  });

  it("still renders the public profile when friend status lookup fails", async () => {
    mockedGetFriendship.mockRejectedValueOnce(new Error("friend status unavailable"));

    render(<PublicUserProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("@formal_typist")).toBeTruthy();
    });
    expect(screen.getByText("Friend status unavailable")).toBeTruthy();
    expect(screen.queryByText("Recent Results")).toBeNull();
    expect(screen.queryByText("Passage recent")).toBeNull();
    expect(screen.queryByText("Public profile could not be loaded.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
  });
});

function makeResult(
  id: string,
  durationSeconds: number,
  wpm: number,
  accuracy: number,
  category: string | null,
  createdAt: string,
  correctCharacters: number
) {
  return {
    id,
    passage_title: `Passage ${id}`,
    passage_category: category,
    duration_seconds: durationSeconds,
    wpm,
    accuracy,
    correct_chars: correctCharacters,
    created_at: createdAt
  };
}

function makeFriendship(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "friendship-1",
    user_id: "user-2",
    handle: "formal_typist",
    status: "pending",
    direction: "outgoing",
    created_at: "2026-06-22T00:00:00.000Z",
    updated_at: "2026-06-22T00:00:00.000Z",
    ...overrides
  };
}

function makePublicProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    handle: "formal_typist",
    bio: "I type with ceremonial precision.",
    avatar_style: "amber",
    avatar_path: null,
    public_profile_enabled: true,
    created_at: "2026-06-20T00:00:00.000Z",
    ...overrides
  };
}
