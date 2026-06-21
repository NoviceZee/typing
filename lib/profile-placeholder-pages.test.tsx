/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountPage from "../pages/profile/account";
import FriendsPage from "../pages/profile/friends";
import PublicProfilePage from "../pages/profile/public";

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
  getSupabaseProfile: vi.fn().mockResolvedValue(null),
  upsertSupabaseProfile: vi.fn()
}));

vi.mock("@/lib/typingResultStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/typingResultStorage")>("@/lib/typingResultStorage");

  return {
    ...actual,
    getSupabaseOwnTypingResults: vi.fn().mockResolvedValue([])
  };
});

describe("profile subpages", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockState.routerPush.mockClear();
  });

  it("renders account settings route", async () => {
    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText("Profile Settings")).toBeTruthy();
    });
  });

  it("renders public profile placeholder", () => {
    render(<PublicProfilePage />);

    expect(screen.getByText("Public profile")).toBeTruthy();
    expect(screen.getByText("Public profiles will be available later.")).toBeTruthy();
  });

  it("renders friends placeholder", () => {
    render(<FriendsPage />);

    expect(screen.getByText("Friends")).toBeTruthy();
    expect(screen.getByText("Friends leaderboard will be available later.")).toBeTruthy();
  });
});
