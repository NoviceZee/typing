/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountPage from "../pages/profile/account";
import { getSupabaseProfile } from "@/lib/profileStorage";
import { updateCurrentUserPassword } from "@/lib/accountStorage";

const mockState = vi.hoisted(() => ({
  user: { id: "user-1", email: "typist@example.com" } as { id: string; email: string } | null,
  isLoading: false,
  isConfigured: true,
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  query: {} as Record<string, string>,
  signOut: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: mockState.user,
    isLoading: mockState.isLoading,
    isConfigured: mockState.isConfigured,
    signOut: mockState.signOut
  })
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    push: mockState.routerPush,
    replace: mockState.routerReplace,
    asPath: "/profile/account",
    query: mockState.query,
    isReady: true
  })
}));

vi.mock("@/lib/profileStorage", () => ({
  getSupabaseProfile: vi.fn().mockResolvedValue({ display_name: "Formal Typist", handle: "formal_typist" })
}));

vi.mock("@/lib/accountStorage", () => ({
  updateCurrentUserPassword: vi.fn().mockResolvedValue(undefined),
  deleteCurrentUserAccount: vi.fn(),
  deleteCurrentUserStats: vi.fn()
}));

const mockedGetSupabaseProfile = vi.mocked(getSupabaseProfile);
const mockedUpdatePassword = vi.mocked(updateCurrentUserPassword);

describe("Profile account page", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1", email: "typist@example.com" };
    mockState.isLoading = false;
    mockState.isConfigured = true;
    mockState.routerPush.mockClear();
    mockState.routerReplace.mockClear();
    mockState.query = {};
    mockState.signOut.mockClear();
    mockedGetSupabaseProfile.mockClear();
    mockedUpdatePassword.mockClear();
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

  it("uses a dedicated recovery form and signs out after setting the new password", async () => {
    mockState.query = { recovery: "1" };

    render(<AccountPage />);

    expect(screen.getByRole("heading", { name: "Set a new password" })).toBeTruthy();
    expect(screen.queryByText("Delete account")).toBeNull();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-secure-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "new-secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => expect(mockedUpdatePassword).toHaveBeenCalledWith("new-secure-password"));
    expect(mockState.signOut).toHaveBeenCalledTimes(1);
    expect(mockState.routerReplace).toHaveBeenCalledWith("/login?passwordReset=1");
  });

  it("does not redirect an expired recovery callback into the ordinary login flow", () => {
    mockState.user = null;
    mockState.query = { recovery: "1" };

    render(<AccountPage />);

    expect(screen.getByRole("alert").textContent).toContain("invalid or has expired");
    expect(screen.getByRole("link", { name: "Request a new link" }).getAttribute("href")).toBe("/login?mode=recovery");
    expect(mockState.routerPush).not.toHaveBeenCalled();
  });

  it("does not claim notification preferences were saved when device storage rejects the write", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<AccountPage />);
    await waitFor(() => expect(screen.getByText("@formal_typist")).toBeTruthy());
    const storageSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("Storage full", "QuotaExceededError");
    });

    const weeklySummary = screen.getByRole("checkbox", { name: /Weekly summary/ }) as HTMLInputElement;
    fireEvent.click(weeklySummary);

    expect(screen.getByRole("alert").textContent).toContain("could not be saved on this device");
    expect(weeklySummary.checked).toBe(false);
    storageSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
