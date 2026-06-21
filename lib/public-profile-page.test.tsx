/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicUserProfilePage from "../pages/u/[handle]";
import {
  getSupabasePublicTypingResultsByHandle
} from "@/lib/typingResultStorage";
import { getSupabasePublicProfileByHandle } from "@/lib/profileStorage";

const mockState = vi.hoisted(() => ({
  handle: "Formal_Typist"
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    isReady: true,
    query: { handle: mockState.handle }
  })
}));

vi.mock("@/lib/profileStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/profileStorage")>("@/lib/profileStorage");

  return {
    ...actual,
    getSupabasePublicProfileByHandle: vi.fn().mockResolvedValue({ handle: "formal_typist" })
  };
});

vi.mock("@/lib/typingResultStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/typingResultStorage")>("@/lib/typingResultStorage");

  return {
    ...actual,
    getSupabasePublicTypingResultsByHandle: vi.fn().mockResolvedValue([
      makeResult("recent", 60, 72, 98.2, "Business email", "2026-06-21T00:02:00.000Z", 360),
      makeResult("perfect", 60, 64, 100, "Legal", "2026-06-20T00:01:00.000Z", 320)
    ])
  };
});

const mockedGetProfile = vi.mocked(getSupabasePublicProfileByHandle);
const mockedGetResults = vi.mocked(getSupabasePublicTypingResultsByHandle);

describe("PublicUserProfilePage", () => {
  beforeEach(() => {
    mockState.handle = "Formal_Typist";
    mockedGetProfile.mockClear();
    mockedGetResults.mockClear();
    mockedGetProfile.mockResolvedValue({ handle: "formal_typist" });
    mockedGetResults.mockResolvedValue([
      makeResult("recent", 60, 72, 98.2, "Business email", "2026-06-21T00:02:00.000Z", 360),
      makeResult("perfect", 60, 64, 100, "Legal", "2026-06-20T00:01:00.000Z", 320)
    ]);
  });

  it("renders a public profile by handle without exposing email", async () => {
    render(<PublicUserProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("@formal_typist")).toBeTruthy();
    });

    expect(screen.getByText("Level")).toBeTruthy();
    expect(screen.getByText("Total XP")).toBeTruthy();
    expect(screen.getByText("Total tests")).toBeTruthy();
    expect(screen.getByText("Best WPM")).toBeTruthy();
    expect(screen.getByText("Best accuracy")).toBeTruthy();
    expect(screen.getByText("Current streak")).toBeTruthy();
    expect(screen.getAllByText("Achievements").length).toBeGreaterThan(0);
    expect(screen.getByText("Recent Results")).toBeTruthy();
    expect(screen.queryByText(/typist@example.com/i)).toBeNull();
    expect(screen.queryByText(/user-1/i)).toBeNull();
  });

  it("uses case-insensitive handle lookup", async () => {
    mockState.handle = "FORMAL_TYPIST";

    render(<PublicUserProfilePage />);

    await waitFor(() => {
      expect(mockedGetProfile).toHaveBeenCalledWith("FORMAL_TYPIST");
    });
    expect(mockedGetResults).toHaveBeenCalledWith("formal_typist");
  });

  it("shows a not found state for a missing handle", async () => {
    mockedGetProfile.mockResolvedValueOnce(null);

    render(<PublicUserProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Profile not found")).toBeTruthy();
    });
    expect(screen.queryByText("@formal_typist")).toBeNull();
  });
});

function makeResult(
  id: string,
  durationSeconds: number,
  wpm: number,
  accuracy: number,
  category: string | null,
  createdAt: string,
  correctCharacters: number
) {
  return {
    id,
    passage_title: `Passage ${id}`,
    passage_category: category,
    duration_seconds: durationSeconds,
    wpm,
    accuracy,
    correct_chars: correctCharacters,
    created_at: createdAt
  };
}
