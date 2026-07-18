import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Megaphone, UserPlus } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { FriendListItem, listIncomingFriendRequests } from "@/lib/friendStorage";
import { AppAnnouncement, listActiveAnnouncements, markAnnouncementsRead, readAnnouncementIds } from "@/lib/announcementStorage";
import { readNotificationSettings } from "@/lib/notificationSettings";

export function NotificationCenter() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<FriendListItem[]>([]);
  const [announcements, setAnnouncements] = useState<AppAnnouncement[]>([]);
  const [openAnnouncements, setOpenAnnouncements] = useState<AppAnnouncement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const markVisibleAnnouncementsRead = useCallback(() => {
    const ids = announcements.filter((item) => !readIds.has(item.id)).map((item) => item.id);
    if (!ids.length) return true;

    const writeResult = markAnnouncementsRead(ids, user?.id);
    if (!writeResult.ok) return false;

    setReadIds((current) => new Set([...Array.from(current), ...ids]));
    return true;
  }, [announcements, readIds, user?.id]);

  useEffect(() => {
    if (!user) { setRequests([]); setAnnouncements([]); setOpenAnnouncements([]); setOpen(false); return; }
    let mounted = true;
    const preferences = readNotificationSettings();
    Promise.all([
      preferences.friendRequests ? Promise.resolve().then(() => listIncomingFriendRequests()).catch(() => []) : Promise.resolve([]),
      listActiveAnnouncements().catch(() => [])
    ]).then(([nextRequests, nextAnnouncements]) => { if (!mounted) return; setRequests(nextRequests); setAnnouncements(nextAnnouncements); setReadIds(readAnnouncementIds(user.id)); });
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
  }, [markVisibleAnnouncementsRead, open]);

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
  }, [markVisibleAnnouncementsRead, open]);

  if (!user) return null;
  const unreadAnnouncements = announcements.filter((item) => !readIds.has(item.id));
  const unreadCount = requests.length + unreadAnnouncements.length;

  function toggle() {
    if (open) {
      setOpen(false);
      setOpenAnnouncements([]);
      return;
    }

    setOpenAnnouncements(unreadAnnouncements);
    markVisibleAnnouncementsRead();
    setOpen(true);
  }

  return <div ref={rootRef} className="relative">
    <button ref={triggerRef} type="button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} title="Notifications" aria-haspopup="dialog" aria-controls="notification-area" aria-expanded={open} onClick={toggle} className="relative grid h-8 w-8 place-items-center rounded-md text-paper/45 transition hover:bg-paper/[0.06] hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/70">
      <Bell className="icon-control" strokeWidth={1.75} aria-hidden="true" />{unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-brass px-1 text-center font-mono text-utility font-bold leading-4 text-ink-950">{Math.min(unreadCount, 9)}{unreadCount > 9 ? "+" : ""}</span>}
    </button>
    {open && <section id="notification-area" role="dialog" aria-label="Notification area" className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-lg border border-paper/10 bg-ink-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-paper/10 px-4 py-3"><h2 className="font-mono text-control uppercase tracking-wider text-paper">Notifications</h2><span className="font-mono text-utility text-paper/35">{unreadCount ? `${unreadCount} new` : "Up to date"}</span></div>
      <div className="max-h-96 overflow-y-auto">
        {requests.map((request) => <Link key={request.id} href="/profile/friends" onClick={() => { setOpen(false); setOpenAnnouncements([]); }} className="flex gap-3 border-b border-paper/10 px-4 py-3 transition hover:bg-paper/[0.04]"><UserPlus className="icon-inline mt-0.5 text-brass" /><span><strong className="block font-mono text-control font-normal text-paper">New friend request</strong><span className="mt-1 block text-utility text-paper/45">@{request.handle} wants to compare results.</span></span></Link>)}
        {openAnnouncements.map((item) => <article key={item.id} className="flex gap-3 border-b border-paper/10 px-4 py-3 last:border-b-0"><Megaphone className="icon-inline mt-0.5 text-brass" /><div><h3 className="font-mono text-control text-paper">{item.title}</h3><p className="mt-1 text-utility leading-5 text-paper/45">{item.body}</p></div></article>)}
        {requests.length === 0 && openAnnouncements.length === 0 && <div className="px-5 py-8 text-center"><Bell className="icon-prominent mx-auto text-paper/20" /><p className="mt-3 font-mono text-utility text-paper/40">No notifications yet.</p></div>}
      </div>
    </section>}
  </div>;
}
