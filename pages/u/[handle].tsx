"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Award, Copy, Flame, Lock, Medal, Target, Trophy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRouter } from "next/router";
import { buildProgressAnalytics } from "@/lib/analytics";
import { getSupabasePublicProfileByHandle } from "@/lib/profileStorage";
import type { SupabasePublicProfile } from "@/lib/profileStorage";
import {
  SupabaseAnalyticsTypingResultRow,
  getSupabasePublicTypingResultsByHandle
} from "@/lib/typingResultStorage";

type LoadState = "loading" | "ready" | "not-found" | "error";

export default function PublicUserProfilePage() {
  const router = useRouter();
  const routeHandle = Array.isArray(router.query.handle) ? router.query.handle[0] : router.query.handle;
  const [profile, setProfile] = useState<SupabasePublicProfile | null>(null);
  const [results, setResults] = useState<SupabaseAnalyticsTypingResultRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [copyMessage, setCopyMessage] = useState("");
  const analytics = useMemo(() => buildProgressAnalytics(results), [results]);
  const recentResults = useMemo(
    () => [...results].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at)).slice(0, 5),
    [results]
  );

  useEffect(() => {
    let isMounted = true;

    if (!router.isReady || !routeHandle) {
      return;
    }

    setLoadState("loading");
    setCopyMessage("");
    getSupabasePublicProfileByHandle(routeHandle)
      .then(async (publicProfile) => {
        if (!isMounted) return;

        if (!publicProfile) {
          setProfile(null);
          setResults([]);
          setLoadState("not-found");
          return;
        }

        const publicResults = await getSupabasePublicTypingResultsByHandle(publicProfile.handle);
        if (!isMounted) return;
        setProfile(publicProfile);
        setResults(publicResults);
        setLoadState("ready");
      })
      .catch(() => {
        if (!isMounted) return;
        setProfile(null);
        setResults([]);
        setLoadState("error");
      });

    return () => {
      isMounted = false;
    };
  }, [routeHandle, router.isReady]);

  async function handleCopyUrl() {
    if (!profile || typeof window === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(`${window.location.origin}/u/${profile.handle}`);
    setCopyMessage("Copied");
  }

  return (
    <AppShell sideAd={false}>
      <section className="mx-auto max-w-6xl">
        {loadState === "loading" && (
          <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-5 font-mono text-sm text-paper/45 shadow-glow">
            Loading public profile...
          </section>
        )}

        {loadState === "error" && (
          <section className="rounded-lg border border-ember/25 bg-ember/10 p-5 font-mono text-sm text-ember shadow-glow">
            Public profile could not be loaded.
          </section>
        )}

        {loadState === "not-found" && (
          <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
            <p className="font-mono text-xs uppercase text-brass">Public profile</p>
            <h1 className="mt-2 text-3xl font-semibold text-paper">Profile not found</h1>
            <p className="mt-4 text-sm leading-6 text-paper/55">No FormalType profile exists for that handle.</p>
          </section>
        )}

        {loadState === "ready" && profile && (
          <div className="space-y-6">
            <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase text-brass">Public profile</p>
                  <h1 className="mt-2 text-4xl font-semibold text-paper">@{profile.handle}</h1>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex items-center gap-2 rounded-md border border-paper/10 bg-ink-900 px-3 py-2 font-mono text-xs text-paper/65 transition hover:border-brass/40 hover:text-paper"
                >
                  <Copy className="h-4 w-4" />
                  {copyMessage || "Copy URL"}
                </button>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PublicStat label="Level" value={analytics.progression.currentLevel} icon={<Medal className="h-4 w-4" />} />
              <PublicStat label="Total XP" value={analytics.progression.totalXp} icon={<Award className="h-4 w-4" />} />
              <PublicStat label="Total tests" value={analytics.summary.totalTests} icon={<Target className="h-4 w-4" />} />
              <PublicStat label="Best WPM" value={formatNumber(analytics.summary.bestWpm)} icon={<Trophy className="h-4 w-4" />} />
              <PublicStat label="Best accuracy" value={`${formatNumber(analytics.summary.bestAccuracy)}%`} icon={<Target className="h-4 w-4" />} />
              <PublicStat label="Current streak" value={`${analytics.activity.currentStreakDays} days`} icon={<Flame className="h-4 w-4" />} />
              <PublicStat
                label="Achievements"
                value={`${analytics.achievements.unlockedCount}/${analytics.achievements.totalCount}`}
                icon={<Award className="h-4 w-4" />}
              />
            </section>

            <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-mono text-sm uppercase text-brass">Achievements</h2>
                  <p className="mt-1 font-mono text-[0.68rem] uppercase text-paper/35">
                    {analytics.achievements.unlockedCount} / {analytics.achievements.totalCount} unlocked
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {analytics.achievements.items.map((achievement) => (
                  <article
                    key={achievement.id}
                    className={`rounded-md border px-4 py-4 ${
                      achievement.isUnlocked ? "border-brass/30 bg-brass/10" : "border-paper/10 bg-ink-900/70 opacity-70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-mono text-sm uppercase text-paper">{achievement.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-paper/50">{achievement.description}</p>
                      </div>
                      <span className={achievement.isUnlocked ? "text-brass" : "text-paper/30"} aria-hidden="true">
                        {achievement.isUnlocked ? <Award className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </span>
                    </div>
                    <p className={`mt-4 font-mono text-[0.68rem] uppercase ${achievement.isUnlocked ? "text-brass" : "text-paper/35"}`}>
                      {achievement.isUnlocked ? "Unlocked" : "Locked"}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <RecentPublicResults results={recentResults} />
          </div>
        )}
      </section>
    </AppShell>
  );
}

function PublicStat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <article className="rounded-md border border-paper/10 bg-ink-950/75 px-4 py-4 shadow-glow">
      <div className="flex items-center justify-between gap-3 text-brass">
        <p className="font-mono text-[0.68rem] uppercase text-paper/40">{label}</p>
        {icon}
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold text-paper">{value}</p>
    </article>
  );
}

function RecentPublicResults({ results }: { results: SupabaseAnalyticsTypingResultRow[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-paper/10 bg-ink-950/75 shadow-glow">
      <div className="border-b border-paper/10 px-4 py-4 md:px-5">
        <h2 className="font-mono text-sm uppercase text-brass">Recent Results</h2>
      </div>
      {results.length === 0 && (
        <p className="px-4 py-5 font-mono text-sm text-paper/45 md:px-5">No public results yet.</p>
      )}
      {results.map((result) => (
        <article
          key={result.id}
          className="grid gap-3 border-b border-paper/10 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_7rem_6rem_7rem] md:items-center md:px-5"
        >
          <div>
            <div className="text-sm font-semibold text-paper">{result.passage_title}</div>
            {result.passage_category && (
              <div className="mt-1 font-mono text-[0.68rem] uppercase text-paper/35">{result.passage_category}</div>
            )}
          </div>
          <PublicResultMetric label="Duration" value={formatDuration(result.duration_seconds)} />
          <PublicResultMetric label="WPM" value={formatNumber(result.wpm)} strong />
          <PublicResultMetric label="Accuracy" value={`${formatNumber(result.accuracy)}%`} />
        </article>
      ))}
    </section>
  );
}

function PublicResultMetric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[0.68rem] uppercase text-paper/35 md:hidden">{label}</div>
      <div className={`font-mono text-sm ${strong ? "font-semibold text-paper" : "text-paper/65"}`}>{value}</div>
    </div>
  );
}

function formatNumber(value: number) {
  return Number(value).toFixed(1);
}

function formatDuration(seconds: number) {
  if (seconds <= 0) {
    return "Infinite";
  }

  return `${Math.round(seconds / 60)}m`;
}
