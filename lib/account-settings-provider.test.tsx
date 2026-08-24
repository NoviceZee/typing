/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccountSettingsProvider,
  useAccountSettings,
  useOptionalAccountSettings
} from "@/components/AccountSettingsProvider";
import {
  createDefaultAccountSettings,
  readLocalAccountSettings,
  supabaseAccountSettingsRepository
} from "@/lib/accountSettings";

const authState = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  isLoading: false
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => authState
}));

function Probe() {
  const { settings, syncState, updateSettings } = useAccountSettings();
  return (
    <div>
      <span data-testid="theme-preset">{settings.appearance.themePreset}</span>
      <span data-testid="caret-style">{settings.appearance.caretStyle}</span>
      <span data-testid="sync-state">{syncState}</span>
      <button
        type="button"
        onClick={() => void updateSettings((current) => ({
          ...current,
          appearance: { ...current.appearance, themePreset: "paper" }
        }))}
      >
        Save Paper
      </button>
      <button
        type="button"
        onClick={() => void updateSettings((current) => ({
          ...current,
          appearance: { ...current.appearance, caretStyle: "block" }
        }))}
      >
        Save block caret
      </button>
    </div>
  );
}

function OptionalProbe() {
  const accountSettings = useOptionalAccountSettings();
  return (
    <span data-testid="optional-settings-state">
      {accountSettings ? accountSettings.settings.appearance.themePreset : "settings-unavailable"}
    </span>
  );
}

