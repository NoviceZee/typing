/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { SessionReview, getMistakeBreakdown } from "@/components/practice/SessionReview";
import type { CharacterComparison, TypingResult } from "./typing-engine";

describe("SessionReview", () => {
  it("classifies and renders capitalization, punctuation, spacing, and wrong-character mistakes", () => {
    const characters: CharacterComparison[] = [
      { expected: "A", actual: "a", index: 0, status: "wrong" },
      { expected: ".", actual: ",", index: 1, status: "wrong" },
      { expected: " ", actual: "", index: 2, status: "wrong" },
      { expected: "q", actual: "x", index: 3, status: "wrong" }
    ];

    expect(getMistakeBreakdown(characters)).toEqual({
      capitalization: 1,
      punctuation: 1,
      spacing: 1,
      wrongCharacter: 1
    });

    render(<SessionReview result={{ incorrectCharacters: 4, characterStatuses: characters } as TypingResult} />);
    expect(screen.getByText("Session review")).toBeTruthy();
    expect(screen.getByText("Missed Shift")).toBeTruthy();
    expect(screen.getAllByText("Punctuation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Spacing").length).toBeGreaterThan(0);
  });
});
