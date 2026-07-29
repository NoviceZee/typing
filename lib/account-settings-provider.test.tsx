/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccountSettingsProvider,
  useAccountSettings
} from "@/components/AccountSettingsProvider";
import {
  createDefaultAccountSettings,
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
      <span data-testid="mode">{settings.appearance.mode}</span>
      <span data-testid="caret-style">{settings.appearance.caretStyle}</span>
      <span data-testid="sync-state">{syncState}</span>
      <button
        type="button"
        onClick={() => void updateSettings((current) => ({
          ...current,
          appearance: { ...current.appearance, mode: "light" }
        }))}
      >
        Save light
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

describe("AccountSettingsProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    authState.user = { id: "user-1" };
    authState.isLoading = false;
    vi.restoreAllMocks();
  });

  it("waits for authenticated cloud hydration and applies cloud values", async () => {
    window.localStorage.setItem("formaltype.theme.v1", JSON.stringify({ mode: "light" }));
    const cloud = createDefaultAccountSettings();
    cloud.appearance.mode = "dark";
    vi.spyOn(supabaseAccountSettingsRepository, "load").mockResolvedValue(cloud);
    vi.spyOn(supabaseAccountSettingsRepository, "save").mockResolvedValue(undefined);

    render(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);

    expect(screen.queryByTestId("mode")).toBeNull();
    expect((await screen.findByTestId("mode")).textContent).toBe("dark");
    expect(screen.getByTestId("sync-state").textContent).toBe("saved");
  });

  it("preserves the local UI value and exposes save_failed when cloud persistence fails", async () => {
    vi.spyOn(supabaseAccountSettingsRepository, "load").mockResolvedValue(createDefaultAccountSettings());
    vi.spyOn(supabaseAccountSettingsRepository, "save").mockRejectedValue(new Error("offline"));

    render(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);
    await screen.findByTestId("mode");
    fireEvent.click(screen.getByRole("button", { name: "Save light" }));

    await waitFor(() => expect(screen.getByTestId("sync-state").textContent).toBe("save_failed"));
    expect(screen.getByTestId("mode").textContent).toBe("light");
  });

  it("reloads the same account values after logout and login", async () => {
    const cloud = createDefaultAccountSettings();
    cloud.appearance.mode = "light";
    vi.spyOn(supabaseAccountSettingsRepository, "load").mockResolvedValue(cloud);
    vi.spyOn(supabaseAccountSettingsRepository, "save").mockResolvedValue(undefined);

    const view = render(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);
    expect((await screen.findByTestId("mode")).textContent).toBe("light");

    authState.user = null;
    view.rerender(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);
    await waitFor(() => expect(screen.getByTestId("sync-state").textContent).toBe("local_fallback"));

    authState.user = { id: "user-1" };
    view.rerender(<AccountSettingsProvider><Probe /></AccountSettingsProvider>);
    await waitFor(() => expect(screen.getByTestId("sync-state").textContent).toBe("saved"));
    expect(screen.getByTestId("mode").textContent).toBe("light");
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
    await screen.findByTestId("mode");

    fireEvent.click(screen.getByRole("button", { name: "Save light" }));
    fireEvent.click(screen.getByRole("button", { name: "Save block caret" }));

    expect(screen.getByTestId("mode").textContent).toBe("light");
    expect(screen.getByTestId("caret-style").textContent).toBe("block");
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));

    releaseFirstSave();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1][1]).toEqual(expect.objectContaining({
      appearance: expect.objectContaining({ mode: "light", caretStyle: "block" })
    }));
    await waitFor(() => expect(screen.getByTestId("sync-state").textContent).toBe("saved"));
  });
});
