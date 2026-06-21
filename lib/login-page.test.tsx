/**
 * @vitest-environment jsdom
 */
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "../pages/login";
import { getSupabaseProfile } from "@/lib/profileStorage";

const mockState = vi.hoisted(() => ({
  user: { id: "user-1", email: "typist@example.com" } as { id: string; email: string } | null,
  isLoading: false,
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
    isConfigured: true,
    signIn: vi.fn(),
    signUp: vi.fn()
  })
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    replace: mockState.routerReplace,
    push: vi.fn(),
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
});
