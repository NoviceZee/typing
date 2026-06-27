"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
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
  const soundPlayer = useRef(createKeyboardSoundPlayer());
  const selectedSoundOption = useMemo(
    () => KEYBOARD_SOUND_OPTIONS.find((option) => option.value === keyboardSoundSetting) ?? KEYBOARD_SOUND_OPTIONS[0],
    [keyboardSoundSetting]
  );

  useEffect(() => {
    const savedSoundSetting = readKeyboardSoundSetting();
    setKeyboardSoundSetting(savedSoundSetting);
    setKeyboardSoundVolume(readKeyboardSoundVolume());
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

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-4xl px-1">
        <div className="mb-6">
          <p className="font-mono text-xs uppercase text-brass">Preferences</p>
          <h1 className="mt-2 text-3xl font-semibold text-paper md:text-4xl">Settings</h1>
        </div>

        <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
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
      </section>
    </AppShell>
  );
}
