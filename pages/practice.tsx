"use client";

import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { clsx } from "clsx";
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
  isTypedTextComplete,
  normalizeTargetForRules,
  validateTypedText
} from "@/lib/typing-engine";
import {
  ALL_FILTER,
  CategoryFilter,
  PreviousTypingResult,
  LibraryPassage,
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
import { PRACTICE_DURATIONS } from "@/lib/practiceDurations";
import { isRestartShortcut } from "@/lib/practiceShortcuts";
import { saveSupabaseTypingResult } from "@/lib/typingResultStorage";

type SessionStatus = "idle" | "running" | "finished";

const RANDOM_PASSAGE_ID = "__random__";

export default function PracticePage() {
  const { user } = useAuth();
  const [rules, setRules] = useState<TypingRules>(DEFAULT_RULES);
  const [passage, setPassage] = useState<StoredPassage>(() => getDefaultPassage(60));
  const [typedText, setTypedText] = useState("");
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<TypingResult | null>(null);
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
  const elapsedSecondsRef = useRef(0);
  const libraryRef = useRef<LibraryPassage[]>([]);
  const isTabPressedRef = useRef(false);
  const scrollFrameRef = useRef<number | null>(null);

  const isRunning = status === "running";
  const isFinished = status === "finished";
  const sourceText = passage.text.trim();
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
      preferredPassageId
    }: {
      library: LibraryPassage[];
      category: CategoryFilter;
      duration: number;
      preferredPassageId?: string | null;
    }) => {
      const categoryLibrary = filterLibraryByCategory(library, category);

      if (categoryLibrary.length > 0) {
        if (preferredPassageId === RANDOM_PASSAGE_ID) {
          const randomPassage = selectRandomLibraryPassage(getActivePassageId() ?? undefined, categoryLibrary) ?? categoryLibrary[0];
          setPassageSelectionMode("random");
          setActivePassageId(randomPassage.id);
          setSelectedPassageId(RANDOM_PASSAGE_ID);
          const nextPassage = toStoredPassage(randomPassage, duration, categoryLibrary);
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
        const nextPassage = toStoredPassage(selectedLibraryPassage, duration, categoryLibrary);
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
          typedCharacters: typedTextRef.current.length,
          supabasePassageId: passage.id ?? null
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
  }, [isRunning, resetSession, rules.requireTabToStart, startSession, status]);

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
      const activeCharacter = currentCharRef.current;

      if (!activeCharacter) {
        return;
      }

      const characterBounds = activeCharacter.getBoundingClientRect();
      const lineHeight = characterBounds.height || 36;
      const bottomEdge = window.innerHeight - Math.max(96, lineHeight * 2.4);

      if (characterBounds.bottom <= bottomEdge) {
        return;
      }

      const scrollAmount = Math.ceil(characterBounds.bottom - bottomEdge);
      window.scrollBy({ top: scrollAmount, behavior: "smooth" });
    });

    return () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [isRunning, typedText.length]);

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

  async function handleDuration(seconds: number) {
    resetSession();
    setDurationSeconds(seconds);
    setRemainingSeconds(seconds);
    const activeLibrary = await loadActivePassageLibrary();
    setAvailableLibrary(activeLibrary);
    choosePracticePassage({
      library: activeLibrary,
      category: selectedCategory,
      duration: seconds,
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
      preferredPassageId: selectedPassageId === RANDOM_PASSAGE_ID ? RANDOM_PASSAGE_ID : null
    });
  }

  function handlePassageSelection(passageId: string) {
    resetSession();
    choosePracticePassage({
      library: availableLibrary,
      category: selectedCategory,
      duration: durationSeconds,
      preferredPassageId: passageId
    });
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
      setSelectedPassageId(isRandomMode ? RANDOM_PASSAGE_ID : nextLibraryPassage.id);
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
    setSelectedPassageId(RANDOM_PASSAGE_ID);
    setPassage(nextPassage);
    setPreviousResult(readPreviousResult(nextPassage.id));
    writeStoredPassage(nextPassage);
  }

  function loadRandomPassage() {
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
    const randomPassage = toStoredPassage(randomLibraryPassage, durationSeconds, library);
    setPassage(randomPassage);
    setPreviousResult(readPreviousResult(randomPassage.id));
    writeStoredPassage(randomPassage);
  }

  async function loadActivePassageLibrary(): Promise<LibraryPassage[]> {
    try {
      const supabaseLibrary = await getSupabasePassageLibrary();
      libraryRef.current = supabaseLibrary;
      writePassageLibrary(supabaseLibrary);
      return supabaseLibrary;
    } catch {
      const localLibrary = getActivePassageLibrary();
      libraryRef.current = localLibrary;
      return localLibrary;
    }
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
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 md:grid-cols-[minmax(8rem,0.8fr)_minmax(14rem,1.35fr)_minmax(12rem,0.8fr)] md:items-center">
            <label className="min-w-0">
              <span className="sr-only">Category</span>
              <select
                value={selectedCategory}
                onChange={(event) => handleCategorySelection(event.target.value as CategoryFilter)}
                disabled={isRunning}
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
                disabled={isRunning || selectablePassages.length === 0}
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

            <div className="grid min-w-0 grid-cols-3 rounded-full bg-paper/[0.035] p-1">
              <span className="sr-only">Duration</span>
              {PRACTICE_DURATIONS.map((duration) => (
                <button
                  key={duration.seconds}
                  type="button"
                  onClick={() => handleDuration(duration.seconds)}
                  disabled={isRunning}
                  className={clsx(
                    "h-7 rounded-full px-3 font-mono text-xs transition disabled:cursor-not-allowed disabled:opacity-60",
                    durationSeconds === duration.seconds
                      ? "bg-brass/85 text-ink-950"
                      : "text-paper/50 hover:bg-paper/5 hover:text-paper/80"
                  )}
                >
                  {duration.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {isRunning ? (
          <div className="mb-1 flex justify-end px-1 font-mono text-[1.45rem] leading-none text-paper/35 md:text-[2rem]">
            {formatTime(remainingSeconds)}
          </div>
        ) : status === "idle" ? (
          <div className="mb-3 flex max-w-full flex-wrap items-center justify-between gap-2 overflow-hidden px-1 font-mono text-xs text-paper/40 transition">
            <div className="w-full min-w-0 truncate sm:w-auto">
              <span className="font-semibold text-paper/70">{passage.title ?? "Untitled passage"}</span> ·{" "}
              {passage.category} · {passage.style} · {formatTime(durationSeconds)}
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
            "relative max-w-full outline-none transition md:p-5",
            isRunning
              ? "overflow-visible rounded-none bg-transparent p-0"
              : "overflow-hidden rounded-lg bg-paper/[0.025] p-3 ring-1 ring-paper/5 focus:ring-brass/30"
          )}
        >
          {previousResult && status === "idle" && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-paper/45">
              <span>Previous pace: {previousResult.wpm.toFixed(1)} WPM</span>
            </div>
          )}

          <div
            ref={typingWindowRef}
            className={clsx(
              "transition",
              isRunning
                ? "min-h-[430px] overflow-visible px-1 py-8 md:min-h-[520px] md:px-6 md:py-10"
                : "h-[340px] overflow-y-auto overscroll-contain rounded-md bg-ink-900/55 px-4 py-6 md:h-[420px] md:px-8 md:py-8"
            )}
          >
            <p
              className={clsx(
                "mx-auto max-w-4xl whitespace-pre-wrap break-words font-mono text-[1.7rem] leading-[2.55rem] text-paper/45 md:text-[2.15rem] md:leading-[3.25rem]",
                isRunning && "text-paper/50"
              )}
            >
              {comparison.characters.map((character, index) => {
                const isCurrent = character.status === "current";
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

        {status === "idle" && (
          <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-xs text-paper/30">
            <span>Tab = start</span>
            <span>Tab + Enter = restart</span>
          </div>
        )}

        {lastResult && <ResultsPanel result={lastResult} onRestart={resetSession} onNextPassage={loadNextPassage} />}
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
          <h2 className="mt-1 text-2xl font-semibold text-paper">
            {result.completionReason === "time_up" ? "Time up" : "Passage completed"}
          </h2>
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/80 px-3 py-4 backdrop-blur md:px-4">
      <section className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-brass/30 bg-ink-900 shadow-glow">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-paper/10 bg-ink-900 px-4 py-4 md:px-6">
          <div>
            <p className="font-mono text-xs uppercase text-brass">Result</p>
            <h2 className="mt-1 text-3xl font-semibold text-paper">
              {result.completionReason === "time_up" ? "Time up" : "Passage completed"}
            </h2>
            <div className="mt-2 font-mono text-sm text-paper/45">
              {passage.category} · {passage.style}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close result"
            className="shrink-0 rounded-md border border-paper/10 bg-ink-800 px-3 py-2 font-mono text-sm text-paper/85 transition hover:border-brass/50 hover:text-paper"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="WPM" value={result.wpm.toFixed(1)} />
            <Metric label="Accuracy" value={`${result.accuracy.toFixed(2)}%`} />
            <Metric label="Mistakes" value={result.incorrectCharacters} />
            <Metric label="Time used" value={formatTime(result.timeUsedSeconds)} />
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

          <SessionReview result={result} />
        </div>

        <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t border-paper/10 bg-ink-900 px-4 py-4 md:px-6">
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
        <div className="mt-4 overflow-hidden rounded-md bg-paper/[0.025]">
          <div className="grid grid-cols-[5rem_1fr_1fr_1fr] border-b border-paper/5 px-3 py-2 font-mono text-[0.68rem] uppercase text-paper/35">
            <span>Pos</span>
            <span>Expected</span>
            <span>Typed</span>
            <span>Type</span>
          </div>
          {mismatches.map((mismatch, index) => (
            <div
              key={`${mismatch.index}-${index}-${mismatch.expected}-${mismatch.actual}`}
              className="grid grid-cols-[5rem_1fr_1fr_1fr] border-b border-paper/5 px-3 py-2 font-mono text-xs text-paper/70 last:border-b-0"
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

function formatSigned(value: number, suffix: string) {
  const roundedValue = Math.round(value * 10) / 10;
  return `${roundedValue >= 0 ? "+" : ""}${roundedValue.toFixed(1)}${suffix}`;
}
