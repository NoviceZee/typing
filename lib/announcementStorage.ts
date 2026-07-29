import { supabase } from "@/lib/supabaseClient";
import { safeSetJsonStorageItem } from "@/lib/storageSafety";

export type AppAnnouncement = { id: string; title: string; body: string; published_at: string };

export type AnnouncementReadState =
  | { source: "account"; lastSeenAnnouncementAt: string | null }
  | { source: "local"; readIds: Set<string> };

export type AnnouncementReadRepository = {
  loadLastSeen(userId: string): Promise<string | null>;
  saveLastSeen(userId: string, publishedAt: string): Promise<string>;
};

export type MarkAnnouncementsSeenRpc = {
  Args: { announcement_published_at: string };
  Returns: string;
};

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

export async function loadAnnouncementReadState({
  userId,
  repository = supabaseAnnouncementReadRepository
}: {
  userId?: string | null;
  repository?: AnnouncementReadRepository;
}): Promise<AnnouncementReadState> {
  if (!userId) {
    return { source: "local", readIds: readAnnouncementIds() };
  }

  return {
    source: "account",
    lastSeenAnnouncementAt: await repository.loadLastSeen(userId)
  };
}

export function getUnreadAnnouncements(
  announcements: AppAnnouncement[],
  state: AnnouncementReadState
): AppAnnouncement[] {
  if (state.source === "local") {
    return announcements.filter((announcement) => !state.readIds.has(announcement.id));
  }

  const lastSeen = state.lastSeenAnnouncementAt ? Date.parse(state.lastSeenAnnouncementAt) : Number.NEGATIVE_INFINITY;
  return announcements.filter((announcement) => {
    const publishedAt = Date.parse(announcement.published_at);
    return Number.isFinite(publishedAt) && publishedAt > lastSeen;
  });
}

export function createOptimisticAnnouncementReadState({
  currentState,
  announcements,
  userId
}: {
  currentState: AnnouncementReadState;
  announcements: AppAnnouncement[];
  userId?: string | null;
}): AnnouncementReadState {
  if (!userId && currentState.source === "local") {
    return {
      source: "local",
      readIds: new Set([
        ...Array.from(currentState.readIds),
        ...announcements.map((announcement) => announcement.id)
      ])
    };
  }

  const latestVisible = getLatestPublishedAt(announcements);
  const currentTimestamp =
    currentState.source === "account" ? currentState.lastSeenAnnouncementAt : null;
  return {
    source: "account",
    lastSeenAnnouncementAt: getLaterTimestamp(currentTimestamp, latestVisible)
  };
}

export async function persistVisibleAnnouncementsRead({
  userId,
  announcements,
  repository = supabaseAnnouncementReadRepository
}: {
  userId?: string | null;
  announcements: AppAnnouncement[];
  repository?: AnnouncementReadRepository;
}): Promise<AnnouncementReadState> {
  if (!userId) {
    markAnnouncementsRead(announcements.map((announcement) => announcement.id));
    return { source: "local", readIds: readAnnouncementIds() };
  }

  const latestPublishedAt = getLatestPublishedAt(announcements);
  if (latestPublishedAt) {
    const persistedPublishedAt = await repository.saveLastSeen(userId, latestPublishedAt);
    return { source: "account", lastSeenAnnouncementAt: persistedPublishedAt };
  }
  return { source: "account", lastSeenAnnouncementAt: null };
}

export async function migrateLocalAnnouncementReadStateToAccount({
  userId,
  announcements,
  accountState,
  repository = supabaseAnnouncementReadRepository
}: {
  userId: string;
  announcements: AppAnnouncement[];
  accountState: AnnouncementReadState;
  repository?: AnnouncementReadRepository;
}): Promise<AnnouncementReadState> {
  if (accountState.source !== "account" || accountState.lastSeenAnnouncementAt) {
    return accountState;
  }

  const localReadIds = readAnnouncementIds(userId);
  const locallyReadAnnouncements = announcements.filter((announcement) => localReadIds.has(announcement.id));
  if (!locallyReadAnnouncements.length) {
    return accountState;
  }

  return persistVisibleAnnouncementsRead({
    userId,
    announcements: locallyReadAnnouncements,
    repository
  });
}

export const supabaseAnnouncementReadRepository: AnnouncementReadRepository = {
  async loadLastSeen(userId) {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("last_seen_announcement_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data?.last_seen_announcement_at ?? null;
  },
  async saveLastSeen(userId, publishedAt) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const rpcArgs = {
      announcement_published_at: publishedAt
    } satisfies MarkAnnouncementsSeenRpc["Args"];
    const { data, error } = await supabase.rpc("mark_announcements_seen", rpcArgs);
    if (error) throw error;
    const persistedTimestamp = data as MarkAnnouncementsSeenRpc["Returns"] | null;
    if (typeof persistedTimestamp !== "string") {
      throw new Error(`Announcement read state was not persisted for user ${userId}.`);
    }
    return persistedTimestamp;
  }
};

function getLatestPublishedAt(announcements: AppAnnouncement[]) {
  return announcements.reduce<string | null>((latest, announcement) => {
    if (!latest || Date.parse(announcement.published_at) > Date.parse(latest)) {
      return announcement.published_at;
    }
    return latest;
  }, null);
}

function getLaterTimestamp(first: string | null, second: string | null) {
  if (!first) return second;
  if (!second) return first;
  return Date.parse(first) >= Date.parse(second) ? first : second;
}
