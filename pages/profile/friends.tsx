"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Plus, UserCircle, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProfileSectionNav } from "@/components/ProfileSectionNav";
import { useAuth } from "@/components/AuthProvider";
import { buildProgressAnalytics } from "@/lib/analytics";
import { ANALYTICS_DOMAIN_OPTIONS, AnalyticsDomain } from "@/lib/analyticsDomain";
import {
  FriendListItem,
  acceptFriendRequest,
  listAcceptedFriends,
  listIncomingFriendRequests,
  listOutgoingFriendRequests,
  rejectFriendRequest,
  removeFriend,
  sendFriendRequestByProfileHandle
} from "@/lib/friendStorage";
import {
  getSupabaseAvatarPublicUrl,
  getSupabasePublicProfileByHandle
} from "@/lib/profileStorage";
import type { SupabasePublicProfile } from "@/lib/profileStorage";
import { getSupabasePublicTypingResultsByHandle } from "@/lib/typingResultStorage";
import type { SupabaseAnalyticsTypingResultRow } from "@/lib/typingResultStorage";

type FriendStats = {
  profile: SupabasePublicProfile | null;
  analytics: ReturnType<typeof buildProgressAnalytics> | null;
  domainAnalytics: Record<AnalyticsDomain, ReturnType<typeof buildProgressAnalytics>> | null;
  latestResult: SupabaseAnalyticsTypingResultRow | null;
  isPrivate: boolean;
};

type FriendRow = {
  friend: FriendListItem;
  stats: FriendStats;
};

