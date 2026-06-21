import { describe, expect, it } from "vitest";
import { getLeaderboardDateRange } from "./leaderboardFilters";

describe("leaderboard date ranges", () => {
  const now = new Date(2026, 5, 21, 10, 30, 0);

  it("calculates today and yesterday ranges", () => {
    expectLocalParts(getLeaderboardDateRange("today", now)?.start, [2026, 5, 21, 0, 0, 0]);
    expectLocalParts(getLeaderboardDateRange("today", now)?.end, [2026, 5, 22, 0, 0, 0]);
    expectLocalParts(getLeaderboardDateRange("yesterday", now)?.start, [2026, 5, 20, 0, 0, 0]);
    expectLocalParts(getLeaderboardDateRange("yesterday", now)?.end, [2026, 5, 21, 0, 0, 0]);
  });

  it("calculates week, month, and year ranges", () => {
    expectLocalParts(getLeaderboardDateRange("this_week", now)?.start, [2026, 5, 15, 0, 0, 0]);
    expectLocalParts(getLeaderboardDateRange("this_week", now)?.end, [2026, 5, 22, 0, 0, 0]);
    expectLocalParts(getLeaderboardDateRange("this_month", now)?.start, [2026, 5, 1, 0, 0, 0]);
    expectLocalParts(getLeaderboardDateRange("this_month", now)?.end, [2026, 6, 1, 0, 0, 0]);
    expectLocalParts(getLeaderboardDateRange("this_year", now)?.start, [2026, 0, 1, 0, 0, 0]);
    expectLocalParts(getLeaderboardDateRange("this_year", now)?.end, [2027, 0, 1, 0, 0, 0]);
  });

  it("does not constrain all time", () => {
    expect(getLeaderboardDateRange("all_time", now)).toBeNull();
  });
});

function expectLocalParts(date: Date | undefined, parts: [number, number, number, number, number, number]) {
  expect(date).toBeTruthy();
  expect([
    date?.getFullYear(),
    date?.getMonth(),
    date?.getDate(),
    date?.getHours(),
    date?.getMinutes(),
    date?.getSeconds()
  ]).toEqual(parts);
}
