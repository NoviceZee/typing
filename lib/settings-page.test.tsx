/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "../pages/settings";

const SOUND_PACK_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "mechanical", label: "Mechanical" },
  { value: "clicky", label: "Clicky" },
  { value: "soft", label: "Soft" },
  { value: "typewriter", label: "Typewriter" },
  { value: "laptop", label: "Laptop" },
  { value: "recorded", label: "Recorded Mix" },
  { value: "recorded-1", label: "Tone Beep" },
  { value: "recorded-2", label: "Fast Typing" },
  { value: "recorded-3", label: "Quick Load" },
  { value: "recorded-4", label: "Footstep Tap" },
  { value: "recorded-5", label: "Boiling Tap" },
  { value: "recorded-6", label: "Keyboard Tap" },
  { value: "recorded-9", label: "iPhone Tap" },
  { value: "recorded-10", label: "Computer Beep" }
];

const mockState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isLoading: false,
  pathname: "/settings",
  asPath: "/settings",
  routerReplace: vi.fn(),
  routerPush: vi.fn(),
  signOut: vi.fn()
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: mockState.user,
    isLoading: mockState.isLoading,
    signOut: mockState.signOut
  })
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    pathname: mockState.pathname,
    asPath: mockState.asPath,
    push: mockState.routerPush,
    replace: mockState.routerReplace
  })
}));

