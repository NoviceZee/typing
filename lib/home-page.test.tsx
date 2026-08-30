/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/pages/index";

const mockState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isLoading: false,
  routerReplace: vi.fn(),
  routerPush: vi.fn()
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: mockState.user, isLoading: mockState.isLoading })
}));

vi.mock("next/router", () => ({
  useRouter: () => ({ replace: mockState.routerReplace, push: mockState.routerPush })
}));

describe("Home authentication routing", () => {
  beforeEach(() => {
    mockState.user = null;
    mockState.isLoading = false;
    mockState.routerReplace.mockReset();
    mockState.routerPush.mockReset();
  });

  it("keeps the landing page at the root for logged-out visitors", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: /Type with purpose/i })).toBeTruthy();
    expect(screen.getByText(/English and Chinese typing practice/i)).toBeTruthy();
    expect(screen.getByText(/英文及中文打字練習/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Typing Station" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Typing practice" }).getAttribute("href")).toBe("/practice");
    expect(screen.getByRole("link", { name: "Typing training" }).getAttribute("href")).toBe("/training");
    expect(screen.getByRole("link", { name: "Passage library" }).getAttribute("href")).toBe("/passages");
    expect(screen.getByRole("link", { name: "Typing leaderboard" }).getAttribute("href")).toBe("/leaderboard");
    expect(mockState.routerReplace).not.toHaveBeenCalled();
  });

  it("keeps the landing page at the root when an authenticated session resolves", async () => {
    mockState.isLoading = true;
    const { rerender } = render(<Home />);

    mockState.user = { id: "user-1" };
    mockState.isLoading = false;
    rerender(<Home />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Type with purpose/i })).toBeTruthy();
    });
    expect(mockState.routerReplace).not.toHaveBeenCalled();
    expect(mockState.routerPush).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
    expect(screen.getByRole("link", { name: "Profile" }).getAttribute("href")).toBe("/profile");
    expect(screen.getByRole("link", { name: /Continue practicing/i }).getAttribute("href")).toBe("/practice");
  });
});
