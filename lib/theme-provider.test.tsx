/**
 * @vitest-environment jsdom
 */
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/ThemeProvider";

type MediaListener = (event: MediaQueryListEvent) => void;

describe("ThemeProvider", () => {
  let mediaQuery: MediaQueryList;
  let listeners: Set<MediaListener>;

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    document.documentElement.removeAttribute("data-theme-preset");
    document.documentElement.removeAttribute("data-accent");
    document.documentElement.removeAttribute("data-app-font");
    listeners = new Set();
    mediaQuery = {
      matches: false,
      media: "(prefers-color-scheme: light)",
      onchange: null,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.add(listener as MediaListener);
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.delete(listener as MediaListener);
      },
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    };
    window.matchMedia = vi.fn(() => mediaQuery);
  });

  it("derives a dark named preset and appearance from the same registry entry", async () => {
    window.localStorage.setItem(
      "formaltype.theme.v1",
      JSON.stringify({
        themePreset: "catppuccin-mocha",
        mode: "light",
        accentColor: "cyan",
        appFont: "rounded"
      })
    );

    render(<ThemeProvider>Content</ThemeProvider>);

    await waitFor(() => expect(document.documentElement.dataset.themePreset).toBe("catppuccin-mocha"));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement).not.toHaveProperty("dataset.themeMode");
    expect(document.documentElement.dataset.themeMode).toBeUndefined();
    expect(document.documentElement.dataset.accent).toBe("cyan");
    expect(document.documentElement.dataset.appFont).toBe("rounded");
  });

  it("derives a light named preset and appearance from the same registry entry", async () => {
    window.localStorage.setItem(
      "formaltype.theme.v1",
      JSON.stringify({ themePreset: "paper", mode: "dark", accentColor: "rose" })
    );

    render(<ThemeProvider>Content</ThemeProvider>);

    await waitFor(() => expect(document.documentElement.dataset.themePreset).toBe("paper"));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.accent).toBe("rose");
  });

  it("resolves System in both directions and preserves the independent accent", async () => {
    window.localStorage.setItem(
      "formaltype.theme.v1",
      JSON.stringify({ themePreset: "system", accentColor: "emerald" })
    );

    render(<ThemeProvider>Content</ThemeProvider>);

    await waitFor(() => expect(document.documentElement.dataset.themePreset).toBe("default-dark"));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.accent).toBe("emerald");

    Object.defineProperty(mediaQuery, "matches", { configurable: true, value: true });
    listeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));

    await waitFor(() => expect(document.documentElement.dataset.themePreset).toBe("light"));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.accent).toBe("emerald");
  });
});
