"use client";

import React, { Fragment, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, RotateCcw, X } from "lucide-react";
import { clsx } from "clsx";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import {
  CompletionReason,
  CharacterComparison,
  DEFAULT_RULES,
  PracticeCategory,
  TypingResult,
  TypingRules,
  buildPracticePassage,
  calculateResult,
  enforceBackspacePolicy,
  normalizeTargetForRules,
  validateTypedText
} from "@/lib/typing-engine";
import {
  ALL_FILTER,
  CategoryFilter,
  PreviousTypingResult,
  LibraryPassage,
  StoredPassage,
  StoredPassageTextMode,
  filterLibraryPassages,
  getDefaultPassage,
  readPreviousResult,
  readStoredPassage,
  readStoredRules,
  selectDifferentLibraryPassage,
  selectRandomLibraryPassage,
  toStoredPassage,
  writePreviousResult,
  writePassageLibrary,
  writeStoredPassage
} from "@/lib/app-storage";
import {
  getActivePassageId,
  getActivePassageLibrary,
  getPassageSelectionMode,
  getSelectedCategory,
  getSupabasePassageLibrary,
  setActivePassageId,
  setPassageSelectionMode,
  setSelectedCategory
} from "@/lib/passageStorage";
import {
  PRACTICE_MODE_OPTIONS,
  PracticeModeId,
  getComparableDurationSeconds,
  getPracticeMode,
  isManualFinishShortcut,
  isTimedPracticeMode,
} from "@/lib/practiceModes";
import {
  buildConsistencySeries,
  getConsistencySummary
} from "@/lib/practiceConsistency";
import { isRestartShortcut } from "@/lib/practiceShortcuts";
import {
  SupabaseOwnTypingResultRow,
  getSupabaseOwnTypingResults,
  saveSupabaseTypingResult
} from "@/lib/typingResultStorage";

type SessionStatus = "idle" | "running" | "finished";

export type AttemptTimelinePoint = {
  timeSeconds: number;
  wpm: number;
  accuracy?: number;
};

const RANDOM_PASSAGE_ID = "__random__";

