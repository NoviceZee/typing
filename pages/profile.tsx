"use client";

import React, { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Activity, Award, Clock, Flame, Lock, Medal, Target, Trophy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { buildProgressAnalytics } from "@/lib/analytics";
import {
  SupabaseAnalyticsTypingResultRow,
  getSupabaseAnalyticsTypingResults
} from "@/lib/typingResultStorage";

type TrendRange = "30" | "90" | "all";

const TREND_RANGES: Array<{ id: TrendRange; label: string }> = [
  { id: "30", label: "Last 30" },
  { id: "90", label: "Last 90" },
  { id: "all", label: "All-time" }
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [results, setResults] = useState<SupabaseAnalyticsTypingResultRow[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [resultsMessage, setResultsMessage] = useState("");
  const [trendRange, setTrendRange] = useState<TrendRange>("30");
  const analytics = useMemo(() => buildProgressAnalytics(results), [results]);
  const trendResults = useMemo(() => getTrendResults(results, trendRange), [results, trendRange]);

  useEffect(() => {
    if (isAuthLoading || user) {
      return;
    }

    router.push("/login?redirectTo=/profile");
  }, [isAuthLoading, router, user]);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setResults([]);
      setResultsMessage("");
      setIsLoadingResults(false);
      return;
    }

    setIsLoadingResults(true);
    setResultsMessage("");
    getSupabaseAnalyticsTypingResults(user.id)
      .then((typingResults) => {
        if (!isMounted) return;
        setResults(typingResults);
      })
      .catch((error) => {
        if (!isMounted) return;
        setResultsMessage(error instanceof Error ? error.message : "Progress analytics could not be loaded.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingResults(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  return (
    <AppShell sideAd={false}>
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase text-brass">Profile</p>
            <h1 className="mt-2 text-3xl font-semibold text-paper md:text-4xl">Profile</h1>
          </div>
          <div className="rounded-md border border-paper/10 bg-ink-950/75 px-4 py-3 text-right shadow-glow">
            <p className="font-mono text-2xl text-paper">{analytics.summary.totalTests}</p>
            <p className="font-mono text-xs uppercase text-paper/45">saved tests</p>
          </div>
        </div>

        {!user && !isAuthLoading && (
          <section className="mt-8 rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
            <p className="font-mono text-sm text-paper/55">
              <Link href="/login?redirectTo=/profile" className="text-brass hover:text-brass/80">
                Log in
              </Link>{" "}
              to view your profile.
            </p>
          </section>
        )}

        {user && (
          <div className="mt-6 space-y-6">
            {resultsMessage && (
              <div className="rounded-md border border-ember/25 bg-ember/10 px-4 py-3 font-mono text-sm text-ember">
                {resultsMessage}
              </div>
            )}

            {isLoadingResults && (
              <div className="rounded-md border border-paper/10 bg-ink-950/75 px-4 py-5 font-mono text-sm text-paper/45">
                Loading profile...
              </div>
            )}

            {!isLoadingResults && results.length === 0 && !resultsMessage && (
              <>
                <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
                  <p className="font-mono text-sm text-paper/55">
                    No saved results yet.{" "}
                    <Link href="/practice" className="text-brass hover:text-brass/80">
                      Start a practice session
                    </Link>{" "}
                    to build your progress profile.
                  </p>
                </section>
                <ProgressionSection analytics={analytics} />
                <ChallengesSection analytics={analytics} />
                <AchievementsSection analytics={analytics} />
              </>
            )}

            {results.length > 0 && (
              <>
                <ProgressSummary analytics={analytics} />
                <ProgressionSection analytics={analytics} />
                <ChallengesSection analytics={analytics} />
                <AchievementsSection analytics={analytics} />
                <Trends
                  range={trendRange}
                  results={trendResults}
                  onRangeChange={setTrendRange}
                />
                <section className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
                  <ConsistencySection />
                  <CategoryBreakdown analytics={analytics} />
                </section>
                <ActivitySection analytics={analytics} />
                <MyResults results={results} />
              </>
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function ProgressionSection({ analytics }: { analytics: ReturnType<typeof buildProgressAnalytics> }) {
  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-mono text-sm uppercase text-brass">Level</h2>
          <p className="mt-2 font-mono text-4xl font-semibold text-paper">{analytics.progression.currentLevel}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ProgressionMetric label="Total XP" value={analytics.progression.totalXp} />
          <ProgressionMetric label="XP to next level" value={analytics.progression.xpToNextLevel} />
        </div>
      </div>
      <div className="mt-5">
        <div className="flex items-center justify-between font-mono text-[0.68rem] uppercase text-paper/35">
          <span>{analytics.progression.currentLevelXp} XP</span>
          <span>{analytics.progression.xpForNextLevel} XP</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-paper/[0.06]" aria-label="Level progress">
          <div
            className="h-full rounded-full bg-brass"
            style={{ width: `${analytics.progression.progressPercent}%` }}
          />
        </div>
      </div>
    </section>
  );
}

function ProgressionMetric({ label, value }: { label: string; value: number }) {
  return (
    <article className="min-w-40 rounded-md border border-paper/10 bg-ink-900/70 px-4 py-3 text-right">
      <p className="font-mono text-[0.68rem] uppercase text-paper/40">{label}</p>
      <p className="mt-2 font-mono text-2xl text-paper">{value}</p>
    </article>
  );
}

function ChallengesSection({ analytics }: { analytics: ReturnType<typeof buildProgressAnalytics> }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <ChallengeGroupSection group={analytics.challenges.daily} />
      <ChallengeGroupSection group={analytics.challenges.weekly} />
    </section>
  );
}

function ChallengeGroupSection({ group }: { group: ReturnType<typeof buildProgressAnalytics>["challenges"]["daily"] }) {
  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
      <h2 className="font-mono text-sm uppercase text-brass">{group.title}</h2>
      <div className="mt-4 space-y-3">
        {group.items.map((item) => (
          <article key={item.id} className="rounded-md border border-paper/10 bg-ink-900/70 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-mono text-xs uppercase text-paper">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-paper/45">{item.description}</p>
              </div>
              <span className={`font-mono text-xs uppercase ${item.isComplete ? "text-brass" : "text-paper/35"}`}>
                {item.isComplete ? "Done" : "Open"}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper/[0.06]">
                <div
                  className="h-full rounded-full bg-brass/80"
                  style={{ width: `${Math.min(100, Math.round((item.progress / item.target) * 100))}%` }}
                />
              </div>
              <p className="min-w-20 text-right font-mono text-xs text-paper/55">
                {formatChallengeProgress(item.progress, item.unit)} / {formatChallengeProgress(item.target, item.unit)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AchievementsSection({ analytics }: { analytics: ReturnType<typeof buildProgressAnalytics> }) {
  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-mono text-sm uppercase text-brass">Achievements</h2>
          <p className="mt-1 font-mono text-[0.68rem] uppercase text-paper/35">
            {analytics.achievements.unlockedCount} / {analytics.achievements.totalCount} unlocked
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-brass/20 bg-brass/10 px-4 py-3">
          <Flame className="h-4 w-4 text-brass" />
          <div>
            <p className="font-mono text-[0.68rem] uppercase text-paper/40">Current streak</p>
            <p className="font-mono text-xl text-paper">{analytics.activity.currentStreakDays} days</p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {analytics.achievements.items.map((achievement) => (
          <article
            key={achievement.id}
            className={`rounded-md border px-4 py-4 transition ${
              achievement.isUnlocked
                ? "border-brass/30 bg-brass/10"
                : "border-paper/10 bg-ink-900/70 opacity-70"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-mono text-sm uppercase text-paper">{achievement.title}</h3>
                <p className="mt-2 text-sm leading-6 text-paper/50">{achievement.description}</p>
              </div>
              <span
                className={`rounded-full border p-2 ${
                  achievement.isUnlocked
                    ? "border-brass/35 bg-brass/15 text-brass"
                    : "border-paper/10 bg-paper/[0.03] text-paper/30"
                }`}
                aria-hidden="true"
              >
                {achievement.isUnlocked ? <Award className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </span>
            </div>
            <p
              className={`mt-4 font-mono text-[0.68rem] uppercase ${
                achievement.isUnlocked ? "text-brass" : "text-paper/35"
              }`}
            >
              {achievement.isUnlocked ? "Unlocked" : "Locked"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatChallengeProgress(value: number, unit: string) {
  return unit === "%" ? `${formatNumber(value)}%` : `${value}`;
}

function MyResults({ results }: { results: SupabaseAnalyticsTypingResultRow[] }) {
  const recentResults = [...results]
    .sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at))
    .slice(0, 10);

  return (
    <section className="overflow-hidden rounded-lg border border-paper/10 bg-ink-950/75 shadow-glow">
      <div className="border-b border-paper/10 px-4 py-4 md:px-5">
        <h2 className="font-mono text-sm uppercase text-brass">My Results</h2>
        <p className="mt-1 font-mono text-[0.68rem] uppercase text-paper/35">Recent attempts</p>
      </div>
      <div className="grid grid-cols-[9rem_minmax(0,1fr)_7rem_6rem_7rem] border-b border-paper/10 px-4 py-3 font-mono text-xs uppercase text-paper/40 max-md:hidden md:px-5">
        <span>Date</span>
        <span>Passage</span>
        <span>Duration</span>
        <span>WPM</span>
        <span>Accuracy</span>
      </div>
      {recentResults.map((result) => (
        <article
          key={result.id}
          className="grid gap-3 border-b border-paper/10 px-4 py-4 last:border-b-0 md:grid-cols-[9rem_minmax(0,1fr)_7rem_6rem_7rem] md:items-center md:px-5"
        >
          <ResultMetric label="Date" value={formatDate(result.created_at)} />
          <div>
            <div className="font-mono text-[0.68rem] uppercase text-paper/35 md:hidden">Passage</div>
            <div className="text-sm font-semibold text-paper">{result.passage_title}</div>
            {result.passage_category && (
              <div className="mt-1 font-mono text-[0.68rem] uppercase text-paper/35">{result.passage_category}</div>
            )}
          </div>
          <ResultMetric label="Duration" value={formatDuration(result.duration_seconds)} />
          <ResultMetric label="WPM" value={formatNumber(result.wpm)} strong />
          <ResultMetric label="Accuracy" value={`${formatNumber(result.accuracy)}%`} />
        </article>
      ))}
    </section>
  );
}

function ProgressSummary({ analytics }: { analytics: ReturnType<typeof buildProgressAnalytics> }) {
  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
      <h2 className="font-mono text-sm uppercase text-brass">Progress Summary</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total tests" value={analytics.summary.totalTests} icon={<Medal className="h-4 w-4" />} />
        <SummaryCard label="Total practice time" value={formatPracticeTime(analytics.summary.totalPracticeSeconds)} icon={<Clock className="h-4 w-4" />} />
        <SummaryCard label="All-time best WPM" value={formatNumber(analytics.summary.bestWpm)} icon={<Trophy className="h-4 w-4" />} />
        <SummaryCard label="All-time best accuracy" value={`${formatNumber(analytics.summary.bestAccuracy)}%`} icon={<Target className="h-4 w-4" />} />
        <SummaryCard label="Average WPM all-time" value={formatNumber(analytics.summary.averageWpm)} icon={<Activity className="h-4 w-4" />} />
        <SummaryCard label="Average WPM last 10" value={formatNumber(analytics.summary.averageWpmLast10)} icon={<Activity className="h-4 w-4" />} />
        <SummaryCard label="Average WPM last 100" value={formatNumber(analytics.summary.averageWpmLast100)} icon={<Activity className="h-4 w-4" />} />
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  icon
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-md border border-paper/10 bg-ink-900/80 px-4 py-4">
      <div className="flex items-center justify-between gap-3 text-brass">
        <p className="font-mono text-[0.68rem] uppercase text-paper/40">{label}</p>
        {icon}
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold text-paper">{value}</p>
    </article>
  );
}

function Trends({
  range,
  results,
  onRangeChange
}: {
  range: TrendRange;
  results: SupabaseAnalyticsTypingResultRow[];
  onRangeChange: (range: TrendRange) => void;
}) {
  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-mono text-sm uppercase text-brass">Trends</h2>
          <p className="mt-1 font-mono text-[0.68rem] uppercase text-paper/35">WPM and accuracy over time</p>
        </div>
        <div className="flex rounded-full bg-paper/[0.035] p-1">
          {TREND_RANGES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onRangeChange(option.id)}
              className={`rounded-full px-3 py-1.5 font-mono text-xs transition ${
                range === option.id ? "bg-brass/85 text-ink-950" : "text-paper/50 hover:bg-paper/5 hover:text-paper/80"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TrendChart
          title="WPM over time"
          unit="WPM"
          results={results}
          valueForResult={(result) => result.wpm}
          formatValue={formatNumber}
        />
        <TrendChart
          title="Accuracy over time"
          unit="Accuracy"
          results={results}
          valueForResult={(result) => result.accuracy}
          formatValue={(value) => `${formatNumber(value)}%`}
        />
      </div>
    </section>
  );
}

function TrendChart({
  title,
  unit,
  results,
  valueForResult,
  formatValue
}: {
  title: string;
  unit: string;
  results: SupabaseAnalyticsTypingResultRow[];
  valueForResult: (result: SupabaseAnalyticsTypingResultRow) => number;
  formatValue: (value: number) => string;
}) {
  const values = results.map(valueForResult);
  const points = buildChartPoints(values);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const latest = values[values.length - 1] ?? 0;
  const best = values.length > 0 ? Math.max(...values) : 0;

  return (
    <section className="rounded-md border border-paper/10 bg-ink-900/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-mono text-xs uppercase text-paper/70">{title}</h3>
          <p className="mt-1 font-mono text-[0.68rem] uppercase text-paper/35">{unit}</p>
        </div>
        <div className="text-right font-mono">
          <p className="text-lg text-paper">{formatValue(latest)}</p>
          <p className="text-[0.68rem] uppercase text-paper/35">Latest</p>
        </div>
      </div>
      <div className="mt-4 h-56 w-full overflow-hidden rounded-md bg-ink-950/70">
        <svg viewBox="0 0 420 220" role="img" aria-label={title} className="h-full w-full">
          <line x1="38" y1="174" x2="390" y2="174" stroke="rgba(238, 232, 212, 0.18)" />
          <line x1="38" y1="36" x2="38" y2="174" stroke="rgba(238, 232, 212, 0.18)" />
          <line x1="38" y1="105" x2="390" y2="105" stroke="rgba(238, 232, 212, 0.08)" strokeDasharray="5 7" />
          {points.length > 1 && (
            <path d={path} fill="none" stroke="rgb(196, 165, 96)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {points.map((point, index) => (
            <circle
              key={`${point.x}-${point.y}-${index}`}
              cx={point.x}
              cy={point.y}
              r={index === points.length - 1 ? 4 : 3}
              fill={index === points.length - 1 ? "rgb(238, 232, 212)" : "rgb(196, 165, 96)"}
              stroke="rgb(15, 20, 24)"
              strokeWidth="2"
            />
          ))}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 font-mono text-[0.68rem] uppercase text-paper/35">
        <span>{results[0] ? formatDate(results[0].created_at) : "No date"}</span>
        <span>Best {formatValue(best)}</span>
        <span>{results[results.length - 1] ? formatDate(results[results.length - 1].created_at) : "No date"}</span>
      </div>
    </section>
  );
}

function ConsistencySection() {
  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
      <h2 className="font-mono text-sm uppercase text-brass">Consistency</h2>
      <p className="mt-4 font-mono text-lg text-paper">Not enough data yet</p>
      <p className="mt-2 text-sm leading-6 text-paper/50">
        Attempt-level consistency is not stored yet, so this section will appear once future results include that data.
      </p>
    </section>
  );
}

function CategoryBreakdown({ analytics }: { analytics: ReturnType<typeof buildProgressAnalytics> }) {
  return (
    <section className="overflow-hidden rounded-lg border border-paper/10 bg-ink-950/75 shadow-glow">
      <div className="border-b border-paper/10 px-4 py-4 md:px-5">
        <h2 className="font-mono text-sm uppercase text-brass">Category Breakdown</h2>
        {analytics.weakestCategory && (
          <p className="mt-2 font-mono text-xs text-paper/45">Weakest: {analytics.weakestCategory.category}</p>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem_7rem_5rem] border-b border-paper/10 px-4 py-3 font-mono text-xs uppercase text-paper/40 max-sm:hidden md:px-5">
        <span>Category</span>
        <span>Avg WPM</span>
        <span>Avg Accuracy</span>
        <span>Tests</span>
      </div>
      {analytics.categoryBreakdown.map((row) => {
        const isWeakest = analytics.weakestCategory?.category === row.category;

        return (
          <article
            key={row.category}
            className={`grid gap-2 border-b px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_5rem] sm:items-center md:px-5 ${
              isWeakest ? "border-brass/20 bg-brass/10" : "border-paper/10"
            }`}
          >
            <h3 className="font-semibold text-paper">{row.category}</h3>
            <BreakdownMetric label="Avg WPM" value={formatNumber(row.averageWpm)} />
            <BreakdownMetric label="Avg Accuracy" value={`${formatNumber(row.averageAccuracy)}%`} />
            <BreakdownMetric label="Tests" value={row.tests} />
          </article>
        );
      })}
    </section>
  );
}

function ActivitySection({ analytics }: { analytics: ReturnType<typeof buildProgressAnalytics> }) {
  const recentDates = analytics.activity.activeDates.slice(-14);

  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
      <h2 className="font-mono text-sm uppercase text-brass">Activity</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SummaryCard label="Current streak" value={`${analytics.activity.currentStreakDays} days`} icon={<Activity className="h-4 w-4" />} />
        <SummaryCard label="Active days" value={analytics.activity.activeDays} icon={<Clock className="h-4 w-4" />} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Recent active days">
        {recentDates.map((date) => (
          <span key={date} title={date} className="h-4 w-4 rounded-sm bg-brass/70" />
        ))}
      </div>
    </section>
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

function BreakdownMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-mono text-[0.68rem] uppercase text-paper/35 sm:hidden">{label}</p>
      <p className="font-mono text-sm text-paper/70">{value}</p>
    </div>
  );
}

function getTrendResults(results: SupabaseAnalyticsTypingResultRow[], range: TrendRange) {
  const sorted = [...results].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
  const limited = range === "all" ? sorted : sorted.slice(0, Number(range));
  return limited.reverse();
}

function buildChartPoints(values: number[]) {
  if (values.length === 0) {
    return [];
  }

  const left = 38;
  const right = 390;
  const top = 30;
  const bottom = 178;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? (right - left) / (values.length - 1) : 0;

  return values.map((value, index) => ({
    x: values.length > 1 ? left + step * index : (left + right) / 2,
    y: bottom - ((value - min) / range) * (bottom - top)
  }));
}

function formatNumber(value: number) {
  return Number(value).toFixed(1);
}

function formatPracticeTime(seconds: number) {
  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatDuration(seconds: number) {
  if (seconds <= 0) {
    return "Infinite";
  }

  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}
