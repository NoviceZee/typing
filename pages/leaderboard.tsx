import React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { ANALYTICS_DOMAIN_OPTIONS, AnalyticsDomain } from "@/lib/analyticsDomain";
import {
  SupabaseLeaderboardResultRow,
  getSupabaseLeaderboardCategories,
  getSupabaseOwnTypingResultIds,
  getSupabaseLeaderboardResults
} from "@/lib/typingResultStorage";
import { getDurationFilterOptions } from "@/lib/practiceDurations";
import {
  DEFAULT_LEADERBOARD_TIME_RANGE,
  LEADERBOARD_HEADING_BY_RANGE,
  LEADERBOARD_TIME_RANGE_OPTIONS,
  LeaderboardTimeRange
} from "@/lib/leaderboardFilters";

const ALL_FILTER = "All";
const DURATION_OPTIONS = getDurationFilterOptions(ALL_FILTER).map((option) => ({
  ...option,
  label: option.value === ALL_FILTER ? "Infinite" : option.value === "60" ? "1m" : option.value === "300" ? "5m" : option.value === "600" ? "10m" : option.label
}));
const TRAINING_DURATION_OPTIONS = [
  { label: "15", value: "15" },
  { label: "30", value: "30" },
  { label: "60", value: "60" },
  { label: "120", value: "120" }
];