export default function PracticePage() {
  const { user } = useAuth();
  const [rules, setRules] = useState<TypingRules>(DEFAULT_RULES);
  const [passage, setPassage] = useState<StoredPassage | null>(null);
  const [typedText, setTypedText] = useState("");
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [practiceModeId, setPracticeModeId] = useState<PracticeModeId>("1m");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<TypingResult | null>(null);
  const [attemptTimeline, setAttemptTimeline] = useState<AttemptTimelinePoint[]>([]);
  const [recentResults, setRecentResults] = useState<SupabaseOwnTypingResultRow[]>([]);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [passageNotice, setPassageNotice] = useState("");
  const [previousResult, setPreviousResult] = useState<PreviousTypingResult | null>(null);
  const [availableLibrary, setAvailableLibrary] = useState<LibraryPassage[]>([]);
  const [selectedCategory, setSelectedCategoryState] = useState<CategoryFilter>(ALL_FILTER);
  const [selectedPassageId, setSelectedPassageId] = useState(RANDOM_PASSAGE_ID);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingWindowRef = useRef<HTMLDivElement>(null);
  const currentCharRef = useRef<HTMLSpanElement | null>(null);
  const finishedRef = useRef(false);
  const statusRef = useRef<SessionStatus>("idle");
  const startedAtRef = useRef<number | null>(null);
  const typedTextRef = useRef("");
  const attemptTimelineRef = useRef<AttemptTimelinePoint[]>([]);
  const elapsedSecondsRef = useRef(0);
  const libraryRef = useRef<LibraryPassage[]>([]);
  const isTabPressedRef = useRef(false);
  const scrollFrameRef = useRef<number | null>(null);

  const isRunning = status === "running";
  const isFinished = status === "finished";
  const isPassageLoading = passage === null;
  const practiceMode = useMemo(() => getPracticeMode(practiceModeId), [practiceModeId]);
  const isTimedMode = isTimedPracticeMode(practiceMode);
  const durationSeconds = isTimedMode ? practiceMode.seconds : 60;
  const passageTextMode: StoredPassageTextMode = isTimedMode ? "timed" : "single";
  const clockSeconds = isTimedMode ? remainingSeconds : elapsedSeconds;
  const sourceText = passage?.text.trim() ?? "";
  const targetText = useMemo(() => normalizeTargetForRules(sourceText, rules), [sourceText, rules]);
  const comparison = useMemo(
    () => validateTypedText({ targetText: sourceText, typedText, rules }),
    [sourceText, typedText, rules]
  );
  const categoryOptions = useMemo(() => getCategoryOptions(availableLibrary), [availableLibrary]);
  const selectablePassages = useMemo(
    () => filterLibraryByCategory(availableLibrary, selectedCategory),
    [availableLibrary, selectedCategory]
  );
  const choosePracticePassage = useCallback(
    ({
      library,
      category,
      duration,
      textMode,
      preferredPassageId
    }: {
      library: LibraryPassage[];
      category: CategoryFilter;
      duration: number;
      textMode: StoredPassageTextMode;
      preferredPassageId?: string | null;
    }) => {
      const categoryLibrary = filterLibraryByCategory(library, category);

      if (categoryLibrary.length > 0) {
        if (preferredPassageId === RANDOM_PASSAGE_ID) {
          const randomPassage = selectRandomLibraryPassage(getActivePassageId() ?? undefined, categoryLibrary) ?? categoryLibrary[0];
          setPassageSelectionMode("random");
          setActivePassageId(randomPassage.id);
          setSelectedPassageId(RANDOM_PASSAGE_ID);
          const nextPassage = toStoredPassage(randomPassage, duration, categoryLibrary, textMode);
          setPassage(nextPassage);
          setPreviousResult(readPreviousResult(nextPassage.id));
          writeStoredPassage(nextPassage);
          setPassageNotice("");
          return;
        }

        const preferredLibraryPassage = preferredPassageId
          ? categoryLibrary.find((libraryPassage) => libraryPassage.id === preferredPassageId)
          : undefined;
        const selectedLibraryPassage = preferredLibraryPassage ?? categoryLibrary[0];
        setPassageSelectionMode("specific");
        setActivePassageId(selectedLibraryPassage.id);
        setSelectedPassageId(selectedLibraryPassage.id);
        const nextPassage = toStoredPassage(selectedLibraryPassage, duration, categoryLibrary, textMode);
        setPassage(nextPassage);
        setPreviousResult(readPreviousResult(nextPassage.id));
        writeStoredPassage(nextPassage);
        setPassageNotice("");
        return;
      }

      const fallbackPassage = readStoredPassage(duration);
      setSelectedPassageId(RANDOM_PASSAGE_ID);
      setPassage(fallbackPassage);
      setPreviousResult(readPreviousResult(fallbackPassage.id));
      setPassageNotice("No active saved passages found. Using a sample passage.");
    },
    []
  );

  useEffect(() => {
    let isMounted = true;

    async function loadInitialPracticeState() {
      const activeLibrary = await loadActivePassageLibrary();

      if (!isMounted) {
        return;
      }

      setAvailableLibrary(activeLibrary);
      const initialCategory = getInitialCategory(activeLibrary);
      setSelectedCategoryState(initialCategory);
      choosePracticePassage({
        library: activeLibrary,
        category: initialCategory,
        duration: 60,
        textMode: "timed",
        preferredPassageId: getPassageSelectionMode() === "random" ? RANDOM_PASSAGE_ID : getActivePassageId()
      });
    }

    setRules(readStoredRules());
    loadInitialPracticeState();

    return () => {
      isMounted = false;
    };
  }, [choosePracticePassage]);

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

  const recordAttemptTimelinePoint = useCallback(
    (elapsed: number, typed: string) => {
      if (elapsed < 1 || !sourceText) {
        return;
      }

      const point = buildAttemptTimelinePoint({
        elapsedSeconds: elapsed,
        sourceText,
        typedText: typed,
        rules
      });
      const existingIndex = attemptTimelineRef.current.findIndex(
        (timelinePoint) => timelinePoint.timeSeconds === point.timeSeconds
      );

      if (existingIndex >= 0) {
        attemptTimelineRef.current = attemptTimelineRef.current.map((timelinePoint, index) =>
          index === existingIndex ? point : timelinePoint
        );
        return;
      }

      attemptTimelineRef.current = [...attemptTimelineRef.current, point].slice(-80);
    },
    [rules, sourceText]
  );

  const resetSession = useCallback(() => {
    finishedRef.current = false;
    statusRef.current = "idle";
    startedAtRef.current = null;
    typedTextRef.current = "";
    attemptTimelineRef.current = [];
    setTypedText("");
    setAttemptTimeline([]);
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    setRemainingSeconds(isTimedMode ? durationSeconds : 0);
    setStartedAt(null);
    setFinishedAt(null);
    setLastResult(null);
    setIsResultModalOpen(false);
    setPreviousResult(passage ? readPreviousResult(passage.id) : null);
    setStatus("idle");
    if (typingWindowRef.current) {
      typingWindowRef.current.scrollTop = 0;
    }
  }, [durationSeconds, isTimedMode, passage]);

  const finishTest = useCallback(
    (completionReason: CompletionReason) => {
      const sessionStartedAt = startedAtRef.current;

      if (finishedRef.current || statusRef.current !== "running" || !sessionStartedAt || !passage) {
        return;
      }

      const finishedTime = Date.now();
      const measuredElapsed = Math.max(1, Math.floor((finishedTime - sessionStartedAt) / 1000));
      const finalElapsed = completionReason === "time_up" && isTimedMode ? durationSeconds : measuredElapsed;
      const resultDurationSeconds = getComparableDurationSeconds(practiceMode, finalElapsed);

      finishedRef.current = true;
      statusRef.current = "finished";
      elapsedSecondsRef.current = finalElapsed;
      setFinishedAt(finishedTime);
      setElapsedSeconds(finalElapsed);
      setRemainingSeconds(isTimedMode ? (completionReason === "time_up" ? 0 : Math.max(0, durationSeconds - finalElapsed)) : 0);
      setStatus("finished");
      setIsResultModalOpen(true);
      setRecentResults([]);
      const finalResult = calculateResult({
        target: sourceText,
        typed: typedTextRef.current,
        elapsedSeconds: Math.max(finalElapsed, 1),
        durationSeconds: resultDurationSeconds,
        category: passage.category,
        rules,
        completionReason
      });
      const finalTimelinePoint: AttemptTimelinePoint = {
        timeSeconds: finalResult.timeUsedSeconds,
        wpm: finalResult.wpm,
        accuracy: finalResult.accuracy
      };
      const completedTimeline = upsertAttemptTimelinePoint(attemptTimelineRef.current, finalTimelinePoint);
      attemptTimelineRef.current = completedTimeline;

      setPreviousResult(readPreviousResult(passage.id));
      setLastResult(finalResult);
      setAttemptTimeline(completedTimeline);
      writePreviousResult(passage, finalResult, typedTextRef.current.length);

      if (user) {
        void getSupabaseOwnTypingResults(user.id, 10)
          .then((typingResults) => setRecentResults(typingResults))
          .catch((error) => {
            console.warn("Supabase recent typing results load failed", error);
          });

        void saveSupabaseTypingResult({
          userId: user.id,
          passage,
          result: finalResult,
          typedCharacters: typedTextRef.current.length,
          supabasePassageId: passage.id ?? null
        }).catch((error) => {
          console.warn("Supabase typing result save failed", error);
        });
      }
    },
    [durationSeconds, isTimedMode, passage, practiceMode, rules, sourceText, user]
  );

  const startSession = useCallback(() => {
    if (!passage || !sourceText || isFinished) {
      return;
    }

    finishedRef.current = false;
    const now = Date.now();
    statusRef.current = "running";
    startedAtRef.current = now;
    typedTextRef.current = "";
    attemptTimelineRef.current = [];
    setTypedText("");
    setAttemptTimeline([]);
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    setRemainingSeconds(isTimedMode ? durationSeconds : 0);
    setStartedAt(now);
    setFinishedAt(null);
    setLastResult(null);
    setPreviousResult(readPreviousResult(passage.id));
    setStatus("running");
  }, [durationSeconds, isFinished, isTimedMode, passage, sourceText]);

  useEffect(() => {
    if (!isRunning || isFinished || !startedAt) {
      return;
    }

    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = isTimedMode ? Math.max(0, durationSeconds - elapsed) : 0;

      elapsedSecondsRef.current = elapsed;
      recordAttemptTimelinePoint(elapsed, typedTextRef.current);
      setElapsedSeconds(elapsed);
      setRemainingSeconds(remaining);

      if (isTimedMode && remaining <= 0) {
        window.clearInterval(timer);
        finishTest("time_up");
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [durationSeconds, finishTest, isFinished, isRunning, isTimedMode, recordAttemptTimelinePoint, startedAt]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Tab") {
        isTabPressedRef.current = true;

        if (isRunning || (rules.requireTabToStart && status === "idle")) {
          event.preventDefault();
        }

        if (rules.requireTabToStart && status === "idle") {
          startSession();
        }

        return;
      }

      if (isRestartShortcut({ key: event.key, tabKey: isTabPressedRef.current })) {
        event.preventDefault();
        resetSession();
        return;
      }

      if (isRunning && isManualFinishShortcut(event.key)) {
        event.preventDefault();
        finishTest("manual");
      }
    };

    const handleKeyUp = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Tab") {
        isTabPressedRef.current = false;
      }
    };

    const resetTabState = () => {
      isTabPressedRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", resetTabState);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", resetTabState);
    };
  }, [finishTest, isRunning, resetSession, rules.requireTabToStart, startSession, status]);

  useEffect(() => {
    if (isRunning) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [isRunning]);

  useEffect(() => {
    const currentCharacter = currentCharRef.current;

    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }

    if (!currentCharacter) {
      return;
    }

    if (!isRunning) {
      currentCharacter.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth"
      });
      return;
    }

    if (typedText.length <= 1) {
      return;
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      const scrollContainer = typingWindowRef.current;
      const activeCharacter = currentCharRef.current;

      if (!scrollContainer || !activeCharacter || !scrollContainer.contains(activeCharacter)) {
        return;
      }

      const containerHeight = scrollContainer.clientHeight;
      if (scrollContainer.scrollHeight <= containerHeight) {
        return;
      }

      const containerBounds = scrollContainer.getBoundingClientRect();
      const characterBounds = activeCharacter.getBoundingClientRect();
      const characterBottom = scrollContainer.scrollTop + characterBounds.bottom - containerBounds.top;
      const triggerLine = scrollContainer.scrollTop + containerHeight * 0.68;

      if (characterBottom <= triggerLine) {
        return;
      }

      const targetLine = scrollContainer.scrollTop + containerHeight * 0.48;
      const scrollAmount = Math.ceil(characterBottom - targetLine);
      scrollContainer.scrollTop += scrollAmount;
    });

    return () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [isRunning, typedText.length]);

  function handleTyping(value: string) {
    if (!passage || isFinished || finishedRef.current || (!isRunning && rules.requireTabToStart)) {
      return;
    }

    if (!isRunning && !rules.requireTabToStart) {
      const now = Date.now();
      finishedRef.current = false;
      statusRef.current = "running";
      startedAtRef.current = now;
      attemptTimelineRef.current = [];
      elapsedSecondsRef.current = 0;
      setElapsedSeconds(0);
      setAttemptTimeline([]);
      setStartedAt(now);
      setFinishedAt(null);
      setRemainingSeconds(isTimedMode ? durationSeconds : 0);
      setLastResult(null);
      setIsResultModalOpen(false);
      setStatus("running");
    }

    setTypedText((previous) => {
      const nextValue = enforceBackspacePolicy(previous, value, rules.allowBackspace);
      typedTextRef.current = nextValue;
      recordAttemptTimelinePoint(elapsedSecondsRef.current, nextValue);
      return nextValue;
    });
  }

  async function handlePracticeMode(modeId: PracticeModeId) {
    const nextMode = getPracticeMode(modeId);
    const nextIsTimedMode = isTimedPracticeMode(nextMode);
    const nextDurationSeconds = nextIsTimedMode ? nextMode.seconds : 60;
    const nextTextMode: StoredPassageTextMode = nextIsTimedMode ? "timed" : "single";

    resetSession();
    setPracticeModeId(modeId);
    setRemainingSeconds(nextIsTimedMode ? nextMode.seconds : 0);
    const activeLibrary = await loadActivePassageLibrary();
    setAvailableLibrary(activeLibrary);
    choosePracticePassage({
      library: activeLibrary,
      category: selectedCategory,
      duration: nextDurationSeconds,
      textMode: nextTextMode,
      preferredPassageId: selectedPassageId
    });
  }

  function handleCategorySelection(category: CategoryFilter) {
    resetSession();
    setSelectedCategoryState(category);
    setSelectedCategory(category);
    choosePracticePassage({
      library: availableLibrary,
      category,
      duration: durationSeconds,
      textMode: passageTextMode,
      preferredPassageId: selectedPassageId === RANDOM_PASSAGE_ID ? RANDOM_PASSAGE_ID : null
    });
  }

  function handlePassageSelection(passageId: string) {
    resetSession();
    choosePracticePassage({
      library: availableLibrary,
      category: selectedCategory,
      duration: durationSeconds,
      textMode: passageTextMode,
      preferredPassageId: passageId
    });
  }

  function loadNextPassage() {
    if (!passage) {
      return;
    }

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
      setSelectedPassageId(isRandomMode ? RANDOM_PASSAGE_ID : nextLibraryPassage.id);
      const nextPassage = toStoredPassage(nextLibraryPassage, durationSeconds, library, passageTextMode);
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
    setSelectedPassageId(RANDOM_PASSAGE_ID);
    setPassage(nextPassage);
    setPreviousResult(readPreviousResult(nextPassage.id));
    writeStoredPassage(nextPassage);
  }

  function loadRandomPassage() {
    if (!passage) {
      return;
    }

    resetSession();
    setPassageSelectionMode("random");
    const library = getFilteredLibrary();
    setSelectedPassageId(RANDOM_PASSAGE_ID);

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
    const randomPassage = toStoredPassage(randomLibraryPassage, durationSeconds, library, passageTextMode);
    setPassage(randomPassage);
    setPreviousResult(readPreviousResult(randomPassage.id));
    writeStoredPassage(randomPassage);
  }

  async function loadActivePassageLibrary(): Promise<LibraryPassage[]> {
    try {
      const supabaseLibrary = await getSupabasePassageLibrary();
      if (supabaseLibrary.length > 0) {
        libraryRef.current = supabaseLibrary;
        writePassageLibrary(supabaseLibrary);
        return supabaseLibrary;
      }
    } catch {
      // Fall through to local active passages.
    }

    const localLibrary = getActivePassageLibrary();
    libraryRef.current = localLibrary;
    return localLibrary;
  }

  function getFilteredLibrary() {
    const activeLibrary = libraryRef.current.length > 0 ? libraryRef.current : getActivePassageLibrary();
    return filterLibraryByCategory(activeLibrary, selectedCategory);
  }

  return (
    <AppShell>
      <section className="mx-auto min-w-0 max-w-6xl w-[calc(100vw-2.5rem)] overflow-x-hidden sm:w-full">
        <div className="mb-3">
          <p className="font-mono text-xs uppercase text-brass">Practice</p>
          <h1 className="sr-only">Practice</h1>
        </div>

        {passageNotice && (
          <div className="mb-5 rounded-md border border-brass/25 bg-brass/10 px-4 py-3 font-mono text-sm text-brass">
            {passageNotice}
          </div>
        )}

        <section
          className={clsx(
            "max-w-full overflow-hidden transition-all duration-200",
            isRunning
              ? "mb-1 max-h-0 opacity-0"
              : "mb-3 max-h-40 rounded-md bg-paper/[0.018] p-1.5"
          )}
          aria-hidden={isRunning}
        >
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 md:grid-cols-[minmax(8rem,0.75fr)_minmax(14rem,1.3fr)_minmax(16rem,0.95fr)] md:items-center">
            <label className="min-w-0">
              <span className="sr-only">Category</span>
              <select
                value={selectedCategory}
                onChange={(event) => handleCategorySelection(event.target.value as CategoryFilter)}
                disabled={isRunning || isPassageLoading}
                className="h-9 w-full min-w-0 rounded-full border-0 bg-paper/[0.035] px-4 font-mono text-xs text-paper/70 outline-none transition hover:bg-paper/[0.055] focus:bg-paper/[0.07] focus:ring-1 focus:ring-brass/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {[ALL_FILTER, ...categoryOptions].map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0">
              <span className="sr-only">Passage</span>
              <select
                value={selectedPassageId}
                onChange={(event) => handlePassageSelection(event.target.value)}
                disabled={isRunning || isPassageLoading || selectablePassages.length === 0}
                className="h-9 w-full min-w-0 rounded-full border-0 bg-paper/[0.035] px-4 font-mono text-xs text-paper/70 outline-none transition hover:bg-paper/[0.055] focus:bg-paper/[0.07] focus:ring-1 focus:ring-brass/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value={RANDOM_PASSAGE_ID}>
                  {selectablePassages.length > 0 ? "Random from selected category" : "Default generated passage"}
                </option>
                {selectablePassages.map((libraryPassage) => (
                  <option key={libraryPassage.id} value={libraryPassage.id}>
                    {libraryPassage.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid min-w-0 grid-cols-4 rounded-full bg-paper/[0.035] p-1">
              <span className="sr-only">Practice mode</span>
              {PRACTICE_MODE_OPTIONS.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => handlePracticeMode(mode.id)}
                  disabled={isRunning || isPassageLoading}
                  className={clsx(
                    "h-7 rounded-full px-2 font-mono text-[0.68rem] transition disabled:cursor-not-allowed disabled:opacity-60 sm:text-xs",
                    practiceModeId === mode.id
                      ? "bg-brass/85 text-ink-950"
                      : "text-paper/50 hover:bg-paper/5 hover:text-paper/80"
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {isRunning ? (
          null
        ) : status === "idle" && passage ? (
          <div className="mb-3 flex max-w-full flex-wrap items-center justify-between gap-2 overflow-hidden px-1 font-mono text-xs text-paper/40 transition">
            <div className="w-full min-w-0 truncate sm:w-auto">
              <span className="font-semibold text-paper/70">{passage.title ?? "Untitled passage"}</span> ·{" "}
              {passage.category} · {passage.style} · {practiceMode.label}
            </div>
          </div>
        ) : null}

        <div
          tabIndex={0}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === "Tab" && rules.requireTabToStart && status === "idle") {
              event.preventDefault();
              startSession();
            }
          }}
          className={clsx(
            "relative max-w-full outline-none transition",
            isRunning
              ? "flex h-[60vh] max-h-[60vh] flex-col overflow-hidden rounded-none bg-transparent p-0 md:h-[68vh] md:max-h-[72vh]"
              : "overflow-hidden rounded-lg bg-paper/[0.025] p-3 ring-1 ring-paper/5 focus:ring-brass/30 md:p-5"
          )}
        >
          {previousResult && status === "idle" && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-paper/45">
              <span>Previous pace: {previousResult.wpm.toFixed(1)} WPM</span>
            </div>
          )}

          {isRunning && (
            <div className="sticky top-0 z-10 flex shrink-0 justify-end bg-ink-950/80 pb-3 font-mono text-[1.45rem] leading-none text-paper/35 backdrop-blur-sm md:text-[2rem]">
              {formatTime(clockSeconds)}
            </div>
          )}

          <div
            ref={typingWindowRef}
            className={clsx(
              "typing-scrollbar min-h-0 transition",
              isRunning
                ? "h-full flex-1 overflow-y-auto overscroll-contain px-1 py-3 md:px-6 md:py-5"
                : "h-[340px] overflow-y-auto overscroll-contain rounded-md bg-ink-900/55 px-4 py-6 md:h-[420px] md:px-8 md:py-8"
            )}
          >
            <p
              className={clsx(
                "mx-auto max-w-4xl whitespace-pre-wrap break-words font-mono text-[1.7rem] leading-[2.55rem] text-paper/45 md:text-[2.15rem] md:leading-[3.25rem]",
                isRunning && "text-paper/50"
              )}
            >
              {isPassageLoading ? (
                <PassageLoadingPlaceholder />
              ) : (
                comparison.characters.map((character, index) => {
                const isCurrent = character.status === "current";
                const isLineBreak = character.expected === "\n" || character.actual === "\n";

                if (isLineBreak) {
                  return (
                    <Fragment key={`${character.index}-${index}-${character.expected}-${character.actual}`}>
                      <span
                        ref={isCurrent ? currentCharRef : undefined}
                        data-index={index}
                        aria-label={character.status === "wrong" ? "Missed line break" : "Line break"}
                        className={clsx(
                          "inline-block min-w-[0.7em]",
                          characterClass(character.status, rules.showMistakesImmediately || isFinished),
                          character.status === "untyped" && "text-paper/20"
                        )}
                      >
                        {shouldShowLineBreakMarker(character.status, rules.showMistakesImmediately || isFinished) ? "↵" : ""}
                      </span>
                      <br />
                    </Fragment>
                  );
                }

                return (
                  <span
                    key={`${character.index}-${index}-${character.expected}-${character.actual}`}
                    ref={isCurrent ? currentCharRef : undefined}
                    data-index={index}
                    className={clsx(
                      characterClass(character.status, rules.showMistakesImmediately || isFinished)
                    )}
                  >
                    {character.actual || character.expected}
                  </span>
                );
                })
              )}
            </p>
          </div>

          <textarea
            ref={inputRef}
            value={typedText}
            disabled={isPassageLoading || isFinished || (!isRunning && rules.requireTabToStart)}
            onKeyDown={(event) => {
              if (isPassageLoading || isFinished || (!isRunning && rules.requireTabToStart)) {
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

        {status === "idle" && (
          <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-xs text-paper/30">
            <span>Tab = start</span>
            <span>Tab + Enter = restart</span>
            <span>Esc = finish</span>
          </div>
        )}

        {lastResult && passage && <ResultsPanel result={lastResult} onRestart={resetSession} onNextPassage={loadNextPassage} />}
        {lastResult && passage && isResultModalOpen && (
          <ResultModal
            result={lastResult}
            passage={passage}
            onRestart={resetSession}
            onNextPassage={loadNextPassage}
            previousResult={previousResult}
            recentResults={user ? recentResults : null}
            attemptTimeline={attemptTimeline}
            onClose={() => setIsResultModalOpen(false)}
          />
        )}
      </section>
    </AppShell>
  );
}

function PassageLoadingPlaceholder() {
  return (
    <span
      data-testid="passage-loading-placeholder"
      aria-hidden="true"
      className="block w-full max-w-4xl space-y-4 opacity-45"
    >
      {[92, 76, 88, 64].map((width, index) => (
        <span
          key={width}
          className="block h-[1.15rem] rounded-sm bg-paper/[0.07]"
          style={{ width: `${width}%`, marginTop: index === 0 ? 0 : undefined }}
        />
      ))}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-paper/[0.035] px-4 py-3">
      <div className="font-mono text-[0.68rem] uppercase text-paper/45">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold text-paper md:text-3xl">{value}</div>
    </div>
  );
}

function getCategoryOptions(library: LibraryPassage[]): PracticeCategory[] {
  return Array.from(new Set(library.map((libraryPassage) => libraryPassage.category))).sort();
}

function getInitialCategory(library: LibraryPassage[]): CategoryFilter {
  const storedCategory = getSelectedCategory();
  const categories = getCategoryOptions(library);

  if (storedCategory === ALL_FILTER || categories.includes(storedCategory as PracticeCategory)) {
    return storedCategory;
  }

  return ALL_FILTER;
}

function filterLibraryByCategory(library: LibraryPassage[], category: CategoryFilter) {
  return filterLibraryPassages(library, category, ALL_FILTER);
}

type MistakeType = "capitalization" | "punctuation" | "spacing" | "wrongCharacter";

type MistakeBreakdown = Record<MistakeType, number>;

function ResultsPanel({
  result,
  onRestart,
  onNextPassage
}: {
  result: TypingResult;
  onRestart: () => void;
  onNextPassage: () => void;
}) {
  return (
    <section className="mt-6 rounded-lg bg-paper/[0.025] p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase text-brass">Result</p>
          <h2 className="mt-1 text-2xl font-semibold text-paper">{getCompletionLabel(result.completionReason)}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center gap-2 rounded-md bg-paper/[0.045] px-3 py-2 font-mono text-xs text-paper/70 transition hover:bg-paper/[0.075] hover:text-paper"
          >
            <RotateCcw className="h-4 w-4" />
            Restart
          </button>
          <button
            type="button"
            onClick={onNextPassage}
            className="inline-flex items-center gap-2 rounded-md bg-brass/10 px-3 py-2 font-mono text-xs text-brass transition hover:bg-brass/15"
          >
            <RefreshCw className="h-4 w-4" />
            Next passage
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric label="WPM" value={result.wpm.toFixed(1)} />
        <Metric label="Accuracy" value={`${result.accuracy.toFixed(2)}%`} />
        <Metric label="Time" value={formatTime(result.timeUsedSeconds)} />
        <Metric label="Mistakes" value={result.incorrectCharacters} />
      </div>
      <SessionReview result={result} />
    </section>
  );
}

export function ResultModal({
  result,
  passage,
  onRestart,
  onNextPassage,
  previousResult,
  recentResults,
  attemptTimeline,
  onClose
}: {
  result: TypingResult;
  passage: StoredPassage;
  onRestart: () => void;
  onNextPassage: () => void;
  previousResult: PreviousTypingResult | null;
  recentResults: SupabaseOwnTypingResultRow[] | null;
  attemptTimeline: AttemptTimelinePoint[];
  onClose: () => void;
}) {
  const completionLabel = getCompletionLabel(result.completionReason);
  const hasSavedHistory = recentResults !== null;
  const historySeries = hasSavedHistory
    ? buildConsistencySeries(recentResults, {
        wpm: result.wpm,
        completedAt: result.completedAt
      })
    : [];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/85 px-3 py-4 backdrop-blur md:px-4">
      <section className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-brass/25 bg-ink-900 shadow-glow">
        <div className="sticky top-0 z-10 border-b border-paper/10 bg-ink-900/95 px-4 py-4 backdrop-blur md:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase text-brass">Result</p>
              <h2 className="mt-1 text-2xl font-semibold leading-tight text-paper md:text-3xl">{completionLabel}</h2>
              <div className="mt-2 truncate font-mono text-xs text-paper/45 md:text-sm">
                {passage.title ?? "Untitled passage"} · {passage.category} · {passage.style}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close result"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-paper/10 bg-ink-800 text-paper/75 transition hover:border-brass/50 hover:text-paper"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="grid gap-7 md:grid-cols-[minmax(14rem,17rem)_minmax(0,1fr)] md:gap-8">
            <ThisResultColumn result={result} />

            <section className="min-w-0 md:border-l md:border-paper/10 md:pl-8">
              <AttemptWpmGraph result={result} timeline={attemptTimeline} />

              <div className="mt-7 grid gap-6 border-t border-paper/10 pt-5 md:grid-cols-2">
                {hasSavedHistory && <HistoryStats points={historySeries} />}
                {previousResult && <PreviousAttemptComparison result={result} previousResult={previousResult} />}
              </div>
            </section>
          </div>

          {!recentResults && <SignInResultCta />}
        </div>

        <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t border-paper/10 bg-ink-900 px-4 py-4 md:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-paper/10 bg-ink-800 px-4 py-2 font-mono text-sm text-paper/70 transition hover:border-brass/50 hover:text-paper"
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

function ThisResultColumn({ result }: { result: TypingResult }) {
  return (
    <section>
      <p className="font-mono text-sm uppercase text-brass">This Result</p>
      <div className="mt-6">
        <p className="font-mono text-sm uppercase text-paper/45">WPM</p>
        <div className="mt-1 font-mono text-7xl font-semibold leading-none text-paper md:text-8xl">
          {result.rawWpm.toFixed(1)}
        </div>
      </div>
      <div className="mt-6 space-y-0">
        <ResultMetricRow label="Net WPM" value={result.wpm.toFixed(1)} tone="text-mint" />
        <ResultMetricRow label="Accuracy" value={`${result.accuracy.toFixed(2)}%`} />
        <ResultMetricRow label="Mistakes" value={result.incorrectCharacters} />
        <ResultMetricRow label="Time" value={formatTime(result.timeUsedSeconds)} />
        <ResultMetricRow label="Consistency" value={`${getResultConsistency(result)}%`} />
      </div>
    </section>
  );
}

function ResultMetricRow({
  label,
  value,
  tone = "text-paper"
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(5rem,1fr)_auto] items-baseline gap-4 border-b border-paper/10 py-4 font-mono last:border-b-0">
      <span className="text-sm text-paper/50">{label}</span>
      <span className={clsx("text-xl font-semibold", tone)}>{value}</span>
    </div>
  );
}

function HistoryStats({ points }: { points: Array<{ wpm: number }> }) {
  const summary = getConsistencySummary(points);

  return (
    <section>
      <p className="font-mono text-sm uppercase text-brass">History</p>
      <div className="mt-4 space-y-3 font-mono">
        <HistoryRow label="Avg (last 10)" value={summary.averageWpm.toFixed(1)} />
        <HistoryRow label="Best (last 10)" value={summary.bestWpm.toFixed(1)} />
        <HistoryRow label="Attempts" value={points.length} />
      </div>
    </section>
  );
}

function HistoryRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-paper/65">
      <span className="text-sm">{label}</span>
      <span className="text-xl text-paper">{value}</span>
    </div>
  );
}

function PreviousAttemptComparison({
  result,
  previousResult
}: {
  result: TypingResult;
  previousResult: PreviousTypingResult;
}) {
  const rawWpmDifference = result.rawWpm - previousResult.rawWpm;
  const netWpmDifference = result.wpm - previousResult.wpm;
  const accuracyDifference = result.accuracy - previousResult.accuracy;

  return (
    <section>
      <p className="font-mono text-sm uppercase text-brass">Previous Attempt</p>
      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 font-mono md:grid-cols-4">
        <PreviousComparisonStat
          label="WPM"
          delta={rawWpmDifference}
          comparison={`${previousResult.rawWpm.toFixed(1)} → ${result.rawWpm.toFixed(1)}`}
        />
        <PreviousComparisonStat
          label="Net WPM"
          delta={netWpmDifference}
          comparison={`${previousResult.wpm.toFixed(1)} → ${result.wpm.toFixed(1)}`}
        />
        <PreviousComparisonStat
          label="Accuracy"
          delta={accuracyDifference}
          suffix="%"
          comparison={`${formatPercent(previousResult.accuracy)} → ${formatPercent(result.accuracy)}`}
        />
        <div>
          <p className="text-xs uppercase text-paper/40">Time</p>
          <p className="mt-3 text-sm text-paper/45">-</p>
          <p className="mt-2 text-sm text-paper/55">
            {formatTime(previousResult.elapsedSeconds)} → {formatTime(result.timeUsedSeconds)}
          </p>
        </div>
      </div>
    </section>
  );
}

function PreviousComparisonStat({
  label,
  delta,
  comparison,
  suffix = ""
}: {
  label: string;
  delta: number;
  comparison: string;
  suffix?: string;
}) {
  const tone = delta > 0 ? "text-mint" : delta < 0 ? "text-ember" : "text-paper/80";

  return (
    <div>
      <p className="text-xs uppercase text-paper/40">{label}</p>
      <p className={clsx("mt-3 text-sm", tone)}>{formatSigned(delta, suffix)}</p>
      <p className="mt-2 text-sm text-paper/55">{comparison}</p>
    </div>
  );
}

function SignInResultCta() {
  return (
    <div data-testid="result-sign-in-cta" className="mt-8 text-center font-mono text-sm text-paper/35">
      <Link href="/login" className="transition hover:text-brass">
        Sign in to save your result
      </Link>
    </div>
  );
}

function AttemptWpmGraph({
  result,
  timeline
}: {
  result: TypingResult;
  timeline: AttemptTimelinePoint[];
}) {
  const [hoveredPoint, setHoveredPoint] = useState<PositionedAttemptPoint | null>(null);
  const points = getAttemptGraphPoints(timeline, result);
  const graph = getAttemptGraphLayout(points, result);

  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-sm uppercase text-brass">WPM Over Time</p>
        <div className="hidden gap-5 font-mono text-xs uppercase text-paper/45 sm:flex">
          <span className="inline-flex items-center gap-2">
            <span className="h-px w-8 bg-mint" />
            WPM
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-px w-8 border-t border-dashed border-paper/40" />
            Avg {result.wpm.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="mt-4 min-w-0">
        <svg
          viewBox={`0 0 ${graph.width} ${graph.height}`}
          role="img"
          aria-label="WPM over time"
          className="h-72 w-full overflow-visible text-paper/45"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          {graph.yTicks.map((tick) => {
            const y = getGraphY(tick, graph);
            return (
              <g key={tick}>
                <line
                  x1={graph.left}
                  x2={graph.right}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeDasharray="4 6"
                  strokeOpacity="0.16"
                />
                <text x={graph.left - 12} y={y + 4} textAnchor="end" className="fill-paper/45 font-mono text-[12px]">
                  {tick}
                </text>
              </g>
            );
          })}
          <line x1={graph.left} x2={graph.left} y1={graph.top} y2={graph.bottom} stroke="currentColor" strokeOpacity="0.55" />
          <line x1={graph.left} x2={graph.right} y1={graph.bottom} y2={graph.bottom} stroke="currentColor" strokeOpacity="0.55" />
          <line
            x1={graph.left}
            x2={graph.right}
            y1={getGraphY(result.wpm, graph)}
            y2={getGraphY(result.wpm, graph)}
            stroke="currentColor"
            strokeDasharray="8 8"
            strokeOpacity="0.45"
          />
          {graph.xTicks.map((tick) => (
            <text
              key={tick}
              x={getGraphX(tick, graph)}
              y={graph.bottom + 24}
              textAnchor="middle"
              className="fill-paper/45 font-mono text-[12px]"
            >
              {tick}
            </text>
          ))}
          <text x={graph.left - 30} y={graph.top - 14} className="fill-paper/55 font-mono text-[12px] uppercase">
            WPM
          </text>
          <text
            x={(graph.left + graph.right) / 2}
            y={graph.height - 8}
            textAnchor="middle"
            className="fill-paper/55 font-mono text-[12px] uppercase"
          >
            Time (seconds)
          </text>
          <path
            d={graph.path}
            fill="none"
            stroke="rgb(85 239 160)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          {graph.positionedPoints.map((point) => (
            <g key={`${point.timeSeconds}-${point.x}`}>
              <circle cx={point.x} cy={point.y} r="3.5" fill="rgb(85 239 160)" />
              <circle
                data-testid={`attempt-graph-point-${point.timeSeconds}`}
                cx={point.x}
                cy={point.y}
                r="12"
                fill="transparent"
                tabIndex={0}
                onMouseEnter={() => setHoveredPoint(point)}
                onFocus={() => setHoveredPoint(point)}
              />
            </g>
          ))}
          {hoveredPoint && (
            <g transform={`translate(${getTooltipX(hoveredPoint.x, graph)} ${Math.max(graph.top + 12, hoveredPoint.y - 84)})`}>
              <rect width="126" height="70" rx="6" className="fill-ink-900 stroke-paper/15" />
              <text x="12" y="20" className="fill-paper font-mono text-[12px]">
                {hoveredPoint.timeSeconds}s
              </text>
              <text x="12" y="42" className="fill-mint font-mono text-[12px]">
                WPM {hoveredPoint.wpm.toFixed(1)}
              </text>
              {typeof hoveredPoint.accuracy === "number" && (
                <text x="12" y="62" className="fill-paper/65 font-mono text-[12px]">
                  Accuracy {hoveredPoint.accuracy.toFixed(1)}%
                </text>
              )}
            </g>
          )}
        </svg>
      </div>
    </section>
  );
}

