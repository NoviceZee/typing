"use client";

import React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import {
  FriendListItem,
  listAcceptedFriends,
  listIncomingFriendRequests,
  listOutgoingFriendRequests
} from "@/lib/friendStorage";

export default function FriendsPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendListItem[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendListItem[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [friendsMessage, setFriendsMessage] = useState("");

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
      setIsLoadingFriends(false);
      return;
    }

    setIsLoadingFriends(true);
    setFriendsMessage("");
    Promise.all([listAcceptedFriends(), listIncomingFriendRequests(), listOutgoingFriendRequests()])
      .then(([nextFriends, nextIncoming, nextOutgoing]) => {
        if (!isMounted) return;
        setFriends(nextFriends);
        setIncomingRequests(nextIncoming);
        setOutgoingRequests(nextOutgoing);
      })
      .catch((error) => {
        if (!isMounted) return;
        setFriendsMessage(error instanceof Error ? error.message : "Friends could not be loaded.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingFriends(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  return (
    <AppShell sideAd={false}>
      <section className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase text-brass">Profile</p>
        <h1 className="mt-2 text-3xl font-semibold text-paper md:text-4xl">Friends</h1>

        {user && (
          <div className="mt-6 space-y-5">
            {friendsMessage && (
              <div className="rounded-md border border-ember/25 bg-ember/10 px-4 py-3 font-mono text-sm text-ember">
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
                <FriendSection title="Friends" emptyMessage="No friends yet." items={friends} />
                <FriendSection title="Incoming requests" emptyMessage="No incoming requests." items={incomingRequests} />
                <FriendSection title="Outgoing requests" emptyMessage="No outgoing requests." items={outgoingRequests} />
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
  items
}: {
  title: string;
  emptyMessage: string;
  items: FriendListItem[];
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
          className="flex items-center justify-between gap-4 border-b border-paper/10 px-4 py-4 last:border-b-0 md:px-5"
        >
          <p className="font-mono text-sm text-paper">@{item.handle}</p>
          <p className="font-mono text-[0.68rem] uppercase text-paper/35">{formatFriendState(item.direction)}</p>
        </article>
      ))}
    </section>
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
