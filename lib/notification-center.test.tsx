/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationCenter } from "@/components/NotificationCenter";
import { readAnnouncementIds } from "@/lib/announcementStorage";

const mockState = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: mockState.user })
}));

vi.mock("@/lib/friendStorage", () => ({
  listIncomingFriendRequests: vi.fn().mockResolvedValue([
    { id: "request-1", handle: "steady_typist" }
  ])
}));

vi.mock("@/lib/announcementStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/announcementStorage")>("@/lib/announcementStorage");
  return {
    ...actual,
    listActiveAnnouncements: vi.fn().mockResolvedValue([
      {
        id: "announcement-1",
        title: "Maintenance notice",
        body: "Practice remains available.",
        published_at: "2026-07-14T00:00:00.000Z"
      }
    ])
  };
});

describe("NotificationCenter", () => {
  beforeEach(() => {
    mockState.user = { id: "user-1" };
    window.localStorage.clear();
  });

  it("closes with Escape, restores trigger focus, and persists visible announcements as read", async () => {
    render(<NotificationCenter />);

    const trigger = await screen.findByRole("button", { name: "Notifications, 2 unread" });
    fireEvent.click(trigger);
    const friendRequestLink = screen.getByRole("link", { name: /New friend request/ });
    friendRequestLink.focus();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Notification area" })).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(readAnnouncementIds().has("announcement-1")).toBe(true);
  });
});
