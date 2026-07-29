/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getUnreadAnnouncements,
  loadAnnouncementReadState,
  markAnnouncementsRead,
  migrateLocalAnnouncementReadStateToAccount,
  persistVisibleAnnouncementsRead,
  type AppAnnouncement
} from "@/lib/announcementStorage";

const announcements: AppAnnouncement[] = [
  {
    id: "old",
    title: "Old",
    body: "Old message",
    published_at: "2026-07-20T00:00:00.000Z"
  },
  {
    id: "new",
    title: "New",
    body: "New message",
    published_at: "2026-07-25T00:00:00.000Z"
  }
];

describe("announcement read-state lifecycle", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("loads authenticated read state from the account rather than browser state", async () => {
    window.localStorage.setItem("formaltype_read_announcements:user-1", JSON.stringify(["new"]));
    const repository = {
      loadLastSeen: vi.fn().mockResolvedValue("2026-07-20T00:00:00.000Z"),
      saveLastSeen: vi.fn()
    };

    const state = await loadAnnouncementReadState({ userId: "user-1", repository });

    expect(state).toEqual({
      source: "account",
      lastSeenAnnouncementAt: "2026-07-20T00:00:00.000Z"
    });
    expect(getUnreadAnnouncements(announcements, state).map((item) => item.id)).toEqual(["new"]);
  });

  it("persists the newest visible publication timestamp when the panel opens", async () => {
    const repository = {
      loadLastSeen: vi.fn(),
      saveLastSeen: vi.fn().mockResolvedValue("2026-07-25T00:00:00.000Z")
    };

    const state = await persistVisibleAnnouncementsRead({
      userId: "user-1",
      announcements,
      repository
    });

    expect(repository.saveLastSeen).toHaveBeenCalledWith("user-1", "2026-07-25T00:00:00.000Z");
    expect(getUnreadAnnouncements(announcements, state)).toEqual([]);
  });

  it("keeps a newer account timestamp when a stale device marks older announcements", async () => {
    const repository = {
      loadLastSeen: vi.fn(),
      saveLastSeen: vi.fn().mockResolvedValue("2026-07-26T00:00:00.000Z")
    };

    const state = await persistVisibleAnnouncementsRead({
      userId: "user-1",
      announcements: [announcements[0]],
      repository
    });

    expect(state).toEqual({
      source: "account",
      lastSeenAnnouncementAt: "2026-07-26T00:00:00.000Z"
    });
  });

  it("does not report read-state success when the account profile row is missing", async () => {
    const repository = {
      loadLastSeen: vi.fn(),
      saveLastSeen: vi.fn().mockRejectedValue(new Error("Profile row not found"))
    };

    await expect(persistVisibleAnnouncementsRead({
      userId: "missing-user",
      announcements,
      repository
    })).rejects.toThrow("Profile row not found");
  });

  it("shows a badge only for an announcement published after the persisted timestamp", () => {
    const state = {
      source: "account" as const,
      lastSeenAnnouncementAt: "2026-07-25T00:00:00.000Z"
    };
    const next = [
      ...announcements,
      {
        id: "genuinely-new",
        title: "Genuinely new",
        body: "Published later",
        published_at: "2026-07-26T00:00:00.000Z"
      }
    ];

    expect(getUnreadAnnouncements(next, state).map((item) => item.id)).toEqual(["genuinely-new"]);
  });

  it("keeps account read state scoped to the authenticated user", async () => {
    const repository = {
      loadLastSeen: vi.fn()
        .mockResolvedValueOnce("2026-07-25T00:00:00.000Z")
        .mockResolvedValueOnce(null),
      saveLastSeen: vi.fn()
    };

    const first = await loadAnnouncementReadState({ userId: "user-1", repository });
    const second = await loadAnnouncementReadState({ userId: "user-2", repository });

    expect(getUnreadAnnouncements(announcements, first)).toEqual([]);
    expect(getUnreadAnnouncements(announcements, second)).toEqual(announcements);
    expect(repository.loadLastSeen).toHaveBeenNthCalledWith(1, "user-1");
    expect(repository.loadLastSeen).toHaveBeenNthCalledWith(2, "user-2");
  });

  it("migrates existing browser read IDs only when the account has no read timestamp", async () => {
    markAnnouncementsRead(["old"], "user-1");
    const repository = {
      loadLastSeen: vi.fn(),
      saveLastSeen: vi.fn().mockResolvedValue("2026-07-20T00:00:00.000Z")
    };

    const state = await migrateLocalAnnouncementReadStateToAccount({
      userId: "user-1",
      announcements,
      accountState: { source: "account", lastSeenAnnouncementAt: null },
      repository
    });

    expect(repository.saveLastSeen).toHaveBeenCalledWith("user-1", "2026-07-20T00:00:00.000Z");
    expect(getUnreadAnnouncements(announcements, state).map((item) => item.id)).toEqual(["new"]);
  });
});
