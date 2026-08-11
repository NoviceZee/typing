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
  comparableText,
  language
}: {
  storedText: string;
  comparableText?: string | null;
  language?: "english" | "chinese";
}): CanonicalTypingTarget {
  const displayText = trimTargetBoundary(normalizeComparableUnicode(storedText));
  const comparisonSource = trimTargetBoundary(
    normalizeComparableUnicode(comparableText ?? storedText)
  );

  return Object.freeze({
    displayText,
    // Passage newlines are layout separators rather than typing input. English
    // prose still needs one word boundary; Chinese prose and poetry keep their
    // existing contiguous comparison target.
    comparableText: comparisonSource.replace(
      /[ \t]*(?:\n[ \t]*)+/g,
      language === "english" ? " " : ""
    )
  });
}

function trimTargetBoundary(value: string): string {
  return value.replace(/^[\s\uFEFF]+|[\s\uFEFF]+$/g, "");
}
