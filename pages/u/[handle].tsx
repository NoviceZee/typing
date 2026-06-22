"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Award, Copy, Target, Trophy, UserCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/router";
import { buildProgressAnalytics } from "@/lib/analytics";
import { getSupabaseProfile, getSupabasePublicProfileByHandle } from "@/lib/profileStorage";
import type { SupabasePublicProfile } from "@/lib/profileStorage";
import {
  FriendListItem,
  getFriendshipWithProfileHandle,
  sendFriendRequestByProfileHandle
} from "@/lib/friendStorage";
import {
  SupabaseAnalyticsTypingResultRow,
  getSupabasePublicTypingResultsByHandle
} from "@/lib/typingResultStorage";

type LoadState = "loading" | "ready" | "not-found" | "error";

export default function PublicUserProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const routeHandle = Array.isArray(router.query.handle) ? router.query.handle[0] : router.query.handle;
  const [profile, setProfile] = useState<SupabasePublicProfile | null>(null);
  const [friendship, setFriendship] = useState<FriendListItem | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isFriendStatusUnavailable, setIsFriendStatusUnavailable] = useState(false);
  const [friendActionMessage, setFriendActionMessage] = useState("");
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
    setFriendship(null);
    setIsOwnProfile(false);
    setIsFriendStatusUnavailable(false);
    setFriendActionMessage("");
    getSupabasePublicProfileByHandle(routeHandle)
      .then(async (publicProfile) => {
        if (!isMounted) return;

        if (!publicProfile) {
          setProfile(null);
          setResults([]);
          setLoadState("not-found");
          return;
        }

        const [publicResults, ownProfile, friendshipResult] = await Promise.all([
          getSupabasePublicTypingResultsByHandle(publicProfile.handle),
          user ? getSupabaseProfile(user.id) : Promise.resolve(null),
          user
            ? getFriendshipWithProfileHandle(publicProfile.handle)
                .then((friendship) => ({ friendship, failed: false }))
                .catch(() => ({ friendship: null, failed: true }))
            : Promise.resolve({ friendship: null, failed: false })
        ]);
        if (!isMounted) return;
        setProfile(publicProfile);
        setResults(publicResults);
        setIsOwnProfile(ownProfile?.handle === publicProfile.handle);
        setFriendship(friendshipResult.friendship);
        setIsFriendStatusUnavailable(friendshipResult.failed);
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
  }, [routeHandle, router.isReady, user]);

  async function handleCopyUrl() {
    if (!profile || typeof window === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(`${window.location.origin}/u/${profile.handle}`);
    setCopyMessage("Copied");
  }

  async function handleAddFriend() {
    if (!profile) {
      return;
    }

    setFriendActionMessage("");
    try {
      const request = await sendFriendRequestByProfileHandle(profile.handle);
      setFriendship({
        id: request.id,
        user_id: request.addressee_id,
        handle: profile.handle,
        status: "pending",
        direction: "outgoing",
        created_at: request.created_at,
        updated_at: request.updated_at
      });
    } catch (error) {
      setFriendActionMessage(error instanceof Error ? error.message : "Friend request could not be sent.");
    }
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
            <ProfileCard
              profile={profile}
              analytics={analytics}
              copyMessage={copyMessage}
              onCopyUrl={handleCopyUrl}
              friendAction={
                user && !isOwnProfile ? (
                  <FriendAction
                    friendship={friendship}
                    isUnavailable={isFriendStatusUnavailable}
                    onAddFriend={handleAddFriend}
                  />
                ) : null
              }
              friendActionMessage={friendActionMessage}
            />

            <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
              <PublicStatsPanel analytics={analytics} hasResults={results.length > 0} />
              <RecentPublicResults results={recentResults} />
            </section>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function FriendAction({
  friendship,
  isUnavailable = false,
  onAddFriend
}: {
  friendship: FriendListItem | null;
  isUnavailable?: boolean;
  onAddFriend: () => void;
}) {
  if (isUnavailable) {
    return (
      <span className="inline-flex items-center rounded-md border border-paper/10 bg-ink-900 px-3 py-2 font-mono text-xs text-paper/40">
        Friend status unavailable
      </span>
    );
  }

  if (friendship?.status === "accepted") {
    return (
      <span className="inline-flex items-center rounded-md border border-brass/25 bg-brass/10 px-3 py-2 font-mono text-xs text-brass">
        Friends
      </span>
    );
  }

  if (friendship?.status === "pending") {
    return (
      <span className="inline-flex items-center rounded-md border border-paper/10 bg-ink-900 px-3 py-2 font-mono text-xs text-paper/55">
        Request pending
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onAddFriend}
      className="inline-flex items-center rounded-md border border-brass/30 bg-brass/10 px-3 py-2 font-mono text-xs text-brass transition hover:border-brass/50 hover:bg-brass/15"
    >
      Add friend
    </button>
  );
}

function ProfileCard({
  profile,
  analytics,
  copyMessage,
  onCopyUrl,
  friendAction,
  friendActionMessage
}: {
  profile: SupabasePublicProfile;
  analytics: ReturnType<typeof buildProgressAnalytics>;
  copyMessage: string;
  onCopyUrl: () => void;
  friendAction: React.ReactNode;
  friendActionMessage: string;
}) {
  const avatarStyle = profile.avatar_style || "default";

  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="flex min-w-0 gap-4">
          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border ${getAvatarStyleClass(avatarStyle)}`}>
            <UserCircle className="h-9 w-9" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs uppercase text-brass">Public typist</p>
            <h1 className="mt-1 break-words font-mono text-4xl font-semibold text-paper">@{profile.handle}</h1>
            <p className="mt-2 font-mono text-xs uppercase text-paper/35">{formatJoinedDate(profile.created_at)}</p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-paper/60">{profile.bio || "No bio yet."}</p>
            <p className="mt-2 font-mono text-[0.68rem] uppercase text-paper/35">Avatar style: {avatarStyle}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button
            type="button"
            onClick={onCopyUrl}
            className="inline-flex items-center gap-2 rounded-md border border-paper/10 bg-ink-900 px-3 py-2 font-mono text-xs text-paper/65 transition hover:border-brass/40 hover:text-paper"
          >
            <Copy className="h-4 w-4" />
            {copyMessage || "Copy URL"}
          </button>
          {friendAction}
        </div>
      </div>

      {friendActionMessage && (
        <div className="mt-4 rounded-md border border-ember/25 bg-ember/10 px-4 py-3 font-mono text-sm text-ember">
          {friendActionMessage}
        </div>
      )}

      <div className="mt-6 rounded-md border border-paper/10 bg-ink-900/60 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase text-paper/40">Level</p>
            <p className="mt-1 font-mono text-3xl font-semibold text-paper">{analytics.progression.currentLevel}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs uppercase text-paper/40">Total XP</p>
            <p className="mt-1 font-mono text-lg text-brass">{analytics.progression.totalXp}</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between font-mono text-[0.68rem] uppercase text-paper/35">
            <span>XP progress</span>
            <span>{analytics.progression.xpToNextLevel} to next</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper/[0.06]">
            <div className="h-full rounded-full bg-brass" style={{ width: `${analytics.progression.progressPercent}%` }} />
          </div>
        </div>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryStat label="Tests completed" value={analytics.summary.totalTests} />
        <SummaryStat label="Best WPM" value={formatNumber(analytics.summary.bestWpm)} />
        <SummaryStat label="Best accuracy" value={`${formatNumber(analytics.summary.bestAccuracy)}%`} />
        <SummaryStat label="Current streak" value={`${analytics.activity.currentStreakDays} days`} />
        <SummaryStat label="Total XP / Level" value={`${analytics.progression.totalXp} / ${analytics.progression.currentLevel}`} />
      </section>
    </section>
  );
}

function getAvatarStyleClass(style: string) {
  if (style === "slate") {
    return "border-paper/15 bg-paper/[0.06] text-paper/65";
  }

  if (style === "ember") {
    return "border-ember/25 bg-ember/10 text-ember";
  }

  return "border-brass/25 bg-brass/10 text-brass";
}

function formatJoinedDate(createdAt?: string | null) {
  if (!createdAt) {
    return "Joined date unavailable";
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "Joined date unavailable";
  }

  return `Joined ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  })}`;
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-md border border-paper/10 bg-ink-900/60 px-4 py-3">
      <p className="font-mono text-[0.68rem] uppercase text-paper/40">{label}</p>
      <p className="mt-2 font-mono text-xl font-semibold text-paper">{value}</p>
    </article>
  );
}

function PublicStatsPanel({
  analytics,
  hasResults
}: {
  analytics: ReturnType<typeof buildProgressAnalytics>;
  hasResults: boolean;
}) {
  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-sm uppercase text-brass">Public Stats</h2>
        <Trophy className="h-4 w-4 text-brass" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <FeaturedStat label="Best WPM" value={formatNumber(analytics.summary.bestWpm)} icon={<Trophy className="h-4 w-4" />} />
        <FeaturedStat label="Best accuracy" value={`${formatNumber(analytics.summary.bestAccuracy)}%`} icon={<Target className="h-4 w-4" />} />
      </div>
      {!hasResults && (
        <div className="mt-5 rounded-md border border-paper/10 bg-ink-900/60 px-4 py-5">
          <p className="font-mono text-sm text-paper">No best result yet.</p>
          <p className="mt-2 text-sm leading-6 text-paper/45">Best WPM and accuracy will fill in after public results.</p>
        </div>
      )}
      <div className="mt-5 rounded-md border border-paper/10 bg-ink-900/60 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-mono text-sm uppercase text-paper">Achievements</h3>
            <p className="mt-1 font-mono text-xs uppercase text-paper/35">
              {analytics.achievements.unlockedCount} / {analytics.achievements.totalCount} unlocked
            </p>
          </div>
          <Award className="h-4 w-4 text-brass" />
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper/[0.06]">
          <div
            className="h-full rounded-full bg-brass"
            style={{
              width: `${Math.round((analytics.achievements.unlockedCount / analytics.achievements.totalCount) * 100)}%`
            }}
          />
        </div>
      </div>
    </section>
  );
}

function FeaturedStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <article className="rounded-md border border-brass/20 bg-brass/10 px-4 py-4">
      <div className="flex items-center justify-between gap-3 text-brass">
        <p className="font-mono text-[0.68rem] uppercase text-paper/45">{label}</p>
        {icon}
      </div>
      <p className="mt-3 font-mono text-3xl font-semibold text-paper">{value}</p>
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
        <div className="px-4 py-8 md:px-5">
          <p className="font-mono text-sm text-paper">No public typing results yet.</p>
          <p className="mt-2 text-sm leading-6 text-paper/45">
            This profile is ready; saved public results will appear here.
          </p>
        </div>
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
