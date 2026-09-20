/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResultPage from "../pages/result/[attemptId]";
import { writeResultPageSnapshot } from "./resultPageStorage";

const router = vi.hoisted(() => ({
  isReady: true,
  query: { attemptId: "attempt-1" } as Record<string, string | string[] | undefined>,
  push: vi.fn()
}));

vi.mock("next/router", () => ({ useRouter: () => router }));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
  AdPlaceholder: () => null
}));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: null }) }));

describe("ResultPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    router.push.mockReset();
    router.query = { attemptId: "attempt-1" };
  });

  it("renders a normal page without dialog, overlay, close action, or nested dashboard scrolling", () => {
    writeFixture();
    render(<ResultPage />);

    expect(screen.getByTestId("app-shell")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Result" })).toBeTruthy();
    expect(screen.getByText("Time up")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: /close/i })).toBeNull();
    const dashboard = screen.getByTestId("result-dashboard");
    expect(dashboard.className).not.toContain("overflow-y-auto");
    expect(dashboard.className).not.toContain("max-h-");
  });

  it("survives remount and routes restart through a one-time handoff", () => {
    writeFixture();
    const first = render(<ResultPage />);
    first.unmount();
    render(<ResultPage />);

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    expect(router.push).toHaveBeenCalledWith(
      "/practice?language=english&mode=1m&resultAction=restart&attempt=attempt-1"
    );
  });

  it("routes Next passage through the same originating flow", () => {
    writeFixture();
    render(<ResultPage />);

    fireEvent.click(screen.getByRole("button", { name: "Next passage" }));
    expect(router.push).toHaveBeenCalledWith(
      "/practice?language=english&mode=1m&resultAction=next&attempt=attempt-1"
    );
  });

  it("shows an unavailable state for a missing or cross-tab result", () => {
    router.query = { attemptId: "missing" };
    render(<ResultPage />);

    expect(screen.getByRole("heading", { name: "Result unavailable" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to Practice" }).getAttribute("href")).toBe("/practice");
  });
});

function writeFixture() {
  writeResultPageSnapshot({
    version: 1,
    attemptId: "attempt-1",
    result: {
      characters: [], characterStatuses: [], correctCharacters: 200, incorrectCharacters: 0,
      missedCharacters: 0, extraCharacters: 0, totalCharacters: 200,
      comparableTargetLength: 200, comparableTypedLength: 200, accuracy: 100,
      wpm: 40, rawWpm: 42, elapsedSeconds: 60, modeDurationSeconds: 60,
      category: "Business communication", presetName: "General", completionReason: "time_up",
      completedAt: "2026-09-19T08:00:00.000Z", isRankable: true
    },
    passage: {
      id: "passage-1", title: "A result route", category: "Business communication", style: "General",
      source: "uploaded", text: "A stable result route survives refresh.", updatedAt: "2026-09-19T08:00:00.000Z"
    },
    previousResult: null,
    restartPreviousResult: null,
    restartTargetIdentity: null,
    recentResults: null,
    progressMilestones: [],
    attemptTimeline: [{ timeSeconds: 60, wpm: 40 }],
    errorEvents: [],
    modeLabel: "1m",
    isSuspicious: false,
    cloudSaveState: "idle",
    originHref: "/practice?language=english&mode=1m"
  });
}
