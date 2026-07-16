"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Award, Ban, Copy, Trophy, UserCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/router";
import { buildProgressAnalytics } from "@/lib/analytics";
import { ANALYTICS_DOMAIN_OPTIONS, AnalyticsDomain } from "@/lib/analyticsDomain";
import {
  getSupabaseAvatarPublicUrl,
  getSupabaseProfile,
  getSupabasePublicProfileByHandle,
  normalizeHandle
} from "@/lib/profileStorage";
import type { SupabaseProfile, SupabasePublicProfile } from "@/lib/profileStorage";
import {
  FriendListItem,
  blockUserByProfileHandle,
  getFriendshipWithProfileHandle,
  isUserBlockedByProfileHandle,
  sendFriendRequestByProfileHandle,
  unblockUserByProfileHandle
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
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockStatusUnavailable, setIsBlockStatusUnavailable] = useState(false);
  const [isBlockActionPending, setIsBlockActionPending] = useState(false);
  const [friendActionMessage, setFriendActionMessage] = useState("");
  const [isFriendActionError, setIsFriendActionError] = useState(false);
  const [results, setResults] = useState<SupabaseAnalyticsTypingResultRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [copyMessage, setCopyMessage] = useState("");
  const analytics = useMemo(() => buildProgressAnalytics(results, { domain: "english" }), [results]);
  const domainAnalytics = useMemo(() => buildDomainAnalytics(results), [results]);

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
    setIsBlocked(false);
    setIsBlockStatusUnavailable(false);
    setIsBlockActionPending(false);
    setFriendActionMessage("");
    setIsFriendActionError(false);
    getSupabasePublicProfileByHandle(routeHandle)
      .then(async (publicProfile) => {
        if (!isMounted) return;

        const ownProfile = user ? await getSupabaseProfile(user.id).catch(() => null) : null;
        const ownerProfile =
          !publicProfile && ownProfile?.handle === normalizeHandle(routeHandle)
            ? getOwnPublicProfileFallback(ownProfile)
            : null;
        const visibleProfile = publicProfile ?? ownerProfile;

        if (!visibleProfile) {
          setProfile(null);
          setResults([]);
          setLoadState("not-found");
          return;
        }

        const isOwnVisibleProfile = ownProfile?.handle === visibleProfile.handle;

        if (visibleProfile.public_profile_enabled === false) {
          const blockResult = user && !isOwnVisibleProfile
            ? await isUserBlockedByProfileHandle(visibleProfile.handle)
                .then((blocked) => ({ blocked, failed: false }))
                .catch(() => ({ blocked: false, failed: true }))
            : { blocked: false, failed: false };
          if (!isMounted) return;
          setProfile(visibleProfile);
          setResults([]);
          setIsOwnProfile(isOwnVisibleProfile);
          setFriendship(null);
          setIsFriendStatusUnavailable(false);
          setIsBlocked(blockResult.blocked);
          setIsBlockStatusUnavailable(blockResult.failed);
          setLoadState("ready");
          return;
        }

        const [publicResults, friendshipResult, blockResult] = await Promise.all([
          getSupabasePublicTypingResultsByHandle(visibleProfile.handle),
          user
            ? getFriendshipWithProfileHandle(visibleProfile.handle)
                .then((friendship) => ({ friendship, failed: false }))
                .catch(() => ({ friendship: null, failed: true }))
            : Promise.resolve({ friendship: null, failed: false }),
          user && !isOwnVisibleProfile
            ? isUserBlockedByProfileHandle(visibleProfile.handle)
                .then((blocked) => ({ blocked, failed: false }))
                .catch(() => ({ blocked: false, failed: true }))
            : Promise.resolve({ blocked: false, failed: false })
        ]);
        if (!isMounted) return;
        setProfile(visibleProfile);
        setResults(publicResults);
        setIsOwnProfile(isOwnVisibleProfile);
        setFriendship(friendshipResult.friendship);
        setIsFriendStatusUnavailable(friendshipResult.failed);
        setIsBlocked(blockResult.blocked);
        setIsBlockStatusUnavailable(blockResult.failed);
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
    setIsFriendActionError(false);
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
      setIsFriendActionError(true);
      setFriendActionMessage(error instanceof Error ? error.message : "Friend request could not be sent.");
    }
  }

  async function handleBlockAction() {
    if (!profile) return;
    setIsBlockActionPending(true);
    setFriendActionMessage("");
    setIsFriendActionError(false);

    try {
      if (isBlocked) {
        await unblockUserByProfileHandle(profile.handle);
        setIsBlocked(false);
        setFriendActionMessage(`Unblocked @${profile.handle}.`);
      } else {
        await blockUserByProfileHandle(profile.handle);
        setIsBlocked(true);
        setFriendship(null);
        setFriendActionMessage(`Blocked @${profile.handle}. Existing friend connections and requests were removed.`);
      }
    } catch (error) {
      setIsFriendActionError(true);
      setFriendActionMessage(error instanceof Error ? error.message : "Block setting could not be updated.");
    } finally {
      setIsBlockActionPending(false);
    }
  }

  const blockControl = user && !isOwnProfile ? (
    isBlockStatusUnavailable ? (
      <span className="inline-flex items-center rounded-md border border-paper/10 bg-ink-900 px-3 py-2 font-mono text-xs text-paper/40">
        Block unavailable
      </span>
    ) : (
      <button
        type="button"
        onClick={handleBlockAction}
        disabled={isBlockActionPending}
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs transition disabled:cursor-wait disabled:opacity-55 ${isBlocked ? "border-paper/10 bg-ink-900 text-paper/60 hover:border-brass/35 hover:text-paper" : "border-ember/25 bg-ember/5 text-ember/75 hover:border-ember/45 hover:bg-ember/10"}`}
      >
        <Ban className="h-3.5 w-3.5" />
        {isBlockActionPending ? "Updating..." : isBlocked ? "Unblock" : "Block user"}
      </button>
    )
  ) : null;

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
            <p className="mt-4 text-sm leading-6 text-paper/55">No Typing Station profile exists for that handle.</p>
          </section>
        )}

        {loadState === "ready" && profile && profile.public_profile_enabled === false && (
          <PrivateProfileCard
            profile={profile}
            isOwnProfile={isOwnProfile}
            blockAction={blockControl}
            actionMessage={friendActionMessage}
            isActionError={isFriendActionError}
          />
        )}

        {loadState === "ready" && profile && profile.public_profile_enabled !== false && (
          <div className="space-y-6">
            <ProfileCard
              profile={profile}
              analytics={analytics}
              copyMessage={copyMessage}
              onCopyUrl={handleCopyUrl}
              isOwnProfile={isOwnProfile}
              friendAction={
                user && !isOwnProfile ? (
                  <>
                    {!isBlocked && (
                      <FriendAction
                        friendship={friendship}
                        isUnavailable={isFriendStatusUnavailable}
                        onAddFriend={handleAddFriend}
                      />
                    )}
                    {blockControl}
                  </>
                ) : null
              }
              friendActionMessage={friendActionMessage}
              isFriendActionError={isFriendActionError}
            />

            <PublicStatsPanel domainAnalytics={domainAnalytics} />
            <AchievementsSummary analytics={analytics} />
          </div>
        )}
      </section>
    </AppShell>
  );
}

function getOwnPublicProfileFallback(profile: SupabaseProfile): SupabasePublicProfile {
  return {
    handle: profile.handle ?? "",
    bio: profile.bio ?? null,
    avatar_style: profile.avatar_style ?? null,
    avatar_path: profile.avatar_path ?? null,
    public_profile_enabled: profile.public_profile_enabled,
    created_at: profile.created_at
  };
}

function PrivateProfileCard({
  profile,
  isOwnProfile,
  blockAction,
  actionMessage,
  isActionError
}: {
  profile: SupabasePublicProfile;
  isOwnProfile: boolean;
  blockAction: React.ReactNode;
  actionMessage: string;
  isActionError: boolean;
}) {
  const avatarStyle = profile.avatar_style || "default";
  const avatarUrl = getSupabaseAvatarPublicUrl(profile.avatar_path);

  return (
    <section className="mx-auto max-w-xl rounded-lg border border-paper/10 bg-ink-950/75 px-5 py-8 text-center shadow-glow">
      <div className="flex justify-center">
        <PublicAvatar avatarUrl={avatarUrl} avatarStyle={avatarStyle} label={`@${profile.handle}`} />
      </div>
      <h1 className="mt-4 break-words font-mono text-3xl font-semibold text-paper">@{profile.handle}</h1>
      <p className="mt-3 text-sm leading-6 text-paper/55">This profile is private.</p>
      {isOwnProfile && (
        <Link
          href="/profile"
          className="mt-5 inline-flex items-center rounded-md border border-brass/30 bg-brass/10 px-3 py-2 font-mono text-xs text-brass transition hover:border-brass/50 hover:bg-brass/15"
        >
          Manage visibility
        </Link>
      )}
      {!isOwnProfile && blockAction && <div className="mt-5 flex justify-center">{blockAction}</div>}
      {actionMessage && (
        <div role={isActionError ? "alert" : "status"} className={`mt-4 rounded-md border px-4 py-3 font-mono text-sm ${isActionError ? "border-ember/25 bg-ember/10 text-ember" : "border-mint/25 bg-mint/10 text-mint"}`}>
          {actionMessage}
        </div>
      )}
    </section>
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
  isOwnProfile,
  friendAction,
  friendActionMessage,
  isFriendActionError
}: {
  profile: SupabasePublicProfile;
  analytics: ReturnType<typeof buildProgressAnalytics>;
  copyMessage: string;
  onCopyUrl: () => void;
  isOwnProfile: boolean;
  friendAction: React.ReactNode;
  friendActionMessage: string;
  isFriendActionError: boolean;
}) {
  const avatarStyle = profile.avatar_style || "default";
  const avatarUrl = getSupabaseAvatarPublicUrl(profile.avatar_path);

  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="flex min-w-0 gap-4">
          <PublicAvatar avatarUrl={avatarUrl} avatarStyle={avatarStyle} label={`@${profile.handle}`} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs uppercase text-brass">Public typist</p>
            <h1 className="mt-1 break-words font-mono text-4xl font-semibold text-paper">@{profile.handle}</h1>
            <p className="mt-2 font-mono text-xs uppercase text-paper/35">{formatJoinedDate(profile.created_at)}</p>
            {profile.bio ? (
              <p className="mt-4 max-w-2xl text-sm leading-6 text-paper/60">{profile.bio}</p>
            ) : isOwnProfile ? (
              <p className="mt-4 max-w-2xl text-sm leading-6 text-paper/35">No bio yet.</p>
            ) : null}
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
        <div role={isFriendActionError ? "alert" : "status"} className={`mt-4 rounded-md border px-4 py-3 font-mono text-sm ${isFriendActionError ? "border-ember/25 bg-ember/10 text-ember" : "border-mint/25 bg-mint/10 text-mint"}`}>
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

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <SummaryStat label="Tests completed" value={analytics.summary.totalTests} />
        <SummaryStat label="Current streak" value={`${analytics.activity.currentStreakDays} days`} />
        <SummaryStat label="Total XP / Level" value={`${analytics.progression.totalXp} / ${analytics.progression.currentLevel}`} />
      </section>
    </section>
  );
}

function PublicAvatar({
  avatarUrl,
  avatarStyle,
  label
}: {
  avatarUrl: string | null;
  avatarStyle: string;
  label: string;
}) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [avatarUrl]);

  if (avatarUrl && !hasImageError) {
    return (
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-brass/25 bg-ink-900">
        <Image
          src={avatarUrl}
          alt={`${label} avatar`}
          width={64}
          height={64}
          unoptimized
          className="h-full w-full object-cover"
          onError={() => setHasImageError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border ${getAvatarStyleClass(avatarStyle)}`}>
      <UserCircle className="h-9 w-9" />
    </div>
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
  domainAnalytics
}: {
  domainAnalytics: DomainAnalyticsSummary[];
}) {
  const visibleDomains = domainAnalytics.filter((domain) => domain.analytics.summary.totalTests > 0);
  const hasResults = visibleDomains.length > 0;

  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-sm uppercase text-brass">Public Stats</h2>
        <Trophy className="h-4 w-4 text-brass" />
      </div>
      {hasResults && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleDomains.map((domain) => (
            <FeaturedStat
              key={domain.id}
              label={`${domain.label} WPM`}
              value={formatNumber(domain.analytics.summary.bestWpm)}
              icon={<Trophy className="h-4 w-4" />}
            />
          ))}
        </div>
      )}
      {!hasResults && (
        <div className="mt-5 rounded-md border border-paper/10 bg-ink-900/60 px-4 py-5">
          <p className="font-mono text-sm text-paper">No best result yet.</p>
          <p className="mt-2 text-sm leading-6 text-paper/45">Best WPM and accuracy will fill in after public results.</p>
        </div>
      )}
    </section>
  );
}