vi.mock("@/lib/profileStorage", () => ({
  getProfileDisplayLabel: () => "Account",
  getSupabaseProfile: vi.fn().mockResolvedValue(null)
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockState.user = null;
    mockState.isLoading = false;
    mockState.pathname = "/settings";
    mockState.asPath = "/settings";
    mockState.routerReplace.mockReset();
    mockState.routerPush.mockReset();
    mockState.signOut.mockReset();
  });

  it("is accessible to logged-out users", () => {
    render(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /login/i })).toBeTruthy();
    expect(mockState.routerReplace).not.toHaveBeenCalled();
  });

  it("announces that preference changes are saved automatically", () => {
    render(<SettingsPage />);

    expect(screen.getByRole("status").textContent).toContain("Changes save automatically");
    fireEvent.click(screen.getByRole("button", { name: "Light mode" }));
    expect(screen.getByRole("status").textContent).toContain("Saved automatically");
  });

  it("renders keyboard sound choices and volume slider in a sound section", () => {
    render(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "Sound" })).toBeTruthy();
    const keyboardSoundVolume = screen.getByLabelText("Keyboard sound volume");
    const keyboardSoundRow = screen.getByRole("group", { name: "Keyboard sound" });
    const keyboardSoundInlineRow = screen.getByTestId("keyboard-sound-row");

    expect(keyboardSoundRow).toBeTruthy();
    expect(keyboardSoundInlineRow.className).toContain("formaltype-setting-row");
    expect(screen.queryByRole("group", { name: "Off sound packs" })).toBeNull();
    expect(screen.getByRole("group", { name: "Synthetic sound packs" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Recorded sound packs" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Effects sound packs" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Off sound" }).getAttribute("aria-pressed")).toBe("true");
    expect(keyboardSoundVolume.className).toContain("formaltype-themed-range");
    expect((keyboardSoundVolume as HTMLInputElement).value).toBe("50");

    for (const option of SOUND_PACK_OPTIONS) {
      expect(screen.getByRole("button", { name: `${option.label} sound` })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: /Recorded 7 sound/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Recorded 8 sound/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Recorded 9 — iPhone Tap sound" })).toBeNull();
  });

  it("renders personalization controls with saved theme values", () => {
    window.localStorage.setItem(
      "formaltype.theme.v1",
      JSON.stringify({
        themePreset: "dracula",
        mode: "light",
        accentColor: "purple",
        appFont: "serif",
        typingFont: "serif",
        typingTextSize: "large",
        typingWidth: "wide",
        caretStyle: "block",
        caretBlink: "off",
        typingColorStyle: "soft"
      })
    );

    render(<SettingsPage />);

    expect(screen.getAllByText("Personalization").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("heading", { name: "Theme" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Workspace presets" })).toBeNull();
    expect(screen.getByRole("button", { name: /Dracula theme preview/i }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Light mode" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Purple accent" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Purple accent" }).className).toContain("h-9");
    expect(screen.getAllByTestId("accent-swatch")).toHaveLength(9);
    expect(screen.getByRole("group", { name: "Accent color" }).className).toContain("flex flex-wrap");
    expect(screen.getByRole("group", { name: "Accent color" }).className).not.toContain("md:grid-cols");
    expect(screen.getByRole("button", { name: "Serif app font" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Serif font" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Geist app font" })).toBeNull();
    expect(screen.queryByRole("button", { name: "IBM Plex Mono font" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Roboto Mono font" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Courier Prime font" })).toBeNull();
    expect(screen.getByRole("button", { name: "Large text size" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Wide typing width" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("settings-typing-preview-sample").className).toContain(
      "formaltype-settings-preview-size-large"
    );
    expect(screen.getByTestId("settings-typing-preview-frame").className).toContain(
      "formaltype-settings-preview-width-wide"
    );
    expect(screen.getByRole("button", { name: "Block caret style" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Off blink" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Soft typing colors" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("persists personalization changes without changing keyboard sound settings", () => {
    window.localStorage.setItem("formaltype.keyboard_sound.v1", "mechanical");

    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "System mode" }));
    fireEvent.click(screen.getByRole("button", { name: "Cyan accent" }));
    fireEvent.click(screen.getByRole("button", { name: "Rounded app font" }));
    fireEvent.click(screen.getByRole("button", { name: "Serif font" }));
    fireEvent.click(screen.getByRole("button", { name: "Small text size" }));
    fireEvent.click(screen.getByRole("button", { name: "Compact typing width" }));
    fireEvent.click(screen.getByRole("button", { name: "Underline caret style" }));
    fireEvent.click(screen.getByRole("button", { name: "Off blink" }));
    fireEvent.click(screen.getByRole("button", { name: "High contrast typing colors" }));

    expect(window.localStorage.getItem("formaltype.keyboard_sound.v1")).toBe("mechanical");
    expect(JSON.parse(window.localStorage.getItem("formaltype.theme.v1") ?? "{}")).toEqual({
      themePreset: "default-dark",
      mode: "system",
      accentColor: "cyan",
      appFont: "rounded",
      typingFont: "serif",
      typingTextSize: "small",
      typingWidth: "compact",
      caretStyle: "underline",
      caretBlink: "off",
      typingColorStyle: "high-contrast"
    });
  });

  it("renders and persists typing behavior rules separately from personalization", () => {
    window.localStorage.setItem(
      "formaltype.rules.v1",
      JSON.stringify({
        requireTabToStart: false,
        requireTwoSpacesAfterPeriod: true,
        enforceUppercase: false,
        enforceLowercase: true,
        caseSensitive: false,
        punctuationSensitive: false,
        enforceExtraSpaces: false,
        enforceMissingSpaces: true,
        autoCapitalisationHints: false,
        showMistakesImmediately: false,
        allowBackspace: false
      })
    );

    render(<SettingsPage />);

    expect(screen.getByText("Typing Rules")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Behavior" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Character rules" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Formatting rules" })).toBeNull();
    expect(screen.getByRole("group", { name: "Start with Tab" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Off start with Tab" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Off start with Tab" }).closest("fieldset")?.className).toContain(
      "formaltype-setting-row"
    );
    expect(screen.getByRole("button", { name: "On two spaces after period" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getByRole("button", { name: "Off strict punctuation" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Off strict capitalization" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getByRole("button", { name: "Off require uppercase" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "On require lowercase" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Off extra spaces" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "On missing spaces" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Off capitalization hints" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getByRole("button", { name: "Off show mistakes immediately" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getByRole("button", { name: "Off allow backspace" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "On start with Tab" }));
    fireEvent.click(screen.getByRole("button", { name: "Off two spaces after period" }));
    fireEvent.click(screen.getByRole("button", { name: "On strict punctuation" }));
    fireEvent.click(screen.getByRole("button", { name: "On strict capitalization" }));
    fireEvent.click(screen.getByRole("button", { name: "On require uppercase" }));
    fireEvent.click(screen.getByRole("button", { name: "Off require lowercase" }));
    fireEvent.click(screen.getByRole("button", { name: "On extra spaces" }));
    fireEvent.click(screen.getByRole("button", { name: "Off missing spaces" }));
    fireEvent.click(screen.getByRole("button", { name: "On capitalization hints" }));
    fireEvent.click(screen.getByRole("button", { name: "On show mistakes immediately" }));
    fireEvent.click(screen.getByRole("button", { name: "On allow backspace" }));

    expect(JSON.parse(window.localStorage.getItem("formaltype.rules.v1") ?? "{}")).toMatchObject({
      requireTabToStart: true,
      requireTwoSpacesAfterPeriod: false,
      enforceUppercase: true,
      enforceLowercase: false,
      caseSensitive: true,
      punctuationSensitive: true,
      enforceExtraSpaces: true,
      enforceMissingSpaces: false,
      autoCapitalisationHints: true,
      showMistakesImmediately: true,
      allowBackspace: true
    });
    expect(window.localStorage.getItem("formaltype.theme.v1")).toBeNull();
  });

  it("persists selected theme preview cards with preset mode and accent", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Tokyo Night theme preview/i }));

    expect(screen.getByRole("button", { name: /Tokyo Night theme preview/i }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(JSON.parse(window.localStorage.getItem("formaltype.theme.v1") ?? "{}")).toMatchObject({
      themePreset: "tokyo-night",
      mode: "dark",
      accentColor: "blue"
    });
  });

  it("renders a sticky live preview and direct setting controls", () => {
    render(<SettingsPage />);

    expect(screen.getByTestId("settings-layout").className).toContain(
      "lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]"
    );
    expect(screen.getByTestId("settings-sidebar").className).toContain("lg:sticky");
    expect(screen.getByTestId("settings-sidebar").className).toContain("min-w-0");
    expect(screen.getByTestId("settings-content").className).toContain("min-w-0");
    expect(screen.getByTestId("settings-live-preview")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Mode" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "App font" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Caret style" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "System Mono font" }).closest("fieldset")?.className).toContain(
      "formaltype-setting-row"
    );
    expect(screen.getByRole("button", { name: /Default Dark theme preview/i }).className).toContain("w-[8.25rem]");
    expect(screen.getByRole("button", { name: /Default Dark theme preview/i }).className).toContain("h-9");
    expect(screen.getByRole("button", { name: /Rose Pine Dawn theme preview/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Solarized Light theme preview/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tangerine theme preview/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Matcha theme preview/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Milkshake theme preview/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Paper theme preview/i })).toBeTruthy();
    expect(screen.getAllByTestId("theme-preview-card")).toHaveLength(19);
    expect(screen.getAllByTestId("theme-preview-accent-dot")).toHaveLength(19);
  });

  it("renders functional sidebar links for real settings sections", () => {
    render(<SettingsPage />);

    const sections = [
      { label: "Behavior", id: "behavior" },
      { label: "Personalization", id: "personalization" },
      { label: "Typing", id: "typing" },
      { label: "Sound", id: "sound" }
    ];

    expect(screen.getByRole("navigation", { name: "Settings sections" })).toBeTruthy();
    for (const section of sections) {
      const link = screen.getByRole("link", { name: section.label });
      expect(link.getAttribute("href")).toBe(`#${section.id}`);
      expect(document.getElementById(section.id)).toBeTruthy();
    }
    expect(document.getElementById("behavior")?.className).toContain("order-1");
    expect(document.getElementById("personalization")?.className).toContain("order-2");
    expect(document.getElementById("typing")?.className).toContain("order-3");
    expect(document.getElementById("sound")?.className).toContain("order-4");
    expect(screen.queryByRole("link", { name: "Appearance" })).toBeNull();
    expect(screen.queryByRole("link", { name: /account/i })).toBeNull();
    expect(screen.getByRole("navigation", { name: "Settings sections" }).querySelector('a[href="/privacy"]')).toBeNull();

    expect(screen.getByRole("link", { name: "Behavior" }).getAttribute("aria-current")).toBe("true");
    fireEvent.click(screen.getByRole("link", { name: "Sound" }));
    expect(screen.getByRole("link", { name: "Sound" }).getAttribute("aria-current")).toBe("true");
  });

  it("updates the live typing preview size and width from button choices", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Small text size" }));
    fireEvent.click(screen.getByRole("button", { name: "Compact typing width" }));
    expect(screen.getByTestId("settings-typing-preview-sample").className).toContain(
      "formaltype-settings-preview-size-small"
    );
    expect(screen.getByTestId("settings-typing-preview-frame").className).toContain(
      "formaltype-settings-preview-width-compact"
    );

    fireEvent.click(screen.getByRole("button", { name: "Large text size" }));
    fireEvent.click(screen.getByRole("button", { name: "Wide typing width" }));
    expect(screen.getByTestId("settings-typing-preview-sample").className).toContain(
      "formaltype-settings-preview-size-large"
    );
    expect(screen.getByTestId("settings-typing-preview-frame").className).toContain(
      "formaltype-settings-preview-width-wide"
    );
  });

  it.each(SOUND_PACK_OPTIONS.filter((option) => option.value !== "off"))(
    "selecting $label persists and triggers a preview",
    async ({ value }) => {
      const audioMock = installAudioContextMock();

      render(<SettingsPage />);

      const option = SOUND_PACK_OPTIONS.find((soundOption) => soundOption.value === value);
      fireEvent.click(screen.getByRole("button", { name: `${option?.label} sound` }));

      expect(window.localStorage.getItem("formaltype.keyboard_sound.v1")).toBe(value);
      expect(screen.getByRole("button", { name: `${option?.label} sound` }).getAttribute("aria-pressed")).toBe("true");
      await waitFor(() => {
        expect(audioMock.oscillators).toHaveLength(1);
      });
    }
  );

  it("selecting off persists and does not trigger a preview", () => {
    window.localStorage.setItem("formaltype.keyboard_sound.v1", "mechanical");
    const audioMock = installAudioContextMock();

    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Off sound" }));

    expect(window.localStorage.getItem("formaltype.keyboard_sound.v1")).toBe("off");
    expect(screen.getByRole("button", { name: "Off sound" }).getAttribute("aria-pressed")).toBe("true");
    expect(audioMock.oscillators).toHaveLength(0);
  });

  it("persists keyboard sound volume changes and previews when sound is enabled", () => {
    window.localStorage.setItem("formaltype.keyboard_sound.v1", "mechanical");
    const audioMock = installAudioContextMock();

    render(<SettingsPage />);

    const keyboardSoundVolume = screen.getByLabelText("Keyboard sound volume");
    fireEvent.change(keyboardSoundVolume, { target: { value: "70" } });

    expect(window.localStorage.getItem("formaltype.keyboard_sound_volume.v1")).toBe("0.7");
    expect((keyboardSoundVolume as HTMLInputElement).value).toBe("70");
    expect(audioMock.oscillators).toHaveLength(1);
  });

  it("does not render a redundant sound section test button", () => {
    window.localStorage.setItem("formaltype.keyboard_sound.v1", "mechanical");

    render(<SettingsPage />);

    expect(screen.queryByRole("button", { name: "Test sound" })).toBeNull();
    expect(screen.getByRole("button", { name: "Test" })).toBeTruthy();
  });

  it("does not play a preview on initial render", () => {
    window.localStorage.setItem("formaltype.keyboard_sound.v1", "mechanical");
    const audioMock = installAudioContextMock();

    render(<SettingsPage />);

    expect(audioMock.oscillators).toHaveLength(0);
  });
});

function installAudioContextMock() {
  const oscillators: Array<{ frequency: { value: number }; type: OscillatorType; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];

  class AudioContextMock {
    currentTime = 1;
    destination = {};
    state = "running";
    resume = vi.fn().mockResolvedValue(undefined);
    createOscillator = vi.fn(() => {
      const oscillator = {
        frequency: { value: 0 },
        type: "square" as OscillatorType,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      };
      oscillators.push(oscillator);
      return oscillator;
    });
    createGain = vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn()
    }));
  }

  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    writable: true,
    value: AudioContextMock
  });

  return { oscillators };
}