describe("AccountSettingsProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    authState.user = { id: "user-1" };
    authState.isLoading = false;
    vi.restoreAllMocks();
  });

  it("can render deterministic public children while auth and settings hydrate", () => {
    authState.user = null;
    authState.isLoading = true;

    render(
      <AccountSettingsProvider renderChildrenWhileHydrating>
        <OptionalProbe />
      </AccountSettingsProvider>
    );

    expect(screen.getByTestId("optional-settings-state").textContent).toBe("settings-unavailable");
  });

  it("waits for authenticated cloud hydration and applies cloud values", async () => {
    window.localStorage.setItem("formaltype.theme.v1", JSON.stringify({ themePreset: "paper" }));
    const cloud = createDefaultAccountSettings();
    cloud.appearance.themePreset = "dracula";
    vi.spyOn(supabaseAccountSettingsRepository, "load").mockResolvedValue(cloud);
    vi.spyOn(supabaseAccountSettingsRepository, "save").mockResolvedValue(undefined);

    render(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);

    expect(screen.queryByTestId("theme-preset")).toBeNull();
    expect((await screen.findByTestId("theme-preset")).textContent).toBe("dracula");
    expect(screen.getByTestId("sync-state").textContent).toBe("saved");
  });

  it("preserves the local UI value and exposes save_failed when cloud persistence fails", async () => {
    vi.spyOn(supabaseAccountSettingsRepository, "load").mockResolvedValue(createDefaultAccountSettings());
    vi.spyOn(supabaseAccountSettingsRepository, "save").mockRejectedValue(new Error("offline"));

    render(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);
    await screen.findByTestId("theme-preset");
    fireEvent.click(screen.getByRole("button", { name: "Save Paper" }));

    await waitFor(() => expect(screen.getByTestId("sync-state").textContent).toBe("save_failed"));
    expect(screen.getByTestId("theme-preset").textContent).toBe("paper");
  });

  it("reloads the same account values after logout and login", async () => {
    const cloud = createDefaultAccountSettings();
    cloud.appearance.themePreset = "system";
    vi.spyOn(supabaseAccountSettingsRepository, "load").mockResolvedValue(cloud);
    vi.spyOn(supabaseAccountSettingsRepository, "save").mockResolvedValue(undefined);

    const view = render(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);
    expect((await screen.findByTestId("theme-preset")).textContent).toBe("system");

    authState.user = null;
    view.rerender(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);
    await waitFor(() => expect(screen.getByTestId("sync-state").textContent).toBe("local_fallback"));

    authState.user = { id: "user-1" };
    view.rerender(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);
    await waitFor(() => expect(screen.getByTestId("sync-state").textContent).toBe("saved"));
    expect(screen.getByTestId("theme-preset").textContent).toBe("system");
  });

  it("merges rapid setting edits and serializes full-object cloud saves", async () => {
    vi.spyOn(supabaseAccountSettingsRepository, "load").mockResolvedValue(createDefaultAccountSettings());
    let releaseFirstSave!: () => void;
    const firstSave = new Promise<void>((resolve) => {
      releaseFirstSave = resolve;
    });
    const save = vi.spyOn(supabaseAccountSettingsRepository, "save")
      .mockImplementationOnce(() => firstSave)
      .mockResolvedValue(undefined);

    render(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);
    await screen.findByTestId("theme-preset");

    fireEvent.click(screen.getByRole("button", { name: "Save Paper" }));
    fireEvent.click(screen.getByRole("button", { name: "Save block caret" }));

    expect(screen.getByTestId("theme-preset").textContent).toBe("paper");
    expect(screen.getByTestId("caret-style").textContent).toBe("block");
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));

    releaseFirstSave();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1][1]).toEqual(expect.objectContaining({
      appearance: expect.objectContaining({ themePreset: "paper", caretStyle: "block" })
    }));
    await waitFor(() => expect(screen.getByTestId("sync-state").textContent).toBe("saved"));
  });

  it("withholds the previous account while the next account hydrates", async () => {
    const firstAccount = createDefaultAccountSettings();
    firstAccount.appearance.themePreset = "paper";
    const secondAccount = createDefaultAccountSettings();
    secondAccount.appearance.themePreset = "dracula";
    let releaseSecondHydration!: (value: typeof secondAccount) => void;
    const secondHydration = new Promise<typeof secondAccount>((resolve) => {
      releaseSecondHydration = resolve;
    });
    vi.spyOn(supabaseAccountSettingsRepository, "load").mockImplementation(async (userId) => {
      return userId === "user-1" ? firstAccount : secondHydration;
    });
    vi.spyOn(supabaseAccountSettingsRepository, "save").mockResolvedValue(undefined);

    const view = render(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);
    expect((await screen.findByTestId("theme-preset")).textContent).toBe("paper");

    authState.user = { id: "user-2" };
    view.rerender(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);
    expect(screen.queryByTestId("theme-preset")).toBeNull();

    releaseSecondHydration(secondAccount);
    expect((await screen.findByTestId("theme-preset")).textContent).toBe("dracula");
  });

  it("does not use another account's browser settings when cloud hydration fails", async () => {
    window.localStorage.setItem("formaltype.theme.v1", JSON.stringify({ themePreset: "paper" }));
    vi.spyOn(supabaseAccountSettingsRepository, "load").mockRejectedValue(new Error("offline"));

    render(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);

    expect((await screen.findByTestId("theme-preset")).textContent).toBe("default-dark");
    expect(screen.getByTestId("sync-state").textContent).toBe("save_failed");
  });

  it("does not let a previous account's pending save block or settle the next account", async () => {
    const firstAccount = createDefaultAccountSettings();
    const secondAccount = createDefaultAccountSettings();
    let releaseFirstSave!: () => void;
    const firstSave = new Promise<void>((resolve) => {
      releaseFirstSave = resolve;
    });
    vi.spyOn(supabaseAccountSettingsRepository, "load").mockImplementation(async () => (
      authState.user?.id === "user-1" ? firstAccount : secondAccount
    ));
    const save = vi.spyOn(supabaseAccountSettingsRepository, "save")
      .mockImplementationOnce(() => firstSave)
      .mockResolvedValue(undefined);

    const view = render(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);
    await screen.findByTestId("theme-preset");
    fireEvent.click(screen.getByRole("button", { name: "Save Paper" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith("user-1", expect.anything()));

    authState.user = { id: "user-2" };
    view.rerender(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);
    await screen.findByTestId("theme-preset");
    fireEvent.click(screen.getByRole("button", { name: "Save block caret" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith("user-2", expect.anything()));
    expect(screen.getByTestId("caret-style").textContent).toBe("block");

    releaseFirstSave();
    await waitFor(() => expect(screen.getByTestId("sync-state").textContent).toBe("saved"));
    expect(screen.getByTestId("caret-style").textContent).toBe("block");
  });

  it("does not let stale hydration overwrite the current account's browser settings", async () => {
    const firstAccount = createDefaultAccountSettings();
    firstAccount.appearance.themePreset = "paper";
    const secondAccount = createDefaultAccountSettings();
    secondAccount.appearance.themePreset = "dracula";
    secondAccount.appearance.caretStyle = "underline";
    let releaseFirstHydration!: (value: typeof firstAccount) => void;
    const firstHydration = new Promise<typeof firstAccount>((resolve) => {
      releaseFirstHydration = resolve;
    });
    vi.spyOn(supabaseAccountSettingsRepository, "load").mockImplementation((userId) =>
      userId === "user-1" ? firstHydration : Promise.resolve(secondAccount)
    );

    const view = render(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);
    authState.user = { id: "user-2" };
    view.rerender(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);
    expect((await screen.findByTestId("caret-style")).textContent).toBe("underline");

    await act(async () => {
      releaseFirstHydration(firstAccount);
      await Promise.resolve();
    });

    expect(readLocalAccountSettings().appearance).toEqual(expect.objectContaining({
      themePreset: "dracula",
      caretStyle: "underline"
    }));
  });
});
