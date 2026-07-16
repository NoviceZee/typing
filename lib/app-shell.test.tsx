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
  isAdmin: false,
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
    isAdmin: mockState.isAdmin,
    signOut: mockState.signOut
  })
}));

vi.mock("@/components/NotificationCenter", () => ({
  NotificationCenter: () => null
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
    profile?.handle ? `@${profile.handle}` : "Account",
  getSupabaseProfile: vi.fn().mockResolvedValue({ display_name: "Formal Typist", handle: "formal_typist" })
}));

const mockedGetSupabaseProfile = vi.mocked(getSupabaseProfile);

describe("AppShell account dropdown", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockState.isLoading = false;
    mockState.isAdmin = false;
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

    expect(screen.getByRole("menuitem", { name: "Profile & stats" }).getAttribute("href")).toBe("/profile");
    expect(screen.getByRole("menuitem", { name: "Friends" }).getAttribute("href")).toBe("/profile/friends");
    expect(screen.getByRole("menuitem", { name: "Public profile" }).getAttribute("href")).toBe("/u/formal_typist");
    expect(screen.getByRole("menuitem", { name: "Account settings" }).getAttribute("href")).toBe("/profile/account");

    const userStatsLink = screen.getByRole("menuitem", { name: "Profile & stats" });
    userStatsLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(userStatsLink);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("shows Settings in the main navbar for logged-in users", async () => {
    render(<AppShell sideAd={false}>Content</AppShell>);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /account menu/i }).textContent).toContain("@formal_typist");
    });
    expect(screen.getByRole("navigation").querySelector('a[href="/settings"]')?.textContent).toBe("Settings");
    expect(screen.getByRole("navigation").querySelector('a[href="/passages/manage"]')).toBeNull();
  });

  it("keeps feedback with the footer links instead of overlaying page content", async () => {
    render(<AppShell sideAd={false}>Content</AppShell>);

    await waitFor(() => expect(screen.getByRole("button", { name: /account menu/i })).toBeTruthy());
    const footerLinks = screen.getByLabelText("Footer links");
    const feedback = screen.getByRole("link", { name: "Feedback" });

    expect(footerLinks.contains(feedback)).toBe(true);
    expect(screen.getByRole("link", { name: "FAQ" }).getAttribute("href")).toBe("/faq");
    expect(feedback.getAttribute("href")).toBe("https://github.com/NoviceZee/typing/issues/new");
  });

  it("keeps library management in the admin account menu", async () => {
    mockState.isAdmin = true;

    render(<AppShell sideAd={false}>Content</AppShell>);

    await waitFor(() => expect(screen.getByRole("button", { name: /account menu/i })).toBeTruthy());
    expect(screen.getByRole("navigation", { name: "Primary navigation" }).querySelector('a[href="/passages/manage"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByRole("menuitem", { name: "Manage library" }).getAttribute("href")).toBe("/passages/manage");
  });

  it("hides Manage passages while a switched account role is loading", () => {
    mockState.isAdmin = true;
    mockState.isLoading = true;
    mockedGetSupabaseProfile.mockReturnValue(new Promise(() => {}) as any);

    render(<AppShell sideAd={false}>Content</AppShell>);

    expect(screen.getByRole("navigation", { name: "Primary navigation" }).querySelector('a[href="/passages/manage"]')).toBeNull();
  });

  it("does not use display name as an account label fallback and closes on Escape", async () => {
    mockedGetSupabaseProfile.mockResolvedValue({ display_name: "Formal Typist", handle: null } as any);

    render(<AppShell sideAd={false}>Content</AppShell>);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /account menu/i }).textContent).toContain("Account");
    });
    expect(screen.getByRole("button", { name: /account menu/i }).textContent).not.toContain("Formal Typist");

    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByRole("menu")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("routes public profile menu item to profile hub when no handle exists", async () => {
    mockedGetSupabaseProfile.mockResolvedValue({ display_name: "Formal Typist", handle: null } as any);
    mockState.pathname = "/onboarding/handle";
    mockState.asPath = "/onboarding/handle";

    render(<AppShell sideAd={false}>Content</AppShell>);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /account menu/i }).textContent).toContain("Account");
    });
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));

    expect(screen.getByRole("menuitem", { name: "Public profile" }).getAttribute("href")).toBe("/profile");
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

  it("shows Settings in the main navbar for logged-out users", () => {
    mockState.user = null;

    render(<AppShell sideAd={false}>Content</AppShell>);

    expect(screen.getByRole("navigation").querySelector('a[href="/settings"]')?.textContent).toBe("Settings");
  });

  it("shows Training in the main navbar", () => {
    mockState.user = null;

    render(<AppShell sideAd={false}>Content</AppShell>);

    expect(screen.getByRole("navigation").querySelector('a[href="/training"]')?.textContent).toBe("Training");
  });

  it("uses Library as the passage information architecture label", () => {
    mockState.user = null;
    render(<AppShell sideAd={false}>Content</AppShell>);

    expect(screen.getByRole("link", { name: "Library" }).getAttribute("href")).toBe("/passages");
    expect(screen.queryByRole("link", { name: "Passages" })).toBeNull();
  });

  it("provides a skip link and an accessible mobile navigation", () => {
    mockState.user = null;
    render(<AppShell sideAd={false}>Content</AppShell>);

    expect(screen.getByRole("link", { name: "Skip to main content" }).getAttribute("href")).toBe("#main-content");
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("main").id).toBe("main-content");
    const menuButton = screen.getByRole("button", { name: "Open navigation" });
    expect(menuButton.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(menuButton);
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close navigation" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).toBeNull();
  });

  it("marks Settings as active on the settings route", () => {
    mockState.user = null;
    mockState.pathname = "/settings";
    mockState.asPath = "/settings";

    render(<AppShell sideAd={false}>Content</AppShell>);

    const settingsLink = screen.getByRole("navigation").querySelector('a[href="/settings"]');
    expect(settingsLink?.className).toContain("bg-paper text-ink-950");
    expect(settingsLink?.getAttribute("aria-current")).toBe("page");
  });
});