type PositionedAttemptPoint = AttemptTimelinePoint & {
  x: number;
  y: number;
};

type AttemptGraphLayout = {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  maxTime: number;
  maxWpm: number;
  yTicks: number[];
  xTicks: number[];
  positionedPoints: PositionedAttemptPoint[];
  path: string;
};

function buildAttemptTimelinePoint({
  elapsedSeconds,
  sourceText,
  typedText,
  rules
}: {
  elapsedSeconds: number;
  sourceText: string;
  typedText: string;
  rules: TypingRules;
}): AttemptTimelinePoint {
  const comparison = validateTypedText({ targetText: sourceText, typedText, rules });
  const minutes = Math.max(elapsedSeconds, 1) / 60;

  return {
    timeSeconds: Math.round(elapsedSeconds),
    wpm: roundOne(comparison.correctCharacters / 5 / minutes),
    accuracy: comparison.accuracy
  };
}

function upsertAttemptTimelinePoint(points: AttemptTimelinePoint[], point: AttemptTimelinePoint) {
  const existingIndex = points.findIndex((timelinePoint) => timelinePoint.timeSeconds === point.timeSeconds);

  if (existingIndex < 0) {
    return [...points, point].sort((left, right) => left.timeSeconds - right.timeSeconds);
  }

  return points
    .map((timelinePoint, index) => (index === existingIndex ? point : timelinePoint))
    .sort((left, right) => left.timeSeconds - right.timeSeconds);
}

