/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "../pages/login";
import { getSupabaseProfile } from "@/lib/profileStorage";

const mockState = vi.hoisted(() => ({
  user: { id: "user-1", email: "typist@example.com" } as { id: string; email: string } | null,
  isLoading: false,
  routerReplace: vi.fn(),
  routerPush: vi.fn(),
  sendPasswordReset: vi.fn().mockResolvedValue({}),
  query: { redirectTo: "/leaderboard" } as Record<string, string>
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: mockState.user,
    isLoading: mockState.isLoading,
    isConfigured: true,
    signIn: vi.fn(),
    signUp: vi.fn(),
    sendPasswordReset: mockState.sendPasswordReset
  })
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    replace: mockState.routerReplace,
    push: mockState.routerPush,
    query: mockState.query
  })
}));

vi.mock("@/lib/profileStorage", () => ({
  getSupabaseProfile: vi.fn().mockResolvedValue({ display_name: "Formal Typist", handle: null })
}));

const mockedGetSupabaseProfile = vi.mocked(getSupabaseProfile);

describe("LoginPage handle redirects", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockState.isLoading = false;
    mockState.query = { redirectTo: "/leaderboard" };
    mockState.routerReplace.mockClear();
    mockState.routerPush.mockClear();
    mockState.sendPasswordReset.mockClear();
    mockedGetSupabaseProfile.mockClear();
    mockedGetSupabaseProfile.mockResolvedValue({ display_name: "Formal Typist", handle: null } as any);
  });

  it("redirects authenticated users without handles to handle onboarding after login", async () => {
    render(<LoginPage />);

    await waitFor(() => {
      expect(mockState.routerReplace).toHaveBeenCalledWith("/onboarding/handle?redirectTo=%2Fleaderboard");
    });
  });

  it("sends authenticated users with handles to the intended page", async () => {
    mockedGetSupabaseProfile.mockResolvedValue({ display_name: "Formal Typist", handle: "formal_typist" } as any);

    render(<LoginPage />);

    await waitFor(() => {
      expect(mockState.routerReplace).toHaveBeenCalledWith("/leaderboard");
    });
  });

  it("offers password recovery without requiring a password", async () => {
    mockState.user = null;
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
      target: { value: "typist@example.com" }
    });
    expect(screen.queryByLabelText("Password")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => {
      expect(mockState.sendPasswordReset).toHaveBeenCalledWith("typist@example.com");
    });
    expect(screen.getByText(/If an account exists/)).toBeTruthy();
  });

  it("opens recovery mode from an expired-link action", () => {
    mockState.user = null;
    mockState.query = { mode: "recovery" };

    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: "Reset password" })).toBeTruthy();
    expect(screen.queryByLabelText("Password")).toBeNull();
  });

  it("confirms a completed password reset on the login screen", () => {
    mockState.user = null;
    mockState.query = { passwordReset: "1" };

    render(<LoginPage />);

    expect(screen.getByText("Password updated. Log in with your new password.")).toBeTruthy();
  });

  it("announces reset delivery failures as errors", async () => {
    mockState.user = null;
    mockState.sendPasswordReset.mockResolvedValueOnce({ errorMessage: "Too many recovery emails have been requested." });

    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "typist@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Too many recovery emails"));
  });

  it("recovers from a thrown network error instead of leaving the form busy", async () => {
    mockState.user = null;
    mockState.sendPasswordReset.mockRejectedValueOnce(new TypeError("Network request failed"));

    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "typist@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Check your connection and try again");
    });
    expect((screen.getByRole("button", { name: "Send reset link" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
