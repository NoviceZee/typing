/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountPage from "../pages/profile/account";
import { changeSupabaseProfileHandle, getSupabaseProfile, updateSupabaseProfileDisplayName } from "@/lib/profileStorage";
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
  getSupabaseProfile: vi.fn().mockResolvedValue({ display_name: "Formal Typist", handle: "formal_typist", handle_changed_at: null }),
  updateSupabaseProfileDisplayName: vi.fn().mockResolvedValue({ display_name: "Updated Typist", handle: "formal_typist", handle_changed_at: null }),
  changeSupabaseProfileHandle: vi.fn().mockResolvedValue({ display_name: "Formal Typist", handle: "updated_typist", handle_changed_at: "2026-07-14T00:00:00.000Z" }),
  canChangeHandle: vi.fn((changedAt?: string | null) => !changedAt),
  getNextHandleChangeAt: vi.fn((changedAt?: string | null) => changedAt ? new Date("2026-08-13T00:00:00.000Z") : null)
}));

vi.mock("@/lib/accountStorage", () => ({
  updateCurrentUserPassword: vi.fn().mockResolvedValue(undefined),
  deleteCurrentUserAccount: vi.fn(),
  deleteCurrentUserStats: vi.fn()
}));

const mockedGetSupabaseProfile = vi.mocked(getSupabaseProfile);
const mockedUpdatePassword = vi.mocked(updateCurrentUserPassword);
const mockedUpdateDisplayName = vi.mocked(updateSupabaseProfileDisplayName);
const mockedChangeHandle = vi.mocked(changeSupabaseProfileHandle);

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
    mockedUpdateDisplayName.mockClear();
    mockedChangeHandle.mockClear();
    mockedGetSupabaseProfile.mockResolvedValue({ display_name: "Formal Typist", handle: "formal_typist", handle_changed_at: null } as any);
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
    expect(screen.getByText("Public handle")).toBeTruthy();
    expect(screen.getByText("@formal_typist")).toBeTruthy();
    expect(screen.queryByLabelText("Display name")).toBeNull();
    expect(screen.getByRole("button", { name: "Change display name" })).toBeTruthy();
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(screen.getByRole("button", { name: "Change password" })).toBeTruthy();
    expect(screen.getByLabelText("Delete confirmation")).toBeTruthy();
    expect(screen.queryByText("My Results")).toBeNull();
    expect(screen.queryByText("Typing rules")).toBeNull();
  });

  it("edits identity in dialogs and applies the handle cooldown returned by the server", async () => {
    render(<AccountPage />);
    await waitFor(() => expect(screen.getByText("@formal_typist")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Change display name" }));
    expect(screen.getByRole("dialog", { name: "Change display name" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Updated Typist" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() => expect(mockedUpdateDisplayName).toHaveBeenCalledWith("user-1", "Updated Typist"));

    fireEvent.click(screen.getByRole("button", { name: "Change public handle" }));
    fireEvent.change(screen.getByLabelText("New handle"), { target: { value: "updated_typist" } });
    fireEvent.click(screen.getByRole("button", { name: "Save handle" }));
    await waitFor(() => expect(mockedChangeHandle).toHaveBeenCalledWith("updated_typist"));
    expect(screen.getByText("@updated_typist")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Change public handle" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("opens password fields only on request and lets Safari autofill be cleared", async () => {
    render(<AccountPage />);
    await waitFor(() => expect(screen.getByText("@formal_typist")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    const password = screen.getByLabelText("New password") as HTMLInputElement;
    const confirmation = screen.getByLabelText("Confirm password") as HTMLInputElement;
    expect(password.getAttribute("autocomplete")).toBe("new-password");

    password.value = "safari-generated-password";
    confirmation.value = "safari-generated-password";
    fireEvent.click(screen.getByRole("button", { name: "Clear fields" }));
    expect(password.value).toBe("");
    expect(confirmation.value).toBe("");

    fireEvent.change(password, { target: { value: "my-manual-password" } });
    fireEvent.change(confirmation, { target: { value: "my-manual-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() => expect(mockedUpdatePassword).toHaveBeenCalledWith("my-manual-password"));
  });

  it("keeps server errors visible inside the open account dialog", async () => {
    mockedChangeHandle.mockRejectedValueOnce(new Error("Your handle can only be changed once every 30 days."));
    render(<AccountPage />);
    await waitFor(() => expect(screen.getByText("@formal_typist")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Change public handle" }));
    fireEvent.change(screen.getByLabelText("New handle"), { target: { value: "another_handle" } });
    fireEvent.click(screen.getByRole("button", { name: "Save handle" }));

    const dialog = screen.getByRole("dialog", { name: "Change handle" });
    await waitFor(() => expect(dialog.querySelector('[role="alert"]')?.textContent).toContain("once every 30 days"));
    expect(screen.getByRole("dialog", { name: "Change handle" })).toBeTruthy();
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
