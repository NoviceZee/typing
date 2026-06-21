/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountPage from "../pages/profile/account";
import { getSupabaseProfile, upsertSupabaseProfile } from "@/lib/profileStorage";

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
    asPath: "/profile/account"
  })
}));

vi.mock("@/lib/profileStorage", () => ({
  getSupabaseProfile: vi.fn().mockResolvedValue({ display_name: "Formal Typist" }),
  upsertSupabaseProfile: vi.fn().mockResolvedValue({ display_name: "Updated Typist" })
}));

const mockedGetSupabaseProfile = vi.mocked(getSupabaseProfile);
const mockedUpsertSupabaseProfile = vi.mocked(upsertSupabaseProfile);

describe("Profile account page", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockState.isLoading = false;
    mockState.isConfigured = true;
    mockState.routerPush.mockClear();
    mockedGetSupabaseProfile.mockClear();
    mockedUpsertSupabaseProfile.mockClear();
  });

  it("renders simplified account settings without results", async () => {
    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Formal Typist")).toBeTruthy();
    });

    expect(mockedGetSupabaseProfile).toHaveBeenCalledWith("user-1");
    expect(screen.getByText("Profile Settings")).toBeTruthy();
    expect(screen.getByText("This public name appears on leaderboard rows. Your email stays private.")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("typist@example.com")).toBeTruthy();
    expect(screen.getByText("Username and handle setup will be added later.")).toBeTruthy();
    expect(screen.queryByText("My Results")).toBeNull();
    expect(screen.queryByText("Typing rules")).toBeNull();
  });

  it("saves display name from account settings", async () => {
    render(<AccountPage />);

    const input = await screen.findByDisplayValue("Formal Typist");
    fireEvent.change(input, { target: { value: "Updated Typist" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));

    await waitFor(() => {
      expect(mockedUpsertSupabaseProfile).toHaveBeenCalledWith("user-1", "Updated Typist");
    });
    expect(screen.getByText("Display name saved.")).toBeTruthy();
  });

  it("redirects logged-out users to login", async () => {
    mockState.user = null;

    render(<AccountPage />);

    await waitFor(() => {
      expect(mockState.routerPush).toHaveBeenCalledWith("/login?redirectTo=/profile/account");
    });
    expect(mockedGetSupabaseProfile).not.toHaveBeenCalled();
  });
});
