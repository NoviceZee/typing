export type TypingViewportMeasurement = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  viewportTop: number;
  activeTop: number;
  activeBottom: number;
  lineHeight: number;
};

export function calculateTypingViewportScrollTop({
  scrollTop,
  scrollHeight,
  clientHeight,
  viewportTop,
  activeTop,
  activeBottom,
  lineHeight
}: TypingViewportMeasurement): number {
  if (scrollHeight <= clientHeight || clientHeight <= 0 || lineHeight <= 0) {
    return scrollTop;
  }

  const activeCenter = activeTop + (activeBottom - activeTop) / 2;
  const visibleRow = Math.floor((activeCenter - viewportTop) / lineHeight);

  // At startup, let the caret use rows one and two naturally. Once it enters
  // row three, movement happens in whole visual-line increments so the active
  // line returns to row two.
  if (scrollTop <= 0 && visibleRow <= 1) {
    return scrollTop;
  }

  const rowDelta = visibleRow - 1;
  if (rowDelta === 0) {
    return scrollTop;
  }

  const nextScrollTop = scrollTop + rowDelta * lineHeight;
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);

  return Math.max(0, Math.min(maxScrollTop, nextScrollTop));
}
