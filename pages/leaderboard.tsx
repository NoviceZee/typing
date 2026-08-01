import React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, Clock, Languages } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageContainer, PageHeader } from "@/components/PageLayout";
import { SegmentedControl } from "@/components/Controls";
import { DataSurface, EmptyState, PageSection, SectionStack, StatusMessage } from "@/components/Surface";
import { useAuth } from "@/components/AuthProvider";
import { ANALYTICS_DOMAIN_OPTIONS, AnalyticsDomain } from "@/lib/analyticsDomain";
import {
  SupabaseLeaderboardResultRow,
  getSupabaseLeaderboardCategories,
  getSupabaseOwnTypingResultIds,
  getSupabaseLeaderboardResults
} from "@/lib/typingResultStorage";
import { getDurationFilterOptions } from "@/lib/practiceDurations";
import { resolveResultDuration } from "@/lib/resultDuration";
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
    const modeDurationSeconds = durationFilter === ALL_FILTER ? null : Number(durationFilter);
    const category = isEnglishLeaderboard && categoryFilter !== ALL_FILTER ? categoryFilter : null;

    setIsLoading(true);
    setOwnResultIds(new Set());
    getSupabaseLeaderboardResults({ modeDurationSeconds, category, timeRange, domain: leaderboardDomain })
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
              <span className="text-[length:var(--ui-type-section-title-size)] font-semibold leading-[var(--ui-type-section-title-leading)] text-[color:var(--ui-text-primary)]">{results.length}</span>
              <span className="text-[length:var(--ui-type-label-size)] uppercase leading-[var(--ui-type-label-leading)] text-[color:var(--ui-text-muted)]">shown</span>
            </div>
          }
        />

        <SectionStack>
          <PageSection aria-label="Leaderboard filters">
            <div data-testid="leaderboard-filters" className="grid min-w-0 gap-2 md:flex md:flex-wrap md:items-start md:gap-x-4 md:gap-y-2">
              <SegmentedControl
                label="Leaderboard domain"
                icon={Languages}
                value={leaderboardDomain}
                onChange={setLeaderboardDomain}
                options={ANALYTICS_DOMAIN_OPTIONS.map((option) => ({ label: option.label, value: option.id }))}
              />
              <SegmentedControl
                label="Leaderboard time range"
                icon={CalendarDays}
                value={timeRange}
                onChange={setTimeRange}
                options={LEADERBOARD_TIME_RANGE_OPTIONS}
              />
              <SegmentedControl
                label="Leaderboard duration"
                icon={Clock}
                value={durationFilter}
                onChange={setDurationFilter}
                options={activeDurationOptions}
              />
              {isEnglishLeaderboard && (
                <SegmentedControl
                  label="Leaderboard category"
                  icon={BookOpen}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={[ALL_FILTER, ...categories].map((category) => ({
                    label: category,
                    value: category,
                    ariaLabel: `${category} category`
                  }))}
                />
              )}
            </div>
          </PageSection>

          {message && <StatusMessage tone="danger">{message}</StatusMessage>}

          {(!message || results.length > 0) && (
            <PageSection aria-label="Ranked results">
              <DataSurface aria-label="Ranked leaderboard results">
                {isLoading && (
                  <div role="status" aria-label="Loading leaderboard" className="px-4 py-10 text-center font-mono text-[length:var(--ui-type-body-size)] text-[color:var(--ui-text-secondary)]">
                    Loading leaderboard...
                  </div>
                )}

                {!isLoading && results.length === 0 && !message && (
                  <EmptyState label="No leaderboard results">
                    {leaderboardDomain === "english"
                      ? "No saved typing results match this time range."
                      : `No saved ${leaderboardDomain} typing results match this time range.`}
                  </EmptyState>
                )}

                {!isLoading && results.length > 0 && (
                  <>
                    <ol
                      aria-label="Leaderboard results"
                      data-responsive-layout="stacked"
                      className="divide-y divide-[color:var(--ui-border-subtle)] md:hidden"
                    >
                      {results.map((result, index) => (
                        <MobileLeaderboardRow
                          key={result.id}
                          result={result}
                          rank={index + 1}
                          isOwnResult={ownResultIds.has(result.id)}
                        />
                      ))}
                    </ol>

                    <table aria-label="Leaderboard results table" className="hidden w-full table-fixed border-collapse text-left md:table">
                      <colgroup>
                        <col className="w-[7%]" />
                        <col className="w-[16%]" />
                        <col className="w-[25%]" />
                        <col className="w-[11%]" />
                        <col className="w-[10%]" />
                        <col className="w-[12%]" />
                        <col className="w-[19%]" />
                      </colgroup>
                      <thead className="border-b border-[color:var(--ui-border-subtle)] font-mono text-[length:var(--ui-type-label-size)] uppercase leading-[var(--ui-type-label-leading)] text-[color:var(--ui-text-muted)]">
                        <tr>
                          <th scope="col" className="px-4 py-3 font-normal">Rank</th>
                          <th scope="col" className="px-3 py-3 font-normal">Name</th>
                          <th scope="col" className="px-3 py-3 font-normal">Passage</th>
                          <th scope="col" className="px-3 py-3 font-normal">Duration</th>
                          <th scope="col" className="px-3 py-3 font-normal">WPM</th>
                          <th scope="col" className="px-3 py-3 font-normal">Accuracy</th>
                          <th scope="col" className="px-3 py-3 font-normal">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((result, index) => (
                          <DesktopLeaderboardRow
                            key={result.id}
                            result={result}
                            rank={index + 1}
                            isOwnResult={ownResultIds.has(result.id)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </DataSurface>
            </PageSection>
          )}
        </SectionStack>
      </PageContainer>
    </AppShell>
  );
}

function getLeaderboardModeDuration(result: SupabaseLeaderboardResultRow) {
  const duration = resolveResultDuration(result);
  return duration.modeDurationSeconds ?? duration.elapsedSeconds;
}

function LeaderboardName({ displayName }: { displayName: string }) {
  const handle = getHandleFromDisplayName(displayName);

  if (!handle) {
    return <span className="font-semibold text-[color:var(--ui-text-primary)]">{displayName}</span>;
  }

  return (
    <Link
      href={`/u/${handle}`}
      className="ui-focus-ring rounded-sm font-semibold text-[color:var(--ui-text-primary)] transition-colors duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)] hover:text-[color:var(--ui-text-accent)]"
      data-focus-ring="standard"
    >
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

function OwnRowCue() {
  return (
    <span data-own-row-cue="true" className="rounded-[var(--ui-radius-control)] bg-[var(--ui-text-accent)] px-1.5 py-0.5 font-mono text-[length:var(--ui-type-caption-size)] font-semibold uppercase leading-[var(--ui-type-caption-leading)] text-[color:var(--ui-surface-canvas)]">
      You
    </span>
  );
}

function MobileLeaderboardRow({
  result,
  rank,
  isOwnResult
}: {
  result: SupabaseLeaderboardResultRow;
  rank: number;
  isOwnResult: boolean;
}) {
  return (
    <li className={`px-4 py-4 ${isOwnResult ? "border-l-2 border-l-[color:var(--ui-border-selected)] bg-[var(--ui-surface-selected)]" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[length:var(--ui-type-section-title-size)] font-semibold leading-[var(--ui-type-section-title-leading)] text-[color:var(--ui-text-accent)]">#{rank}</span>
            <LeaderboardName displayName={result.display_name} />
            {isOwnResult && <OwnRowCue />}
          </div>
          <h2 className="mt-2 break-words text-[length:var(--ui-type-subsection-title-size)] font-semibold leading-[var(--ui-type-subsection-title-leading)] text-[color:var(--ui-text-primary)]">
            {result.passage_title}
          </h2>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-[length:var(--ui-type-label-size)] uppercase leading-[var(--ui-type-label-leading)] text-[color:var(--ui-text-muted)]">WPM</p>
          <p className="mt-1 font-mono text-[length:var(--ui-type-metric-size)] font-semibold leading-[var(--ui-type-metric-leading)] text-[color:var(--ui-text-primary)]">{formatNumber(result.wpm)}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[color:var(--ui-border-subtle)] pt-3">
        <MobileMetric label="Duration" value={formatLeaderboardDuration(getLeaderboardModeDuration(result))} />
        <MobileMetric label="Accuracy" value={`${formatNumber(result.accuracy)}%`} />
        <MobileMetric label="Date" value={formatDate(result.created_at)} className="col-span-2" />
      </dl>
    </li>
  );
}

function MobileMetric({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="font-mono text-[length:var(--ui-type-caption-size)] uppercase leading-[var(--ui-type-caption-leading)] text-[color:var(--ui-text-muted)]">{label}</dt>
      <dd className="mt-1 font-mono text-[length:var(--ui-type-body-size)] leading-[var(--ui-type-body-leading)] text-[color:var(--ui-text-secondary)]">{value}</dd>
    </div>
  );
}

function DesktopLeaderboardRow({
  result,
  rank,
  isOwnResult
}: {
  result: SupabaseLeaderboardResultRow;
  rank: number;
  isOwnResult: boolean;
}) {
  return (
    <tr className={`border-b border-[color:var(--ui-border-subtle)] last:border-b-0 ${isOwnResult ? "bg-[var(--ui-surface-selected)] shadow-[inset_2px_0_var(--ui-border-selected)]" : ""}`}>
      <td className="px-4 py-4 font-mono text-[length:var(--ui-type-section-title-size)] font-semibold text-[color:var(--ui-text-accent)]">#{rank}</td>
      <td className="px-3 py-4"><div className="flex flex-wrap items-center gap-2"><LeaderboardName displayName={result.display_name} />{isOwnResult && <OwnRowCue />}</div></td>
      <td className="px-3 py-4"><span className="block truncate font-semibold text-[color:var(--ui-text-primary)]" title={result.passage_title}>{result.passage_title}</span></td>
      <td className="px-3 py-4 font-mono text-[length:var(--ui-type-body-size)] text-[color:var(--ui-text-secondary)]">{formatLeaderboardDuration(getLeaderboardModeDuration(result))}</td>
      <td className="px-3 py-4 font-mono text-[length:var(--ui-type-body-size)] font-semibold text-[color:var(--ui-text-primary)]">{formatNumber(result.wpm)}</td>
      <td className="px-3 py-4 font-mono text-[length:var(--ui-type-body-size)] text-[color:var(--ui-text-secondary)]">{formatNumber(result.accuracy)}%</td>
      <td className="px-3 py-4 font-mono text-[length:var(--ui-type-body-size)] text-[color:var(--ui-text-secondary)]">{formatDate(result.created_at)}</td>
    </tr>
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
