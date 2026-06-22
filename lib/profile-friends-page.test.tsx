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

const mockedAccept = vi.mocked(acceptFriendRequest);
const mockedListFriends = vi.mocked(listAcceptedFriends);
const mockedListIncoming = vi.mocked(listIncomingFriendRequests);
const mockedListOutgoing = vi.mocked(listOutgoingFriendRequests);
const mockedReject = vi.mocked(rejectFriendRequest);
const mockedRemove = vi.mocked(removeFriend);
const mockedSend = vi.mocked(sendFriendRequestByProfileHandle);

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
    mockedListFriends.mockResolvedValue([]);
    mockedListIncoming.mockResolvedValue([]);
    mockedListOutgoing.mockResolvedValue([]);
    mockedAccept.mockResolvedValue({} as any);
    mockedReject.mockResolvedValue(undefined);
    mockedRemove.mockResolvedValue(undefined);
    mockedSend.mockResolvedValue({} as any);
  });

  it("renders empty friend request sections", async () => {
    render(<FriendsPage />);

    await waitFor(() => {
      expect(screen.getByText("No friends yet.")).toBeTruthy();
    });

    expect(screen.getByText("Incoming requests")).toBeTruthy();
    expect(screen.getByText("No incoming requests.")).toBeTruthy();
    expect(screen.getByText("Outgoing requests")).toBeTruthy();
    expect(screen.getByText("No outgoing requests.")).toBeTruthy();
  });

  it("renders friends, incoming requests, and outgoing requests", async () => {
    mockedListFriends.mockResolvedValueOnce([makeFriend({ handle: "ada_type" })]);
    mockedListIncoming.mockResolvedValueOnce([makeFriend({ id: "request-1", handle: "grace_keys", direction: "incoming" })]);
    mockedListOutgoing.mockResolvedValueOnce([makeFriend({ id: "request-2", handle: "linus_letters", direction: "outgoing" })]);

    render(<FriendsPage />);

    await waitFor(() => {
      expect(screen.getByText("@ada_type")).toBeTruthy();
    });

    expect(screen.getByText("@grace_keys")).toBeTruthy();
    expect(screen.getByText("@linus_letters")).toBeTruthy();
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
    expect(screen.getByRole("button", { name: "Remove @ada_type" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept @grace_keys" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel @linus_letters" })).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: "Accept @grace_keys" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Reject @grace_keys" }));

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
    fireEvent.change(screen.getByLabelText("Add friend by handle"), { target: { value: "@kkk" } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => {
      expect(mockedSend).toHaveBeenCalledWith("@kkk");
    });
    expect(await screen.findByText("Friend request sent to @kkk.")).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: "Cancel @linus_letters" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove @ada_type" }));

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
