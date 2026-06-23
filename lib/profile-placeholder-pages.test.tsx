/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountPage from "../pages/profile/account";
import FriendsPage from "../pages/profile/friends";
import PublicProfilePage from "../pages/profile/public";
import { getSupabaseProfile } from "@/lib/profileStorage";

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
    asPath: "/profile"
  })
}));

vi.mock("@/lib/profileStorage", () => ({
  getSupabaseProfile: vi.fn().mockResolvedValue({ display_name: "formal_typist", handle: "formal_typist" }),
  upsertSupabaseProfile: vi.fn()
}));

vi.mock("@/lib/friendStorage", () => ({
  listAcceptedFriends: vi.fn().mockResolvedValue([]),
  listIncomingFriendRequests: vi.fn().mockResolvedValue([]),
  listOutgoingFriendRequests: vi.fn().mockResolvedValue([])
}));

vi.mock("@/lib/typingResultStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/typingResultStorage")>("@/lib/typingResultStorage");

  return {
    ...actual,
    getSupabaseOwnTypingResults: vi.fn().mockResolvedValue([])
  };
});

describe("profile subpages", () => {
  const mockedGetSupabaseProfile = vi.mocked(getSupabaseProfile);

  beforeEach(() => {
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockState.routerPush.mockClear();
    mockedGetSupabaseProfile.mockResolvedValue({ display_name: "formal_typist", handle: "formal_typist" } as any);
  });

  it("renders account settings route", async () => {
    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText("Profile Settings")).toBeTruthy();
    });
  });

  it("points public profile compatibility route back to profile identity", async () => {
    render(<PublicProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Public profile moved")).toBeTruthy();
    });
    expect(screen.getByRole("link", { name: "Go to Profile Identity" }).getAttribute("href")).toBe("/profile");
    expect(screen.queryByRole("button", { name: /copy/i })).toBeNull();
  });

  it("renders friends compact empty state", async () => {
    render(<FriendsPage />);

    await waitFor(() => {
      expect(screen.getByText("No friends yet.")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Add friend" })).toBeTruthy();
    expect(screen.queryByText("No incoming requests.")).toBeNull();
    expect(screen.queryByText("No outgoing requests.")).toBeNull();
  });
});
