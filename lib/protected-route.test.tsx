/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const mockState = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  isLoading: false,
  isAdmin: false,
  replace: vi.fn()
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: mockState.user,
    isLoading: mockState.isLoading,
    isAdmin: mockState.isAdmin
  })
}));

vi.mock("next/router", () => ({
  useRouter: () => ({ asPath: "/passages/manage", replace: mockState.replace })
}));

describe("ProtectedRoute admin authorization", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1" };
    mockState.isLoading = false;
    mockState.isAdmin = false;
    mockState.replace.mockReset();
  });

  it("denies a signed-in non-admin", () => {
    render(<ProtectedRoute>Admin content</ProtectedRoute>);

    expect(screen.getByText("Admin access required")).toBeTruthy();
    expect(screen.queryByText("Admin content")).toBeNull();
    expect(mockState.replace).not.toHaveBeenCalled();
  });

  it("renders protected content for an admin", () => {
    mockState.isAdmin = true;

    render(<ProtectedRoute>Admin content</ProtectedRoute>);

    expect(screen.getByText("Admin content")).toBeTruthy();
  });

  it("redirects a logged-out visitor to login", async () => {
    mockState.user = null;

    render(<ProtectedRoute>Admin content</ProtectedRoute>);

    await waitFor(() => {
      expect(mockState.replace).toHaveBeenCalledWith("/login?redirectTo=%2Fpassages%2Fmanage");
    });
    expect(screen.queryByText("Admin content")).toBeNull();
  });
});
