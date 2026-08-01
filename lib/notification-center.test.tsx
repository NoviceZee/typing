/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationCenter } from "@/components/NotificationCenter";

const mockState = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  lastSeenByUser: new Map<string, string | null>(),
  announcements: [{
    id: "announcement-1",
    title: "Maintenance notice",
    body: "Practice remains available.",
    published_at: "2026-07-14T00:00:00.000Z"
  }],
  friendRequests: [] as Array<{ id: string; handle: string }>,
  loadPromise: null as Promise<{ source: "account"; lastSeenAnnouncementAt: string | null }> | null,
  loadError: null as Error | null,
  persistPromise: null as Promise<void> | null,
  persistError: null as Error | null,
  persistCalls: 0
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: mockState.user })
}));

vi.mock("@/lib/friendStorage", () => ({
  FRIENDSHIP_RESOLVED_EVENT: "formaltype:friendship-resolved",
  listIncomingFriendRequests: vi.fn(async () => mockState.friendRequests)
}));

vi.mock("@/lib/announcementStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/announcementStorage")>("@/lib/announcementStorage");
  return {
    ...actual,
    listActiveAnnouncements: vi.fn(async () => mockState.announcements),
    loadAnnouncementReadState: vi.fn(async ({ userId }: { userId: string }) => {
      if (mockState.loadError) throw mockState.loadError;
      if (mockState.loadPromise) return mockState.loadPromise;
      return {
        source: "account" as const,
        lastSeenAnnouncementAt: mockState.lastSeenByUser.get(userId) ?? null
      };
    }),
    persistVisibleAnnouncementsRead: vi.fn(async ({
      userId,
      announcements
    }: {
      userId: string;
      announcements: Array<{ published_at: string }>;
    }) => {
      mockState.persistCalls += 1;
      if (mockState.persistPromise) await mockState.persistPromise;
      if (mockState.persistError) throw mockState.persistError;
      const latest = announcements.map((item) => item.published_at).sort().at(-1) ?? null;
      mockState.lastSeenByUser.set(userId, latest);
      return { source: "account" as const, lastSeenAnnouncementAt: latest };
    })
  };
});

