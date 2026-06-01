"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DEFAULT_RULES, TypingRules } from "@/lib/typing-engine";
import { readStoredRules, writeStoredRules } from "@/lib/app-storage";

const SETTINGS: Array<{ key: keyof TypingRules; label: string; description: string }> = [
  { key: "requireTabToStart", label: "Require Tab to start", description: "Typing is locked until Tab starts the test." },
  { key: "requireTwoSpacesAfterPeriod", label: "Two spaces after period", description: "A full stop requires two following spaces unless it ends the passage or line." },
  { key: "caseSensitive", label: "Case sensitive", description: "Uppercase and lowercase letters must match exactly." },
  { key: "punctuationSensitive", label: "Punctuation sensitive", description: "Punctuation differences count as mistakes." },
  { key: "enforceExtraSpaces", label: "Extra spaces count as errors", description: "Typed spaces that are not in the target count against accuracy." },
  { key: "enforceMissingSpaces", label: "Missing spaces count as errors", description: "Skipped target spaces count against accuracy." },
  { key: "allowBackspace", label: "Allow backspace", description: "Backspace can delete previous input during a running test." },
  { key: "showMistakesImmediately", label: "Show mistakes immediately", description: "Mistakes are highlighted while typing instead of only after finish." }
];

export default function SettingsPage() {
  const [rules, setRules] = useState<TypingRules>(DEFAULT_RULES);

  useEffect(() => {
    setRules(readStoredRules());
  }, []);

  function updateRule(key: keyof TypingRules, value: boolean) {
    const nextRules = { ...rules, [key]: value };
    setRules(nextRules);
    writeStoredRules(nextRules);
  }

  return (
    <AppShell sideAd={false}>
      <section className="mx-auto max-w-3xl">
        <p className="font-mono text-xs uppercase text-brass">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-paper md:text-4xl">Typing rules</h1>

        <div className="mt-8 rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-6">
          <div className="space-y-3">
            {SETTINGS.map((setting) => (
              <label
                key={setting.key}
                className="flex cursor-pointer items-center justify-between gap-5 rounded-md border border-paper/10 bg-ink-900 px-4 py-4 transition hover:border-brass/40"
              >
                <span>
                  <span className="block text-sm font-semibold text-paper">{setting.label}</span>
                  <span className="mt-1 block font-mono text-xs text-paper/45">{setting.description}</span>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(rules[setting.key])}
                  onChange={(event) => updateRule(setting.key, event.target.checked)}
                  className="h-5 w-5 accent-brass"
                />
              </label>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
