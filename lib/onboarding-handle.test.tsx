/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HandleOnboardingPage from "../pages/onboarding/handle";
import { getSupabaseProfile, setSupabaseProfileHandle } from "@/lib/profileStorage";

const mockState = vi.hoisted(() => ({
  user: { id: "user-1", email: "typist@example.com" } as { id: string; email: string } | null,
  isLoading: false,
  isConfigured: true,
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  query: { redirectTo: "/leaderboard" } as Record<string, string>
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
    replace: mockState.routerReplace,
    query: mockState.query,
    asPath: "/onboarding/handle?redirectTo=/leaderboard",
    pathname: "/onboarding/handle"
  })
}));

vi.mock("@/lib/profileStorage", () => ({
  getSupabaseProfile: vi.fn().mockResolvedValue({ display_name: "Formal Typist", handle: null }),
  setSupabaseProfileHandle: vi.fn().mockResolvedValue({
    user_id: "user-1",
    display_name: "Formal Typist",
    handle: "formal_typist"
  }),
  validateHandle: (handle: string) => {
    const clean = handle.trim().toLowerCase();
    if (clean.length < 3 || clean.length > 20) return { isValid: false, message: "Handle must be 3-20 characters." };
    if (!/^[a-z0-9_]+$/.test(clean)) return { isValid: false, message: "Use letters, numbers, and underscores only." };
    return { isValid: true, handle: clean };
  }
}));

const mockedGetSupabaseProfile = vi.mocked(getSupabaseProfile);
const mockedSetSupabaseProfileHandle = vi.mocked(setSupabaseProfileHandle);

describe("HandleOnboardingPage", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockState.isLoading = false;
    mockState.isConfigured = true;
    mockState.query = { redirectTo: "/leaderboard" };
    mockState.routerPush.mockClear();
    mockState.routerReplace.mockClear();
    mockedGetSupabaseProfile.mockClear();
    mockedSetSupabaseProfileHandle.mockClear();
    mockedGetSupabaseProfile.mockResolvedValue({ display_name: "Formal Typist", handle: null } as any);
    mockedSetSupabaseProfileHandle.mockResolvedValue({
      user_id: "user-1",
      display_name: "Formal Typist",
      handle: "formal_typist"
    } as any);
  });

  it("saves a valid handle and redirects to the intended page", async () => {
    render(<HandleOnboardingPage />);

    const input = await screen.findByLabelText("Handle");
    await waitFor(() => {
      expect((input as HTMLInputElement).disabled).toBe(false);
    });
    fireEvent.change(input, { target: { value: "Formal_Typist" } });
    fireEvent.click(screen.getByRole("button", { name: "Save handle" }));

    await waitFor(() => {
      expect(mockedSetSupabaseProfileHandle).toHaveBeenCalledWith("user-1", "formal_typist");
    });
    expect(mockState.routerReplace).toHaveBeenCalledWith("/leaderboard");
  });

  it("shows duplicate handle errors without redirecting", async () => {
    mockedSetSupabaseProfileHandle.mockRejectedValue(new Error("That handle is already taken."));

    render(<HandleOnboardingPage />);

    const input = await screen.findByLabelText("Handle");
    await waitFor(() => {
      expect((input as HTMLInputElement).disabled).toBe(false);
    });
    fireEvent.change(input, { target: { value: "taken_handle" } });
    fireEvent.click(screen.getByRole("button", { name: "Save handle" }));

    await waitFor(() => {
      expect(screen.getByText("That handle is already taken.")).toBeTruthy();
    });
    expect(mockState.routerReplace).not.toHaveBeenCalledWith("/leaderboard");
  });

  it("redirects authenticated users who already have handles away from onboarding", async () => {
    mockedGetSupabaseProfile.mockResolvedValue({ display_name: "Formal Typist", handle: "formal_typist" } as any);

    render(<HandleOnboardingPage />);

    await waitFor(() => {
      expect(mockState.routerReplace).toHaveBeenCalledWith("/leaderboard");
    });
  });
});