function getAttemptGraphPoints(timeline: AttemptTimelinePoint[], result: TypingResult) {
  const sortedPoints = timeline
    .filter((point) => point.timeSeconds >= 0)
    .sort((left, right) => left.timeSeconds - right.timeSeconds);

  if (sortedPoints.length >= 2) {
    return sortedPoints;
  }

  if (sortedPoints.length === 1) {
    return [{ timeSeconds: 0, wpm: 0 }, sortedPoints[0]];
  }

  return [
    { timeSeconds: 0, wpm: 0 },
    { timeSeconds: result.timeUsedSeconds, wpm: result.wpm, accuracy: result.accuracy }
  ];
}

function getAttemptGraphLayout(points: AttemptTimelinePoint[], result: TypingResult): AttemptGraphLayout {
  const width = 640;
  const height = 280;
  const left = 48;
  const right = width - 18;
  const top = 32;
  const bottom = height - 46;
  const maxTime = Math.max(result.timeUsedSeconds, ...points.map((point) => point.timeSeconds), 1);
  const maxWpm = getNiceGraphMax(Math.max(result.wpm, ...points.map((point) => point.wpm), 1));
  const graphBase = {
    width,
    height,
    left,
    right,
    top,
    bottom,
    maxTime,
    maxWpm,
    yTicks: getWpmTicks(maxWpm),
    xTicks: getTimeTicks(maxTime)
  };
  const positionedPoints = points.map((point) => ({
    ...point,
    x: getGraphX(point.timeSeconds, graphBase),
    y: getGraphY(point.wpm, graphBase)
  }));

  return {
    ...graphBase,
    positionedPoints,
    path: positionedPoints
      .map((point, index) => `${index === 0 ? "M" : "L"} ${roundOne(point.x)} ${roundOne(point.y)}`)
      .join(" ")
  };
}

