import React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, Clock, Languages } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageContainer, PageHeader } from "@/components/PageLayout";
import { FilterControl, SecondaryToolbar, ToolbarGroup, ToolbarSeparator } from "@/components/SecondaryNavigation";
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
  label: option.value === ALL_FILTER ? "All" : option.value === "60" ? "1m" : option.value === "300" ? "5m" : option.value === "600" ? "10m" : option.label
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
    <AppShell sideAd={false}>
      <PageContainer>
        <PageHeader
          eyebrow="Leaderboard"
          title={LEADERBOARD_HEADING_BY_RANGE[timeRange]}
          description="Ranked by WPM, then accuracy. Only public handles are shown."
          aside={
            <div aria-label={`${results.length} results shown`} className="flex items-baseline gap-2 font-mono">
              <span className="text-section font-semibold text-paper">{results.length}</span>
              <span className="text-utility uppercase text-paper/45">shown</span>
            </div>
          }
        />

        <SecondaryToolbar label="Leaderboard filters" data-testid="leaderboard-filters">
        <ToolbarGroup label="Leaderboard domain" icon={Languages}>
          {ANALYTICS_DOMAIN_OPTIONS.map((option) => {
            const isSelected = leaderboardDomain === option.id;

            return (
              <FilterControl
                key={option.id}
                selected={isSelected}
                onClick={() => setLeaderboardDomain(option.id)}
              >
                {option.label}
              </FilterControl>
            );
          })}
        </ToolbarGroup>

        <ToolbarSeparator />

        <ToolbarGroup label="Leaderboard time range" icon={CalendarDays}>
          {LEADERBOARD_TIME_RANGE_OPTIONS.map((option) => {
            const isSelected = timeRange === option.value;

            return (
              <FilterControl
                key={option.value}
                selected={isSelected}
                onClick={() => setTimeRange(option.value)}
              >
                {option.label}
              </FilterControl>
            );
          })}
        </ToolbarGroup>

        <ToolbarSeparator />

          <FilterChoiceGroup
            label="Leaderboard duration"
            icon={Clock}
            value={durationFilter}
            onChange={setDurationFilter}
            options={activeDurationOptions}
          />
          {isEnglishLeaderboard && (
            <>
              <ToolbarSeparator />
              <FilterChoiceGroup
              label="Leaderboard category"
              icon={BookOpen}
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[ALL_FILTER, ...categories].map((category) => ({ label: category, value: category }))}
            />
            </>
          )}
        </SecondaryToolbar>

        {message && (
          <div className="mt-6 rounded-md border border-ember/25 bg-ember/10 px-4 py-3 font-mono text-body text-ember">
            {message}
          </div>
        )}

        <section className="mt-6 overflow-hidden rounded-lg border border-paper/[0.09] bg-ink-950/45">
          <div className="grid grid-cols-[4rem_minmax(0,0.85fr)_minmax(0,1fr)_7rem_6rem_7rem_10rem] border-b border-paper/10 px-4 py-3 font-mono text-utility uppercase text-paper/40 max-md:hidden">
            <span>Rank</span>
            <span>Name</span>
            <span>Passage</span>
            <span>Duration</span>
            <span>WPM</span>
            <span>Accuracy</span>
            <span>Date</span>
          </div>

          {isLoading && (
            <div className="px-4 py-8 text-center font-mono text-body text-paper/45">Loading leaderboard...</div>
          )}

          {!isLoading && results.length === 0 && !message && (
            <div className="px-4 py-8 text-center font-mono text-body text-paper/45">
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
                  <div className="font-mono text-section font-semibold text-brass">#{index + 1}</div>
                  <div>
                    <div className="font-mono text-utility uppercase text-paper/35 md:hidden">Name</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <LeaderboardName displayName={result.display_name} />
                      {isOwnResult && (
                        <span className="rounded bg-brass px-1.5 py-0.5 font-mono text-utility font-semibold uppercase text-ink-950">
                          You
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h2 className="font-semibold text-paper">{result.passage_title}</h2>
                    <p className="mt-1 font-mono text-utility text-paper/40 md:hidden">
                      {formatLeaderboardDuration(result.duration_seconds)} · {formatDate(result.created_at)}
                    </p>
                  </div>
                  <Metric label="Duration" value={formatLeaderboardDuration(result.duration_seconds)} />
                  <Metric label="WPM" value={formatNumber(result.wpm)} strong />
                  <Metric label="Accuracy" value={`${formatNumber(result.accuracy)}%`} />
                  <div className="font-mono text-body text-paper/55 max-md:hidden">{formatDate(result.created_at)}</div>
                </article>
              );
            })}
        </section>
      </PageContainer>
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
  icon,
  value,
  onChange,
  options
}: {
  label: string;
  icon: typeof Clock;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <ToolbarGroup label={label} icon={icon}>
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <FilterControl
            key={option.value}
            aria-label={label === "Leaderboard category" ? `${option.label} category` : option.label}
            selected={isSelected}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </FilterControl>
        );
      })}
    </ToolbarGroup>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="font-mono text-utility uppercase text-paper/35 md:hidden">{label}</div>
      <div className={`font-mono text-body ${strong ? "font-semibold text-paper" : "text-paper/65"}`}>{value}</div>
    </div>
  );
}

export function formatLeaderboardDuration(seconds: number) {
  const roundedSeconds = Math.round(seconds);
  if (!Number.isFinite(seconds) || roundedSeconds <= 0) return "—";
  if (roundedSeconds < 60) return `${roundedSeconds} sec`;
  if (roundedSeconds % 60 === 0) return `${roundedSeconds / 60} min`;
  const minutes = Math.floor(roundedSeconds / 60);
  return `${minutes}:${String(roundedSeconds % 60).padStart(2, "0")}`;
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
