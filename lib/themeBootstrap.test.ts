/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";
import { THEME_BOOTSTRAP_SCRIPT } from "./themeBootstrap";

describe("theme bootstrap", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-preset");
    document.documentElement.removeAttribute("data-accent");
    document.documentElement.removeAttribute("data-app-font");
  });

  it("applies the deterministic default before hydration", () => {
    window.eval(THEME_BOOTSTRAP_SCRIPT);

    expect(document.documentElement.dataset).toEqual(expect.objectContaining({
      theme: "dark",
      themePreset: "default-dark",
      accent: "amber",
      appFont: "system"
    }));
  });

  it("applies valid local appearance settings before hydration", () => {
    window.localStorage.setItem("formaltype.theme.v1", JSON.stringify({
      themePreset: "paper",
      accentColor: "rose",
      appFont: "sans"
    }));

    window.eval(THEME_BOOTSTRAP_SCRIPT);

    expect(document.documentElement.dataset).toEqual(expect.objectContaining({
      theme: "light",
      themePreset: "paper",
      accent: "rose",
      appFont: "sans"
    }));
  });
});