function getGraphX(timeSeconds: number, graph: Pick<AttemptGraphLayout, "left" | "right" | "maxTime">) {
  const range = graph.right - graph.left;
  return graph.left + (Math.min(Math.max(timeSeconds, 0), graph.maxTime) / graph.maxTime) * range;
}

function getGraphY(wpm: number, graph: Pick<AttemptGraphLayout, "top" | "bottom" | "maxWpm">) {
  const range = graph.bottom - graph.top;
  return graph.bottom - (Math.min(Math.max(wpm, 0), graph.maxWpm) / graph.maxWpm) * range;
}

function getTooltipX(x: number, graph: Pick<AttemptGraphLayout, "left" | "right">) {
  if (x > graph.right - 126) {
    return graph.right - 126;
  }

  return Math.max(graph.left, x + 12);
}

function getNiceGraphMax(value: number) {
  return Math.max(30, Math.ceil(value / 15) * 15);
}

function getWpmTicks(maxWpm: number) {
  return [0, Math.round(maxWpm / 2), maxWpm];
}

function getTimeTicks(maxTime: number) {
  return Array.from(new Set([0, Math.round(maxTime / 2), maxTime]));
}

function getResultConsistency(result: TypingResult) {
  if (result.rawWpm <= 0) {
    return roundOne(result.accuracy);
  }

  return roundOne(Math.max(0, Math.min(100, (result.wpm / result.rawWpm) * 100)));
}

