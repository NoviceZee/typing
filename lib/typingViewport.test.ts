import { describe, expect, it } from "vitest";
import { calculateTypingViewportScrollTop } from "./typingViewport";

describe("calculateTypingViewportScrollTop", () => {
  it.each([
    ["small", 26, 344, 370, 107],
    ["medium", 34, 336, 370, 103],
    ["large", 46, 324, 370, 97]
  ])(
    "centres an English Training wrapped line using measured %s typography bounds",
    (_size, _height, activeTop, activeBottom, expectedScrollTop) => {
      expect(
        calculateTypingViewportScrollTop({
          scrollTop: 0,
          scrollHeight: 900,
          clientHeight: 300,
          viewportTop: 100,
          activeTop,
          activeBottom
        })
      ).toBe(expectedScrollTop);
    }
  );

  it.each([
    ["small", 28, 342, 370, 106],
    ["medium", 38, 332, 370, 101],
    ["large", 50, 320, 370, 95]
  ])(
    "centres a Chinese Training token on its next visual line using measured %s typography bounds",
    (_size, _height, activeTop, activeBottom, expectedScrollTop) => {
      expect(
        calculateTypingViewportScrollTop({
          scrollTop: 0,
          scrollHeight: 900,
          clientHeight: 300,
          viewportTop: 100,
          activeTop,
          activeBottom
        })
      ).toBe(expectedScrollTop);
    }
  );

  it("keeps an already visible line in place and clamps measured scrolling at the content bounds", () => {
    expect(
      calculateTypingViewportScrollTop({
        scrollTop: 120,
        scrollHeight: 900,
        clientHeight: 300,
        viewportTop: 100,
        activeTop: 210,
        activeBottom: 250
      })
    ).toBe(120);

    expect(
      calculateTypingViewportScrollTop({
        scrollTop: 590,
        scrollHeight: 900,
        clientHeight: 300,
        viewportTop: 100,
        activeTop: 360,
        activeBottom: 410
      })
    ).toBe(600);
  });
});
