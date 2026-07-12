/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountPage from "../pages/profile/account";
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
    asPath: "/profile/account"
  })
}));

vi.mock("@/lib/profileStorage", () => ({
  getSupabaseProfile: vi.fn().mockResolvedValue({ display_name: "Formal Typist", handle: "formal_typist" })
}));

const mockedGetSupabaseProfile = vi.mocked(getSupabaseProfile);

describe("Profile account page", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockState.isLoading = false;
    mockState.isConfigured = true;
    mockState.routerPush.mockClear();
    mockedGetSupabaseProfile.mockClear();
  });

  it("renders working identity, security and deletion controls", async () => {
    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText("@formal_typist")).toBeTruthy();
    });

    expect(mockedGetSupabaseProfile).toHaveBeenCalledWith("user-1");
    expect(screen.getByText("Identity")).toBeTruthy();
    expect(screen.getByText("Security")).toBeTruthy();
    expect(screen.getByText("Delete account")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("typist@example.com")).toBeTruthy();
    expect(screen.getByText("Handle")).toBeTruthy();
    expect(screen.getByText("@formal_typist")).toBeTruthy();
    expect(screen.getByLabelText("Display name")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save name" })).toBeTruthy();
    expect(screen.getByLabelText("New password")).toBeTruthy();
    expect(screen.getByLabelText("Delete confirmation")).toBeTruthy();
    expect(screen.queryByText("My Results")).toBeNull();
    expect(screen.queryByText("Typing rules")).toBeNull();
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
