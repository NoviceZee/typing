"use client";

import React, { ReactNode, useEffect, useState } from "react";
import {
  THEME_SETTING_CHANGE_EVENT,
  ThemeSettings,
  readThemeSettings
} from "@/lib/app-storage";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings | null>(null);

  useEffect(() => {
    setSettings(readThemeSettings());

    function handleThemeSettingsChange(event: Event) {
      setSettings((event as CustomEvent<ThemeSettings>).detail ?? readThemeSettings());
    }

    window.addEventListener(THEME_SETTING_CHANGE_EVENT, handleThemeSettingsChange);
    window.addEventListener("storage", handleThemeSettingsChange);

    return () => {
      window.removeEventListener(THEME_SETTING_CHANGE_EVENT, handleThemeSettingsChange);
      window.removeEventListener("storage", handleThemeSettingsChange);
    };
  }, []);

  useEffect(() => {
    if (!settings) {
      return;
    }

    const currentSettings = settings;
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: light)") ?? null;

    function applyResolvedTheme() {
      const resolvedMode =
        currentSettings.mode === "system" ? (mediaQuery?.matches ? "light" : "dark") : currentSettings.mode;
      document.documentElement.dataset.theme = resolvedMode;
      document.documentElement.dataset.themeMode = currentSettings.mode;
      document.documentElement.dataset.themePreset = currentSettings.themePreset;
      document.documentElement.dataset.accent = currentSettings.accentColor;
      document.documentElement.dataset.appFont = currentSettings.appFont;
    }

    applyResolvedTheme();
    mediaQuery?.addEventListener("change", applyResolvedTheme);

    return () => mediaQuery?.removeEventListener("change", applyResolvedTheme);
  }, [settings]);

  return <>{children}</>;
}
