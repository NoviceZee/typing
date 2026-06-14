"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { getSupabaseProfile, upsertSupabaseProfile } from "@/lib/profileStorage";
import { DEFAULT_RULES, TypingRules } from "@/lib/typing-engine";
import { readStoredRules, writeStoredRules } from "@/lib/app-storage";
import { SupabaseOwnTypingResultRow, getSupabaseOwnTypingResults } from "@/lib/typingResultStorage";

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
  const { user, isConfigured } = useAuth();
  const [rules, setRules] = useState<TypingRules>(DEFAULT_RULES);
  const [displayName, setDisplayName] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [results, setResults] = useState<SupabaseOwnTypingResultRow[]>([]);
  const [resultsMessage, setResultsMessage] = useState("");
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  useEffect(() => {
    setRules(readStoredRules());
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setDisplayName("");
      setResults([]);
      setResultsMessage("");
      setIsLoadingResults(false);
      return;
    }

    getSupabaseProfile(user.id)
      .then((profile) => {
        if (!isMounted) return;
        setDisplayName(profile?.display_name ?? "");
      })
      .catch((error) => {
        if (!isMounted) return;
        setProfileMessage(error instanceof Error ? error.message : "Display name could not be loaded.");
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      return;
    }

    setIsLoadingResults(true);
    setResultsMessage("");

    getSupabaseOwnTypingResults(user.id)
      .then((typingResults) => {
        if (!isMounted) return;
        setResults(typingResults);
      })
      .catch((error) => {
        if (!isMounted) return;
        setResultsMessage(error instanceof Error ? error.message : "Results could not be loaded.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingResults(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  function updateRule(key: keyof TypingRules, value: boolean) {
    const nextRules = { ...rules, [key]: value };
    setRules(nextRules);
    writeStoredRules(nextRules);
  }

  async function saveDisplayName() {
    if (!user) {
      setProfileMessage("Log in to set a leaderboard name.");
      return;
    }

    setIsSavingProfile(true);
    setProfileMessage("");

    try {
      const profile = await upsertSupabaseProfile(user.id, displayName);
      setDisplayName(profile.display_name);
      setProfileMessage("Display name saved.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Display name could not be saved.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <AppShell sideAd={false}>
      <section className="mx-auto max-w-3xl">
        <p className="font-mono text-xs uppercase text-brass">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-paper md:text-4xl">Settings</h1>

        <section className="mt-8 rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-paper">Leaderboard name</h2>
              <p className="mt-2 text-sm leading-6 text-paper/55">
                This public name appears on leaderboard rows. Your email stays private.
              </p>
            </div>
          </div>

          {user && isConfigured ? (
            <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <label className="block">
                <span className="font-mono text-xs uppercase text-paper/45">Display name</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={40}
                  className="mt-2 w-full rounded-md border border-paper/10 bg-ink-900 px-3 py-3 font-mono text-sm text-paper outline-none transition focus:border-brass/60"
                  placeholder="Your leaderboard name"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={saveDisplayName}
                  disabled={isSavingProfile}
                  className="rounded-md border border-brass/35 bg-brass/10 px-4 py-3 font-mono text-sm text-brass transition hover:bg-brass/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingProfile ? "Saving..." : "Save name"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-md border border-paper/10 bg-ink-900 px-4 py-3 font-mono text-sm text-paper/55">
              Log in to set a public leaderboard name.
            </div>
          )}

          {profileMessage && (
            <div className="mt-4 rounded-md border border-brass/25 bg-brass/10 px-4 py-3 font-mono text-sm text-brass">
              {profileMessage}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-paper">My Results</h2>
              <p className="mt-2 text-sm leading-6 text-paper/55">
                Your recent typing history is private to your account.
              </p>
            </div>
          </div>

          {!user && (
            <div className="mt-5 rounded-md border border-paper/10 bg-ink-900 px-4 py-3 font-mono text-sm text-paper/55">
              <Link href="/login?redirectTo=/settings" className="text-brass hover:text-brass/80">
                Log in
              </Link>{" "}
              to view your typing history.
            </div>
          )}

          {user && resultsMessage && (
            <div className="mt-5 rounded-md border border-ember/25 bg-ember/10 px-4 py-3 font-mono text-sm text-ember">
              {resultsMessage}
            </div>
          )}

          {user && isLoadingResults && (
            <div className="mt-5 rounded-md border border-paper/10 bg-ink-900 px-4 py-3 font-mono text-sm text-paper/45">
              Loading results...
            </div>
          )}

          {user && !isLoadingResults && results.length === 0 && !resultsMessage && (
            <div className="mt-5 rounded-md border border-paper/10 bg-ink-900 px-4 py-5 font-mono text-sm text-paper/55">
              No results yet.{" "}
              <Link href="/practice" className="text-brass hover:text-brass/80">
                Start a practice session
              </Link>
              .
            </div>
          )}

          {user && results.length > 0 && (
            <>
              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <ResultStat label="Sessions" value={results.length} />
                <ResultStat label="Best WPM" value={formatNumber(getBestWpm(results))} />
                <ResultStat label="Average WPM" value={formatNumber(getAverage(results.map((result) => result.wpm)))} />
                <ResultStat
                  label="Average accuracy"
                  value={`${formatNumber(getAverage(results.map((result) => result.accuracy)))}%`}
                />
              </div>

              <div className="mt-5 overflow-hidden rounded-md border border-paper/10 bg-ink-900">
                <div className="grid grid-cols-[9rem_minmax(0,1fr)_7rem_6rem_7rem] border-b border-paper/10 px-4 py-3 font-mono text-xs uppercase text-paper/40 max-md:hidden">
                  <span>Date</span>
                  <span>Passage</span>
                  <span>Duration</span>
                  <span>WPM</span>
                  <span>Accuracy</span>
                </div>

                {results.map((result) => (
                  <article
                    key={result.id}
                    className="grid gap-3 border-b border-paper/10 px-4 py-4 last:border-b-0 md:grid-cols-[9rem_minmax(0,1fr)_7rem_6rem_7rem] md:items-center"
                  >
                    <ResultMetric label="Date" value={formatDate(result.created_at)} />
                    <div>
                      <div className="font-mono text-[0.68rem] uppercase text-paper/35 md:hidden">Passage</div>
                      <div className="text-sm font-semibold text-paper">{result.passage_title}</div>
                    </div>
                    <ResultMetric label="Duration" value={formatDuration(result.duration_seconds)} />
                    <ResultMetric label="WPM" value={formatNumber(result.wpm)} strong />
                    <ResultMetric label="Accuracy" value={`${formatNumber(result.accuracy)}%`} />
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="mt-8 rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-6">
          <h2 className="text-xl font-semibold text-paper">Typing rules</h2>
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
        </section>
      </section>
    </AppShell>
  );
}

function ResultStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-paper/10 bg-ink-900 px-4 py-3">
      <div className="font-mono text-[0.68rem] uppercase text-paper/40">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold text-paper">{value}</div>
    </div>
  );
}

function ResultMetric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[0.68rem] uppercase text-paper/35 md:hidden">{label}</div>
      <div className={`font-mono text-sm ${strong ? "font-semibold text-paper" : "text-paper/65"}`}>{value}</div>
    </div>
  );
}

function getBestWpm(results: SupabaseOwnTypingResultRow[]) {
  return Math.max(...results.map((result) => result.wpm));
}

function getAverage(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

function formatNumber(value: number) {
  return Number(value).toFixed(1);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}
