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
  routerReplace: vi.fn()
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: mockState.user, isLoading: mockState.isLoading })
}));

vi.mock("next/router", () => ({
  useRouter: () => ({ replace: mockState.routerReplace })
}));

describe("Home authentication routing", () => {
  beforeEach(() => {
    mockState.user = null;
    mockState.isLoading = false;
    mockState.routerReplace.mockReset();
  });

  it("keeps the landing page at the root for logged-out visitors", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: /Type with purpose/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Typing Station" }).getAttribute("href")).toBe("/");
    expect(mockState.routerReplace).not.toHaveBeenCalled();
  });

  it("redirects logged-in visitors from the root to Practice", async () => {
    mockState.user = { id: "user-1" };
    render(<Home />);

    await waitFor(() => expect(mockState.routerReplace).toHaveBeenCalledWith("/practice"));
    expect(screen.queryByRole("heading", { name: /Type with purpose/i })).toBeNull();
  });
});
