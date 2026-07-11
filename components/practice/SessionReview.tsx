import React from "react";
import type { CharacterComparison, TypingResult } from "@/lib/typing-engine";
import { classifyDetailedMistake, getFingerForKey } from "@/lib/typingStatistics";

type MistakeType = "capitalization" | "punctuation" | "spacing" | "wrongCharacter";
type MistakeBreakdown = Record<MistakeType, number>;

export function SessionReview({ result }: { result: TypingResult }) {
  const breakdown = getMistakeBreakdown(result.characterStatuses);
  const mismatches = getMismatches(result.characterStatuses, 10);

  return (
    <section className="mt-5 rounded-md bg-ink-950/35 p-4">
      <h3 className="text-lg font-semibold text-paper">Session review</h3>
      <p className="mt-1 text-sm leading-6 text-paper/50">A quick breakdown of where the finished attempt drifted.</p>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <ReviewStat label="Mistakes" value={result.incorrectCharacters} />
        <ReviewStat label="Capitalization" value={breakdown.capitalization} />
        <ReviewStat label="Punctuation" value={breakdown.punctuation} />
        <ReviewStat label="Spacing" value={breakdown.spacing} />
        <ReviewStat label="Wrong character" value={breakdown.wrongCharacter} />
      </div>

      {mismatches.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-md bg-paper/[0.025]">
          <div className="grid min-w-[64rem] grid-cols-[4rem_1fr_1fr_1fr_1fr_1fr_1.2fr_1fr] border-b border-paper/5 px-3 py-2 font-mono text-[0.68rem] uppercase text-paper/35">
            <span>Pos</span><span>Expected</span><span>Typed</span><span>Finger</span>
            <span>Expected finger</span><span>Typed finger</span><span>Classification</span><span>Type</span>
          </div>
          {mismatches.map((mismatch, index) => (
            <div
              key={`${mismatch.index}-${index}-${mismatch.expected}-${mismatch.actual}`}
              className="grid min-w-[64rem] grid-cols-[4rem_1fr_1fr_1fr_1fr_1fr_1.2fr_1fr] border-b border-paper/5 px-3 py-2 font-mono text-xs text-paper/70 last:border-b-0"
            >
              <span className="text-paper/40">{mismatch.index + 1}</span>
              <span>{formatReviewCharacter(mismatch.expected, "Missing")}</span>
              <span>{formatReviewCharacter(mismatch.actual, "Extra")}</span>
              <span>{formatReviewFinger(getFingerForKey(mismatch.actual) ?? getFingerForKey(mismatch.expected))}</span>
              <span>{formatReviewFinger(getFingerForKey(mismatch.expected))}</span>
              <span>{formatReviewFinger(getFingerForKey(mismatch.actual))}</span>
              <span>{classifyDetailedMistake(mismatch)}</span>
              <span>{formatMistakeType(classifyMistake(mismatch))}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-paper/[0.03] px-3 py-3">
      <div className="font-mono text-[0.68rem] uppercase text-paper/35">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold text-paper/90">{value}</div>
    </div>
  );
}

export function getMistakeBreakdown(characters: CharacterComparison[]): MistakeBreakdown {
  return getMismatches(characters).reduce<MistakeBreakdown>((breakdown, character) => {
    const type = classifyMistake(character);
    return { ...breakdown, [type]: breakdown[type] + 1 };
  }, { capitalization: 0, punctuation: 0, spacing: 0, wrongCharacter: 0 });
}

function getMismatches(characters: CharacterComparison[], limit = Number.POSITIVE_INFINITY) {
  return characters.filter((character) => character.status === "wrong" || character.status === "extra").slice(0, limit);
}

function classifyMistake(character: CharacterComparison): MistakeType {
  const { expected, actual } = character;
  if (isSpacingCharacter(expected) || isSpacingCharacter(actual)) return "spacing";
  if (isPunctuationCharacter(expected) || isPunctuationCharacter(actual)) return "punctuation";
  if (expected && actual && expected !== actual && expected.toLocaleLowerCase() === actual.toLocaleLowerCase() && isLetterCharacter(expected) && isLetterCharacter(actual)) return "capitalization";
  return "wrongCharacter";
}

function formatMistakeType(type: MistakeType) {
  return type === "wrongCharacter" ? "Wrong character" : type.charAt(0).toLocaleUpperCase() + type.slice(1);
}

function formatReviewFinger(finger: string | null) { return finger ?? "N/A"; }

function formatReviewCharacter(character: string, emptyLabel: string) {
  if (!character) return emptyLabel;
  if (character === " ") return "Space";
  if (character === "\n") return "Line break";
  if (character === "\t") return "Tab";
  return character;
}

function isSpacingCharacter(character: string) { return character === " " || character === "\n" || character === "\t"; }
function isPunctuationCharacter(character: string) { return Boolean(character.match(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/)); }
function isLetterCharacter(character: string) { return /^[a-z]$/i.test(character); }