function AchievementsSummary({ analytics }: { analytics: ReturnType<typeof buildProgressAnalytics> }) {
  const unlockedPercent = Math.round((analytics.achievements.unlockedCount / analytics.achievements.totalCount) * 100);

  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-sm uppercase text-brass">Achievements</h2>
          <p className="mt-1 font-mono text-xs uppercase text-paper/35">
            {analytics.achievements.unlockedCount} / {analytics.achievements.totalCount} unlocked
          </p>
        </div>
        <Award className="h-4 w-4 text-brass" />
      </div>
      {analytics.achievements.unlockedCount === 0 ? (
        <div className="mt-5 rounded-md border border-paper/10 bg-ink-900/60 px-4 py-5">
          <p className="font-mono text-sm text-paper">No achievements unlocked yet.</p>
          <p className="mt-2 text-sm leading-6 text-paper/45">Milestones will appear here as public results build up.</p>
        </div>
      ) : (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-paper/[0.06]">
          <div className="h-full rounded-full bg-brass" style={{ width: `${unlockedPercent}%` }} />
        </div>
      )}
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

type DomainAnalyticsSummary = {
  id: AnalyticsDomain;
  label: string;
  analytics: ReturnType<typeof buildProgressAnalytics>;
};

function buildDomainAnalytics(results: SupabaseAnalyticsTypingResultRow[]): DomainAnalyticsSummary[] {
  return ANALYTICS_DOMAIN_OPTIONS.map((option) => ({
    ...option,
    analytics: buildProgressAnalytics(results, { domain: option.id })
  }));
}

function formatNumber(value: number) {
  return Number(value).toFixed(1);
}
