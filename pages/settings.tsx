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
  readStoredRules,
  readThemeSettings,
  writeStoredRules,
  writeThemeSettings
} from "@/lib/app-storage";
import { DEFAULT_RULES, TypingRules } from "@/lib/typing-engine";
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
  const [rules, setRules] = useState<TypingRules>(DEFAULT_RULES);
  const [activeSectionId, setActiveSectionId] = useState(SETTINGS_NAV_ITEMS[0].id);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const soundPlayer = useRef(createKeyboardSoundPlayer());
  const savedFeedbackTimerRef = useRef<number | null>(null);
  const selectedSoundOption = useMemo(
    () => KEYBOARD_SOUND_OPTIONS.find((option) => option.value === keyboardSoundSetting) ?? KEYBOARD_SOUND_OPTIONS[0],
    [keyboardSoundSetting]
  );

  useEffect(() => {
    const savedSoundSetting = readKeyboardSoundSetting();
    setKeyboardSoundSetting(savedSoundSetting);
    setKeyboardSoundVolume(readKeyboardSoundVolume());
    setThemeSettings(readThemeSettings());
    setRules(readStoredRules());
    soundPlayer.current.preload(savedSoundSetting);
  }, []);

  useEffect(() => () => {
    if (savedFeedbackTimerRef.current !== null) window.clearTimeout(savedFeedbackTimerRef.current);
  }, []);

  function announceSaved() {
    setShowSavedFeedback(true);
    if (savedFeedbackTimerRef.current !== null) window.clearTimeout(savedFeedbackTimerRef.current);
    savedFeedbackTimerRef.current = window.setTimeout(() => setShowSavedFeedback(false), 1800);
  }

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const sections = SETTINGS_NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(
      (section): section is HTMLElement => Boolean(section)
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top)[0];

        if (visibleEntry?.target.id) {
          setActiveSectionId(visibleEntry.target.id);
        }
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0.01 }
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  function handleKeyboardSoundSetting(nextSetting: KeyboardSoundSetting) {
    setKeyboardSoundSetting(nextSetting);
    writeKeyboardSoundSetting(nextSetting);
    announceSaved();
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
    announceSaved();
    if (keyboardSoundSetting !== "off") {
      soundPlayer.current.play(keyboardSoundSetting, "normal", nextVolume);
    }
  }

  function handleThemeSetting<Key extends keyof ThemeSettings>(key: Key, value: ThemeSettings[Key]) {
    announceSaved();
    setThemeSettings((current) => {
      const nextSettings = { ...current, [key]: value };
      writeThemeSettings(nextSettings);
      return nextSettings;
    });
  }

  function handleThemePreset(preset: ThemePresetOption) {
    announceSaved();
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

  function handleRuleSetting<Key extends keyof TypingRules>(key: Key, value: TypingRules[Key]) {
    announceSaved();
    setRules((current) => {
      const nextRules = { ...current, [key]: value };
      writeStoredRules(nextRules);
      return nextRules;
    });
  }

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-6xl px-1">
        <div className="mb-6 rounded-xl border border-paper/10 bg-ink-900/45 p-5 shadow-glow backdrop-blur">
          <p className="font-mono text-xs uppercase text-brass">Preferences</p>
          <h1 className="mt-2 text-3xl font-semibold text-paper md:text-4xl">Settings</h1>
          <div role="status" aria-live="polite" className="mt-2 min-h-5 font-mono text-xs text-mint">
            {showSavedFeedback ? "Saved automatically" : "Changes save automatically"}
          </div>
        </div>

        <div
          data-testid="settings-layout"
          className="grid w-full gap-5 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)] lg:items-start"
        >
          <SettingsSidebar
            activeSectionId={activeSectionId}
            onSelectSection={setActiveSectionId}
            themeSettings={themeSettings}
            soundLabel={selectedSoundOption.label}
            keyboardSoundSetting={keyboardSoundSetting}
            keyboardSoundVolume={keyboardSoundVolume}
            onTestSound={() => soundPlayer.current.play(keyboardSoundSetting, "normal", keyboardSoundVolume)}
          />

          <div data-testid="settings-content" className="grid min-w-0 gap-5">
            <section
              id="personalization"
              className="formaltype-settings-card order-2 scroll-mt-5 rounded-xl bg-ink-950/70 p-5 shadow-glow backdrop-blur"
            >
              <SectionHeading
                eyebrow="Personalization"
                title="Theme"
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
                  options={THEME_MODE_OPTIONS}
                  value={themeSettings.mode}
                  getAriaLabel={(option) => `${option.label} mode`}
                  onChange={(value) => handleThemeSetting("mode", value as ThemeSettings["mode"])}
                />

                <AccentSelector
                  value={themeSettings.accentColor}
                  onChange={(value) => handleThemeSetting("accentColor", value)}
                />

                <ButtonGroup
                  label="App font"
                  description="Changes navigation, controls and analytics. Uses fonts already available on your device."
                  options={APP_FONT_OPTIONS}
                  value={themeSettings.appFont}
                  getAriaLabel={(option) => `${option.label} app font`}
                  onChange={(value) => handleThemeSetting("appFont", value as ThemeSettings["appFont"])}
                />
              </div>
            </section>

            <section
              id="typing"
              className="formaltype-settings-card order-3 scroll-mt-5 rounded-xl bg-ink-950/70 p-5 shadow-glow backdrop-blur"
            >
              <SectionHeading
                eyebrow="Typing"
                title="Typing Area"
              />

              <div className="mt-5 grid gap-6 md:gap-7">
                <ButtonGroup
                  label="Typing font"
                  description="Choose separately from the interface font so passages stay comfortable to read."
                  options={TYPING_FONT_OPTIONS}
                  value={themeSettings.typingFont}
                  getAriaLabel={(option) => `${option.label} font`}
                  onChange={(value) => handleThemeSetting("typingFont", value as ThemeSettings["typingFont"])}
                />

                <ButtonGroup
                  label="Typing text size"
                  options={TYPING_TEXT_SIZE_OPTIONS}
                  value={themeSettings.typingTextSize}
                  getAriaLabel={(option) => `${option.label} text size`}
                  onChange={(value) => handleThemeSetting("typingTextSize", value as ThemeSettings["typingTextSize"])}
                />

                <ButtonGroup
                  label="Typing width"
                  options={TYPING_WIDTH_OPTIONS}
                  value={themeSettings.typingWidth}
                  getAriaLabel={(option) => `${option.label} typing width`}
                  onChange={(value) => handleThemeSetting("typingWidth", value as ThemeSettings["typingWidth"])}
                />

                <ButtonGroup
                  label="Caret style"
                  options={CARET_STYLE_OPTIONS}
                  value={themeSettings.caretStyle}
                  getAriaLabel={(option) => `${option.label} caret style`}
                  onChange={(value) => handleThemeSetting("caretStyle", value as ThemeSettings["caretStyle"])}
                />

                <ButtonGroup
                  label="Blink"
                  options={CARET_BLINK_OPTIONS}
                  value={themeSettings.caretBlink}
                  getAriaLabel={(option) => `${option.label} blink`}
                  onChange={(value) => handleThemeSetting("caretBlink", value as ThemeSettings["caretBlink"])}
                />

                <ButtonGroup
                  label="Typing colors"
                  options={TYPING_COLOR_STYLE_OPTIONS}
                  value={themeSettings.typingColorStyle}
                  getAriaLabel={(option) => `${option.label} typing colors`}
                  onChange={(value) => handleThemeSetting("typingColorStyle", value as ThemeSettings["typingColorStyle"])}
                />
              </div>
            </section>

            <section
              id="behavior"
              className="formaltype-settings-card order-1 scroll-mt-5 rounded-xl bg-ink-950/70 p-5 shadow-glow backdrop-blur"
            >
              <SectionHeading
                eyebrow="Typing Rules"
                title="Behavior"
              />

              <div className="mt-5 grid gap-4">
                <BooleanRuleGroup
                  label="Start with Tab"
                  value={rules.requireTabToStart}
                  onChange={(value) => handleRuleSetting("requireTabToStart", value)}
                />

                <BooleanRuleGroup
                  label="Two spaces after period"
                  value={rules.requireTwoSpacesAfterPeriod}
                  onChange={(value) => handleRuleSetting("requireTwoSpacesAfterPeriod", value)}
                />

                <BooleanRuleGroup
                  label="Strict capitalization"
                  value={rules.caseSensitive}
                  onChange={(value) => handleRuleSetting("caseSensitive", value)}
                />

                <BooleanRuleGroup
                  label="Require uppercase"
                  value={rules.enforceUppercase}
                  onChange={(value) => handleRuleSetting("enforceUppercase", value)}
                />

                <BooleanRuleGroup
                  label="Require lowercase"
                  value={rules.enforceLowercase}
                  onChange={(value) => handleRuleSetting("enforceLowercase", value)}
                />

                <BooleanRuleGroup
                  label="Strict punctuation"
                  value={rules.punctuationSensitive}
                  onChange={(value) => handleRuleSetting("punctuationSensitive", value)}
                />

                <BooleanRuleGroup
                  label="Extra spaces"
                  value={rules.enforceExtraSpaces}
                  onChange={(value) => handleRuleSetting("enforceExtraSpaces", value)}
                />

                <BooleanRuleGroup
                  label="Missing spaces"
                  value={rules.enforceMissingSpaces}
                  onChange={(value) => handleRuleSetting("enforceMissingSpaces", value)}
                />

                <BooleanRuleGroup
                  label="Capitalization hints"
                  value={rules.autoCapitalisationHints}
                  onChange={(value) => handleRuleSetting("autoCapitalisationHints", value)}
                />

                <BooleanRuleGroup
                  label="Show mistakes immediately"
                  value={rules.showMistakesImmediately}
                  onChange={(value) => handleRuleSetting("showMistakesImmediately", value)}
                />

                <BooleanRuleGroup
                  label="Allow backspace"
                  value={rules.allowBackspace}
                  onChange={(value) => handleRuleSetting("allowBackspace", value)}
                />
              </div>
            </section>

            <section
              id="sound"
              className="formaltype-settings-card order-4 scroll-mt-5 rounded-xl bg-ink-950/70 p-5 shadow-glow backdrop-blur"
            >
              <SectionHeading
                eyebrow="Sound"
                title="Sound"
              />

              <SoundPackSelector
                value={keyboardSoundSetting}
                onChange={handleKeyboardSoundSetting}
              />

              <div className="mt-6 grid gap-x-8 gap-y-3 py-1 lg:grid-cols-[minmax(280px,1fr)_minmax(12rem,16rem)] lg:items-center">
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

function SettingsSidebar({
  activeSectionId,
  onSelectSection,
  themeSettings,
  soundLabel,
  keyboardSoundSetting,
  keyboardSoundVolume,
  onTestSound
}: {
  activeSectionId: string;
  onSelectSection: (sectionId: string) => void;
  themeSettings: ThemeSettings;
  soundLabel: string;
  keyboardSoundSetting: KeyboardSoundSetting;
  keyboardSoundVolume: number;
  onTestSound: () => void;
}) {
  return (
    <aside data-testid="settings-sidebar" className="grid w-full min-w-0 gap-4 self-start lg:sticky lg:top-5">
      <nav
        aria-label="Settings sections"
        className="rounded-xl border border-paper/10 bg-ink-950/80 p-3 shadow-glow backdrop-blur"
      >
        <p className="px-2 font-mono text-xs uppercase text-brass">Settings</p>
        <div className="mt-3 grid gap-1">
          {SETTINGS_NAV_ITEMS.map((item) => {
            const isActive = activeSectionId === item.id;

            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => onSelectSection(item.id)}
                className={`rounded-md px-2.5 py-2 font-mono text-sm transition ${
                  isActive
                    ? "bg-brass/15 text-brass shadow-[0_0_0_1px_rgb(var(--color-accent)/0.12)]"
                    : "text-paper/55 hover:bg-paper/[0.055] hover:text-paper/80"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </div>
      </nav>

      <SettingsLivePreview
        themeSettings={themeSettings}
        soundLabel={soundLabel}
        keyboardSoundSetting={keyboardSoundSetting}
        keyboardSoundVolume={keyboardSoundVolume}
        onTestSound={onTestSound}
      />
    </aside>
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
      className="rounded-xl border border-paper/10 bg-ink-950/80 p-4 shadow-glow backdrop-blur"
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

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase text-brass">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold text-paper">{title}</h2>
      {description && <p className="mt-1 max-w-2xl text-sm text-paper/55">{description}</p>}
    </div>
  );
}

function AccentSelector({
  value,
  onChange
}: {
  value: ThemeSettings["accentColor"];
  onChange: (value: ThemeSettings["accentColor"]) => void;
}) {
  return (
    <fieldset className="grid gap-x-8 gap-y-3 py-1">
      <div>
        <legend className="font-mono text-sm text-paper/80">Accent</legend>
      </div>
      <div role="group" aria-label="Accent color" className="flex flex-wrap gap-2">
        {ACCENT_COLOR_OPTIONS.map((option) => {
          const isSelected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              aria-label={`${option.label} accent`}
              aria-pressed={isSelected}
              title={option.label}
              onClick={() => onChange(option.value)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                isSelected
                  ? "border-brass/80 bg-brass/15 shadow-[0_0_0_1px_rgb(var(--color-accent)/0.2)]"
                  : "border-paper/10 bg-paper/[0.035] hover:border-paper/25 hover:bg-paper/[0.06]"
              }`}
            >
              <AccentDot accent={option.value} />
              <span className="sr-only">{option.label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function SoundPackSelector({
  value,
  onChange
}: {
  value: KeyboardSoundSetting;
  onChange: (value: KeyboardSoundSetting) => void;
}) {
  const offOption = KEYBOARD_SOUND_OPTIONS.find((option) => option.value === "off");

  return (
    <div className="mt-5 grid gap-5">
      <div role="group" aria-labelledby="keyboard-sound-label" className="grid gap-3 py-1">
        <div data-testid="keyboard-sound-row" className="formaltype-setting-row">
          <p id="keyboard-sound-label" className="font-mono text-sm text-paper/80">
            Keyboard sound
          </p>
          <div className="formaltype-setting-row-controls">
            {offOption && (
              <button
                type="button"
                aria-label={`${offOption.label} sound`}
                aria-pressed={value === offOption.value}
                onClick={() => onChange(offOption.value)}
                className={`inline-flex min-h-10 items-center rounded-md border px-3 py-2 font-mono text-xs transition ${
                  value === offOption.value
                    ? "border-brass/70 bg-brass/15 text-brass shadow-[0_0_0_1px_rgb(var(--color-accent)/0.14)]"
                    : "border-paper/10 bg-paper/[0.035] text-paper/60 hover:border-paper/20 hover:bg-paper/[0.06] hover:text-paper/80"
                }`}
              >
                {offOption.label}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {SOUND_PACK_GROUPS.map((group) => (
          <fieldset key={group.label} role="group" aria-label={`${group.label} sound packs`} className="grid gap-2">
            <legend className="font-mono text-[0.68rem] uppercase text-paper/35">{group.label}</legend>
            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={`${option.label} sound`}
                    aria-pressed={isSelected}
                    onClick={() => onChange(option.value)}
                    className={`inline-flex min-h-10 items-center rounded-md border px-3 py-2 font-mono text-xs transition ${
                      isSelected
                        ? "border-brass/70 bg-brass/15 text-brass shadow-[0_0_0_1px_rgb(var(--color-accent)/0.14)]"
                        : "border-paper/10 bg-paper/[0.035] text-paper/60 hover:border-paper/20 hover:bg-paper/[0.06] hover:text-paper/80"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}

function BooleanRuleGroup({
  label,
  description,
  value,
  onChange
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const ariaLabelSuffix = lowerFirst(label);

  return (
    <ButtonGroup
      label={label}
      description={description}
      options={BOOLEAN_OPTIONS}
      value={String(value)}
      getAriaLabel={(option) => `${option.label} ${ariaLabelSuffix}`}
      onChange={(nextValue) => onChange(nextValue === "true")}
    />
  );
}

function ButtonGroup<Option extends { value: string; label: string }>({
  label,
  description,
  options,
  value,
  getAriaLabel,
  layout = "inline",
  renderPrefix,
  onChange
}: {
  label: string;
  description?: string;
  options: Option[];
  value: string;
  getAriaLabel: (option: Option) => string;
  layout?: "inline" | "stacked";
  renderPrefix?: (option: Option) => React.ReactNode;
  onChange: (value: string) => void;
}) {
  const isStacked = layout === "stacked";

  return (
    <fieldset
      className={isStacked ? "grid gap-x-8 gap-y-3 py-1" : "formaltype-setting-row py-1"}
    >
      <div>
        <legend className="font-mono text-sm text-paper/80">{label}</legend>
        {description && <p className="mt-1 text-sm text-paper/45">{description}</p>}
      </div>
      <div role="group" aria-label={label} className={isStacked ? "flex flex-wrap gap-2" : "formaltype-setting-row-controls"}>
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

function lowerFirst(value: string) {
  return value ? `${value[0].toLocaleLowerCase()}${value.slice(1)}` : value;
}

function AccentDot({ accent }: { accent: string }) {
  return (
    <span
      data-testid="accent-swatch"
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

const BOOLEAN_OPTIONS = [
  { value: "true", label: "On" },
  { value: "false", label: "Off" }
];

const SOUND_PACK_GROUPS: Array<{
  label: "Synthetic" | "Recorded" | "Effects";
  options: typeof KEYBOARD_SOUND_OPTIONS;
}> = [
  {
    label: "Synthetic",
    options: getSoundOptions(["mechanical", "clicky", "soft", "laptop", "typewriter"])
  },
  {
    label: "Recorded",
    options: getSoundOptions(["recorded", "recorded-6", "recorded-9", "recorded-2"])
  },
  {
    label: "Effects",
    options: getSoundOptions(["recorded-3", "recorded-1", "recorded-10", "recorded-4", "recorded-5"])
  }
];

function getSoundOptions(values: KeyboardSoundSetting[]) {
  return values
    .map((value) => KEYBOARD_SOUND_OPTIONS.find((option) => option.value === value))
    .filter((option): option is (typeof KEYBOARD_SOUND_OPTIONS)[number] => Boolean(option));
}

const SETTINGS_NAV_ITEMS = [
  { id: "behavior", label: "Behavior" },
  { id: "personalization", label: "Personalization" },
  { id: "typing", label: "Typing" },
  { id: "sound", label: "Sound" }
];
