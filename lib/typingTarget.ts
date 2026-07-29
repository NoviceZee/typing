export type CanonicalTypingTarget = Readonly<{
  displayText: string;
  comparableText: string;
}>;

export function normalizeComparableUnicode(value: string): string {
  // Canonical composition removes visually irrelevant encoding differences
  // without compatibility-folding authored full-width Chinese punctuation.
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u2028\u2029]/g, "\n")
    .normalize("NFC")
    .replace(/[\uFE00-\uFE0F]|\uDB40[\uDD00-\uDDEF]/g, "");
}

export function createCanonicalTypingTarget({
  storedText,
  comparableText
}: {
  storedText: string;
  comparableText?: string | null;
}): CanonicalTypingTarget {
  const displayText = trimTargetBoundary(normalizeComparableUnicode(storedText));
  const comparisonSource = trimTargetBoundary(
    normalizeComparableUnicode(comparableText ?? storedText)
  );

  return Object.freeze({
    displayText,
    // Passage newlines are layout separators. The textarea is not expected to
    // reproduce them, so remove the separator and any indentation around it
    // before the immutable typing session is created.
    comparableText: comparisonSource.replace(/[ \t]*\n[ \t]*/g, "")
  });
}

function trimTargetBoundary(value: string): string {
  return value.replace(/^[\s\uFEFF]+|[\s\uFEFF]+$/g, "");
}
