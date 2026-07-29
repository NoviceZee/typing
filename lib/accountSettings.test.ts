/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_SETTINGS_VERSION,
  createDefaultAccountSettings,
  hydrateAccountSettings,
  persistAccountSettings,
  readLocalAccountSettings
} from "@/lib/accountSettings";

describe("account settings lifecycle", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("uses authenticated cloud settings as the source of truth over local values", async () => {
    window.localStorage.setItem("formaltype.theme.v1", JSON.stringify({ mode: "light", caretStyle: "block" }));
    const cloud = {
      ...createDefaultAccountSettings(),
      appearance: {
        ...createDefaultAccountSettings().appearance,
        mode: "dark" as const,
        caretStyle: "underline" as const
      }
    };
    const repository = {
      load: vi.fn().mockResolvedValue(cloud),
      save: vi.fn()
    };

    const result = await hydrateAccountSettings({
      userId: "user-1",
      repository,
      localSettings: readLocalAccountSettings()
    });

    expect(result.source).toBe("cloud");
    expect(result.settings.appearance.mode).toBe("dark");
    expect(result.settings.appearance.caretStyle).toBe("underline");
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("migrates local settings once only when the account has no cloud row", async () => {
    window.localStorage.setItem("formaltype.theme.v1", JSON.stringify({ mode: "light", typingTextSize: "large" }));
    const repository = {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined)
    };
    const localSettings = readLocalAccountSettings();

    const result = await hydrateAccountSettings({ userId: "user-1", repository, localSettings });

    expect(result.source).toBe("migrated");
    expect(result.settings.version).toBe(ACCOUNT_SETTINGS_VERSION);
    expect(result.settings.appearance.mode).toBe("light");
    expect(result.settings.appearance.typingTextSize).toBe("large");
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith("user-1", localSettings);
  });

  it("keeps the local UI value and reports failure when a cloud save fails", async () => {
    const next = {
      ...createDefaultAccountSettings(),
      appearance: {
        ...createDefaultAccountSettings().appearance,
        caretStyle: "outline-block" as const
      }
    };
    const repository = {
      load: vi.fn(),
      save: vi.fn().mockRejectedValue(new Error("offline"))
    };

    const result = await persistAccountSettings({ userId: "user-1", repository, settings: next });

    expect(result.status).toBe("save_failed");
    expect(result.settings.appearance.caretStyle).toBe("outline-block");
  });

  it("keeps anonymous settings local without calling the account repository", async () => {
    const repository = {
      load: vi.fn(),
      save: vi.fn()
    };
    const settings = createDefaultAccountSettings();

    const result = await persistAccountSettings({ userId: null, repository, settings });

    expect(result.status).toBe("local_fallback");
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("drops the removed Previous Pace style from normalized storage", () => {
    window.localStorage.setItem(
      "formaltype.theme.v1",
      JSON.stringify({ previousPaceEnabled: "on", previousPaceStyle: "underline" })
    );

    const settings = readLocalAccountSettings();

    expect(settings.appearance.previousPaceEnabled).toBe("on");
    expect(settings.appearance).not.toHaveProperty("previousPaceStyle");
  });
});
