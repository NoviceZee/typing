"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  ACCENT_COLOR_OPTIONS,
  DEFAULT_THEME_SETTINGS,
  THEME_MODE_OPTIONS,
  THEME_PRESET_OPTIONS,
  ThemePresetOption,
  TYPING_FONT_OPTIONS,
  TYPING_TEXT_SIZE_OPTIONS,
  TYPING_WIDTH_OPTIONS,
  ThemeSettings,
  readThemeSettings,
  writeThemeSettings
} from "@/lib/app-storage";
import {
  KEYBOARD_SOUND_OPTIONS,
  KeyboardSoundSetting,
  createKeyboardSoundPlayer,
  isRecordedKeyboardSoundSetting,
  readKeyboardSoundSetting,
  readKeyboardSoundVolume,
  writeKeyboardSoundSetting,
  writeKeyboardSoundVolume
} from "@/lib/keyboardSound";

export default function SettingsPage() {
  const [keyboardSoundSetting, setKeyboardSoundSetting] = useState<KeyboardSoundSetting>("off");
  const [keyboardSoundVolume, setKeyboardSoundVolume] = useState(0.5);
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(DEFAULT_THEME_SETTINGS);
  const soundPlayer = useRef(createKeyboardSoundPlayer());
  const selectedSoundOption = useMemo(
    () => KEYBOARD_SOUND_OPTIONS.find((option) => option.value === keyboardSoundSetting) ?? KEYBOARD_SOUND_OPTIONS[0],
    [keyboardSoundSetting]
  );

  useEffect(() => {
    const savedSoundSetting = readKeyboardSoundSetting();
    setKeyboardSoundSetting(savedSoundSetting);
    setKeyboardSoundVolume(readKeyboardSoundVolume());
    setThemeSettings(readThemeSettings());
    soundPlayer.current.preload(savedSoundSetting);
  }, []);

  function handleKeyboardSoundSetting(nextSetting: KeyboardSoundSetting) {
    setKeyboardSoundSetting(nextSetting);
    writeKeyboardSoundSetting(nextSetting);
    if (isRecordedKeyboardSoundSetting(nextSetting)) {
      void soundPlayer.current.reload(nextSetting).then(() => {
        soundPlayer.current.play(nextSetting, "normal", keyboardSoundVolume);
      });
      return;
    }

    soundPlayer.current.preload(nextSetting);
    if (nextSetting !== "off") {
      soundPlayer.current.play(nextSetting, "normal", keyboardSoundVolume);
    }
  }

  function handleKeyboardSoundVolume(nextVolume: number) {
    setKeyboardSoundVolume(nextVolume);
    writeKeyboardSoundVolume(nextVolume);
    if (keyboardSoundSetting !== "off") {
      soundPlayer.current.play(keyboardSoundSetting, "normal", nextVolume);
    }
  }

  function handleThemeSetting<Key extends keyof ThemeSettings>(key: Key, value: ThemeSettings[Key]) {
    setThemeSettings((current) => {
      const nextSettings = { ...current, [key]: value };
      writeThemeSettings(nextSettings);
      return nextSettings;
    });
  }

  function handleThemePreset(preset: ThemePresetOption) {
    setThemeSettings((current) => {
      const nextSettings: ThemeSettings = {
        ...current,
        themePreset: preset.value,
        mode: preset.mode,
        accentColor: preset.accentColor
      };
      writeThemeSettings(nextSettings);
      return nextSettings;
    });
  }

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-6xl px-1">
        <div className="mb-6 rounded-xl border border-paper/10 bg-ink-900/45 p-5 shadow-glow backdrop-blur">
          <p className="font-mono text-xs uppercase text-brass">Preferences</p>
          <h1 className="mt-2 text-3xl font-semibold text-paper md:text-4xl">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-paper/55">
            Tune the typing room without changing your practice behavior, sound pack, or saved results.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start">
          <aside className="sticky top-5 rounded-xl bg-ink-900/35 p-2 font-mono text-xs text-paper/45 backdrop-blur">
            <a href="#appearance" className="block rounded-lg bg-brass/15 px-3 py-2 text-brass transition hover:bg-brass/20">
              Appearance
            </a>
            <a href="#typing" className="mt-1 block rounded-lg px-3 py-2 transition hover:bg-paper/10 hover:text-paper/70">
              Typing
            </a>
            <a href="#sound" className="mt-1 block rounded-lg px-3 py-2 transition hover:bg-paper/10 hover:text-paper/70">
              Sound
            </a>
          </aside>

          <div className="grid gap-5">
          <section id="appearance" className="scroll-mt-5 rounded-xl bg-ink-950/70 p-5 shadow-glow backdrop-blur">
            <div>
              <p className="font-mono text-xs uppercase text-brass">Appearance</p>
              <h2 className="mt-1 text-xl font-semibold text-paper">Appearance</h2>
              <p className="mt-1 max-w-2xl text-sm text-paper/55">
                Preview the product direction with theme, accent, and typing area preferences.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-[repeat(auto-fit,8.75rem)] gap-3">
              {THEME_PRESET_OPTIONS.map((preset) => (
                <ThemePreviewCard
                  key={preset.value}
                  preset={preset}
                  isSelected={themeSettings.themePreset === preset.value}
                  onSelect={() => handleThemePreset(preset)}
                />
              ))}
            </div>

            <div className="mt-6 border-t border-paper/10 pt-1">
            <div id="typing" className="mt-5 grid scroll-mt-5 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] md:items-center">
              <SettingLabel id="theme-mode" label="Mode" description="Choose a light, dark, or system-matched shell." />
              <select
                id="theme-mode"
                value={themeSettings.mode}
                onChange={(event) => handleThemeSetting("mode", event.target.value as ThemeSettings["mode"])}
                className="h-10 w-full min-w-0 rounded-md border border-paper/10 bg-ink-800 px-3 font-mono text-sm text-paper/80 outline-none transition hover:border-paper/20 focus:border-brass/50 focus:ring-1 focus:ring-brass/30"
              >
                {THEME_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] md:items-center">
              <SettingLabel id="accent-color" label="Accent color" description="Used for primary actions, focus, tabs, charts, and pace." />
              <select
                id="accent-color"
                value={themeSettings.accentColor}
                onChange={(event) => handleThemeSetting("accentColor", event.target.value as ThemeSettings["accentColor"])}
                className="h-10 w-full min-w-0 rounded-md border border-paper/10 bg-ink-800 px-3 font-mono text-sm text-paper/80 outline-none transition hover:border-paper/20 focus:border-brass/50 focus:ring-1 focus:ring-brass/30"
              >
                {ACCENT_COLOR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] md:items-center">
              <SettingLabel id="typing-font" label="Typing font" description="Applies only to the typing practice text." />
              <select
                id="typing-font"
                value={themeSettings.typingFont}
                onChange={(event) => handleThemeSetting("typingFont", event.target.value as ThemeSettings["typingFont"])}
                className="h-10 w-full min-w-0 rounded-md border border-paper/10 bg-ink-800 px-3 font-mono text-sm text-paper/80 outline-none transition hover:border-paper/20 focus:border-brass/50 focus:ring-1 focus:ring-brass/30"
              >
                {TYPING_FONT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] md:items-center">
              <SettingLabel id="typing-text-size" label="Typing text size" description="Changes the practice text scale only." />
              <select
                id="typing-text-size"
                value={themeSettings.typingTextSize}
                onChange={(event) => handleThemeSetting("typingTextSize", event.target.value as ThemeSettings["typingTextSize"])}
                className="h-10 w-full min-w-0 rounded-md border border-paper/10 bg-ink-800 px-3 font-mono text-sm text-paper/80 outline-none transition hover:border-paper/20 focus:border-brass/50 focus:ring-1 focus:ring-brass/30"
              >
                {TYPING_TEXT_SIZE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] md:items-center">
              <SettingLabel id="typing-width" label="Typing width" description="Adjusts the reading measure inside practice." />
              <select
                id="typing-width"
                value={themeSettings.typingWidth}
                onChange={(event) => handleThemeSetting("typingWidth", event.target.value as ThemeSettings["typingWidth"])}
                className="h-10 w-full min-w-0 rounded-md border border-paper/10 bg-ink-800 px-3 font-mono text-sm text-paper/80 outline-none transition hover:border-paper/20 focus:border-brass/50 focus:ring-1 focus:ring-brass/30"
              >
                {TYPING_WIDTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section id="sound" className="scroll-mt-5 rounded-xl bg-ink-950/70 p-5 shadow-glow backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase text-brass">Sound</p>
              <h2 className="mt-1 text-xl font-semibold text-paper">Sound</h2>
              <p className="mt-1 max-w-2xl text-sm text-paper/55">
                Choose the keyboard sound pack used while typing in practice.
              </p>
            </div>
            <button
              type="button"
              onClick={() => soundPlayer.current.play(keyboardSoundSetting, "normal", keyboardSoundVolume)}
              disabled={keyboardSoundSetting === "off"}
              className="rounded-md border border-paper/10 bg-ink-800 px-3 py-2 font-mono text-xs text-paper/75 transition hover:border-brass/50 hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
            >
              Test sound
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] md:items-center">
            <div>
              <label htmlFor="keyboard-sound" className="font-mono text-sm text-paper/80">
                Keyboard sound
              </label>
              <p className="mt-1 text-sm text-paper/45">{selectedSoundOption.description}</p>
            </div>
            <select
              id="keyboard-sound"
              value={keyboardSoundSetting}
              onChange={(event) => handleKeyboardSoundSetting(event.target.value as KeyboardSoundSetting)}
              className="h-10 w-full min-w-0 rounded-md border border-paper/10 bg-ink-800 px-3 font-mono text-sm text-paper/80 outline-none transition hover:border-paper/20 focus:border-brass/50 focus:ring-1 focus:ring-brass/30"
            >
              {KEYBOARD_SOUND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] md:items-center">
            <div>
              <label htmlFor="keyboard-sound-volume" className="font-mono text-sm text-paper/80">
                Keyboard sound volume
              </label>
              <p className="mt-1 text-sm text-paper/45">
                App click volume: {Math.round(keyboardSoundVolume * 100)}%
              </p>
            </div>
            <input
              id="keyboard-sound-volume"
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round(keyboardSoundVolume * 100)}
              onChange={(event) => handleKeyboardSoundVolume(Number(event.target.value) / 100)}
              className="h-10 w-full accent-brass"
            />
          </div>
          </section>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function ThemePreviewCard({
  preset,
  isSelected,
  onSelect
}: {
  preset: ThemePresetOption;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${preset.label} theme preview`}
      aria-pressed={isSelected}
      onClick={onSelect}
      className={`group overflow-hidden rounded-xl border p-3 text-left transition ${
        isSelected
          ? "border-brass/70 bg-brass/10 shadow-[0_0_0_1px_rgb(var(--color-accent)/0.24),0_18px_60px_rgb(var(--color-accent)/0.12)]"
          : "border-paper/10 bg-paper/[0.035] hover:border-brass/45 hover:bg-paper/[0.055]"
      } h-32 w-[8.75rem]`}
    >
      <div className="rounded-lg border border-white/10 p-2" style={{ backgroundColor: preset.swatches[0] }}>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: preset.swatches[2] }} />
          <span className="h-2 w-2 rounded-full bg-white/25" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
        </div>
        <div className="mt-4 h-1.5 w-3/5 rounded-full" style={{ backgroundColor: preset.swatches[2] }} />
        <div className="mt-1.5 h-1.5 w-4/5 rounded-full bg-white/20" />
        <div className="mt-1.5 h-1.5 w-2/5 rounded-full" style={{ backgroundColor: preset.swatches[1] }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-paper">{preset.label}</span>
        <span
          className={`rounded-full px-1.5 py-0.5 font-mono text-[0.56rem] uppercase ${
            isSelected ? "bg-brass text-ink-950" : "bg-paper/10 text-paper/45"
          }`}
        >
          {isSelected ? "Active" : preset.mode}
        </span>
      </div>
    </button>
  );
}

function SettingLabel({ id, label, description }: { id: string; label: string; description: string }) {
  return (
    <div>
      <label htmlFor={id} className="font-mono text-sm text-paper/80">
        {label}
      </label>
      <p className="mt-1 text-sm text-paper/45">{description}</p>
    </div>
  );
}
