import { describe, expect, it } from "vitest";
import { calculateTypingViewportScrollTop } from "./typingViewport";

const lineHeight = 52;
const viewportTop = 100;
const clientHeight = lineHeight * 3;

function measurement(overrides: Partial<Parameters<typeof calculateTypingViewportScrollTop>[0]> = {}) {
  return {
    scrollTop: 0,
    scrollHeight: 900,
    clientHeight,
    viewportTop,
    activeTop: viewportTop + 10,
    activeBottom: viewportTop + 42,
    lineHeight,
    ...overrides
  };
}

describe("calculateTypingViewportScrollTop", () => {
  it("allows the caret to progress through the first two visual lines without scrolling", () => {
    expect(calculateTypingViewportScrollTop(measurement())).toBe(0);
    expect(calculateTypingViewportScrollTop(measurement({
      activeTop: viewportTop + lineHeight + 10,
      activeBottom: viewportTop + lineHeight + 42
    }))).toBe(0);
  });

  it("advances exactly one visual line when the caret enters the third row", () => {
    expect(calculateTypingViewportScrollTop(measurement({
      activeTop: viewportTop + lineHeight * 2 + 4,
      activeBottom: viewportTop + lineHeight * 2 + 34
    }))).toBe(lineHeight);
  });

  it("advances by whole line-height increments after a multi-line input jump", () => {
    expect(calculateTypingViewportScrollTop(measurement({
      scrollHeight: 1_500,
      activeTop: viewportTop + lineHeight * 4 + 10,
      activeBottom: viewportTop + lineHeight * 4 + 42
    }))).toBe(lineHeight * 3);
  });

  it("keeps the active line in row two after rolling has begun, including backspace", () => {
    expect(calculateTypingViewportScrollTop(measurement({
      scrollTop: lineHeight * 3,
      activeTop: viewportTop + 10,
      activeBottom: viewportTop + 42
    }))).toBe(lineHeight * 2);

    expect(calculateTypingViewportScrollTop(measurement({
      scrollTop: lineHeight * 3,
      activeTop: viewportTop + lineHeight + 10,
      activeBottom: viewportTop + lineHeight + 42
    }))).toBe(lineHeight * 3);
  });

  it("clamps line-oriented movement at the content bounds", () => {
    expect(calculateTypingViewportScrollTop(measurement({
      scrollTop: 730,
      activeTop: viewportTop + lineHeight * 2 + 10,
      activeBottom: viewportTop + lineHeight * 2 + 42
    }))).toBe(744);

    expect(calculateTypingViewportScrollTop(measurement({
      scrollTop: lineHeight,
      activeTop: viewportTop - lineHeight + 10,
      activeBottom: viewportTop - lineHeight + 42
    }))).toBe(0);
  });

  it("does not move when the content is already bounded or geometry is invalid", () => {
    expect(calculateTypingViewportScrollTop(measurement({ scrollHeight: clientHeight }))).toBe(0);
    expect(calculateTypingViewportScrollTop(measurement({ lineHeight: 0 }))).toBe(0);
  });
});
