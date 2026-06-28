/**
 * @vitest-environment jsdom
 */
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "@/components/ThemeProvider";

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    document.documentElement.removeAttribute("data-theme-preset");
    document.documentElement.removeAttribute("data-accent");
    document.documentElement.removeAttribute("data-app-font");
  });

  it("applies saved preset, mode, and accent as root attributes", async () => {
    window.localStorage.setItem(
      "formaltype.theme.v1",
      JSON.stringify({
        themePreset: "catppuccin-mocha",
        mode: "dark",
        accentColor: "cyan",
        appFont: "rounded",
        typingFont: "system-mono",
        typingTextSize: "medium",
        typingWidth: "comfortable"
      })
    );

    render(<ThemeProvider>Content</ThemeProvider>);

    await waitFor(() => {
      expect(document.documentElement.dataset.themePreset).toBe("catppuccin-mocha");
    });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themeMode).toBe("dark");
    expect(document.documentElement.dataset.accent).toBe("cyan");
    expect(document.documentElement.dataset.appFont).toBe("rounded");
  });
});
