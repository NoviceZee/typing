"use client";

import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, RotateCcw, Shuffle } from "lucide-react";
import { clsx } from "clsx";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import {
  CompletionReason,
  DEFAULT_RULES,
  TypingResult,
  TypingRules,
  buildPracticePassage,
  calculateResult,
  enforceBackspacePolicy,
  isTypedTextComplete,
  normalizeTargetForRules,
  validateTypedText
} from "@/lib/typing-engine";
import {
  PreviousTypingResult,
  StoredPassage,
  filterLibraryPassages,
  getDefaultPassage,
  readPreviousResult,
  readStoredPassage,
  readStoredRules,
  selectDifferentLibraryPassage,
  selectRandomLibraryPassage,
  toStoredPassage,
  writePreviousResult,
  writeStoredPassage
} from "@/lib/app-storage";
import {
  getActivePassageLibrary,
  getPassageSelectionMode,
  getSelectedCategory,
  getSelectedStyle,
  setActivePassageId,
  setPassageSelectionMode
} from "@/lib/passageStorage";
import { saveSupabaseTypingResult } from "@/lib/typingResultStorage";

const DURATIONS = [
  { label: "1 min", seconds: 60 },
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 }
];

type SessionStatus = "idle" | "running" | "finished";

export default function PracticePage() {
  const { user } = useAuth();
  const [rules, setRules] = useState<TypingRules>(DEFAULT_RULES);
  const [passage, setPassage] = useState<StoredPassage>(() => getDefaultPassage(60));
  const [typedText, setTypedText] = useState("");
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [customMinutes, setCustomMinutes] = useState(2);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<TypingResult | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [passageNotice, setPassageNotice] = useState("");
  const [previousResult, setPreviousResult] = useState<PreviousTypingResult | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingWindowRef = useRef<HTMLDivElement>(null);
  const currentCharRef = useRef<HTMLSpanElement | null>(null);
  const finishedRef = useRef(false);
  const statusRef = useRef<SessionStatus>("idle");
  const startedAtRef = useRef<number | null>(null);
  const typedTextRef = useRef("");
  const elapsedSecondsRef = useRef(0);

  const isRunning = status === "running";
  const isFinished = status === "finished";
  const sourceText = passage.text.trim();
  const targetText = useMemo(() => normalizeTargetForRules(sourceText, rules), [sourceText, rules]);
  const comparison = useMemo(
    () => validateTypedText({ targetText: sourceText, typedText, rules }),
    [sourceText, typedText, rules]
  );
  const liveResult = useMemo(
    () =>
      isRunning
        ? calculateResult({
            target: sourceText,
            typed: typedText,
            elapsedSeconds: Math.max(elapsedSeconds, 1),
            durationSeconds,
            category: passage.category,
            rules
          })
        : {
            ...comparison,
            wpm: 0,
            rawWpm: 0,
            timeUsedSeconds: 0,
            durationSeconds,
            category: passage.category,
            presetName: "Custom rules",
            completionReason: "manual" as CompletionReason,
            completedAt: "",
            isRankable: false
          },
    [comparison, durationSeconds, elapsedSeconds, isRunning, passage.category, rules, sourceText, typedText]
  );
  const displayedResult = lastResult ?? liveResult;
  const previousPaceIndex = useMemo(() => {
    if (!previousResult || !isRunning) {
      return -1;
    }

    const previousCharsPerSecond = (previousResult.wpm * 5) / 60;
    return Math.min(Math.max(Math.floor(elapsedSeconds * previousCharsPerSecond), 0), Math.max(targetText.length - 1, 0));
  }, [elapsedSeconds, isRunning, previousResult, targetText.length]);
  const paceComparison =
    previousResult && isRunning
      ? typedText.length >= previousPaceIndex
        ? "Ahead of previous pace"
        : "Behind previous pace"
      : "";

  useEffect(() => {
    setRules(readStoredRules());
    const storedPassage = readStoredPassage(60);
    setPassage(storedPassage);
    setPreviousResult(readPreviousResult(storedPassage.id));
    if (getFilteredLibrary().length === 0) {
      setPassageNotice("No active saved passages found. Using a sample passage.");
    }
  }, []);

  useEffect(() => {
    typedTextRef.current = typedText;
  }, [typedText]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    startedAtRef.current = startedAt;
  }, [startedAt]);

  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  const resetSession = useCallback(() => {
    finishedRef.current = false;
    statusRef.current = "idle";
    startedAtRef.current = null;
    typedTextRef.current = "";
    setTypedText("");
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    setRemainingSeconds(durationSeconds);
    setStartedAt(null);
    setFinishedAt(null);
    setLastResult(null);
    setIsResultModalOpen(false);
    setPreviousResult(readPreviousResult(passage.id));
    setStatus("idle");
    if (typingWindowRef.current) {
      typingWindowRef.current.scrollTop = 0;
    }
  }, [durationSeconds, passage.id]);

  const finishTest = useCallback(
    (completionReason: CompletionReason) => {
      const sessionStartedAt = startedAtRef.current;

      if (finishedRef.current || statusRef.current !== "running" || !sessionStartedAt) {
        return;
      }

      const finishedTime = Date.now();
      const measuredElapsed = Math.max(1, Math.floor((finishedTime - sessionStartedAt) / 1000));
      const finalElapsed = completionReason === "time_up" ? durationSeconds : measuredElapsed;

      finishedRef.current = true;
      statusRef.current = "finished";
      elapsedSecondsRef.current = finalElapsed;
      setFinishedAt(finishedTime);
      setElapsedSeconds(finalElapsed);
      setRemainingSeconds(completionReason === "time_up" ? 0 : Math.max(0, durationSeconds - finalElapsed));
      setStatus("finished");
      setIsResultModalOpen(completionReason === "time_up" || completionReason === "text_completed");
      const finalResult = calculateResult({
        target: sourceText,
        typed: typedTextRef.current,
        elapsedSeconds: Math.max(finalElapsed, 1),
        durationSeconds,
        category: passage.category,
        rules,
        completionReason
      });

      setPreviousResult(readPreviousResult(passage.id));
      setLastResult(finalResult);
      writePreviousResult(passage, finalResult, typedTextRef.current.length);

      if (user) {
        void saveSupabaseTypingResult({
          userId: user.id,
          passage,
          result: finalResult,
          typedCharacters: typedTextRef.current.length
        }).catch((error) => {
          console.warn("Supabase typing result save failed", error);
        });
      }
    },
    [durationSeconds, passage, rules, sourceText, user]
  );

  const startSession = useCallback(() => {
    if (!sourceText || isFinished) {
      return;
    }

    finishedRef.current = false;
    const now = Date.now();
    statusRef.current = "running";
    startedAtRef.current = now;
    typedTextRef.current = "";
    setTypedText("");
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    setRemainingSeconds(durationSeconds);
    setStartedAt(now);
    setFinishedAt(null);
    setLastResult(null);
    setPreviousResult(readPreviousResult(passage.id));
    setStatus("running");
  }, [durationSeconds, isFinished, passage.id, sourceText]);

  useEffect(() => {
    if (!isRunning || isFinished || !startedAt) {
      return;
    }

    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, durationSeconds - elapsed);

      elapsedSecondsRef.current = elapsed;
      setElapsedSeconds(elapsed);
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        window.clearInterval(timer);
        finishTest("time_up");
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [durationSeconds, finishTest, isFinished, isRunning, startedAt]);

  useEffect(() => {
    if (!isRunning || isFinished) {
      return;
    }

    if (isTypedTextComplete(sourceText, typedText, rules)) {
      finishTest("text_completed");
    }
  }, [finishTest, isFinished, isRunning, rules, sourceText, typedText]);

  useEffect(() => {
    const startOnTab = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Tab" || !rules.requireTabToStart || status !== "idle") {
        return;
      }

      event.preventDefault();
      startSession();
    };

    window.addEventListener("keydown", startOnTab);
    return () => window.removeEventListener("keydown", startOnTab);
  }, [rules.requireTabToStart, startSession, status]);

  useEffect(() => {
    if (isRunning) {
      inputRef.current?.focus();
    }
  }, [isRunning]);

  useEffect(() => {
    currentCharRef.current?.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "smooth"
    });
  }, [typedText.length]);

  function handleTyping(value: string) {
    if (isFinished || finishedRef.current || (!isRunning && rules.requireTabToStart)) {
      return;
    }

    if (!isRunning && !rules.requireTabToStart) {
      const now = Date.now();
      finishedRef.current = false;
      statusRef.current = "running";
      startedAtRef.current = now;
      elapsedSecondsRef.current = 0;
      setElapsedSeconds(0);
      setStartedAt(now);
      setFinishedAt(null);
      setRemainingSeconds(durationSeconds);
      setLastResult(null);
      setIsResultModalOpen(false);
      setStatus("running");
    }

    setTypedText((previous) => {
      const nextValue = enforceBackspacePolicy(previous, value, rules.allowBackspace);
      typedTextRef.current = nextValue;
      return nextValue;
    });
  }

  function handleDuration(seconds: number) {
    resetSession();
    setDurationSeconds(seconds);
    setRemainingSeconds(seconds);
    const nextPassage = readStoredPassage(seconds);
    setPassage(nextPassage);
    setPreviousResult(readPreviousResult(nextPassage.id));
    setPassageNotice(getFilteredLibrary().length === 0 ? "No active saved passages found. Using a sample passage." : "");
  }

  function handleCustomDuration(minutes: number) {
    const safeMinutes = Math.min(Math.max(minutes || 1, 1), 60);
    setCustomMinutes(safeMinutes);
    handleDuration(safeMinutes * 60);
  }

  function loadNextPassage() {
    resetSession();
    const library = getFilteredLibrary();

    if (library.length > 0) {
      const isRandomMode = getPassageSelectionMode() === "random";
      const nextLibraryPassage = isRandomMode
        ? selectRandomLibraryPassage(passage.id, library)
        : selectDifferentLibraryPassage(passage.id, library);
      if (!nextLibraryPassage) {
        return;
      }

      if (library.length === 1) {
        setPassageNotice("Only one passage available.");
      } else {
        setPassageNotice("");
      }

      setPassageSelectionMode(isRandomMode ? "random" : "specific");
      setActivePassageId(nextLibraryPassage.id);
      const nextPassage = toStoredPassage(nextLibraryPassage, durationSeconds, library);
      setPassage(nextPassage);
      setPreviousResult(readPreviousResult(nextPassage.id));
      writeStoredPassage(nextPassage);
      return;
    }

    const nextPassage: StoredPassage = {
      id: `generated-${Date.now()}`,
      title: `${passage.category} generated practice`,
      category: passage.category,
      style: passage.style,
      source: "generated",
      text: buildPracticePassage(passage.category, durationSeconds),
      updatedAt: new Date().toISOString()
    };
    setPassageNotice("No active saved passages found. Using a sample passage.");
    setPassage(nextPassage);
    setPreviousResult(readPreviousResult(nextPassage.id));
    writeStoredPassage(nextPassage);
  }

  function loadRandomPassage() {
    resetSession();
    setPassageSelectionMode("random");
    const library = getFilteredLibrary();

    if (library.length === 0) {
      const defaultPassage = getDefaultPassage(durationSeconds);
      setPassageNotice("No active saved passages found. Using a sample passage.");
      setPassage(defaultPassage);
      setPreviousResult(readPreviousResult(defaultPassage.id));
      writeStoredPassage(defaultPassage);
      return;
    }

    const randomLibraryPassage = selectRandomLibraryPassage(passage.id, library);
    if (!randomLibraryPassage) {
      return;
    }

    if (library.length === 1) {
      setPassageNotice("Only one passage available.");
    } else {
      setPassageNotice("");
    }

    setActivePassageId(randomLibraryPassage.id);
    const randomPassage = toStoredPassage(randomLibraryPassage, durationSeconds, library);
    setPassage(randomPassage);
    setPreviousResult(readPreviousResult(randomPassage.id));
    writeStoredPassage(randomPassage);
  }

  function getFilteredLibrary() {
    return filterLibraryPassages(getActivePassageLibrary(), getSelectedCategory(), getSelectedStyle());
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase text-brass">Practice</p>
            <h1 className="mt-2 text-3xl font-semibold text-paper md:text-4xl">Focused typing desk</h1>
          </div>
          <div className="font-mono text-sm text-paper/45">
            {isRunning ? "Session running" : isFinished ? "Session complete" : "Press Tab to begin"}
          </div>
        </div>

        {passageNotice && (
          <div className="mb-5 rounded-md border border-brass/25 bg-brass/10 px-4 py-3 font-mono text-sm text-brass">
            {passageNotice}
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {DURATIONS.map((duration) => (
              <button
                key={duration.seconds}
                type="button"
                onClick={() => handleDuration(duration.seconds)}
                className={clsx(
                  "rounded-md border px-4 py-2 font-mono text-sm transition",
                  durationSeconds === duration.seconds
                    ? "border-brass bg-brass text-ink-950"
                    : "border-paper/10 bg-ink-900 text-paper/70 hover:border-brass/50"
                )}
              >
                {duration.label}
              </button>
            ))}
            <label className="flex items-center gap-2 rounded-md border border-paper/10 bg-ink-900 px-3 py-2 font-mono text-sm text-paper/70">
              Custom
              <input
                aria-label="Custom duration in minutes"
                type="number"
                min={1}
                max={60}
                value={customMinutes}
                onChange={(event) => handleCustomDuration(Number(event.target.value))}
                className="w-12 bg-transparent outline-none"
              />
            </label>
          </div>
          <div className="text-right font-mono text-sm text-paper/45">
            <div>
              {passage.category} · {passage.style}
            </div>
            {passage.title && <div className="mt-1 text-paper/65">{passage.title}</div>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="WPM" value={displayedResult.wpm.toFixed(1)} />
          <Metric label="Accuracy" value={`${displayedResult.accuracy.toFixed(1)}%`} />
          <Metric label="Errors" value={displayedResult.incorrectCharacters} />
          <Metric label="Remaining" value={formatTime(remainingSeconds)} />
        </div>

        <div
          tabIndex={0}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === "Tab" && rules.requireTabToStart && status === "idle") {
              event.preventDefault();
              startSession();
            }
          }}
          className={clsx(
            "relative mt-5 rounded-lg border bg-ink-950/80 p-4 shadow-glow outline-none transition md:p-6",
            isRunning ? "border-brass/50" : "border-paper/10 focus:border-brass/60"
          )}
        >
          {previousResult && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-paper/45">
              <span>Previous pace: {previousResult.wpm.toFixed(1)} WPM</span>
              {paceComparison && <span className="text-paper/55">{paceComparison}</span>}
            </div>
          )}

          {!isRunning && !isFinished && (
            <div className="mb-4 rounded-md border border-brass/25 bg-brass/10 px-4 py-3 font-mono text-sm text-brass">
              {rules.requireTabToStart ? "Press Tab to begin" : "Start typing to begin"}
            </div>
          )}

          <div
            ref={typingWindowRef}
            className="h-[260px] overflow-y-auto overscroll-contain rounded-md bg-ink-900 px-4 py-5 md:h-[300px] md:px-6"
          >
            <p className="whitespace-pre-wrap break-words font-mono text-2xl leading-[2.35rem] text-paper/45 md:text-3xl md:leading-[2.85rem]">
              {comparison.characters.map((character, index) => {
                const isCurrent = character.status === "current";
                const isPreviousPace = index === previousPaceIndex && !isCurrent;
                return (
                  <span
                    key={`${character.index}-${index}-${character.expected}-${character.actual}`}
                    ref={isCurrent ? currentCharRef : undefined}
                    data-index={index}
                    className={clsx(
                      characterClass(character.status, rules.showMistakesImmediately || isFinished),
                      isPreviousPace && "border-l-2 border-sky-300/55 pl-0.5"
                    )}
                  >
                    {character.actual || character.expected}
                  </span>
                );
              })}
            </p>
          </div>

          <textarea
            ref={inputRef}
            value={typedText}
            disabled={isFinished || (!isRunning && rules.requireTabToStart)}
            onKeyDown={(event) => {
              if (isFinished || (!isRunning && rules.requireTabToStart)) {
                event.preventDefault();
                return;
              }
              if (!rules.allowBackspace && event.key === "Backspace") {
                event.preventDefault();
              }
            }}
            onChange={(event) => handleTyping(event.target.value)}
            className="absolute inset-0 h-full w-full resize-none opacity-0"
            aria-label="Typing input"
            spellCheck={false}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="font-mono text-sm text-paper/45">
            Typed {typedText.length} / {targetText.length} characters
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetSession}
              className="inline-flex items-center gap-2 rounded-md border border-paper/10 bg-ink-900 px-4 py-2 font-mono text-sm text-paper/75 transition hover:border-brass/50"
            >
              <RotateCcw className="h-4 w-4" />
              Restart
            </button>
            <button
              type="button"
              onClick={loadRandomPassage}
              className="inline-flex items-center gap-2 rounded-md border border-paper/10 bg-ink-900 px-4 py-2 font-mono text-sm text-paper/75 transition hover:border-brass/50"
            >
              <Shuffle className="h-4 w-4" />
              Random passage
            </button>
            <button
              type="button"
              onClick={loadNextPassage}
              className="inline-flex items-center gap-2 rounded-md border border-brass/35 bg-brass/10 px-4 py-2 font-mono text-sm text-brass transition hover:bg-brass/15"
            >
              <RefreshCw className="h-4 w-4" />
              Next passage
            </button>
          </div>
        </div>

        {lastResult && <ResultsPanel result={lastResult} />}
        {lastResult && isResultModalOpen && (
          <ResultModal
            result={lastResult}
            passage={passage}
            onRestart={resetSession}
            onNextPassage={loadNextPassage}
            previousResult={previousResult}
            onClose={() => setIsResultModalOpen(false)}
          />
        )}
      </section>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-paper/10 bg-ink-900 px-4 py-3">
      <div className="font-mono text-[0.68rem] uppercase text-paper/40">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold text-paper">{value}</div>
    </div>
  );
}

