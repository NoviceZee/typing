import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { Bell, Megaphone, UserPlus } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  FRIENDSHIP_RESOLVED_EVENT,
  FriendListItem,
  listIncomingFriendRequests
} from "@/lib/friendStorage";
import {
  AnnouncementReadState,
  AppAnnouncement,
  createOptimisticAnnouncementReadState,
  getUnreadAnnouncements,
  listActiveAnnouncements,
  loadAnnouncementReadState,
  migrateLocalAnnouncementReadStateToAccount,
  persistVisibleAnnouncementsRead
} from "@/lib/announcementStorage";
import { readNotificationSettings } from "@/lib/notificationSettings";

export function NotificationCenter() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<FriendListItem[]>([]);
  const [announcements, setAnnouncements] = useState<AppAnnouncement[]>([]);
  const [openAnnouncements, setOpenAnnouncements] = useState<AppAnnouncement[]>([]);
  const [readState, setReadState] = useState<AnnouncementReadState | null>(null);
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  const [readSyncState, setReadSyncState] = useState<"loading" | "saved" | "failed">("loading");
  const [readHydrationError, setReadHydrationError] = useState<string | null>(null);
  const [readSyncError, setReadSyncError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const accountGenerationRef = useRef(0);
  const userIdRef = useRef<string | null>(user?.id ?? null);
  userIdRef.current = user?.id ?? null;

  useEffect(() => {
    const generation = ++accountGenerationRef.current;
    if (!user) {
      setRequests([]);
      setAnnouncements([]);
      setOpenAnnouncements([]);
      setReadState(null);
      setHydratedUserId(null);
      setReadSyncState("loading");
      setReadHydrationError(null);
      setReadSyncError(null);
      setOpen(false);
      return;
    }
    let mounted = true;
    setRequests([]);
    setAnnouncements([]);
    setReadState(null);
    setHydratedUserId(null);
    setReadSyncState("loading");
    setReadHydrationError(null);
    setReadSyncError(null);
    setOpen(false);
    setOpenAnnouncements([]);
    const preferences = readNotificationSettings();
    void Promise.allSettled([
      preferences.friendRequests ? Promise.resolve().then(() => listIncomingFriendRequests()) : Promise.resolve([]),
      listActiveAnnouncements(),
      loadAnnouncementReadState({ userId: user.id })
    ]).then(async ([requestsResult, announcementsResult, readStateResult]) => {
      if (!mounted || accountGenerationRef.current !== generation || userIdRef.current !== user.id) return;
      const nextRequests = requestsResult.status === "fulfilled" ? requestsResult.value : [];
      const nextAnnouncements =
        announcementsResult.status === "fulfilled" ? announcementsResult.value : [];
      let nextReadState: AnnouncementReadState = {
        source: "account",
        lastSeenAnnouncementAt: null
      };
      let syncError: Error | null = null;

      if (readStateResult.status === "fulfilled") {
        nextReadState = readStateResult.value;
        try {
          nextReadState = await migrateLocalAnnouncementReadStateToAccount({
            userId: user.id,
            announcements: nextAnnouncements,
            accountState: nextReadState
          });
        } catch (error) {
          syncError = toError(error);
        }
      } else {
        syncError = toError(readStateResult.reason);
      }

      if (!mounted || accountGenerationRef.current !== generation || userIdRef.current !== user.id) return;
      setRequests(nextRequests);
      setAnnouncements(nextAnnouncements);
      setReadState(nextReadState);
      setHydratedUserId(user.id);
      setReadSyncState(syncError ? "failed" : "saved");
      setReadHydrationError(syncError?.message ?? null);
      if (syncError) {
        console.error("Announcement read state could not hydrate. The account migration may be missing.", syncError);
      }
    });
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setOpenAnnouncements([]);
    };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    function removeResolvedFriendRequest(event: Event) {
      const friendshipId = (event as CustomEvent<{ friendshipId?: string }>).detail?.friendshipId;
      if (!friendshipId) return;
      setRequests((currentRequests) =>
        currentRequests.filter((request) => request.id !== friendshipId)
      );
    }

    window.addEventListener(FRIENDSHIP_RESOLVED_EVENT, removeResolvedFriendRequest);
    return () => window.removeEventListener(FRIENDSHIP_RESOLVED_EVENT, removeResolvedFriendRequest);
  }, []);

  useEffect(() => {
    if (!open) return;
    function closeWithEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      setOpenAnnouncements([]);
      triggerRef.current?.focus();
    }
    document.addEventListener("keydown", closeWithEscape);
    return () => document.removeEventListener("keydown", closeWithEscape);
  }, [open]);

  if (!user) return null;
  const userId = user.id;
  const hasHydratedCurrentAccount = hydratedUserId === user.id && readState !== null;
  const unreadAnnouncements = hasHydratedCurrentAccount
    ? getUnreadAnnouncements(announcements, readState)
    : [];
  const unreadCount = requests.length + unreadAnnouncements.length;

  function toggle() {
    if (open) {
      setOpen(false);
      setOpenAnnouncements([]);
      return;
    }

    setOpenAnnouncements(unreadAnnouncements);
    if (unreadAnnouncements.length > 0) {
      const visibleAnnouncements = [...unreadAnnouncements];
      const generation = accountGenerationRef.current;
      setReadState((currentState) =>
        createOptimisticAnnouncementReadState({
          currentState: currentState ?? { source: "account", lastSeenAnnouncementAt: null },
          announcements: visibleAnnouncements,
          userId
        })
      );
      setReadSyncState("loading");
      setReadSyncError(null);
      void persistVisibleAnnouncementsRead({
        userId,
        announcements: visibleAnnouncements
      })
        .then((nextState) => {
          if (accountGenerationRef.current !== generation || userIdRef.current !== userId) return;
          setReadState(nextState);
          setReadSyncState("saved");
        })
        .catch((error) => {
          if (accountGenerationRef.current !== generation || userIdRef.current !== userId) return;
          const syncError = toError(error);
          setReadSyncState("failed");
          setReadSyncError(syncError.message);
          console.error("Announcement read state could not sync.", syncError);
        });
    }
    setOpen(true);
  }

  return <div ref={rootRef} className="relative">
    <button ref={triggerRef} type="button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} title="Notifications" aria-haspopup="dialog" aria-controls="notification-area" aria-expanded={open} onClick={toggle} className="relative grid h-8 w-8 place-items-center rounded-md text-paper/45 transition hover:bg-paper/[0.06] hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/70">
      <Bell className="icon-control" strokeWidth={1.75} aria-hidden="true" />{unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-brass px-1 text-center font-mono text-utility font-bold leading-4 text-ink-950">{Math.min(unreadCount, 9)}{unreadCount > 9 ? "+" : ""}</span>}
    </button>
    {open && <section id="notification-area" role="dialog" aria-label="Notification area" className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-lg border border-paper/10 bg-ink-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-paper/10 px-4 py-3"><h2 className="font-mono text-control uppercase tracking-wider text-paper">Notifications</h2><span className="font-mono text-utility text-paper/35">{unreadCount ? `${unreadCount} new` : "Up to date"}</span></div>
      {(readSyncState === "failed" || readHydrationError) && (
        <p role="status" className="border-b border-red-400/20 bg-red-400/10 px-4 py-2 font-mono text-utility text-red-200">
          Notification read state could not sync. Account persistence requires the latest database migration.
          {readHydrationError || readSyncError ? ` ${readHydrationError ?? readSyncError}` : ""}
        </p>
      )}
      <div className="max-h-96 overflow-y-auto">
        {requests.map((request) => <Link key={request.id} href="/profile/friends" onClick={() => { setOpen(false); setOpenAnnouncements([]); }} className="flex gap-3 border-b border-paper/10 px-4 py-3 transition hover:bg-paper/[0.04]"><UserPlus className="icon-inline mt-0.5 text-brass" /><span><strong className="block font-mono text-control font-normal text-paper">New friend request</strong><span className="mt-1 block text-utility text-paper/45">@{request.handle}</span></span></Link>)}
        {openAnnouncements.map((item) => <article key={item.id} className="flex gap-3 border-b border-paper/10 px-4 py-3 last:border-b-0"><Megaphone className="icon-inline mt-0.5 text-brass" /><div><h3 className="font-mono text-control text-paper">{item.title}</h3><p className="mt-1 text-utility leading-5 text-paper/45">{item.body}</p></div></article>)}
        {requests.length === 0 && openAnnouncements.length === 0 && <div className="px-5 py-8 text-center"><Bell className="icon-prominent mx-auto text-paper/20" /><p className="mt-3 font-mono text-utility text-paper/40">No notifications yet.</p></div>}
      </div>
    </section>}
  </div>;
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}
