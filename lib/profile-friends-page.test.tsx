/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FriendsPage from "../pages/profile/friends";
import {
  acceptFriendRequest,
  listAcceptedFriends,
  listIncomingFriendRequests,
  listOutgoingFriendRequests,
  rejectFriendRequest,
  removeFriend,
  sendFriendRequestByProfileHandle
} from "@/lib/friendStorage";
import { getSupabaseProfile, getSupabasePublicProfileByHandle } from "@/lib/profileStorage";
import { getSupabaseAnalyticsTypingResults, getSupabasePublicTypingResultsByHandle } from "@/lib/typingResultStorage";

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
    isLoading: mockState.isLoading,
    isConfigured: true
  })
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    push: mockState.routerPush,
    asPath: "/profile/friends"
  })
}));

vi.mock("@/lib/friendStorage", () => ({
  acceptFriendRequest: vi.fn().mockResolvedValue({}),
  listAcceptedFriends: vi.fn().mockResolvedValue([]),
  listIncomingFriendRequests: vi.fn().mockResolvedValue([]),
  listOutgoingFriendRequests: vi.fn().mockResolvedValue([]),
  rejectFriendRequest: vi.fn().mockResolvedValue(undefined),
  removeFriend: vi.fn().mockResolvedValue(undefined),
  sendFriendRequestByProfileHandle: vi.fn().mockResolvedValue({})
}));

vi.mock("@/lib/profileStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/profileStorage")>("@/lib/profileStorage");

  return {
    ...actual,
    getSupabaseAvatarPublicUrl: vi.fn((path: string | null) => (path ? `https://cdn.example.com/${path}` : null)),
    getSupabaseProfile: vi.fn().mockResolvedValue(null),
    getSupabasePublicProfileByHandle: vi.fn().mockResolvedValue(makePublicProfile())
  };
});

vi.mock("@/lib/typingResultStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/typingResultStorage")>("@/lib/typingResultStorage");

  return {
    ...actual,
    getSupabaseAnalyticsTypingResults: vi.fn().mockResolvedValue([]),
    getSupabasePublicTypingResultsByHandle: vi.fn().mockResolvedValue([makeResult("latest", 72, 98.2)])
  };
});

const mockedAccept = vi.mocked(acceptFriendRequest);
const mockedListFriends = vi.mocked(listAcceptedFriends);
const mockedListIncoming = vi.mocked(listIncomingFriendRequests);
const mockedListOutgoing = vi.mocked(listOutgoingFriendRequests);
const mockedReject = vi.mocked(rejectFriendRequest);
const mockedRemove = vi.mocked(removeFriend);
const mockedSend = vi.mocked(sendFriendRequestByProfileHandle);
const mockedGetPublicProfile = vi.mocked(getSupabasePublicProfileByHandle);
const mockedGetPublicResults = vi.mocked(getSupabasePublicTypingResultsByHandle);
const mockedGetProfile = vi.mocked(getSupabaseProfile);
const mockedGetOwnResults = vi.mocked(getSupabaseAnalyticsTypingResults);

