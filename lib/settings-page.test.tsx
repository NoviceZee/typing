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

  it("renders the keyboard sound option in a sound section", () => {
    render(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "Sound" })).toBeTruthy();
    const keyboardSound = screen.getByLabelText("Keyboard sound");

    expect((keyboardSound as HTMLSelectElement).value).toBe("off");
    expect(screen.getByRole("option", { name: "Sound off" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Mechanical" })).toBeTruthy();
  });

  it("persists keyboard sound changes to localStorage", () => {
    render(<SettingsPage />);

    const keyboardSound = screen.getByLabelText("Keyboard sound");
    fireEvent.change(keyboardSound, { target: { value: "mechanical" } });

    expect(window.localStorage.getItem("formaltype.keyboard_sound.v1")).toBe("mechanical");
    expect((keyboardSound as HTMLSelectElement).value).toBe("mechanical");
  });

  it("plays a preview sound for the selected sound pack", () => {
    window.localStorage.setItem("formaltype.keyboard_sound.v1", "mechanical");
    const audioMock = installAudioContextMock();

    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Test sound" }));

    expect(audioMock.oscillators).toHaveLength(1);
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