function getCompletionLabel(completionReason: CompletionReason) {
  if (completionReason === "time_up") {
    return "Time up";
  }

  return "Session ended";
}

function SessionReview({ result }: { result: TypingResult }) {
  const breakdown = getMistakeBreakdown(result.characterStatuses);
  const mismatches = getMismatches(result.characterStatuses, 10);

  return (
    <section className="mt-5 rounded-md bg-ink-950/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-paper">Session review</h3>
          <p className="mt-1 text-sm leading-6 text-paper/50">A quick breakdown of where the finished attempt drifted.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <ReviewStat label="Mistakes" value={result.incorrectCharacters} />
        <ReviewStat label="Capitalization" value={breakdown.capitalization} />
        <ReviewStat label="Punctuation" value={breakdown.punctuation} />
        <ReviewStat label="Spacing" value={breakdown.spacing} />
        <ReviewStat label="Wrong character" value={breakdown.wrongCharacter} />
      </div>

      {mismatches.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-md bg-paper/[0.025]">
          <div className="grid min-w-[34rem] grid-cols-[4rem_1fr_1fr_1fr] border-b border-paper/5 px-3 py-2 font-mono text-[0.68rem] uppercase text-paper/35">
            <span>Pos</span>
            <span>Expected</span>
            <span>Typed</span>
            <span>Type</span>
          </div>
          {mismatches.map((mismatch, index) => (
            <div
              key={`${mismatch.index}-${index}-${mismatch.expected}-${mismatch.actual}`}
              className="grid min-w-[34rem] grid-cols-[4rem_1fr_1fr_1fr] border-b border-paper/5 px-3 py-2 font-mono text-xs text-paper/70 last:border-b-0"
            >
              <span className="text-paper/40">{mismatch.index + 1}</span>
              <span>{formatReviewCharacter(mismatch.expected, "Missing")}</span>
              <span>{formatReviewCharacter(mismatch.actual, "Extra")}</span>
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

function shouldShowLineBreakMarker(status: string, revealMistakes: boolean) {
  return status === "current" || ((status === "wrong" || status === "extra") && revealMistakes);
}

function getMistakeBreakdown(characters: CharacterComparison[]): MistakeBreakdown {
  return getMismatches(characters).reduce<MistakeBreakdown>(
    (breakdown, character) => {
      const mistakeType = classifyMistake(character);
      return {
        ...breakdown,
        [mistakeType]: breakdown[mistakeType] + 1
      };
    },
    {
      capitalization: 0,
      punctuation: 0,
      spacing: 0,
      wrongCharacter: 0
    }
  );
}

function getMismatches(characters: CharacterComparison[], limit = Number.POSITIVE_INFINITY) {
  return characters.filter((character) => character.status === "wrong" || character.status === "extra").slice(0, limit);
}

function classifyMistake(character: CharacterComparison): MistakeType {
  const expected = character.expected;
  const actual = character.actual;

  if (isSpacingCharacter(expected) || isSpacingCharacter(actual)) {
    return "spacing";
  }

  if (isPunctuationCharacter(expected) || isPunctuationCharacter(actual)) {
    return "punctuation";
  }

  if (
    expected &&
    actual &&
    expected !== actual &&
    expected.toLocaleLowerCase() === actual.toLocaleLowerCase() &&
    isLetterCharacter(expected) &&
    isLetterCharacter(actual)
  ) {
    return "capitalization";
  }

  return "wrongCharacter";
}

function formatMistakeType(type: MistakeType) {
  if (type === "wrongCharacter") {
    return "Wrong character";
  }

  return type.charAt(0).toLocaleUpperCase() + type.slice(1);
}

function formatReviewCharacter(character: string, emptyLabel: string) {
  if (!character) {
    return emptyLabel;
  }

  if (character === " ") {
    return "Space";
  }

  if (character === "\n") {
    return "Line break";
  }

  if (character === "\t") {
    return "Tab";
  }

  return character;
}

function isSpacingCharacter(character: string) {
  return character === " " || character === "\n" || character === "\t";
}

function isPunctuationCharacter(character: string) {
  return Boolean(character.match(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/));
}

function isLetterCharacter(character: string) {
  return /^[a-z]$/i.test(character);
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatPercent(value: number) {
  const roundedValue = roundOne(value);
  return `${Number.isInteger(roundedValue) ? roundedValue.toFixed(0) : roundedValue.toFixed(1)}%`;
}

function formatSigned(value: number, suffix: string) {
  const roundedValue = roundOne(value);
  return `${roundedValue >= 0 ? "+" : ""}${roundedValue.toFixed(1)}${suffix}`;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
