"use client";

import React from "react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
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

export default function FriendsPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendListItem[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendListItem[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [friendsMessage, setFriendsMessage] = useState("");
  const [friendsMessageKind, setFriendsMessageKind] = useState<"success" | "error">("success");
  const [friendHandle, setFriendHandle] = useState("");
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const loadFriends = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoadingFriends(true);
    }

    const [nextFriends, nextIncoming, nextOutgoing] = await Promise.all([
      listAcceptedFriends(),
      listIncomingFriendRequests(),
      listOutgoingFriendRequests()
    ]);
    setFriends(nextFriends);
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
      setFriends([]);
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
      <section className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase text-brass">Profile</p>
        <h1 className="mt-2 text-3xl font-semibold text-paper md:text-4xl">Friends</h1>

        {user && (
          <div className="mt-6 space-y-5">
            <form
              onSubmit={handleSendFriendRequest}
              className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5"
            >
              <label className="block">
                <span className="font-mono text-sm uppercase text-brass">Add friend by handle</span>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={friendHandle}
                    onChange={(event) => setFriendHandle(event.target.value)}
                    placeholder="@handle"
                    className="min-w-0 flex-1 rounded-md border border-paper/10 bg-ink-900 px-3 py-2 font-mono text-sm text-paper outline-none transition placeholder:text-paper/30 focus:border-brass"
                  />
                  <button
                    type="submit"
                    disabled={isSendingRequest}
                    className="rounded-md border border-brass/30 bg-brass/10 px-4 py-2 font-mono text-xs uppercase text-brass transition hover:border-brass/50 hover:bg-brass/15 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {isSendingRequest ? "Sending..." : "Send request"}
                  </button>
                </div>
              </label>
            </form>

            {friendsMessage && (
              <div
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
              <div className="rounded-md border border-paper/10 bg-ink-950/75 px-4 py-5 font-mono text-sm text-paper/45">
                Loading friends...
              </div>
            )}

            {!isLoadingFriends && (
              <>
                <FriendSection
                  title="Friends"
                  emptyMessage="No friends yet."
                  items={friends}
                  pendingActionId={pendingActionId}
                  actionForItem={(item) => ({
                    label: "Remove",
                    onClick: () =>
                      handleFriendAction(item, () => removeFriend(item.id), `Removed @${item.handle} from friends.`)
                  })}
                />
                <FriendSection
                  title="Incoming requests"
                  emptyMessage="No incoming requests."
                  items={incomingRequests}
                  pendingActionId={pendingActionId}
                  actionForItem={(item) => ({
                    label: "Accept",
                    onClick: () =>
                      handleFriendAction(item, () => acceptFriendRequest(item.id), "Friend request accepted."),
                    secondaryLabel: "Reject",
                    onSecondaryClick: () =>
                      handleFriendAction(item, () => rejectFriendRequest(item.id), "Friend request rejected.")
                  })}
                />
                <FriendSection
                  title="Outgoing requests"
                  emptyMessage="No outgoing requests."
                  items={outgoingRequests}
                  pendingActionId={pendingActionId}
                  actionForItem={(item) => ({
                    label: "Cancel",
                    onClick: () =>
                      handleFriendAction(item, () => rejectFriendRequest(item.id), `Canceled request to @${item.handle}.`)
                  })}
                />
              </>
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function FriendSection({
  title,
  emptyMessage,
  items,
  pendingActionId,
  actionForItem
}: {
  title: string;
  emptyMessage: string;
  items: FriendListItem[];
  pendingActionId: string | null;
  actionForItem: (item: FriendListItem) => {
    label: string;
    onClick: () => void;
    secondaryLabel?: string;
    onSecondaryClick?: () => void;
  };
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-paper/10 bg-ink-950/75 shadow-glow">
      <div className="border-b border-paper/10 px-4 py-4 md:px-5">
        <h2 className="font-mono text-sm uppercase text-brass">{title}</h2>
      </div>
      {items.length === 0 && <p className="px-4 py-5 font-mono text-sm text-paper/45 md:px-5">{emptyMessage}</p>}
      {items.map((item) => (
        <article
          key={item.id}
          className="flex flex-col gap-3 border-b border-paper/10 px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between md:px-5"
        >
          <div>
            <p className="font-mono text-sm text-paper">@{item.handle}</p>
            <p className="mt-1 font-mono text-[0.68rem] uppercase text-paper/35">{formatFriendState(item.direction)}</p>
          </div>
          <FriendActions item={item} pendingActionId={pendingActionId} action={actionForItem(item)} />
        </article>
      ))}
    </section>
  );
}

function FriendActions({
  item,
  pendingActionId,
  action
}: {
  item: FriendListItem;
  pendingActionId: string | null;
  action: {
    label: string;
    onClick: () => void;
    secondaryLabel?: string;
    onSecondaryClick?: () => void;
  };
}) {
  const isPending = pendingActionId === item.id;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={action.onClick}
        disabled={isPending}
        aria-label={`${action.label} @${item.handle}`}
        className="rounded-md border border-brass/30 bg-brass/10 px-3 py-2 font-mono text-xs uppercase text-brass transition hover:border-brass/50 hover:bg-brass/15 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {action.label}
      </button>
      {action.secondaryLabel && action.onSecondaryClick && (
        <button
          type="button"
          onClick={action.onSecondaryClick}
          disabled={isPending}
          aria-label={`${action.secondaryLabel} @${item.handle}`}
          className="rounded-md border border-paper/10 bg-ink-900 px-3 py-2 font-mono text-xs uppercase text-paper/55 transition hover:border-ember/35 hover:text-ember disabled:cursor-not-allowed disabled:opacity-55"
        >
          {action.secondaryLabel}
        </button>
      )}
    </div>
  );
}

function formatFriendState(direction: FriendListItem["direction"]) {
  if (direction === "incoming") {
    return "Incoming";
  }

  if (direction === "outgoing") {
    return "Pending";
  }

  return "Friends";
}
