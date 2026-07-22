export type TypingViewportMeasurement = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  viewportTop: number;
  activeTop: number;
  activeBottom: number;
};

const VIEWPORT_TRIGGER_START = 0.28;
const VIEWPORT_TRIGGER_END = 0.72;
const VIEWPORT_TARGET = 0.5;

export function calculateTypingViewportScrollTop({
  scrollTop,
  scrollHeight,
  clientHeight,
  viewportTop,
  activeTop,
  activeBottom
}: TypingViewportMeasurement): number {
  if (scrollHeight <= clientHeight || clientHeight <= 0) {
    return scrollTop;
  }

  const triggerTop = viewportTop + clientHeight * VIEWPORT_TRIGGER_START;
  const triggerBottom = viewportTop + clientHeight * VIEWPORT_TRIGGER_END;
  if (activeTop >= triggerTop && activeBottom <= triggerBottom) {
    return scrollTop;
  }

  const activeCenter = activeTop + (activeBottom - activeTop) / 2;
  const targetCenter = viewportTop + clientHeight * VIEWPORT_TARGET;
  const nextScrollTop = scrollTop + activeCenter - targetCenter;
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);

  return Math.max(0, Math.min(maxScrollTop, Math.round(nextScrollTop)));
}
