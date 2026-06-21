"use client";

import React, { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Activity, Clock, Medal, Target, Trophy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { buildProgressAnalytics } from "@/lib/analytics";
import {
  SupabaseAnalyticsTypingResultRow,
  getSupabaseAnalyticsTypingResults
} from "@/lib/typingResultStorage";

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [results, setResults] = useState<SupabaseAnalyticsTypingResultRow[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [message, setMessage] = useState("");
  const analytics = useMemo(() => buildProgressAnalytics(results), [results]);

  useEffect(() => {
    if (isAuthLoading || user) {
      return;
    }

    router.push("/login?redirectTo=/analytics");
  }, [isAuthLoading, router, user]);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setResults([]);
      setMessage("");
      setIsLoadingResults(false);
      return;
    }

    setIsLoadingResults(true);
    setMessage("");

    getSupabaseAnalyticsTypingResults(user.id)
      .then((typingResults) => {
        if (!isMounted) return;
        setResults(typingResults);
      })
      .catch((error) => {
        if (!isMounted) return;
        setMessage(error instanceof Error ? error.message : "Analytics could not be loaded.");
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
            <p className="font-mono text-xs uppercase text-brass">Analytics</p>
            <h1 className="mt-2 text-3xl font-semibold text-paper md:text-4xl">Progress Analytics</h1>
          </div>
          <div className="rounded-md border border-paper/10 bg-ink-950/75 px-4 py-3 text-right shadow-glow">
            <p className="font-mono text-2xl text-paper">{analytics.summary.totalTests}</p>
            <p className="font-mono text-xs uppercase text-paper/45">saved tests</p>
          </div>
        </div>

        {!user && !isAuthLoading && (
          <section className="mt-8 rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
            <p className="font-mono text-sm text-paper/55">
              <Link href="/login?redirectTo=/analytics" className="text-brass hover:text-brass/80">
                Log in
              </Link>{" "}
              to view your progress analytics.
            </p>
          </section>
        )}

        {user && (
          <>
            {message && (
              <div className="mt-6 rounded-md border border-ember/25 bg-ember/10 px-4 py-3 font-mono text-sm text-ember">
                {message}
              </div>
            )}

            {isLoadingResults && (
              <div className="mt-6 rounded-md border border-paper/10 bg-ink-950/75 px-4 py-5 font-mono text-sm text-paper/45">
                Loading analytics...
              </div>
            )}

            {!isLoadingResults && results.length === 0 && !message && (
              <section className="mt-8 rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
                <p className="font-mono text-sm text-paper/55">
                  No saved results yet.{" "}
                  <Link href="/practice" className="text-brass hover:text-brass/80">
                    Start a practice session
                  </Link>{" "}
                  to build your analytics.
                </p>
              </section>
            )}

            {results.length > 0 && (
              <>
                <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <SummaryCard
                    label="Best WPM"
                    value={formatNumber(analytics.summary.bestWpm)}
                    icon={<Trophy className="h-4 w-4" />}
                  />
                  <SummaryCard
                    label="Average WPM"
                    value={formatNumber(analytics.summary.averageWpm)}
                    icon={<Activity className="h-4 w-4" />}
                  />
                  <SummaryCard
                    label="Best Accuracy"
                    value={`${formatNumber(analytics.summary.bestAccuracy)}%`}
                    icon={<Target className="h-4 w-4" />}
                  />
                  <SummaryCard
                    label="Total Tests"
                    value={analytics.summary.totalTests}
                    icon={<Medal className="h-4 w-4" />}
                  />
                  <SummaryCard
                    label="Total Practice Time"
                    value={formatPracticeTime(analytics.summary.totalPracticeSeconds)}
                    icon={<Clock className="h-4 w-4" />}
                  />
                </section>

                <section className="mt-6 grid gap-4 lg:grid-cols-2">
                  <TrendChart
                    title="WPM Trend"
                    unit="WPM"
                    results={analytics.recentTrend}
                    valueForResult={(result) => result.wpm}
                    formatValue={formatNumber}
                  />
                  <TrendChart
                    title="Accuracy Trend"
                    unit="Accuracy"
                    results={analytics.recentTrend}
                    valueForResult={(result) => result.accuracy}
                    formatValue={(value) => `${formatNumber(value)}%`}
                  />
                </section>

                <section className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <PersonalRecords analytics={analytics} />
                  <CategoryBreakdown rows={analytics.categoryBreakdown} />
                </section>
              </>
            )}
          </>
        )}
      </section>
    </AppShell>
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
    <article className="rounded-md border border-paper/10 bg-ink-950/75 px-4 py-4 shadow-glow">
      <div className="flex items-center justify-between gap-3 text-brass">
        <p className="font-mono text-[0.68rem] uppercase text-paper/40">{label}</p>
        {icon}
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold text-paper">{value}</p>
    </article>
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
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-mono text-sm uppercase text-brass">{title}</h2>
          <p className="mt-1 font-mono text-[0.68rem] uppercase text-paper/35">Most recent 30 · {unit}</p>
        </div>
        <div className="text-right font-mono">
          <p className="text-lg text-paper">{formatValue(latest)}</p>
          <p className="text-[0.68rem] uppercase text-paper/35">Latest</p>
        </div>
      </div>

      <div className="mt-4 h-64 w-full overflow-hidden rounded-md bg-ink-900/70">
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

function PersonalRecords({ analytics }: { analytics: ReturnType<typeof buildProgressAnalytics> }) {
  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
      <h2 className="font-mono text-sm uppercase text-brass">Personal Records</h2>
      <div className="mt-4 space-y-3">
        <RecordRow label="Fastest 1-minute result" result={analytics.records.fastestOneMinute} valueForResult={(result) => formatNumber(result.wpm)} />
        <RecordRow label="Fastest 5-minute result" result={analytics.records.fastestFiveMinute} valueForResult={(result) => formatNumber(result.wpm)} />
        <RecordRow label="Highest Accuracy" result={analytics.records.highestAccuracy} valueForResult={(result) => `${formatNumber(result.accuracy)}%`} />
      </div>
    </section>
  );
}

function RecordRow({
  label,
  result,
  valueForResult
}: {
  label: string;
  result: SupabaseAnalyticsTypingResultRow | null;
  valueForResult: (result: SupabaseAnalyticsTypingResultRow) => string;
}) {
  return (
    <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-paper/10 pb-3 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <p className="font-mono text-xs text-paper/70">{label}</p>
        <p className="mt-1 truncate text-sm text-paper/40">
          {result ? `${result.passage_title} · ${formatDuration(result.duration_seconds)} · ${formatDate(result.created_at)}` : "No saved result"}
        </p>
      </div>
      <p className="font-mono text-lg text-paper">{result ? valueForResult(result) : "-"}</p>
    </article>
  );
}

function CategoryBreakdown({
  rows
}: {
  rows: ReturnType<typeof buildProgressAnalytics>["categoryBreakdown"];
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-paper/10 bg-ink-950/75 shadow-glow">
      <div className="border-b border-paper/10 px-4 py-4 md:px-5">
        <h2 className="font-mono text-sm uppercase text-brass">Category Breakdown</h2>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem_7rem_5rem] border-b border-paper/10 px-4 py-3 font-mono text-xs uppercase text-paper/40 max-sm:hidden md:px-5">
        <span>Category</span>
        <span>Avg WPM</span>
        <span>Avg Accuracy</span>
        <span>Tests</span>
      </div>
      {rows.map((row) => (
        <article
          key={row.category}
          className="grid gap-2 border-b border-paper/10 px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_5rem] sm:items-center md:px-5"
        >
          <h3 className="font-semibold text-paper">{row.category}</h3>
          <BreakdownMetric label="Avg WPM" value={formatNumber(row.averageWpm)} />
          <BreakdownMetric label="Avg Accuracy" value={`${formatNumber(row.averageAccuracy)}%`} />
          <BreakdownMetric label="Tests" value={row.tests} />
        </article>
      ))}
    </section>
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

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}
