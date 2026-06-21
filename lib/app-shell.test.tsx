/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/AppShell";
import { getSupabaseProfile } from "@/lib/profileStorage";

const mockState = vi.hoisted(() => ({
  user: { id: "user-1", email: "typist@example.com" } as { id: string; email: string } | null,
  isLoading: false,
  signOut: vi.fn(),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  pathname: "/practice",
  asPath: "/practice"
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: mockState.user,
    isLoading: mockState.isLoading,
    signOut: mockState.signOut
  })
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    pathname: mockState.pathname,
    asPath: mockState.asPath,
    push: mockState.routerPush,
    replace: mockState.routerReplace
  })
}));

vi.mock("@/lib/profileStorage", () => ({
  getProfileDisplayLabel: (profile: { display_name: string; handle: string | null } | null) =>
    profile?.handle ? `@${profile.handle}` : profile?.display_name || "Account",
  getSupabaseProfile: vi.fn().mockResolvedValue({ display_name: "Formal Typist", handle: "formal_typist" })
}));

const mockedGetSupabaseProfile = vi.mocked(getSupabaseProfile);

describe("AppShell account dropdown", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockState.isLoading = false;
    mockState.signOut.mockReset();
    mockState.routerPush.mockReset();
    mockState.routerReplace.mockReset();
    mockState.pathname = "/practice";
    mockState.asPath = "/practice";
    mockedGetSupabaseProfile.mockClear();
    mockedGetSupabaseProfile.mockResolvedValue({ display_name: "Formal Typist", handle: "formal_typist" } as any);
  });

  it("shows an authenticated account dropdown with profile links", async () => {
    render(<AppShell sideAd={false}>Content</AppShell>);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /account menu/i }).textContent).toContain("@formal_typist");
    });

    expect(screen.queryByRole("link", { name: "Profile" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));

    expect(screen.getByRole("menuitem", { name: "User stats" }).getAttribute("href")).toBe("/profile");
    expect(screen.getByRole("menuitem", { name: "Friends" }).getAttribute("href")).toBe("/profile/friends");
    expect(screen.getByRole("menuitem", { name: "Public profile" }).getAttribute("href")).toBe("/profile/public");
    expect(screen.getByRole("menuitem", { name: "Account settings" }).getAttribute("href")).toBe("/profile/account");

    const userStatsLink = screen.getByRole("menuitem", { name: "User stats" });
    userStatsLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(userStatsLink);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("falls back to display name and closes on Escape", async () => {
    mockedGetSupabaseProfile.mockResolvedValue({ display_name: "Formal Typist", handle: null } as any);

    render(<AppShell sideAd={false}>Content</AppShell>);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /account menu/i }).textContent).toContain("Formal Typist");
    });

    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByRole("menu")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("does not render email while the display name is still loading", () => {
    mockedGetSupabaseProfile.mockReturnValue(new Promise(() => {}) as any);

    render(<AppShell sideAd={false}>Content</AppShell>);

    const accountButton = screen.getByRole("button", { name: /account menu/i });
    expect(accountButton.textContent).not.toContain("typist@example.com");
    expect(accountButton.textContent).toContain("Account");
  });

  it("redirects authenticated users without handles to handle onboarding", async () => {
    mockedGetSupabaseProfile.mockResolvedValue({ display_name: "Formal Typist", handle: null } as any);
    mockState.asPath = "/leaderboard";
    mockState.pathname = "/leaderboard";

    render(<AppShell sideAd={false}>Content</AppShell>);

    await waitFor(() => {
      expect(mockState.routerReplace).toHaveBeenCalledWith("/onboarding/handle?redirectTo=%2Fleaderboard");
    });
  });

  it("allows authenticated users with handles to access normal pages", async () => {
    render(<AppShell sideAd={false}>Content</AppShell>);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /account menu/i }).textContent).toContain("@formal_typist");
    });
    expect(mockState.routerReplace).not.toHaveBeenCalled();
  });

  it("does not show the account dropdown for logged-out users", () => {
    mockState.user = null;

    render(<AppShell sideAd={false}>Content</AppShell>);

    expect(screen.queryByRole("button", { name: /account menu/i })).toBeNull();
    expect(screen.getByRole("link", { name: /login/i })).toBeTruthy();
  });
});