describe("Profile friends page", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockState.isLoading = false;
    mockState.routerPush.mockClear();
    mockedListFriends.mockClear();
    mockedListIncoming.mockClear();
    mockedListOutgoing.mockClear();
    mockedAccept.mockClear();
    mockedReject.mockClear();
    mockedRemove.mockClear();
    mockedSend.mockClear();
    mockedGetPublicProfile.mockClear();
    mockedGetPublicResults.mockClear();
    mockedGetProfile.mockReset();
    mockedGetOwnResults.mockReset();
    mockedListFriends.mockResolvedValue([]);
    mockedListIncoming.mockResolvedValue([]);
    mockedListOutgoing.mockResolvedValue([]);
    mockedAccept.mockResolvedValue({} as any);
    mockedReject.mockResolvedValue(undefined);
    mockedRemove.mockResolvedValue(undefined);
    mockedSend.mockResolvedValue({} as any);
    mockedGetPublicProfile.mockResolvedValue(makePublicProfile() as any);
    mockedGetPublicResults.mockResolvedValue([makeResult("latest", 72, 98.2)] as any);
    mockedGetProfile.mockResolvedValue(null);
    mockedGetOwnResults.mockResolvedValue([]);
  });

  it("shows the signed-in user's results as the comparison benchmark", async () => {
    mockedListFriends.mockResolvedValueOnce([makeFriend({ handle: "ada_type" })]);
    mockedGetProfile.mockResolvedValueOnce({ user_id: "user-1", handle: "me_type", avatar_style: "amber", avatar_path: null, public_profile_enabled: true, bio: null, display_name: "Me", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-06-01T00:00:00.000Z" } as any);
    mockedGetOwnResults.mockResolvedValueOnce([makeResult("mine", 81, 99.1)] as any);

    render(<FriendsPage />);

    expect(await screen.findByText("Your benchmark")).toBeTruthy();
    expect(screen.getByRole("link", { name: "@me_type" })).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("81.0")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove friend @me_type" })).toBeNull();
  });

  it("renders a calm empty friends table state without large empty request boxes", async () => {
    render(<FriendsPage />);

    await waitFor(() => {
      expect(screen.getByText("No friends yet.")).toBeTruthy();
    });

    expect(screen.getByRole("button", { name: "Add friend" })).toBeTruthy();
    expect(screen.queryByText("No incoming requests.")).toBeNull();
    expect(screen.queryByText("No outgoing requests.")).toBeNull();
  });

  it("renders a compact friends stats table", async () => {
    mockedListFriends.mockResolvedValueOnce([makeFriend({ handle: "ada_type", updated_at: "2026-06-19T00:00:00.000Z" })]);
    mockedGetPublicProfile.mockResolvedValueOnce(makePublicProfile({ handle: "ada_type", avatar_path: "user-2/avatar.png" }) as any);

    render(<FriendsPage />);

    await waitFor(() => {
      expect(screen.getByRole("table", { name: "Friends stats" })).toBeTruthy();
    });

    expect(screen.getByRole("link", { name: "@ada_type" }).getAttribute("href")).toBe("/u/ada_type");
    expect(screen.getByAltText("@ada_type avatar").getAttribute("src")).toBe("https://cdn.example.com/user-2/avatar.png");
    expect(screen.getByText("Friends since Jun 19, 2026")).toBeTruthy();
    expect(screen.getByText("Level")).toBeTruthy();
    expect(screen.getByText("Tests")).toBeTruthy();
    expect(screen.getByText("English")).toBeTruthy();
    expect(screen.getByText("Chinese")).toBeTruthy();
    expect(screen.getByText("Code")).toBeTruthy();
    expect(screen.queryByText("Best WPM")).toBeNull();
    expect(screen.getByText("Acc")).toBeTruthy();
    expect(screen.getByText("Streak")).toBeTruthy();
    expect(screen.getByText("Latest")).toBeTruthy();
    expect(screen.queryByText("Action")).toBeNull();
    expect(screen.getByText("72.0")).toBeTruthy();
    expect(screen.getByText("98.2%")).toBeTruthy();
    expect(screen.getByText("Passage latest")).toBeTruthy();
  });

  it("renders friend best WPM values by analytics domain with dashes for missing domains", async () => {
    mockedListFriends.mockResolvedValueOnce([makeFriend({ handle: "ada_type" })]);
    mockedGetPublicProfile.mockResolvedValueOnce(makePublicProfile({ handle: "ada_type" }) as any);
    mockedGetPublicResults.mockResolvedValueOnce([
      makeResult("english", 72, 98.2, "Business email"),
      makeResult("chinese", 58, 99, "training_chinese"),
      makeResult("code", 31, 96, "training_code")
    ] as any);

    render(<FriendsPage />);

    await waitFor(() => {
      expect(screen.getByRole("table", { name: "Friends stats" })).toBeTruthy();
    });

    expect(screen.getByText("72.0")).toBeTruthy();
    expect(screen.getByText("58.0")).toBeTruthy();
    expect(screen.getByText("31.0")).toBeTruthy();
    expect(screen.queryByText("—")).toBeNull();

    mockedListFriends.mockResolvedValueOnce([makeFriend({ id: "friend-2", handle: "solo_type" })]);
    mockedGetPublicProfile.mockResolvedValueOnce(makePublicProfile({ handle: "solo_type" }) as any);
    mockedGetPublicResults.mockResolvedValueOnce([makeResult("english-only", 64, 97.5, "Business email")] as any);

    render(<FriendsPage />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "@solo_type" })).toBeTruthy();
    });
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("renders incoming and outgoing requests compactly", async () => {
    mockedListIncoming.mockResolvedValueOnce([makeFriend({ id: "request-1", handle: "grace_keys", direction: "incoming" })]);
    mockedListOutgoing.mockResolvedValueOnce([makeFriend({ id: "request-2", handle: "linus_letters", direction: "outgoing" })]);

    render(<FriendsPage />);

    await waitFor(() => {
      expect(screen.getByText("Requests")).toBeTruthy();
    });

    expect(screen.getByText("@grace_keys")).toBeTruthy();
    expect(screen.getByText("@linus_letters")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
  });

  it("links friend and request handles to public profiles", async () => {
    mockedListFriends.mockResolvedValueOnce([makeFriend({ handle: "ada_type" })]);
    mockedListIncoming.mockResolvedValueOnce([makeFriend({ id: "request-1", handle: "grace_keys", direction: "incoming" })]);
    mockedListOutgoing.mockResolvedValueOnce([makeFriend({ id: "request-2", handle: "linus_letters", direction: "outgoing" })]);

    render(<FriendsPage />);

    const friendLink = await screen.findByRole("link", { name: "@ada_type" });
    const incomingLink = screen.getByRole("link", { name: "@grace_keys" });
    const outgoingLink = screen.getByRole("link", { name: "@linus_letters" });

    expect(friendLink.getAttribute("href")).toBe("/u/ada_type");
    expect(incomingLink.getAttribute("href")).toBe("/u/grace_keys");
    expect(outgoingLink.getAttribute("href")).toBe("/u/linus_letters");
    expect(screen.getByRole("button", { name: "Remove friend @ada_type" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept request @grace_keys" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel request @linus_letters" })).toBeTruthy();
    expect(screen.getByTitle("Remove friend @ada_type")).toBeTruthy();
    expect(screen.getByTitle("Accept request @grace_keys")).toBeTruthy();
    expect(screen.getByTitle("Cancel request @linus_letters")).toBeTruthy();
  });

  it("accepts incoming friend requests and refreshes lists", async () => {
    mockedListIncoming.mockResolvedValueOnce([
      makeFriend({ id: "request-1", handle: "grace_keys", direction: "incoming", status: "pending" })
    ]);
    mockedListFriends.mockResolvedValueOnce([]).mockResolvedValueOnce([makeFriend({ handle: "grace_keys" })]);
    mockedListIncoming.mockResolvedValueOnce([]);
    mockedListOutgoing.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    render(<FriendsPage />);

    await waitFor(() => {
      expect(screen.getByText("@grace_keys")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Accept request @grace_keys" }));

    await waitFor(() => {
      expect(mockedAccept).toHaveBeenCalledWith("request-1");
    });
    expect(await screen.findByText("Friend request accepted.")).toBeTruthy();
  });

  it("rejects incoming friend requests and refreshes lists", async () => {
    mockedListIncoming.mockResolvedValueOnce([
      makeFriend({ id: "request-1", handle: "grace_keys", direction: "incoming", status: "pending" })
    ]);
    mockedListIncoming.mockResolvedValueOnce([]);

    render(<FriendsPage />);

    await waitFor(() => {
      expect(screen.getByText("@grace_keys")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Reject request @grace_keys" }));

    await waitFor(() => {
      expect(mockedReject).toHaveBeenCalledWith("request-1");
    });
    expect(await screen.findByText("Friend request rejected.")).toBeTruthy();
  });

  it("sends friend requests by handle from the friends page", async () => {
    render(<FriendsPage />);

    await waitFor(() => {
      expect(screen.getByText("No friends yet.")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Add friend" }));
    fireEvent.change(screen.getByLabelText("Add friend by handle"), { target: { value: "@kkk" } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => {
      expect(mockedSend).toHaveBeenCalledWith("@kkk");
    });
    expect(await screen.findByText("Friend request sent to @kkk.")).toBeTruthy();
  });

  it("renders private friend stats as dashes without breaking the friends table", async () => {
    mockedListFriends.mockResolvedValueOnce([makeFriend({ handle: "private_keys" })]);
    mockedGetPublicProfile.mockResolvedValueOnce(makePublicProfile({ handle: "private_keys", public_profile_enabled: false }) as any);
    mockedGetPublicResults.mockResolvedValueOnce([] as any);

    render(<FriendsPage />);

    const link = await screen.findByRole("link", { name: "@private_keys" });
    expect(link.getAttribute("href")).toBe("/u/private_keys");
    expect(screen.getByText("Private")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(5);
  });

  it("cancels outgoing requests and removes accepted friends", async () => {
    mockedListFriends.mockResolvedValueOnce([makeFriend({ id: "friend-1", handle: "ada_type" })]);
    mockedListOutgoing.mockResolvedValueOnce([
      makeFriend({ id: "request-2", handle: "linus_letters", direction: "outgoing", status: "pending" })
    ]);

    render(<FriendsPage />);

    await waitFor(() => {
      expect(screen.getByText("@ada_type")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel request @linus_letters" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove friend @ada_type" }));

    await waitFor(() => {
      expect(mockedReject).toHaveBeenCalledWith("request-2");
      expect(mockedRemove).toHaveBeenCalledWith("friend-1");
    });
  });

  it("redirects logged-out users to login", async () => {
    mockState.user = null;

    render(<FriendsPage />);

    await waitFor(() => {
      expect(mockState.routerPush).toHaveBeenCalledWith("/login?redirectTo=/profile/friends");
    });
    expect(mockedListFriends).not.toHaveBeenCalled();
  });
});

function makeFriend(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "friendship-1",
    user_id: "user-2",
    handle: "formal_typist",
    status: "accepted",
    direction: "accepted",
    created_at: "2026-06-22T00:00:00.000Z",
    updated_at: "2026-06-22T00:00:00.000Z",
    ...overrides
  } as any;
}

function makePublicProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    handle: "formal_typist",
    bio: null,
    avatar_style: "amber",
    avatar_path: null,
    public_profile_enabled: true,
    created_at: "2026-06-20T00:00:00.000Z",
    ...overrides
  };
}

function makeResult(id: string, wpm: number, accuracy: number, category = "Letters") {
  return {
    id,
    passage_title: `Passage ${id}`,
    passage_category: category,
    duration_seconds: 60,
    wpm,
    accuracy,
    correct_chars: Math.round(wpm * 5),
    created_at: "2026-06-22T00:00:00.000Z"
  };
}