export default function FriendsPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [friendRows, setFriendRows] = useState<FriendRow[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendListItem[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendListItem[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [friendsMessage, setFriendsMessage] = useState("");
  const [friendsMessageKind, setFriendsMessageKind] = useState<"success" | "error">("success");
  const [friendHandle, setFriendHandle] = useState("");
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);

  const requestCount = incomingRequests.length + outgoingRequests.length;

  const loadFriends = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoadingFriends(true);
    }

    const [nextFriends, nextIncoming, nextOutgoing] = await Promise.all([
      listAcceptedFriends(),
      listIncomingFriendRequests(),
      listOutgoingFriendRequests()
    ]);
    const nextRows = await Promise.all(nextFriends.map(toFriendRow));

    setFriendRows(nextRows);
    setIncomingRequests(nextIncoming);
    setOutgoingRequests(nextOutgoing);

    if (showLoading) {
      setIsLoadingFriends(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthLoading || user) {
      return;
    }

    router.push("/login?redirectTo=/profile/friends");
  }, [isAuthLoading, router, user]);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setFriendRows([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setFriendsMessage("");
      setFriendsMessageKind("success");
      setIsLoadingFriends(false);
      return;
    }

    setIsLoadingFriends(true);
    setFriendsMessage("");
    setFriendsMessageKind("success");
    loadFriends()
      .then(() => {
        if (!isMounted) return;
      })
      .catch((error) => {
        if (!isMounted) return;
        setFriendsMessage(error instanceof Error ? error.message : "Friends could not be loaded.");
        setFriendsMessageKind("error");
        setIsLoadingFriends(false);
      });

    return () => {
      isMounted = false;
    };
  }, [loadFriends, user]);

  async function handleSendFriendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayHandle = friendHandle.trim();

    if (!displayHandle) {
      setFriendsMessage("Enter a handle to send a friend request.");
      setFriendsMessageKind("error");
      return;
    }

    setIsSendingRequest(true);
    setFriendsMessage("");
    setFriendsMessageKind("success");

    try {
      await sendFriendRequestByProfileHandle(displayHandle);
      setFriendHandle("");
      setIsAddFriendOpen(false);
      setFriendsMessage(`Friend request sent to @${displayHandle.replace(/^@+/, "")}.`);
      setFriendsMessageKind("success");
      await loadFriends(false);
    } catch (error) {
      setFriendsMessage(error instanceof Error ? error.message : "Friend request could not be sent.");
      setFriendsMessageKind("error");
    } finally {
      setIsSendingRequest(false);
    }
  }

  async function handleFriendAction(
    friendship: FriendListItem,
    action: () => Promise<unknown>,
    successMessage: string
  ) {
    setPendingActionId(friendship.id);
    setFriendsMessage("");
    setFriendsMessageKind("success");

    try {
      await action();
      setFriendsMessage(successMessage);
      setFriendsMessageKind("success");
      await loadFriends(false);
    } catch (error) {
      setFriendsMessage(error instanceof Error ? error.message : "Friend action could not be completed.");
      setFriendsMessageKind("error");
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <AppShell sideAd={false}>
      <section className="mx-auto max-w-6xl">
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-paper md:text-4xl">Friends</h1>
            <p className="mt-2 font-mono text-xs uppercase text-paper/35">
              {friendRows.length} friends{requestCount > 0 ? ` / ${requestCount} requests` : ""}
            </p>
          </div>
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAddFriendOpen((isOpen) => !isOpen)}
                className="inline-flex items-center gap-2 rounded-md border border-brass/30 bg-brass/10 px-3 py-2 font-mono text-xs uppercase text-brass transition hover:border-brass/50 hover:bg-brass/15"
              >
                <Plus className="h-4 w-4" />
                Add friend
              </button>
              {isAddFriendOpen && (
                <form
                  onSubmit={handleSendFriendRequest}
                  className="absolute right-0 z-10 mt-2 w-72 rounded-lg border border-paper/10 bg-ink-950 p-3 shadow-glow"
                >
                  <label className="block">
                    <span className="font-mono text-xs uppercase text-paper/45">Add friend by handle</span>
                    <input
                      value={friendHandle}
                      onChange={(event) => setFriendHandle(event.target.value)}
                      placeholder="@handle"
                      className="mt-2 w-full rounded-md border border-paper/10 bg-ink-900 px-3 py-2 font-mono text-sm text-paper outline-none transition placeholder:text-paper/30 focus:border-brass"
                    />
                  </label>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddFriendOpen(false)}
                      className="rounded-md border border-paper/10 bg-ink-900 px-3 py-2 font-mono text-xs uppercase text-paper/55 transition hover:border-paper/20 hover:text-paper"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSendingRequest}
                      className="rounded-md border border-brass/30 bg-brass/10 px-3 py-2 font-mono text-xs uppercase text-brass transition hover:border-brass/50 hover:bg-brass/15 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {isSendingRequest ? "Sending..." : "Send request"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
        <ProfileSectionNav />

        {user && (
          <div className="mt-6 space-y-4">
            {friendsMessage && (
              <div
                role={friendsMessageKind === "error" ? "alert" : "status"}
                aria-live={friendsMessageKind === "error" ? "assertive" : "polite"}
                className={`rounded-md border px-4 py-3 font-mono text-sm ${
                  friendsMessageKind === "error"
                    ? "border-ember/25 bg-ember/10 text-ember"
                    : "border-brass/25 bg-brass/10 text-brass"
                }`}
              >
                {friendsMessage}
              </div>
            )}

            {isLoadingFriends && (
              <div role="status" aria-live="polite" className="rounded-md border border-paper/10 bg-ink-950/75 px-4 py-5 font-mono text-sm text-paper/45">
                Loading friends...
              </div>
            )}

            {!isLoadingFriends && (
              <>
                <RequestsPanel
                  incomingRequests={incomingRequests}
                  outgoingRequests={outgoingRequests}
                  pendingActionId={pendingActionId}
                  onAccept={(item) =>
                    handleFriendAction(item, () => acceptFriendRequest(item.id), "Friend request accepted.")
                  }
                  onReject={(item) =>
                    handleFriendAction(item, () => rejectFriendRequest(item.id), "Friend request rejected.")
                  }
                  onCancel={(item) =>
                    handleFriendAction(item, () => rejectFriendRequest(item.id), `Canceled request to @${item.handle}.`)
                  }
                />
                <FriendsTable
                  rows={friendRows}
                  pendingActionId={pendingActionId}
                  onRemove={(item) =>
                    handleFriendAction(item, () => removeFriend(item.id), `Removed @${item.handle} from friends.`)
                  }
                />
              </>
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}

async function toFriendRow(friend: FriendListItem): Promise<FriendRow> {
  try {
    const profile = await getSupabasePublicProfileByHandle(friend.handle);

    if (!profile || profile.public_profile_enabled === false) {
      return { friend, stats: { profile, analytics: null, domainAnalytics: null, latestResult: null, isPrivate: true } };
    }

    const results = await getSupabasePublicTypingResultsByHandle(friend.handle);
    const newestFirst = [...results].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));

    return {
      friend,
      stats: {
        profile,
        analytics: buildProgressAnalytics(results),
        domainAnalytics: buildFriendDomainAnalytics(results),
        latestResult: newestFirst[0] ?? null,
        isPrivate: false
      }
    };
  } catch {
    return { friend, stats: { profile: null, analytics: null, domainAnalytics: null, latestResult: null, isPrivate: true } };
  }
}

function FriendsTable({
  rows,
  pendingActionId,
  onRemove
}: {
  rows: FriendRow[];
  pendingActionId: string | null;
  onRemove: (friend: FriendListItem) => void;
}) {
  if (rows.length === 0) {
    return (
      <section className="rounded-lg border border-paper/10 bg-ink-950/75 px-4 py-8 text-center shadow-glow">
        <p className="font-mono text-sm text-paper">No friends yet.</p>
        <p className="mt-2 text-sm text-paper/45">Add a handle to start building your stats table.</p>
      </section>
    );
  }

  return (
    <section className="overflow-x-auto rounded-lg border border-paper/10 bg-ink-950/75 shadow-glow">
      <table aria-label="Friends stats" className="min-w-[64rem] w-full border-collapse text-left">
        <thead className="border-b border-paper/10 font-mono text-[0.68rem] uppercase text-paper/35">
          <tr>
            <th className="px-4 py-3 font-normal">Friend</th>
            <th className="px-3 py-3 font-normal">Level</th>
            <th className="px-3 py-3 font-normal">Tests</th>
            <th className="px-3 py-3 font-normal">English</th>
            <th className="px-3 py-3 font-normal">Chinese</th>
            <th className="px-3 py-3 font-normal">Code</th>
            <th className="px-3 py-3 font-normal">Acc</th>
            <th className="px-3 py-3 font-normal">Streak</th>
            <th className="px-3 py-3 font-normal">Latest</th>
            <th className="px-4 py-3 text-right font-normal">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <FriendTableRow
              key={row.friend.id}
              row={row}
              isPending={pendingActionId === row.friend.id}
              onRemove={() => onRemove(row.friend)}
            />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function FriendTableRow({
  row,
  isPending,
  onRemove
}: {
  row: FriendRow;
  isPending: boolean;
  onRemove: () => void;
}) {
  const { friend, stats } = row;
  const avatarUrl = getSupabaseAvatarPublicUrl(stats.profile?.avatar_path);
  const analytics = stats.analytics;
  const domainAnalytics = stats.domainAnalytics;
  const latestResult = stats.latestResult;
  const hasPublicStats = Boolean(analytics && !stats.isPrivate);

  return (
    <tr className="border-b border-paper/10 last:border-b-0">
      <td className="min-w-56 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <FriendAvatar
            avatarUrl={avatarUrl}
            avatarStyle={stats.profile?.avatar_style ?? "amber"}
            label={`@${friend.handle}`}
          />
          <div className="min-w-0">
            <Link href={`/u/${friend.handle}`} className="font-mono text-sm text-paper transition hover:text-brass">
              @{friend.handle}
            </Link>
            <p className="mt-1 font-mono text-[0.68rem] uppercase text-paper/35">
              {stats.isPrivate ? "Private" : `Friends since ${formatShortDate(friend.updated_at || friend.created_at)}`}
            </p>
          </div>
        </div>
      </td>
      <FriendStatCell value={hasPublicStats ? analytics?.progression.currentLevel : null} />
      <FriendStatCell value={hasPublicStats ? analytics?.summary.totalTests : null} />
      <FriendStatCell value={getDomainBestWpm(domainAnalytics, "english")} />
      <FriendStatCell value={getDomainBestWpm(domainAnalytics, "chinese")} />
      <FriendStatCell value={getDomainBestWpm(domainAnalytics, "code")} />
      <FriendStatCell
        value={hasPublicStats && analytics?.summary.bestAccuracy ? `${formatNumber(analytics.summary.bestAccuracy)}%` : null}
      />
      <FriendStatCell value={hasPublicStats ? `${analytics?.activity.currentStreakDays ?? 0}d` : null} />
      <td className="max-w-44 px-3 py-3 font-mono text-xs text-paper/60">
        {hasPublicStats && latestResult ? (
          <span className="block truncate" title={latestResult.passage_title}>
            {latestResult.passage_title}
          </span>
        ) : (
          "-"
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={onRemove}
          disabled={isPending}
          aria-label={`Remove friend @${friend.handle}`}
          title={`Remove friend @${friend.handle}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-paper/10 bg-ink-900 text-paper/45 transition hover:border-ember/35 hover:text-ember disabled:cursor-not-allowed disabled:opacity-55"
        >
          <X className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function RequestsPanel({
  incomingRequests,
  outgoingRequests,
  pendingActionId,
  onAccept,
  onReject,
  onCancel
}: {
  incomingRequests: FriendListItem[];
  outgoingRequests: FriendListItem[];
  pendingActionId: string | null;
  onAccept: (friend: FriendListItem) => void;
  onReject: (friend: FriendListItem) => void;
  onCancel: (friend: FriendListItem) => void;
}) {
  const hasRequests = incomingRequests.length > 0 || outgoingRequests.length > 0;

  if (!hasRequests) {
    return null;
  }

  return (
    <section className="rounded-lg border border-paper/10 bg-ink-950/75 px-4 py-3 shadow-glow">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-mono text-sm uppercase text-brass">Requests</h2>
          <p className="mt-1 font-mono text-[0.68rem] uppercase text-paper/35">
            {incomingRequests.length} incoming / {outgoingRequests.length} outgoing
          </p>
        </div>
        <div className="grid flex-1 gap-2 lg:max-w-3xl">
          {incomingRequests.map((item) => (
            <RequestRow
              key={item.id}
              item={item}
              statusLabel="Incoming"
              pendingActionId={pendingActionId}
              primaryLabel="Accept"
              onPrimary={() => onAccept(item)}
              secondaryLabel="Reject"
              onSecondary={() => onReject(item)}
            />
          ))}
          {outgoingRequests.map((item) => (
            <RequestRow
              key={item.id}
              item={item}
              statusLabel="Pending"
              pendingActionId={pendingActionId}
              primaryLabel="Cancel"
              onPrimary={() => onCancel(item)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function RequestRow({
  item,
  statusLabel,
  pendingActionId,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary
}: {
  item: FriendListItem;
  statusLabel: string;
  pendingActionId: string | null;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const isPending = pendingActionId === item.id;
  const primaryActionLabel = `${primaryLabel} request @${item.handle}`;
  const secondaryActionLabel = secondaryLabel ? `${secondaryLabel} request @${item.handle}` : "";

  return (
    <div className="flex flex-col gap-2 rounded-md border border-paper/10 bg-ink-900/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Link href={`/u/${item.handle}`} className="font-mono text-sm text-paper transition hover:text-brass">
          @{item.handle}
        </Link>
        <span className="font-mono text-[0.68rem] uppercase text-paper/35">{statusLabel}</span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrimary}
          disabled={isPending}
          aria-label={primaryActionLabel}
          title={primaryActionLabel}
          className="rounded-md border border-brass/30 bg-brass/10 px-3 py-1.5 font-mono text-xs uppercase text-brass transition hover:border-brass/50 hover:bg-brass/15 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            disabled={isPending}
            aria-label={secondaryActionLabel}
            title={secondaryActionLabel}
            className="rounded-md border border-paper/10 bg-ink-900 px-3 py-1.5 font-mono text-xs uppercase text-paper/55 transition hover:border-ember/35 hover:text-ember disabled:cursor-not-allowed disabled:opacity-55"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function FriendAvatar({
  avatarUrl,
  avatarStyle,
  label
}: {
  avatarUrl: string | null;
  avatarStyle: string;
  label: string;
}) {
  const avatarClass = useMemo(() => getAvatarStyleClass(avatarStyle), [avatarStyle]);

  if (avatarUrl) {
    return (
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-brass/25 bg-ink-900">
        <Image
          src={avatarUrl}
          alt={`${label} avatar`}
          width={36}
          height={36}
          unoptimized
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${avatarClass}`}>
      <UserCircle className="h-5 w-5" />
    </div>
  );
}

function FriendStatCell({ value }: { value: string | number | null | undefined }) {
  return <td className="px-3 py-3 font-mono text-sm text-paper/70">{value ?? "—"}</td>;
}

function buildFriendDomainAnalytics(results: SupabaseAnalyticsTypingResultRow[]) {
  return ANALYTICS_DOMAIN_OPTIONS.reduce(
    (domains, option) => {
      domains[option.id] = buildProgressAnalytics(results, { domain: option.id });
      return domains;
    },
    {} as Record<AnalyticsDomain, ReturnType<typeof buildProgressAnalytics>>
  );
}

function getDomainBestWpm(
  domainAnalytics: Record<AnalyticsDomain, ReturnType<typeof buildProgressAnalytics>> | null,
  domain: AnalyticsDomain
) {
  const analytics = domainAnalytics?.[domain];

  if (!analytics || analytics.summary.totalTests === 0) {
    return null;
  }

  return formatNumber(analytics.summary.bestWpm);
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

function formatShortDate(createdAt?: string | null) {
  if (!createdAt) {
    return "-";
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function formatNumber(value: number) {
  return Number(value).toFixed(1);
}
