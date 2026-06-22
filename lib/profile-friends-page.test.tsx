/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FriendsPage from "../pages/profile/friends";
import {
  listAcceptedFriends,
  listIncomingFriendRequests,
  listOutgoingFriendRequests
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
  listAcceptedFriends: vi.fn().mockResolvedValue([]),
  listIncomingFriendRequests: vi.fn().mockResolvedValue([]),
  listOutgoingFriendRequests: vi.fn().mockResolvedValue([])
}));

const mockedListFriends = vi.mocked(listAcceptedFriends);
const mockedListIncoming = vi.mocked(listIncomingFriendRequests);
const mockedListOutgoing = vi.mocked(listOutgoingFriendRequests);

describe("Profile friends page", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockState.isLoading = false;
    mockState.routerPush.mockClear();
    mockedListFriends.mockClear();
    mockedListIncoming.mockClear();
    mockedListOutgoing.mockClear();
    mockedListFriends.mockResolvedValue([]);
    mockedListIncoming.mockResolvedValue([]);
    mockedListOutgoing.mockResolvedValue([]);
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
