"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { useOptionalAccountSettings } from "@/components/AccountSettingsProvider";
import {
  THEME_SETTING_CHANGE_EVENT,
  type ThemeSettings,
  readThemeSettings
} from "@/lib/app-storage";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const accountContext = useOptionalAccountSettings();
  const [fallbackSettings, setFallbackSettings] = useState<ThemeSettings | null>(null);
  const settings = accountContext?.settings.appearance ?? fallbackSettings;

  useEffect(() => {
    if (accountContext) return;
    setFallbackSettings(readThemeSettings());
    const handleChange = (event: Event) => {
      setFallbackSettings((event as CustomEvent<ThemeSettings>).detail ?? readThemeSettings());
    };
    window.addEventListener(THEME_SETTING_CHANGE_EVENT, handleChange);
    window.addEventListener("storage", handleChange);
    return () => {
      window.removeEventListener(THEME_SETTING_CHANGE_EVENT, handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, [accountContext]);

  useEffect(() => {
    if (!settings) return;
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