function ResultsPanel({ result }: { result: TypingResult }) {
  return (
    <section className="mt-6 rounded-lg border border-brass/25 bg-brass/10 p-5">
      <h2 className="text-2xl font-semibold text-paper">Result</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="WPM" value={result.wpm.toFixed(1)} />
        <Metric label="Raw WPM" value={result.rawWpm.toFixed(1)} />
        <Metric label="Accuracy" value={`${result.accuracy.toFixed(2)}%`} />
        <Metric label="Errors" value={result.incorrectCharacters} />
        <Metric label="Time" value={formatTime(result.timeUsedSeconds)} />
        <Metric label="Reason" value={result.completionReason.replace("_", " ")} />
        <Metric label="Correct" value={result.correctCharacters} />
        <Metric label="Extra" value={result.extraCharacters} />
      </div>
    </section>
  );
}

function ResultModal({
  result,
  passage,
  onRestart,
  onNextPassage,
  previousResult,
  onClose
}: {
  result: TypingResult;
  passage: StoredPassage;
  onRestart: () => void;
  onNextPassage: () => void;
  previousResult: PreviousTypingResult | null;
  onClose: () => void;
}) {
  const wpmDifference = previousResult ? result.wpm - previousResult.wpm : 0;
  const accuracyDifference = previousResult ? result.accuracy - previousResult.accuracy : 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/80 px-4 backdrop-blur">
      <section className="w-full max-w-3xl rounded-lg border border-brass/30 bg-ink-900 p-5 shadow-glow md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-paper/10 pb-4">
          <div>
            <p className="font-mono text-xs uppercase text-brass">Result</p>
            <h2 className="mt-1 text-3xl font-semibold text-paper">
              {result.completionReason === "time_up" ? "Time up" : "Passage completed"}
            </h2>
          </div>
          <div className="font-mono text-sm text-paper/45">
            {passage.category} · {passage.style}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="WPM" value={result.wpm.toFixed(1)} />
          <Metric label="Raw WPM" value={result.rawWpm.toFixed(1)} />
          <Metric label="Accuracy" value={`${result.accuracy.toFixed(2)}%`} />
          <Metric label="Errors" value={result.incorrectCharacters} />
          <Metric label="Correct" value={result.correctCharacters} />
          <Metric label="Incorrect" value={result.incorrectCharacters} />
          <Metric label="Missed" value={result.missedCharacters} />
          <Metric label="Extra" value={result.extraCharacters} />
          <Metric label="Time used" value={formatTime(result.timeUsedSeconds)} />
          <Metric label="Duration" value={formatTime(result.durationSeconds)} />
          <Metric label="Reason" value={result.completionReason.replace("_", " ")} />
          <Metric label="Category" value={result.category} />
        </div>

        {previousResult && (
          <div className="mt-5 rounded-md border border-paper/10 bg-ink-950/60 p-4">
            <p className="font-mono text-xs uppercase text-paper/45">Previous attempt</p>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Previous WPM" value={previousResult.wpm.toFixed(1)} />
              <Metric label="Current WPM" value={result.wpm.toFixed(1)} />
              <Metric label="Change" value={formatSigned(wpmDifference, " WPM")} />
              <Metric label="Accuracy" value={formatSigned(accuracyDifference, "%")} />
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-paper/10 bg-ink-800 px-4 py-2 font-mono text-sm text-paper/70 transition hover:border-brass/50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="rounded-md border border-paper/10 bg-ink-800 px-4 py-2 font-mono text-sm text-paper/85 transition hover:border-brass/50"
          >
            Restart same passage
          </button>
          <button
            type="button"
            onClick={onNextPassage}
            className="rounded-md border border-brass/35 bg-brass/10 px-4 py-2 font-mono text-sm text-brass transition hover:bg-brass/15"
          >
            Next passage
          </button>
        </div>
      </section>
    </div>
  );
}

function characterClass(status: string, revealMistakes: boolean) {
  if (status === "correct") {
    return "text-mint";
  }
  if (status === "wrong" || status === "extra") {
    return revealMistakes ? "rounded-sm bg-ember/25 text-ember underline decoration-ember/60" : "text-paper";
  }
  if (status === "current") {
    return "rounded-sm bg-brass px-0.5 text-ink-950";
  }
  return "text-paper/35";
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatSigned(value: number, suffix: string) {
  const roundedValue = Math.round(value * 10) / 10;
  return `${roundedValue >= 0 ? "+" : ""}${roundedValue.toFixed(1)}${suffix}`;
}
