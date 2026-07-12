import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
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
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) { setRequests([]); setAnnouncements([]); return; }
    let mounted = true;
    const preferences = readNotificationSettings();
    Promise.all([
      preferences.friendRequests ? Promise.resolve().then(() => listIncomingFriendRequests()).catch(() => []) : Promise.resolve([]),
      listActiveAnnouncements().catch(() => [])
    ]).then(([nextRequests, nextAnnouncements]) => { if (!mounted) return; setRequests(nextRequests); setAnnouncements(nextAnnouncements); setReadIds(readAnnouncementIds()); });
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!user) return null;
  const unreadAnnouncements = announcements.filter((item) => !readIds.has(item.id));
  const unreadCount = requests.length + unreadAnnouncements.length;

  function toggle() {
    const nextOpen = !open; setOpen(nextOpen);
    if (nextOpen && unreadAnnouncements.length) { markAnnouncementsRead(unreadAnnouncements.map((item) => item.id)); setReadIds(new Set([...Array.from(readIds), ...unreadAnnouncements.map((item) => item.id)])); }
  }

  return <div ref={rootRef} className="relative">
    <button type="button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} aria-expanded={open} onClick={toggle} className="relative grid h-9 w-9 place-items-center rounded-md border border-paper/10 bg-ink-900 text-paper/55 transition hover:border-brass/40 hover:text-paper">
      <Bell className="h-4 w-4" />{unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-brass px-1 text-center font-mono text-[9px] font-bold leading-4 text-ink-950">{Math.min(unreadCount, 9)}{unreadCount > 9 ? "+" : ""}</span>}
    </button>
    {open && <section aria-label="Notification area" className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-lg border border-paper/10 bg-ink-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-paper/10 px-4 py-3"><h2 className="font-mono text-xs uppercase tracking-wider text-paper">Notifications</h2><span className="font-mono text-[10px] text-paper/35">{unreadCount ? `${unreadCount} new` : "Up to date"}</span></div>
      <div className="max-h-96 overflow-y-auto">
        {requests.map((request) => <Link key={request.id} href="/profile/friends" onClick={() => setOpen(false)} className="flex gap-3 border-b border-paper/10 px-4 py-3 transition hover:bg-paper/[0.04]"><UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-brass" /><span><strong className="block font-mono text-xs font-normal text-paper">New friend request</strong><span className="mt-1 block text-xs text-paper/45">@{request.handle} wants to compare results.</span></span></Link>)}
        {announcements.map((item) => <article key={item.id} className="flex gap-3 border-b border-paper/10 px-4 py-3 last:border-b-0"><Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-brass" /><div><div className="flex items-center gap-2"><h3 className="font-mono text-xs text-paper">{item.title}</h3>{!readIds.has(item.id) && <span className="h-1.5 w-1.5 rounded-full bg-brass" />}</div><p className="mt-1 text-xs leading-5 text-paper/45">{item.body}</p></div></article>)}
        {requests.length === 0 && announcements.length === 0 && <div className="px-5 py-8 text-center"><Bell className="mx-auto h-5 w-5 text-paper/20" /><p className="mt-3 font-mono text-xs text-paper/40">No notifications yet.</p></div>}
      </div>
    </section>}
  </div>;
}
