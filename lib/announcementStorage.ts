import { supabase } from "@/lib/supabaseClient";

export type AppAnnouncement = { id: string; title: string; body: string; published_at: string };

export async function listActiveAnnouncements(): Promise<AppAnnouncement[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("app_announcements").select("id,title,body,published_at").eq("is_active", true).lte("published_at", new Date().toISOString()).order("published_at", { ascending: false }).limit(5);
  if (error) throw error;
  return data ?? [];
}

const READ_KEY = "formaltype_read_announcements";
export function readAnnouncementIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(window.localStorage.getItem(READ_KEY) || "[]")); } catch { return new Set(); }
}
export function markAnnouncementsRead(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(READ_KEY, JSON.stringify(Array.from(new Set([...Array.from(readAnnouncementIds()), ...ids])).slice(-100)));
}
