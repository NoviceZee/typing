/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "../pages/settings";

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

  it("renders the keyboard sound dropdown and volume slider in a sound section", () => {
    render(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "Sound" })).toBeTruthy();
    const keyboardSound = screen.getByLabelText("Keyboard sound");
    const keyboardSoundVolume = screen.getByLabelText("Keyboard sound volume");

    expect(keyboardSound.tagName).toBe("SELECT");
    expect((keyboardSound as HTMLSelectElement).value).toBe("off");
    expect((keyboardSoundVolume as HTMLInputElement).value).toBe("50");
    expect(screen.getByRole("option", { name: "Sound off" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Mechanical" })).toBeTruthy();
  });

  it("selecting mechanical persists and triggers a preview", () => {
    const audioMock = installAudioContextMock();

    render(<SettingsPage />);

    const keyboardSound = screen.getByLabelText("Keyboard sound");
    fireEvent.change(keyboardSound, { target: { value: "mechanical" } });

    expect(window.localStorage.getItem("formaltype.keyboard_sound.v1")).toBe("mechanical");
    expect((keyboardSound as HTMLSelectElement).value).toBe("mechanical");
    expect(audioMock.oscillators).toHaveLength(1);
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

  it("plays a preview sound for the selected sound pack", () => {
    window.localStorage.setItem("formaltype.keyboard_sound.v1", "mechanical");
    const audioMock = installAudioContextMock();

    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Test sound" }));

    expect(audioMock.oscillators).toHaveLength(1);
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