describe("NotificationCenter", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1" };
    mockState.lastSeenByUser.clear();
    mockState.announcements = [{
      id: "announcement-1",
      title: "Maintenance notice",
      body: "Practice remains available.",
      published_at: "2026-07-14T00:00:00.000Z"
    }];
    mockState.friendRequests = [];
    mockState.loadPromise = null;
    mockState.loadError = null;
    mockState.persistPromise = null;
    mockState.persistError = null;
    mockState.persistCalls = 0;
    window.localStorage.clear();
  });

  it("clears the visible announcement badge immediately while persistence is pending", async () => {
    let releaseSave!: () => void;
    mockState.persistPromise = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    render(<NotificationCenter />);

    const trigger = await screen.findByRole("button", { name: "Notifications, 1 unread" });
    fireEvent.click(trigger);

    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    expect(screen.getByText("Maintenance notice")).toBeTruthy();
    expect(mockState.persistCalls).toBe(1);

    releaseSave();
    await waitFor(() =>
      expect(mockState.lastSeenByUser.get("user-1")).toBe("2026-07-14T00:00:00.000Z")
    );
  });

  it("persists a successful read after remounting", async () => {
    const firstRender = render(<NotificationCenter />);

    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
    await waitFor(() =>
      expect(mockState.lastSeenByUser.get("user-1")).toBe("2026-07-14T00:00:00.000Z")
    );
    firstRender.unmount();

    render(<NotificationCenter />);
    expect(await screen.findByRole("button", { name: "Notifications" })).toBeTruthy();
  });

  it("keeps the optimistic badge clear and exposes sync failure when saving fails", async () => {
    mockState.persistError = new Error("mark_announcements_seen is unavailable");
    render(<NotificationCenter />);

    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));

    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    expect((await screen.findByRole("status")).textContent).toMatch(/could not sync/i);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(mockState.persistCalls).toBe(1);
    expect(screen.queryByRole("button", { name: "Notifications, 1 unread" })).toBeNull();
  });

  it("ignores a mark-seen completion from the previous account", async () => {
    let releaseSave!: () => void;
    mockState.persistPromise = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const view = render(<NotificationCenter />);

    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
    mockState.user = { id: "user-2" };
    view.rerender(<NotificationCenter />);

    expect(await screen.findByRole("button", { name: "Notifications, 1 unread" })).toBeTruthy();

    releaseSave();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeTruthy();
  });

  it("clears the previous account's friend requests while the next account hydrates", async () => {
    mockState.announcements = [];
    mockState.friendRequests = [{ id: "friendship-user-1", handle: "first_account_friend" }];
    const view = render(<NotificationCenter />);
    expect(await screen.findByRole("button", { name: "Notifications, 1 unread" })).toBeTruthy();

    mockState.friendRequests = [];
    mockState.loadPromise = new Promise(() => undefined);
    mockState.user = { id: "user-2" };
    view.rerender(<NotificationCenter />);

    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    expect(screen.queryByText("@first_account_friend")).toBeNull();
  });

  it("does not flash an unread announcement before account read-state hydration completes", async () => {
    let releaseLoad!: (state: { source: "account"; lastSeenAnnouncementAt: string | null }) => void;
    mockState.loadPromise = new Promise((resolve) => {
      releaseLoad = resolve;
    });
    render(<NotificationCenter />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole("button", { name: "Notifications, 1 unread" })).toBeNull();

    releaseLoad({ source: "account", lastSeenAnnouncementAt: null });
    expect(await screen.findByRole("button", { name: "Notifications, 1 unread" })).toBeTruthy();
  });

  it("shows a badge for an announcement published after the persisted timestamp", async () => {
    mockState.lastSeenByUser.set("user-1", "2026-07-14T00:00:00.000Z");
    mockState.announcements = [
      ...mockState.announcements,
      {
        id: "announcement-2",
        title: "New release",
        body: "Published after the previous read.",
        published_at: "2026-07-29T00:00:00.000Z"
      }
    ];

    render(<NotificationCenter />);

    expect(await screen.findByRole("button", { name: "Notifications, 1 unread" })).toBeTruthy();
  });

  it("surfaces account read-state hydration errors instead of silently treating them as defaults", async () => {
    mockState.loadError = new Error("last_seen_announcement_at does not exist");
    render(<NotificationCenter />);

    const trigger = await screen.findByRole("button", { name: "Notifications, 1 unread" });
    fireEvent.click(trigger);

    expect((await screen.findByRole("status")).textContent).toMatch(/could not sync/i);
  });

  it("closes with Escape and restores trigger focus", async () => {
    render(<NotificationCenter />);

    const trigger = await screen.findByRole("button", { name: "Notifications, 1 unread" });
    fireEvent.click(trigger);
    screen.getByText("Maintenance notice").focus();
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Notification area" })).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("marks announcements read when opened so they do not return as new after login", async () => {
    const firstRender = render(<NotificationCenter />);

    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
    expect(screen.getByText("Maintenance notice")).toBeTruthy();
    await waitFor(() =>
      expect(mockState.lastSeenByUser.get("user-1")).toBe("2026-07-14T00:00:00.000Z")
    );
    await screen.findByRole("button", { name: "Notifications" });
    firstRender.unmount();

    render(<NotificationCenter />);
    const trigger = await screen.findByRole("button", { name: "Notifications" });
    fireEvent.click(trigger);
    expect(screen.queryByText("Maintenance notice")).toBeNull();
  });

  it("removes a resolved friend request without creating a post-accept notification", async () => {
    mockState.announcements = [];
    mockState.friendRequests = [{
      id: "friendship-1",
      handle: "formal_typist"
    }];
    render(<NotificationCenter />);

    const trigger = await screen.findByRole("button", { name: "Notifications, 1 unread" });
    fireEvent.click(trigger);
    expect(screen.getByText("New friend request")).toBeTruthy();
    expect(screen.getByText("@formal_typist")).toBeTruthy();
    expect(screen.queryByText(/wants to compare results/i)).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent("formaltype:friendship-resolved", {
        detail: { friendshipId: "friendship-1" }
      }));
    });

    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    expect(screen.queryByText("New friend request")).toBeNull();
  });
});