export default function LeaderboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [results, setResults] = useState<SupabaseLeaderboardResultRow[]>([]);
  const [ownResultIds, setOwnResultIds] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<string[]>([]);
  const [leaderboardDomain, setLeaderboardDomain] = useState<AnalyticsDomain>("english");
  const [timeRange, setTimeRange] = useState<LeaderboardTimeRange>(DEFAULT_LEADERBOARD_TIME_RANGE);
  const [durationFilter, setDurationFilter] = useState(ALL_FILTER);
  const [categoryFilter, setCategoryFilter] = useState(ALL_FILTER);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const isEnglishLeaderboard = leaderboardDomain === "english";
  const activeDurationOptions = isEnglishLeaderboard ? DURATION_OPTIONS : TRAINING_DURATION_OPTIONS;

  useEffect(() => {
    let isMounted = true;

    getSupabaseLeaderboardCategories(200, leaderboardDomain)
      .then((leaderboardCategories) => {
        if (!isMounted) return;
        setCategories(leaderboardCategories);
      })
      .catch(() => {
        if (!isMounted) return;
        setCategories([]);
      });

    return () => {
      isMounted = false;
    };
  }, [leaderboardDomain]);

  useEffect(() => {
    setCategoryFilter(ALL_FILTER);

    if (leaderboardDomain === "english") {
      setDurationFilter(ALL_FILTER);
      return;
    }

    setDurationFilter((currentDuration) =>
      TRAINING_DURATION_OPTIONS.some((option) => option.value === currentDuration) ? currentDuration : "60"
    );
  }, [leaderboardDomain]);

  useEffect(() => {
    let isMounted = true;
    const durationSeconds = durationFilter === ALL_FILTER ? null : Number(durationFilter);
    const category = isEnglishLeaderboard && categoryFilter !== ALL_FILTER ? categoryFilter : null;

    setIsLoading(true);
    setOwnResultIds(new Set());
    getSupabaseLeaderboardResults({ durationSeconds, category, timeRange, domain: leaderboardDomain })
      .then((leaderboardResults) => {
        if (!isMounted) return;
        setResults(leaderboardResults);
        setMessage("");
      })
      .catch((error) => {
        if (!isMounted) return;
        setMessage(error instanceof Error ? error.message : "Leaderboard could not be loaded.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [categoryFilter, durationFilter, isEnglishLeaderboard, leaderboardDomain, timeRange]);

  useEffect(() => {
    let isMounted = true;

    if (isAuthLoading) {
      return () => {
        isMounted = false;
      };
    }

    if (!user || results.length === 0) {
      setOwnResultIds(new Set());
      return () => {
        isMounted = false;
      };
    }

    getSupabaseOwnTypingResultIds(
      results.map((result) => result.id),
      user.id
    )
      .then((ids) => {
        if (!isMounted) return;
        setOwnResultIds(ids);
      })
      .catch(() => {
        if (!isMounted) return;
        setOwnResultIds(new Set());
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, results, user]);

  return (
    <AppShell>
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase text-brass">Leaderboard</p>
            <h1 className="mt-2 text-3xl font-semibold text-paper md:text-4xl">
              {LEADERBOARD_HEADING_BY_RANGE[timeRange]}
            </h1>
          </div>
          <div className="rounded-md border border-paper/10 bg-ink-950/75 px-4 py-3 text-right shadow-glow">
            <p className="font-mono text-2xl text-paper">{results.length}</p>
            <p className="font-mono text-xs uppercase text-paper/45">shown</p>
          </div>
        </div>

        <p className="mt-4 max-w-2xl text-sm leading-6 text-paper/55">
          Ranked by WPM, then accuracy. Only public handles are shown.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs" data-testid="leaderboard-filters">
        <div className="flex flex-wrap gap-x-2 gap-y-1" role="group" aria-label="Leaderboard domain">
          {ANALYTICS_DOMAIN_OPTIONS.map((option) => {
            const isSelected = leaderboardDomain === option.id;

            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setLeaderboardDomain(option.id)}
                className={`px-1.5 py-1 transition focus-visible:text-brass focus-visible:ring-1 focus-visible:ring-brass/60 ${
                  isSelected ? "text-brass" : "text-paper/45 hover:text-paper/75"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <FilterSeparator />

        <div className="flex flex-wrap gap-x-2 gap-y-1" role="group" aria-label="Leaderboard time range">
          {LEADERBOARD_TIME_RANGE_OPTIONS.map((option) => {
            const isSelected = timeRange === option.value;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setTimeRange(option.value)}
                className={`px-1.5 py-1 transition focus-visible:text-brass focus-visible:ring-1 focus-visible:ring-brass/60 ${
                  isSelected ? "text-brass" : "text-paper/45 hover:text-paper/75"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <FilterSeparator />

          <FilterChoiceGroup
            label="Leaderboard duration"
            value={durationFilter}
            onChange={setDurationFilter}
            options={activeDurationOptions}
          />
          {isEnglishLeaderboard && (
            <>
              <FilterSeparator />
              <FilterChoiceGroup
              label="Leaderboard category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[ALL_FILTER, ...categories].map((category) => ({ label: category, value: category }))}
            />
            </>
          )}
        </div>

        {message && (
          <div className="mt-6 rounded-md border border-ember/25 bg-ember/10 px-4 py-3 font-mono text-sm text-ember">
            {message}
          </div>
        )}

        <section className="mt-6 overflow-hidden rounded-lg border border-paper/10 bg-ink-950/75 shadow-glow">
          <div className="grid grid-cols-[4rem_minmax(0,0.85fr)_minmax(0,1fr)_7rem_6rem_7rem_10rem] border-b border-paper/10 px-4 py-3 font-mono text-xs uppercase text-paper/40 max-md:hidden">
            <span>Rank</span>
            <span>Name</span>
            <span>Passage</span>
            <span>Duration</span>
            <span>WPM</span>
            <span>Accuracy</span>
            <span>Date</span>
          </div>

          {isLoading && (
            <div className="px-4 py-8 text-center font-mono text-sm text-paper/45">Loading leaderboard...</div>
          )}

          {!isLoading && results.length === 0 && !message && (
            <div className="px-4 py-8 text-center font-mono text-sm text-paper/45">
              {leaderboardDomain === "english"
                ? "No saved typing results match this time range."
                : `No saved ${leaderboardDomain} typing results match this time range.`}
            </div>
          )}

          {!isLoading &&
            results.map((result, index) => {
              const isOwnResult = ownResultIds.has(result.id);

              return (
                <article
                  key={result.id}
                  className={`grid gap-3 border-b px-4 py-4 last:border-b-0 md:grid-cols-[4rem_minmax(0,0.85fr)_minmax(0,1fr)_7rem_6rem_7rem_10rem] md:items-center ${
                    isOwnResult ? "border-brass/25 bg-brass/10" : "border-paper/10"
                  }`}
                >
                  <div className="font-mono text-lg font-semibold text-brass md:text-base">#{index + 1}</div>
                  <div>
                    <div className="font-mono text-[0.68rem] uppercase text-paper/35 md:hidden">Name</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <LeaderboardName displayName={result.display_name} />
                      {isOwnResult && (
                        <span className="rounded bg-brass px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase text-ink-950">
                          You
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h2 className="font-semibold text-paper">{result.passage_title}</h2>
                    <p className="mt-1 font-mono text-xs text-paper/40 md:hidden">
                      {formatDuration(result.duration_seconds)} · {formatDate(result.created_at)}
                    </p>
                  </div>
                  <Metric label="Duration" value={formatDuration(result.duration_seconds)} />
                  <Metric label="WPM" value={formatNumber(result.wpm)} strong />
                  <Metric label="Accuracy" value={`${formatNumber(result.accuracy)}%`} />
                  <div className="font-mono text-sm text-paper/55 max-md:hidden">{formatDate(result.created_at)}</div>
                </article>
              );
            })}
        </section>
      </section>
    </AppShell>
  );
}

function LeaderboardName({ displayName }: { displayName: string }) {
  const handle = getHandleFromDisplayName(displayName);

  if (!handle) {
    return <span className="font-semibold text-paper">{displayName}</span>;
  }

  return (
    <Link href={`/u/${handle}`} className="font-semibold text-paper transition hover:text-brass">
      {displayName}
    </Link>
  );
}

function getHandleFromDisplayName(displayName: string) {
  if (!/^@[a-z0-9_]{3,20}$/.test(displayName)) {
    return null;
  }

  return displayName.slice(1);
}

function FilterChoiceGroup({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-x-2 gap-y-1">
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-label={label === "Leaderboard category" ? `${option.label} category` : option.label}
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
            className={`px-1.5 py-1 transition focus-visible:text-brass focus-visible:ring-1 focus-visible:ring-brass/60 ${
              isSelected ? "text-brass" : "text-paper/45 hover:text-paper/75"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function FilterSeparator() {
  return <span className="text-paper/18" aria-hidden="true">|</span>;
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[0.68rem] uppercase text-paper/35 md:hidden">{label}</div>
      <div className={`font-mono text-sm ${strong ? "font-semibold text-paper" : "text-paper/65"}`}>{value}</div>
    </div>
  );
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
