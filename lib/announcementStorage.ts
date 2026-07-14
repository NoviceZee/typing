import { supabase } from "@/lib/supabaseClient";
import { safeSetJsonStorageItem } from "@/lib/storageSafety";

export type AppAnnouncement = { id: string; title: string; body: string; published_at: string };

export async function listActiveAnnouncements(): Promise<AppAnnouncement[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("app_announcements").select("id,title,body,published_at").eq("is_active", true).lte("published_at", new Date().toISOString()).order("published_at", { ascending: false }).limit(5);
  if (error) throw error;
  return data ?? [];
}

const LEGACY_READ_KEY = "formaltype_read_announcements";
const READ_KEY_PREFIX = "formaltype_read_announcements";

function getReadKey(userId?: string | null) {
  return userId ? `${READ_KEY_PREFIX}:${userId}` : LEGACY_READ_KEY;
}

export function readAnnouncementIds(userId?: string | null): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const readKey = getReadKey(userId);
    const scopedValue = window.localStorage.getItem(readKey);
    if (scopedValue) return new Set<string>(JSON.parse(scopedValue));

    const legacyValue = userId ? window.localStorage.getItem(LEGACY_READ_KEY) : null;
    if (!legacyValue) return new Set();

    const legacyIds = JSON.parse(legacyValue);
    const migration = safeSetJsonStorageItem(readKey, legacyIds, { context: "migrateAnnouncementReadState" });
    if (migration.ok) window.localStorage.removeItem(LEGACY_READ_KEY);
    return new Set<string>(legacyIds);
  } catch {
    return new Set();
  }
}
export function markAnnouncementsRead(ids: string[], userId?: string | null) {
  return safeSetJsonStorageItem(
    getReadKey(userId),
    Array.from(new Set([...Array.from(readAnnouncementIds(userId)), ...ids])).slice(-100),
    { context: "markAnnouncementsRead" }
  );
}
