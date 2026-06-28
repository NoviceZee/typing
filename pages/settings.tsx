"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  ACCENT_COLOR_OPTIONS,
  APP_FONT_OPTIONS,
  CARET_BLINK_OPTIONS,
  CARET_STYLE_OPTIONS,
  DEFAULT_THEME_SETTINGS,
  THEME_MODE_OPTIONS,
  THEME_PRESET_OPTIONS,
  ThemePresetOption,
  TYPING_COLOR_STYLE_OPTIONS,
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

        <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
          <SettingsLivePreview
            themeSettings={themeSettings}
            soundLabel={selectedSoundOption.label}
            keyboardSoundSetting={keyboardSoundSetting}
            keyboardSoundVolume={keyboardSoundVolume}
            onTestSound={() => soundPlayer.current.play(keyboardSoundSetting, "normal", keyboardSoundVolume)}
          />

          <div className="grid gap-5">
            <section id="appearance" className="scroll-mt-5 rounded-xl bg-ink-950/70 p-5 shadow-glow backdrop-blur">
              <SectionHeading
                eyebrow="Personalization"
                title="Theme"
                description="Choose the overall room color and accent identity."
              />

              <div className="mt-5 grid grid-cols-[repeat(auto-fit,8.25rem)] gap-2">
                {THEME_PRESET_OPTIONS.map((preset) => (
                  <ThemePreviewCard
                    key={preset.value}
                    preset={preset}
                    isSelected={themeSettings.themePreset === preset.value}
                    onSelect={() => handleThemePreset(preset)}
                  />
                ))}
              </div>

              <div className="mt-6 grid gap-5">
                <ButtonGroup
                  label="Mode"
                  description="Choose a light, dark, or system-matched shell."
                  options={THEME_MODE_OPTIONS}
                  value={themeSettings.mode}
                  getAriaLabel={(option) => `${option.label} mode`}
                  onChange={(value) => handleThemeSetting("mode", value as ThemeSettings["mode"])}
                />

                <ButtonGroup
                  label="Accent color"
                  description="Used for primary actions, focus, tabs, charts, and pace."
                  options={ACCENT_COLOR_OPTIONS}
                  value={themeSettings.accentColor}
                  getAriaLabel={(option) => `${option.label} accent`}
                  renderPrefix={(option) => <AccentDot accent={option.value} />}
                  onChange={(value) => handleThemeSetting("accentColor", value as ThemeSettings["accentColor"])}
                />

                <ButtonGroup
                  label="App font"
                  description="Applies to the overall site UI."
                  options={APP_FONT_OPTIONS}
                  value={themeSettings.appFont}
                  getAriaLabel={(option) => `${option.label} app font`}
                  onChange={(value) => handleThemeSetting("appFont", value as ThemeSettings["appFont"])}
                />
              </div>
            </section>

            <section id="typing" className="scroll-mt-5 rounded-xl bg-ink-950/70 p-5 shadow-glow backdrop-blur">
              <SectionHeading
                eyebrow="Typing"
                title="Typing Area"
                description="These controls apply only to the practice text and active caret."
              />

              <div className="mt-5 grid gap-5">
                <ButtonGroup
                  label="Typing font"
                  description="Applies only to the typing practice text and this preview."
                  options={TYPING_FONT_OPTIONS}
                  value={themeSettings.typingFont}
                  getAriaLabel={(option) => `${option.label} font`}
                  onChange={(value) => handleThemeSetting("typingFont", value as ThemeSettings["typingFont"])}
                />

                <ButtonGroup
                  label="Typing text size"
                  description="Changes the practice text scale only."
                  options={TYPING_TEXT_SIZE_OPTIONS}
                  value={themeSettings.typingTextSize}
                  getAriaLabel={(option) => `${option.label} text size`}
                  onChange={(value) => handleThemeSetting("typingTextSize", value as ThemeSettings["typingTextSize"])}
                />

                <ButtonGroup
                  label="Typing width"
                  description="Adjusts the reading measure inside practice."
                  options={TYPING_WIDTH_OPTIONS}
                  value={themeSettings.typingWidth}
                  getAriaLabel={(option) => `${option.label} typing width`}
                  onChange={(value) => handleThemeSetting("typingWidth", value as ThemeSettings["typingWidth"])}
                />

                <ButtonGroup
                  label="Caret style"
                  description="Controls the active typing position only."
                  options={CARET_STYLE_OPTIONS}
                  value={themeSettings.caretStyle}
                  getAriaLabel={(option) => `${option.label} caret style`}
                  onChange={(value) => handleThemeSetting("caretStyle", value as ThemeSettings["caretStyle"])}
                />

                <ButtonGroup
                  label="Blink"
                  description="Toggle caret blinking during practice."
                  options={CARET_BLINK_OPTIONS}
                  value={themeSettings.caretBlink}
                  getAriaLabel={(option) => `${option.label} blink`}
                  onChange={(value) => handleThemeSetting("caretBlink", value as ThemeSettings["caretBlink"])}
                />

                <ButtonGroup
                  label="Typing colors"
                  description="Changes pending, correct, wrong, and current text states."
                  options={TYPING_COLOR_STYLE_OPTIONS}
                  value={themeSettings.typingColorStyle}
                  getAriaLabel={(option) => `${option.label} typing colors`}
                  onChange={(value) => handleThemeSetting("typingColorStyle", value as ThemeSettings["typingColorStyle"])}
                />
              </div>
            </section>

            <section id="sound" className="scroll-mt-5 rounded-xl bg-ink-950/70 p-5 shadow-glow backdrop-blur">
              <SectionHeading
                eyebrow="Sound"
                title="Sound"
                description="Choose the keyboard sound pack used while typing in practice."
              />

              <div className="mt-5">
                <ButtonGroup
                  label="Keyboard sound"
                  description={selectedSoundOption.description}
                  options={KEYBOARD_SOUND_OPTIONS}
                  value={keyboardSoundSetting}
                  getAriaLabel={(option) => `${option.label} sound`}
                  onChange={(value) => handleKeyboardSoundSetting(value as KeyboardSoundSetting)}
                />
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
                  className="formaltype-themed-range h-10 w-full"
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
      data-testid="theme-preview-card"
      aria-label={`${preset.label} theme preview`}
      aria-pressed={isSelected}
      onClick={onSelect}
      className={`group inline-flex h-9 w-[8.25rem] items-center gap-2 overflow-hidden rounded-full border px-2.5 text-left transition ${
        isSelected
          ? "border-brass/70 bg-brass/12 shadow-[0_0_0_1px_rgb(var(--color-accent)/0.18)]"
          : "border-paper/10 bg-paper/[0.035] hover:border-brass/45 hover:bg-paper/[0.055]"
      }`}
    >
      <span
        data-testid="theme-preview-accent-dot"
        className="h-3 w-3 shrink-0 rounded-full border border-white/20"
        style={{
          backgroundColor: preset.preview.accent,
          boxShadow: `0 0 0 3px ${preset.preview.background}, 0 0 0 4px ${preset.preview.muted}`
        }}
      />
      <span className="min-w-0 flex-1 truncate font-mono text-[0.68rem] font-semibold leading-none text-paper">
        {preset.label}
      </span>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isSelected ? "bg-brass" : "bg-paper/25"}`} />
    </button>
  );
}

function SettingsLivePreview({
  themeSettings,
  soundLabel,
  keyboardSoundSetting,
  keyboardSoundVolume,
  onTestSound
}: {
  themeSettings: ThemeSettings;
  soundLabel: string;
  keyboardSoundSetting: KeyboardSoundSetting;
  keyboardSoundVolume: number;
  onTestSound: () => void;
}) {
  return (
    <aside
      data-testid="settings-live-preview"
      className="sticky top-5 rounded-xl border border-paper/10 bg-ink-950/80 p-4 shadow-glow backdrop-blur"
    >
      <p className="font-mono text-xs uppercase text-brass">Live preview</p>
      <div
        data-testid="settings-typing-preview-frame"
        className={`mt-4 rounded-lg border border-paper/10 bg-ink-900/65 p-3 formaltype-typing-colors-${themeSettings.typingColorStyle} formaltype-settings-preview-width-${themeSettings.typingWidth}`}
      >
        <p
          data-testid="settings-typing-preview-sample"
          className={`formaltype-typing-font-${themeSettings.typingFont} formaltype-settings-preview-size-${themeSettings.typingTextSize}`}
          aria-label="Typing preview"
        >
          <span className="formaltype-typed-correct">form</span>
          <span className="formaltype-typed-wrong">a</span>
          <span
            className={`formaltype-typed-current formaltype-caret-${themeSettings.caretStyle} ${
              themeSettings.caretBlink === "off" ? "formaltype-caret-static" : "formaltype-caret-animated"
            }`}
          >
            l
          </span>
          <span className="formaltype-typed-pending"> type</span>
        </p>
        <p className="mt-2 font-mono text-[0.68rem] uppercase text-paper/35">
          {themeSettings.caretStyle} caret / {themeSettings.typingColorStyle.replace("-", " ")}
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-paper/10 bg-paper/[0.035] p-3">
        <p className="font-mono text-[0.68rem] uppercase text-paper/35">Sound</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-sm text-paper/80">{soundLabel}</p>
            <p className="mt-1 font-mono text-xs text-paper/40">{Math.round(keyboardSoundVolume * 100)}% volume</p>
          </div>
          <button
            type="button"
            onClick={onTestSound}
            disabled={keyboardSoundSetting === "off"}
            className="rounded-md border border-paper/10 bg-brass/15 px-2.5 py-1.5 font-mono text-xs text-brass transition hover:border-brass/50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Test
          </button>
        </div>
      </div>
    </aside>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase text-brass">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold text-paper">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-paper/55">{description}</p>
    </div>
  );
}

function ButtonGroup<Option extends { value: string; label: string }>({
  label,
  description,
  options,
  value,
  getAriaLabel,
  renderPrefix,
  onChange
}: {
  label: string;
  description: string;
  options: Option[];
  value: string;
  getAriaLabel: (option: Option) => string;
  renderPrefix?: (option: Option) => React.ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(16rem,1.25fr)] md:items-start">
      <div>
        <legend className="font-mono text-sm text-paper/80">{label}</legend>
        <p className="mt-1 text-sm text-paper/45">{description}</p>
      </div>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              aria-label={getAriaLabel(option)}
              aria-pressed={isSelected}
              onClick={() => onChange(option.value)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs transition ${
                isSelected
                  ? "border-brass/70 bg-brass/15 text-brass shadow-[0_0_0_1px_rgb(var(--color-accent)/0.14)]"
                  : "border-paper/10 bg-paper/[0.035] text-paper/60 hover:border-paper/20 hover:bg-paper/[0.06] hover:text-paper/80"
              }`}
            >
              {renderPrefix?.(option)}
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function AccentDot({ accent }: { accent: string }) {
  return (
    <span
      className="h-3 w-3 rounded-full border border-white/20"
      style={{ backgroundColor: ACCENT_SWATCHES[accent] ?? "rgb(var(--color-accent))" }}
    />
  );
}

const ACCENT_SWATCHES: Record<string, string> = {
  blue: "rgb(91 157 255)",
  purple: "rgb(168 125 255)",
  emerald: "rgb(76 189 138)",
  rose: "rgb(244 101 135)",
  amber: "rgb(202 164 93)",
  cyan: "rgb(34 211 238)",
  lime: "rgb(132 204 22)",
  red: "rgb(239 68 68)",
  orange: "rgb(249 115 22)"
};
