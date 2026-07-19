"use client";

import React, { Fragment, KeyboardEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpenText, Clock3, ImageIcon, KeyboardIcon, Languages, RefreshCw, RotateCcw, Shuffle, X } from "lucide-react";
import { clsx } from "clsx";
import Link from "next/link";
import { AdPlaceholder, AppShell } from "@/components/AppShell";
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
  PassageLanguage,
  PreviousTypingResult,
  PreviousResultScope,
  PreviousPaceTimelinePoint,
  LibraryPassage,
  StoredPassage,
  StoredPassageTextMode,
  ThemeSettings,
  DEFAULT_THEME_SETTINGS,
  filterLibraryPassages,
  filterLibraryPassagesByLanguage,
  getDefaultPassage,
  readPreviousResult,
  readStoredPassage,
  readStoredRules,
  readThemeSettings,
  selectDifferentLibraryPassage,
  selectRandomLibraryPassage,
  toStoredPassage,
  withBuiltInSamplePassages,
  writePreviousResult,
  writeStoredPassage
} from "@/lib/app-storage";
import {
  getActivePassageId,
  getActivePassageLibrary,
  getPassageSelectionMode,
  getSelectedLanguage,
  getSelectedCategory,
  getSupabasePassageLibrary,
  setActivePassageId,
  setPassageSelectionMode,
  setSelectedLanguage,
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
  calculateTimelineConsistency,
  getConsistencySummary
} from "@/lib/practiceConsistency";
import type { ConsistencyPoint } from "@/lib/practiceConsistency";
import {
  KeyboardSoundKeyType,
  KeyboardSoundSetting,
  createKeyboardSoundPlayer,
  getKeyboardSoundKeyType,
  isTypingSoundKey,
  readKeyboardSoundSetting,
  readKeyboardSoundVolume
} from "@/lib/keyboardSound";
import { isRestartShortcut } from "@/lib/practiceShortcuts";
import { buildProgressAnalytics } from "@/lib/analytics";
import { getResultAnalyticsDomain } from "@/lib/analyticsDomain";
import {
  SupabaseAnalyticsTypingResultRow,
  SupabaseOwnTypingResultRow,
  getSupabaseAnalyticsTypingResults,
  getSupabaseOwnTypingResults,
  saveSupabaseTypingResult
} from "@/lib/typingResultStorage";
import { formatPassageResultMetadata } from "@/lib/trainingDisplay";
import {
  appendTypingAttemptDetail,
  buildTypingAttemptDetail
} from "@/lib/typingStatistics";
import type { TypingAttemptDetail } from "@/lib/typingStatistics";
import { saveSupabaseTypingAttemptDetail } from "@/lib/typingAttemptStorage";
import { SessionReview } from "@/components/practice/SessionReview";

export type PracticeTrainingMode = {
  pageTitle: string;
  passageId: string;
  configKey?: string;
  controls?: ReactNode;
  session:
    | { kind: "time"; seconds: number }
    | { kind: "words"; wordCount: number };
  buildPassage: (input: {
    durationSeconds: number;
    wordCount?: number;
    mode: "time" | "words";
  }) => StoredPassage;
  hideMetadata?: boolean;
  hidePassageControls?: boolean;
  hidePracticeModeControls?: boolean;
};

type SessionStatus = "idle" | "running" | "finished";
type CloudSaveState = "idle" | "saving" | "saved" | "failed";

export type AttemptTimelinePoint = {
  timeSeconds: number;
  characterIndex?: number;
  wpm: number;
  accuracy?: number;
  burstWpm?: number;
  errorCount?: number;
};

export type AttemptErrorEvent = { timeSeconds: number; characterIndex: number };

export type ResultImageCardInput = {
  result: TypingResult;
  passage: StoredPassage;
  modeLabel: string;
};

const RANDOM_PASSAGE_ID = "__random__";
const SUSPICIOUS_RESULT_NOTE = "This result was not saved because suspicious input was detected.";
const MAX_CHARACTERS_PER_INPUT_EVENT = 5;
const SUSPICIOUS_WPM_THRESHOLD = 250;
const HAN_CHARACTER_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/;
const CONSISTENCY_HELP_TEXT =
  "Consistency shows how steady your WPM stayed during the test. It is based on the coefficient of variation of your WPM timeline.";
const ACHIEVEMENT_POP_DISMISS_MS = 5000;
const TOUCH_FIRST_INPUT_MEDIA_QUERY = "(hover: none) and (pointer: coarse)";

type CelebrationMilestone = {
  id: string;
  title: string;
  value: string;
  subtitle?: string;
  effect?: "ribbons" | "quiet";
};

const EMPTY_CELEBRATION_MILESTONES: CelebrationMilestone[] = [];

function useTouchFirstInput() {
  const [isTouchFirstInput, setIsTouchFirstInput] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(TOUCH_FIRST_INPUT_MEDIA_QUERY);
    const updateInputCapability = () => setIsTouchFirstInput(mediaQuery.matches);

    updateInputCapability();
    mediaQuery.addEventListener("change", updateInputCapability);
    return () => mediaQuery.removeEventListener("change", updateInputCapability);
  }, []);

  return isTouchFirstInput;
}

export default function PracticePage({ trainingMode }: { trainingMode?: PracticeTrainingMode } = {}) {
  const { user } = useAuth();
  const isTouchFirstInput = useTouchFirstInput();
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
  const [attemptErrorEvents, setAttemptErrorEvents] = useState<AttemptErrorEvent[]>([]);
  const [recentResults, setRecentResults] = useState<SupabaseOwnTypingResultRow[]>([]);
  const [progressMilestones, setProgressMilestones] = useState<CelebrationMilestone[]>([]);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [cloudSaveState, setCloudSaveState] = useState<CloudSaveState>("idle");
  const [passageNotice, setPassageNotice] = useState("");
  const [isAttemptSuspicious, setIsAttemptSuspicious] = useState(false);
  const [isInputActivated, setIsInputActivated] = useState(false);
  const [previousResult, setPreviousResult] = useState<PreviousTypingResult | null>(null);
  const [availableLibrary, setAvailableLibrary] = useState<LibraryPassage[]>([]);
  const [practiceLanguage, setPracticeLanguage] = useState<PassageLanguage>("english");
  const [selectedCategory, setSelectedCategoryState] = useState<CategoryFilter>(ALL_FILTER);
  const [selectedPassageId, setSelectedPassageId] = useState(RANDOM_PASSAGE_ID);
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(DEFAULT_THEME_SETTINGS);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const chineseImeInputRef = useRef<HTMLTextAreaElement | null>(null);
  const typingWindowRef = useRef<HTMLDivElement>(null);
  const typingTextRef = useRef<HTMLDivElement>(null);
  const resultPanelRestartButtonRef = useRef<HTMLButtonElement>(null);
  const currentCharRef = useRef<HTMLSpanElement | null>(null);
  const previousPaceMarkerRef = useRef<HTMLSpanElement | null>(null);
  const characterRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const finishedRef = useRef(false);
  const statusRef = useRef<SessionStatus>("idle");
  const startedAtRef = useRef<number | null>(null);
  const passageRef = useRef<StoredPassage | null>(null);
  const previousResultScopeRef = useRef<PreviousResultScope>("60s");
  const durationSecondsRef = useRef(60);
  const isTimedModeRef = useRef(true);
  const typedTextRef = useRef("");
  const attemptTimelineRef = useRef<AttemptTimelinePoint[]>([]);
  const attemptErrorEventsRef = useRef<AttemptErrorEvent[]>([]);
  const activeErrorIndexesRef = useRef<Set<number>>(new Set());
  const elapsedSecondsRef = useRef(0);
  const suspiciousAttemptRef = useRef(false);
  const libraryRef = useRef<LibraryPassage[]>([]);
  const libraryLoadPromiseRef = useRef<Promise<LibraryPassage[]> | null>(null);
  const isTabPressedRef = useRef(false);
  const isInputActivatedRef = useRef(false);
  // Keep modal visibility synchronous with session refs so a timer completion
  // cannot race a pending keyboard shortcut before React commits the render.
  const isResultModalOpenRef = useRef(false);
  const isComposingRef = useRef(false);
  const explicitCompositionActiveRef = useRef(false);
  const awaitingChineseFinalCommitRef = useRef(false);
  const imeDebugSequenceRef = useRef(0);
  const activeTrainingConfigKeyRef = useRef<string | null>(null);
  const activeSessionGenerationRef = useRef(0);
  const chineseCompositionSequenceRef = useRef(0);
  const chineseImeFallbackTimeoutRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const previousPaceAnimationFrameRef = useRef<number | null>(null);
  const keyboardSoundSettingRef = useRef<KeyboardSoundSetting>("off");
  const keyboardSoundVolumeRef = useRef(0.5);
  const keyboardSoundPlayerRef = useRef(createKeyboardSoundPlayer());
  const pendingSoundKeyTypeRef = useRef<KeyboardSoundKeyType | null>(null);
  const typedCharacterDelaysRef = useRef<number[]>([]);
  const lastTypedCharacterAtRef = useRef<number | null>(null);
  const activeAttemptIdRef = useRef(createClientAttemptId());

  const isRunning = status === "running";
  const isFinished = status === "finished";
  const isFocusMode = isInputActivated && !isFinished;
  const isPassageLoading = passage === null;
  const practiceMode = useMemo(() => getPracticeMode(practiceModeId), [practiceModeId]);
  const trainingSession = trainingMode?.session;
  const isTimedMode = trainingSession ? trainingSession.kind === "time" : isTimedPracticeMode(practiceMode);
  const durationSeconds = trainingSession?.kind === "time" ? trainingSession.seconds : isTimedPracticeMode(practiceMode) ? practiceMode.seconds : 60;
  const previousResultScope: PreviousResultScope = trainingSession
    ? trainingSession.kind === "time"
      ? trainingSession.seconds
      : `words-${trainingSession.wordCount}`
    : isTimedMode
      ? durationSeconds
      : practiceMode.id;
  const passageTextMode: StoredPassageTextMode = trainingSession?.kind === "words" ? "single" : isTimedMode ? "timed" : "single";
  const clockSeconds = isTimedMode ? remainingSeconds : elapsedSeconds;
  const modeLabel = trainingSession
    ? trainingSession.kind === "time"
      ? `${trainingSession.seconds}s`
      : `${trainingSession.wordCount} words`
    : practiceMode.label;
  const shouldShowPracticeHeader =
    !trainingMode?.hideMetadata || !trainingMode?.hidePassageControls || !trainingMode?.hidePracticeModeControls;
  const shouldShowTypingHeader = Boolean(trainingMode?.controls) || shouldShowPracticeHeader;
  const displayText = passage?.text.trim() ?? "";
  const sourceText = (passage?.comparableText ?? passage?.text ?? "").trim();
  const isChinesePassage = passage?.language === "chinese" || passage?.category === "training_chinese";
  const isChineseTraining = passage?.category === "training_chinese";
  const shouldUseChineseImeSink = isChinesePassage;
  const shouldTraceIme = Boolean(
    isChineseTraining &&
      typeof window !== "undefined" &&
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(window.location.search).get("imeDebug") === "1"
  );
  const targetText = useMemo(() => normalizeTargetForRules(sourceText, rules), [sourceText, rules]);
  passageRef.current = passage;
  previousResultScopeRef.current = previousResultScope;
  durationSecondsRef.current = durationSeconds;
  isTimedModeRef.current = isTimedMode;
  const comparison = useMemo(
    () => validateTypedText({ targetText: sourceText, typedText, rules }),
    [sourceText, typedText, rules]
  );
  const previousComparisonMatches = Boolean(
    passage?.id &&
      previousResult &&
      previousResult.passageId === passage.id &&
      (!previousResult.durationSeconds || previousResult.durationSeconds === durationSeconds)
  );
  const shouldShowPreviousPaceMarker = Boolean(
    previousComparisonMatches && isRunning && !isResultModalOpen && previousResult?.previousPaceTimeline?.length
  );
  const setCharacterRef = useCallback(
    (index: number, isCurrent: boolean) => (node: HTMLSpanElement | null) => {
      characterRefs.current[index] = node;
      if (isCurrent) {
        currentCharRef.current = node;
      }
    },
    []
  );
  const choosePracticePassage = useCallback(
    ({
      library,
      category,
      duration,
      textMode,
      language,
      preferredPassageId
    }: {
      library: LibraryPassage[];
      category: CategoryFilter;
      duration: number;
      textMode: StoredPassageTextMode;
      language: PassageLanguage;
      preferredPassageId?: string | null;
    }) => {
      const languageLibrary = filterLibraryPassagesByLanguage(library, language);
      const categoryLibrary = filterLibraryByCategory(languageLibrary, category);

      if (categoryLibrary.length > 0) {
        if (preferredPassageId === RANDOM_PASSAGE_ID) {
          const activePassageId = getActivePassageId();
          const activePassageIsInScopedLibrary = Boolean(
            activePassageId && categoryLibrary.some((libraryPassage) => libraryPassage.id === activePassageId)
          );
          const randomPassage = activePassageIsInScopedLibrary
            ? selectRandomLibraryPassage(activePassageId ?? undefined, categoryLibrary) ?? categoryLibrary[0]
            : categoryLibrary[0];
          setPassageSelectionMode("random");
          setActivePassageId(randomPassage.id);
          setSelectedPassageId(RANDOM_PASSAGE_ID);
          const nextPassage = toStoredPassage(randomPassage, duration, categoryLibrary, textMode);
          setPassage(nextPassage);
          setPreviousResult(readPreviousResult(nextPassage.id, getPreviousResultScope(duration, textMode)));
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
        setPreviousResult(readPreviousResult(nextPassage.id, getPreviousResultScope(duration, textMode)));
        writeStoredPassage(nextPassage);
        setPassageNotice("");
        return;
      }

      const fallbackPassage = readStoredPassage(duration);
      setSelectedPassageId(RANDOM_PASSAGE_ID);
      setPassage(fallbackPassage);
      setPreviousResult(readPreviousResult(fallbackPassage.id, getPreviousResultScope(duration, textMode)));
      setPassageNotice("No active saved passages found. Using a sample passage.");
    },
    []
  );

  const cancelPendingChineseImeFallback = useCallback(() => {
    if (chineseImeFallbackTimeoutRef.current !== null) {
      window.clearTimeout(chineseImeFallbackTimeoutRef.current);
      chineseImeFallbackTimeoutRef.current = null;
    }
  }, []);

  const resetActiveSessionState = useCallback(
    ({
      nextPassage,
      nextPreviousResultScope
    }: {
      nextPassage?: StoredPassage | null;
      nextPreviousResultScope?: PreviousResultScope;
    } = {}) => {
      const resetPassage = nextPassage === undefined ? passageRef.current : nextPassage;
      const resetPreviousResultScope =
        nextPreviousResultScope === undefined ? previousResultScopeRef.current : nextPreviousResultScope;
      const resetDurationSeconds = durationSecondsRef.current;
      const resetIsTimedMode = isTimedModeRef.current;

      activeSessionGenerationRef.current += 1;
      chineseCompositionSequenceRef.current += 1;
      cancelPendingChineseImeFallback();
      isComposingRef.current = false;
      explicitCompositionActiveRef.current = false;
      awaitingChineseFinalCommitRef.current = false;
      isInputActivatedRef.current = false;
      finishedRef.current = false;
      statusRef.current = "idle";
      startedAtRef.current = null;
      typedTextRef.current = "";
      attemptTimelineRef.current = [];
      attemptErrorEventsRef.current = [];
      activeErrorIndexesRef.current = new Set();
      suspiciousAttemptRef.current = false;
      typedCharacterDelaysRef.current = [];
      lastTypedCharacterAtRef.current = null;
      setTypedText("");
      setIsInputActivated(false);
      if (chineseImeInputRef.current) {
        chineseImeInputRef.current.value = "";
      }
      setAttemptTimeline([]);
      setAttemptErrorEvents([]);
      setIsAttemptSuspicious(false);
      setElapsedSeconds(0);
      elapsedSecondsRef.current = 0;
      setRemainingSeconds(resetIsTimedMode ? resetDurationSeconds : 0);
      setStartedAt(null);
      setFinishedAt(null);
      setLastResult(null);
      setProgressMilestones([]);
      setCloudSaveState("idle");
      isResultModalOpenRef.current = false;
      setIsResultModalOpen(false);
      setPreviousResult(resetPassage ? readPreviousResult(resetPassage.id, resetPreviousResultScope) : null);
      setStatus("idle");
      if (typingWindowRef.current) {
        typingWindowRef.current.scrollTop = 0;
      }
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      if (previousPaceAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(previousPaceAnimationFrameRef.current);
        previousPaceAnimationFrameRef.current = null;
      }
    },
    [cancelPendingChineseImeFallback]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadInitialPracticeState() {
      if (trainingMode) {
        const trainingPassage = buildTrainingModePassage(trainingMode, durationSeconds);
        const nextConfigKey = trainingMode.configKey ?? trainingMode.passageId;
        const didTrainingConfigChange =
          activeTrainingConfigKeyRef.current !== null && activeTrainingConfigKeyRef.current !== nextConfigKey;
        activeTrainingConfigKeyRef.current = nextConfigKey;

        if (!isMounted) {
          return;
        }

        libraryRef.current = [];
        setAvailableLibrary([]);
        setSelectedCategoryState(trainingPassage.category);
        setSelectedPassageId(trainingMode.passageId);
        setPassageNotice("");
        setPassage(trainingPassage);
        setPreviousResult(readPreviousResult(trainingPassage.id, previousResultScope));
        if (didTrainingConfigChange) {
          resetActiveSessionState({
            nextPassage: trainingPassage,
            nextPreviousResultScope: previousResultScope
          });
        }
        return;
      }

      const activeLibrary = await loadActivePassageLibrary();

      if (!isMounted) {
        return;
      }

      setAvailableLibrary(activeLibrary);
      const initialLanguage = getSelectedLanguage();
      const initialCategory = getInitialCategory(activeLibrary, initialLanguage);
      setPracticeLanguage(initialLanguage);
      setSelectedCategoryState(initialCategory);
      choosePracticePassage({
        library: activeLibrary,
        category: initialCategory,
        duration: durationSeconds,
        textMode: passageTextMode,
        language: initialLanguage,
        preferredPassageId: getPassageSelectionMode() === "random" ? RANDOM_PASSAGE_ID : getActivePassageId()
      });
    }

    setRules(readStoredRules());
    setThemeSettings(readThemeSettings());
    keyboardSoundSettingRef.current = readKeyboardSoundSetting();
    keyboardSoundVolumeRef.current = readKeyboardSoundVolume();
    keyboardSoundPlayerRef.current.preload(keyboardSoundSettingRef.current);
    loadInitialPracticeState();

    return () => {
      isMounted = false;
    };
  }, [choosePracticePassage, durationSeconds, passageTextMode, previousResultScope, resetActiveSessionState, trainingMode]);

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
        category: passage?.category,
        language: passage?.language,
        rules
      });
      point.burstWpm = getBurstWpm(typedCharacterDelaysRef.current, passage?.language === "chinese" || passage?.category === "training_chinese");
      point.errorCount = attemptErrorEventsRef.current.length;
      const existingIndex = attemptTimelineRef.current.findIndex(
        (timelinePoint) => timelinePoint.timeSeconds === point.timeSeconds
      );

      if (existingIndex >= 0) {
        attemptTimelineRef.current = attemptTimelineRef.current.map((timelinePoint, index) =>
          index === existingIndex ? point : timelinePoint
        );
        return;
      }

      attemptTimelineRef.current = addAttemptTimelinePoint(attemptTimelineRef.current, point);
    },
    [passage?.category, passage?.language, rules, sourceText]
  );

  const resetSession = useCallback(() => {
    resetActiveSessionState();
  }, [resetActiveSessionState]);

  const closeResultModal = useCallback(() => {
    isResultModalOpenRef.current = false;
    setIsResultModalOpen(false);
    window.requestAnimationFrame(() => resultPanelRestartButtonRef.current?.focus());
  }, []);

  const finishTest = useCallback(
    (completionReason: CompletionReason) => {
      const sessionStartedAt = startedAtRef.current;

      if (finishedRef.current || statusRef.current !== "running" || sessionStartedAt === null || !passage) {
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
      isResultModalOpenRef.current = true;
      setIsResultModalOpen(true);
      // Blur immediately; the disabled prop is applied on the next render and
      // a held key could otherwise race the result modal.
      pendingSoundKeyTypeRef.current = null;
      inputRef.current?.blur();
      setRecentResults([]);
      setProgressMilestones([]);
      const finalResult = calculateResult({
        target: sourceText,
        typed: typedTextRef.current,
        elapsedSeconds: Math.max(finalElapsed, 1),
        durationSeconds: resultDurationSeconds,
        category: passage.category,
        language: passage.language,
        rules,
        completionReason
      });
      const finalTimelinePoint: AttemptTimelinePoint = {
        timeSeconds: finalResult.timeUsedSeconds,
        characterIndex: typedTextRef.current.length,
        wpm: finalResult.wpm,
        accuracy: finalResult.accuracy,
        burstWpm: getBurstWpm(typedCharacterDelaysRef.current, passage.language === "chinese" || passage.category === "training_chinese"),
        errorCount: attemptErrorEventsRef.current.length
      };
      const completedTimeline = upsertAttemptTimelinePoint(attemptTimelineRef.current, finalTimelinePoint);
      attemptTimelineRef.current = completedTimeline;
      const isSuspicious = suspiciousAttemptRef.current;

      const comparisonPreviousResult = readPreviousResult(passage.id, previousResultScope);
      let attemptDetail: TypingAttemptDetail | null = null;
      if (!isSuspicious) {
        writePreviousResult(
          passage,
          finalResult,
          typedTextRef.current.length,
          previousResultScope,
          completedTimeline.map(toPreviousPaceTimelinePoint)
        );
        if (user) {
          attemptDetail = buildTypingAttemptDetail({
            userId: user.id,
            result: finalResult,
            typedCharacterDelaysMs: typedCharacterDelaysRef.current,
            timeline: completedTimeline
          });
          appendTypingAttemptDetail(attemptDetail);
        }
      }
      setPreviousResult(comparisonPreviousResult);
      setLastResult(finalResult);
      setAttemptTimeline(completedTimeline);
      setAttemptErrorEvents([...attemptErrorEventsRef.current]);
      setIsAttemptSuspicious(isSuspicious);

      const completedSessionGeneration = activeSessionGenerationRef.current;
      const completedAttemptId = activeAttemptIdRef.current;
      const isCurrentCompletedSession = () =>
        activeSessionGenerationRef.current === completedSessionGeneration &&
        activeAttemptIdRef.current === completedAttemptId &&
        finishedRef.current;

      if (user) {
        void getSupabaseOwnTypingResults(user.id, 50)
          .then((typingResults) => {
            if (isCurrentCompletedSession()) {
              setRecentResults(filterComparableRecentResults(typingResults, passage, finalResult));
            }
          })
          .catch((error) => {
            console.warn("Supabase recent typing results load failed", error);
          });

        if (!isSuspicious) {
          setCloudSaveState("saving");
          void saveSupabaseTypingResult({
            userId: user.id,
            attemptId: completedAttemptId,
            passage,
            result: finalResult,
            typedCharacters: typedTextRef.current.length,
            supabasePassageId: passage.id ?? null
          })
            .then((savedResult) => {
              if (isCurrentCompletedSession()) {
                setCloudSaveState("saved");
              }
              if (attemptDetail) {
                void saveSupabaseTypingAttemptDetail(attemptDetail, savedResult.id).catch((error) => {
                  console.warn("Supabase typing attempt detail save failed", error);
                });
              }
              void getSupabaseAnalyticsTypingResults(user.id)
                .then((typingResults) => {
                  if (isCurrentCompletedSession()) {
                    setProgressMilestones(
                      buildProgressCelebrationMilestones(
                        typingResults.filter((typingResult) => typingResult.id !== savedResult.id),
                        passage,
                        { ...finalResult, completedAt: savedResult.created_at }
                      )
                    );
                  }
                })
                .catch((error) => {
                  console.warn("Supabase progress analytics load failed", error);
                });
            })
            .catch((error) => {
              if (isCurrentCompletedSession()) {
                setCloudSaveState("failed");
              }
              console.warn("Supabase typing result save failed", error);
            });
        }
      }
    },
    [durationSeconds, isTimedMode, passage, practiceMode, previousResultScope, rules, sourceText, user]
  );

  useEffect(() => {
    if (
      !isRunning ||
      isFinished ||
      trainingSession?.kind === "time" ||
      !sourceText ||
      !isTypedTextComplete(sourceText, typedText, rules)
    ) {
      return;
    }

    finishTest("text_completed");
  }, [finishTest, isFinished, isRunning, rules, sourceText, trainingSession?.kind, typedText]);

  const startSession = useCallback(() => {
    if (!passage || !sourceText || isFinished) {
      return;
    }

    finishedRef.current = false;
    activeAttemptIdRef.current = createClientAttemptId();
    const now = Date.now();
    statusRef.current = "running";
    startedAtRef.current = now;
    typedTextRef.current = "";
    attemptTimelineRef.current = [];
    attemptErrorEventsRef.current = [];
    activeErrorIndexesRef.current = new Set();
    suspiciousAttemptRef.current = false;
    typedCharacterDelaysRef.current = [];
    lastTypedCharacterAtRef.current = null;
    setTypedText("");
    setAttemptTimeline([]);
    setAttemptErrorEvents([]);
    setIsAttemptSuspicious(false);
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    setRemainingSeconds(isTimedMode ? durationSeconds : 0);
    setStartedAt(now);
    setFinishedAt(null);
    setLastResult(null);
    isResultModalOpenRef.current = false;
    setProgressMilestones([]);
    setPreviousResult(readPreviousResult(passage.id, previousResultScope));
    isInputActivatedRef.current = true;
    setIsInputActivated(true);
    setStatus("running");
  }, [durationSeconds, isFinished, isTimedMode, passage, previousResultScope, sourceText]);

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
          isInputActivatedRef.current = true;
          setIsInputActivated(true);
          if (shouldUseChineseImeSink) {
            startSession();
            chineseImeInputRef.current?.focus({ preventScroll: true });
            return;
          }
          inputRef.current?.focus({ preventScroll: true });
          return;
        }

        return;
      }

      if (
        !isResultModalOpenRef.current &&
        !event.repeat &&
        isRestartShortcut({ key: event.key, tabKey: isTabPressedRef.current })
      ) {
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
  }, [finishTest, isRunning, resetSession, rules.requireTabToStart, shouldUseChineseImeSink, startSession, status]);

  useEffect(() => {
    if (isRunning) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [isRunning]);

  useEffect(() => {
    characterRefs.current = characterRefs.current.slice(0, comparison.characters.length);
  }, [comparison.characters.length]);

  useEffect(() => {
    if (previousPaceAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(previousPaceAnimationFrameRef.current);
      previousPaceAnimationFrameRef.current = null;
    }

    const timeline = previousResult?.previousPaceTimeline;
    if (!shouldShowPreviousPaceMarker || !timeline || timeline.length === 0) {
      if (previousPaceMarkerRef.current) {
        previousPaceMarkerRef.current.style.opacity = "0";
      }
      return;
    }

    const animatePreviousPaceMarker = () => {
      const marker = previousPaceMarkerRef.current;
      const container = typingTextRef.current;
      const startedAtMs = startedAtRef.current;

      if (!marker || !container || !startedAtMs || statusRef.current !== "running" || isResultModalOpen) {
        if (marker) {
          marker.style.opacity = "0";
        }
        previousPaceAnimationFrameRef.current = window.requestAnimationFrame(animatePreviousPaceMarker);
        return;
      }

      const liveElapsedSeconds = Math.max(0, (Date.now() - startedAtMs) / 1000);
      const interpolatedIndex = getInterpolatedPreviousPaceIndex(timeline, liveElapsedSeconds);

      if (interpolatedIndex === null || comparison.characters.length === 0) {
        marker.style.opacity = "0";
        previousPaceAnimationFrameRef.current = window.requestAnimationFrame(animatePreviousPaceMarker);
        return;
      }

      const maxIndex = Math.max(0, comparison.characters.length - 1);
      const boundedIndex = Math.max(0, Math.min(interpolatedIndex, maxIndex));
      const baseIndex = Math.floor(boundedIndex);
      const fraction = boundedIndex - baseIndex;
      const currentCharacter = characterRefs.current[baseIndex];
      const nextCharacter = characterRefs.current[Math.min(baseIndex + 1, maxIndex)] ?? currentCharacter;

      if (!currentCharacter || !nextCharacter || !container.contains(currentCharacter) || !container.contains(nextCharacter)) {
        marker.style.opacity = "0";
        previousPaceAnimationFrameRef.current = window.requestAnimationFrame(animatePreviousPaceMarker);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const currentRect = currentCharacter.getBoundingClientRect();
      const nextRect = nextCharacter.getBoundingClientRect();
      const x = currentRect.left - containerRect.left + (nextRect.left - currentRect.left) * fraction;
      const y = currentRect.top - containerRect.top + (nextRect.top - currentRect.top) * fraction;

      marker.dataset.characterIndex = String(Math.round(boundedIndex));
      marker.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      marker.style.opacity = "1";
      previousPaceAnimationFrameRef.current = window.requestAnimationFrame(animatePreviousPaceMarker);
    };

    previousPaceAnimationFrameRef.current = window.requestAnimationFrame(animatePreviousPaceMarker);
    const markerToReset = previousPaceMarkerRef.current;

    return () => {
      if (previousPaceAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(previousPaceAnimationFrameRef.current);
        previousPaceAnimationFrameRef.current = null;
      }
      if (markerToReset) {
        markerToReset.style.opacity = "0";
      }
    };
  }, [
    comparison.characters.length,
    isResultModalOpen,
    previousResult?.previousPaceTimeline,
    shouldShowPreviousPaceMarker,
    typedText
  ]);

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
    if (
      !passage ||
      isFinished ||
      finishedRef.current ||
      (!isRunning && rules.requireTabToStart && !isInputActivatedRef.current)
    ) {
      return;
    }

    if (!isRunning) {
      const now = Date.now();
      finishedRef.current = false;
      activeAttemptIdRef.current = createClientAttemptId();
      statusRef.current = "running";
      startedAtRef.current = now;
      attemptTimelineRef.current = [];
      attemptErrorEventsRef.current = [];
      activeErrorIndexesRef.current = new Set();
      typedCharacterDelaysRef.current = [];
      lastTypedCharacterAtRef.current = null;
      elapsedSecondsRef.current = 0;
      setElapsedSeconds(0);
      setAttemptTimeline([]);
      setAttemptErrorEvents([]);
      setProgressMilestones([]);
      setStartedAt(now);
      setFinishedAt(null);
      setRemainingSeconds(isTimedMode ? durationSeconds : 0);
      setLastResult(null);
      isResultModalOpenRef.current = false;
      setIsResultModalOpen(false);
      isInputActivatedRef.current = true;
      setIsInputActivated(true);
      setStatus("running");
    }

    setTypedText((previous) => {
      const nextValue = enforceBackspacePolicy(previous, value, rules.allowBackspace);
      const didTypingChange = nextValue !== previous;
      recordTypedCharacterDelays(previous, nextValue);
      if (isSuspiciousInputChange(previous, nextValue, elapsedSecondsRef.current)) {
        markAttemptSuspicious();
      }
      typedTextRef.current = nextValue;
      recordHistoricalErrors(nextValue);
      recordAttemptTimelinePoint(elapsedSecondsRef.current, nextValue);
      if (didTypingChange) {
        playPendingKeyboardSound();
      }
      return nextValue;
    });
  }

  function recordHistoricalErrors(nextValue: string) {
    const nextComparison = validateTypedText({ targetText: sourceText, typedText: nextValue, rules });
    const nextActiveErrors = new Set<number>();
    let didAddError = false;

    nextComparison.characters.forEach((character) => {
      if ((character.status !== "wrong" && character.status !== "extra") || !character.actual) return;
      nextActiveErrors.add(character.index);
      if (activeErrorIndexesRef.current.has(character.index)) return;

      const sessionStartedAt = startedAtRef.current;
      attemptErrorEventsRef.current.push({
        timeSeconds: sessionStartedAt === null ? 0.1 : Math.max(0.1, (Date.now() - sessionStartedAt) / 1000),
        characterIndex: character.index
      });
      didAddError = true;
    });

    activeErrorIndexesRef.current = nextActiveErrors;
    if (didAddError) setAttemptErrorEvents([...attemptErrorEventsRef.current]);
  }

  function syncChineseTextareaValue(source: "input" | "compositionend-fallback") {
    const textareaValue = chineseImeInputRef.current?.value ?? "";
    const nextValue = getChineseComparableInput(textareaValue, passage);

    if (
      !passage ||
      isFinished ||
      finishedRef.current ||
      (rules.requireTabToStart && !isInputActivatedRef.current)
    ) {
      return;
    }

    if (!isRunning && nextValue.length === 0) {
      logImeAction("sync-skip-no-accepted-text", {
        source,
        processed: false,
        textareaValue
      });
      return;
    }

    if (!isRunning && isChinesePassage) {
      const nextComparison = validateTypedText({ targetText: sourceText, typedText: nextValue, rules });
      if (nextComparison.correctCharacters === 0) {
        logImeAction("sync-skip-no-target-progress", {
          source,
          processed: false,
          textareaValue
        });
        return;
      }
    }

    logImeAction("sync-textarea-value", {
      source,
      processed: true,
      textareaLength: textareaValue.length,
      comparableLength: nextValue.length
    });

    handleTyping(nextValue);
  }

  function logImeAction(action: string, details: Record<string, unknown> = {}) {
    if (!shouldTraceIme) {
      return;
    }

    imeDebugSequenceRef.current += 1;
    console.info("[Typing Station IME]", {
      sequence: imeDebugSequenceRef.current,
      eventType: action,
      timestamp: Date.now(),
      transactionId: chineseCompositionSequenceRef.current,
      sessionGenerationId: activeSessionGenerationRef.current,
      isComposingRef: isComposingRef.current,
      explicitCompositionActive: explicitCompositionActiveRef.current,
      awaitingFinalCommit: awaitingChineseFinalCommitRef.current,
      refValue: chineseImeInputRef.current?.value ?? "",
      fallbackPending: chineseImeFallbackTimeoutRef.current !== null,
      ...details
    });
  }

  function logImeEvent(eventType: string, event: React.SyntheticEvent<HTMLTextAreaElement>) {
    if (!shouldTraceIme) {
      return;
    }

    const nativeEvent = event.nativeEvent as InputEvent & CompositionEvent & { isComposing?: boolean };
    const syntheticEvent = event as React.SyntheticEvent<HTMLTextAreaElement> & {
      data?: string;
      inputType?: string;
      isComposing?: boolean;
    };

    imeDebugSequenceRef.current += 1;
    console.info("[Typing Station IME]", {
      sequence: imeDebugSequenceRef.current,
      eventType,
      timestamp: Date.now(),
      transactionId: chineseCompositionSequenceRef.current,
      sessionGenerationId: activeSessionGenerationRef.current,
      data: syntheticEvent.data,
      nativeData: nativeEvent.data,
      inputType: syntheticEvent.inputType ?? nativeEvent.inputType,
      isComposingRef: isComposingRef.current,
      explicitCompositionActive: explicitCompositionActiveRef.current,
      awaitingFinalCommit: awaitingChineseFinalCommitRef.current,
      isComposing: syntheticEvent.isComposing,
      nativeIsComposing: nativeEvent.isComposing,
      currentTargetValue: event.currentTarget.value,
      refValue: chineseImeInputRef.current?.value ?? inputRef.current?.value ?? "",
      fallbackPending: chineseImeFallbackTimeoutRef.current !== null
    });
  }

  function handleChineseImeKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    logImeEvent("keydown", event);
    if (
      isPassageLoading ||
      isFinished ||
      finishedRef.current ||
      (!isRunning && rules.requireTabToStart && !isInputActivatedRef.current)
    ) {
      pendingSoundKeyTypeRef.current = null;
      event.preventDefault();
      return;
    }

    if (!rules.allowBackspace && event.key === "Backspace") {
      event.preventDefault();
    }
  }

  function handleChineseCompositionStart(event: React.CompositionEvent<HTMLTextAreaElement>) {
    logImeEvent("compositionstart", event);
    cancelPendingChineseImeFallback();
    chineseCompositionSequenceRef.current += 1;
    awaitingChineseFinalCommitRef.current = false;
    explicitCompositionActiveRef.current = true;
    isComposingRef.current = true;
  }

  function handleChineseCompositionUpdate(event: React.CompositionEvent<HTMLTextAreaElement>) {
    logImeEvent("compositionupdate", event);
    explicitCompositionActiveRef.current = true;
    isComposingRef.current = true;
  }

  function handleChineseBeforeInput(event: React.FormEvent<HTMLTextAreaElement>) {
    logImeEvent("beforeinput", event);
  }

  function handleChineseInput(event: React.FormEvent<HTMLTextAreaElement>) {
    logImeEvent("input", event);
    if (explicitCompositionActiveRef.current || isComposingRef.current) {
      return;
    }

    cancelPendingChineseImeFallback();
    awaitingChineseFinalCommitRef.current = false;
    syncChineseTextareaValue("input");
  }

  function handleChineseChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    logImeEvent("change", event);
  }

  function handleChineseCompositionEnd(event: React.CompositionEvent<HTMLTextAreaElement>) {
    logImeEvent("compositionend", event);
    explicitCompositionActiveRef.current = false;
    isComposingRef.current = false;
    awaitingChineseFinalCommitRef.current = true;
    const sessionGenerationId = activeSessionGenerationRef.current;
    cancelPendingChineseImeFallback();
    chineseImeFallbackTimeoutRef.current = window.setTimeout(() => {
      chineseImeFallbackTimeoutRef.current = null;
      if (sessionGenerationId !== activeSessionGenerationRef.current) {
        logImeAction("fallback-skip-stale-session", {
          sessionGenerationId,
          processed: false
        });
        return;
      }

      syncChineseTextareaValue("compositionend-fallback");
      if (sessionGenerationId === activeSessionGenerationRef.current) {
        awaitingChineseFinalCommitRef.current = false;
      }
    }, 0);
    logImeAction("fallback-scheduled", { sessionGenerationId });
  }

  function recordTypedCharacterDelays(previousValue: string, nextValue: string) {
    if (nextValue.length <= previousValue.length) {
      typedCharacterDelaysRef.current = typedCharacterDelaysRef.current.slice(0, nextValue.length);
      lastTypedCharacterAtRef.current = Date.now();
      return;
    }

    const now = Date.now();
    const previousTimestamp = lastTypedCharacterAtRef.current ?? startedAtRef.current ?? now;
    const addedCharacters = nextValue.length - previousValue.length;
    const delay = Math.max(0, now - previousTimestamp);

    typedCharacterDelaysRef.current = [
      ...typedCharacterDelaysRef.current.slice(0, previousValue.length),
      ...Array.from({ length: addedCharacters }, (_, index) => (index === 0 ? delay : 0))
    ];
    lastTypedCharacterAtRef.current = now;
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    pendingSoundKeyTypeRef.current = null;
    event.preventDefault();
  }

  function playPendingKeyboardSound() {
    const keyType = pendingSoundKeyTypeRef.current;
    pendingSoundKeyTypeRef.current = null;

    if (!keyType || statusRef.current !== "running") {
      return;
    }

    keyboardSoundPlayerRef.current.play(keyboardSoundSettingRef.current, keyType, keyboardSoundVolumeRef.current);
  }

  function markAttemptSuspicious() {
    suspiciousAttemptRef.current = true;
    setIsAttemptSuspicious(true);
  }

  async function handlePracticeMode(modeId: PracticeModeId) {
    const nextMode = getPracticeMode(modeId);
    const nextIsTimedMode = isTimedPracticeMode(nextMode);
    const nextDurationSeconds = nextIsTimedMode ? nextMode.seconds : 60;
    const nextTextMode: StoredPassageTextMode = nextIsTimedMode ? "timed" : "single";

    resetSession();
    setPracticeModeId(modeId);
    setRemainingSeconds(nextIsTimedMode ? nextMode.seconds : 0);
    if (trainingMode) {
      const nextPassage = buildTrainingModePassage(trainingMode, nextDurationSeconds);
      setPassage(nextPassage);
      setSelectedCategoryState(nextPassage.category);
      setSelectedPassageId(trainingMode.passageId);
      setPreviousResult(readPreviousResult(nextPassage.id, previousResultScope));
      return;
    }

    const activeLibrary = libraryRef.current.length > 0 ? libraryRef.current : await loadActivePassageLibrary();
    setAvailableLibrary(activeLibrary);
    choosePracticePassage({
      library: activeLibrary,
      category: selectedCategory,
      duration: nextDurationSeconds,
      textMode: nextTextMode,
      language: practiceLanguage,
      preferredPassageId: selectedPassageId
    });
  }

  async function handlePracticeLanguage(language: PassageLanguage) {
    if (language === practiceLanguage || trainingMode) {
      return;
    }

    resetSession();
    setPracticeLanguage(language);
    setSelectedLanguage(language);
    setSelectedCategoryState(ALL_FILTER);
    setSelectedCategory(ALL_FILTER);
    setSelectedPassageId(RANDOM_PASSAGE_ID);
    setPassageSelectionMode("random");

    const activeLibrary = libraryRef.current.length > 0 ? libraryRef.current : await loadActivePassageLibrary();
    setAvailableLibrary(activeLibrary);
    choosePracticePassage({
      library: activeLibrary,
      category: ALL_FILTER,
      duration: durationSeconds,
      textMode: passageTextMode,
      language,
      preferredPassageId: RANDOM_PASSAGE_ID
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
      language: practiceLanguage,
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
      language: practiceLanguage,
      preferredPassageId: passageId
    });
  }

  function loadNextPassage() {
    if (!passage) {
      return;
    }

    resetSession();
    if (trainingMode) {
      const nextPassage = buildTrainingModePassage(trainingMode, durationSeconds);
      setPassage(nextPassage);
      setPreviousResult(readPreviousResult(nextPassage.id, previousResultScope));
      return;
    }

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
      setPreviousResult(readPreviousResult(nextPassage.id, previousResultScope));
      writeStoredPassage(nextPassage);
      return;
    }

    const nextPassage: StoredPassage = {
      id: `generated-${Date.now()}`,
      title: `${passage.category} generated practice`,
      category: passage.category,
      style: passage.style,
      language: passage.language ?? practiceLanguage,
      source: "generated",
      text: buildPracticePassage(passage.category, durationSeconds),
      updatedAt: new Date().toISOString()
    };
    setPassageNotice("No active saved passages found. Using a sample passage.");
    setSelectedPassageId(RANDOM_PASSAGE_ID);
    setPassage(nextPassage);
    setPreviousResult(readPreviousResult(nextPassage.id, previousResultScope));
    writeStoredPassage(nextPassage);
  }

  function loadRandomPassage() {
    if (!passage) {
      return;
    }

    if (trainingMode) {
      loadNextPassage();
      return;
    }

    resetSession();
    setPassageSelectionMode("random");
    const library = getFilteredLibrary();
    setSelectedPassageId(RANDOM_PASSAGE_ID);

    if (library.length === 0) {
      const defaultPassage = practiceLanguage === "english" ? getDefaultPassage(durationSeconds) : readStoredPassage(durationSeconds);
      setPassageNotice("No active saved passages found. Using a sample passage.");
      setPassage(defaultPassage);
      setPreviousResult(readPreviousResult(defaultPassage.id, previousResultScope));
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
    setPreviousResult(readPreviousResult(randomPassage.id, previousResultScope));
    writeStoredPassage(randomPassage);
  }

  async function loadActivePassageLibrary(): Promise<LibraryPassage[]> {
    if (libraryRef.current.length > 0) {
      return libraryRef.current;
    }

    if (libraryLoadPromiseRef.current) {
      return libraryLoadPromiseRef.current;
    }

    const loadPromise = (async () => {
      try {
        const supabaseLibrary = await getSupabasePassageLibrary();
        if (supabaseLibrary.length > 0) {
          const activeLibrary = withBuiltInSamplePassages(supabaseLibrary);
          libraryRef.current = activeLibrary;
          return activeLibrary;
        }
      } catch {
        // Fall through to local active passages.
      }

      const localLibrary = getActivePassageLibrary();
      libraryRef.current = localLibrary;
      return localLibrary;
    })();

    libraryLoadPromiseRef.current = loadPromise;
    try {
      return await loadPromise;
    } finally {
      if (libraryLoadPromiseRef.current === loadPromise) {
        libraryLoadPromiseRef.current = null;
      }
    }
  }

  function getFilteredLibrary() {
    const activeLibrary = libraryRef.current.length > 0 ? libraryRef.current : getActivePassageLibrary();
    return filterLibraryByCategory(filterLibraryPassagesByLanguage(activeLibrary, practiceLanguage), selectedCategory);
  }

  const isCompactPractice = !trainingMode;

  return (
    <AppShell topAd={false} sideAd={false} focusMode={isFocusMode} compact={isCompactPractice}>
      <section className="mx-auto min-w-0 w-[calc(100vw-2.5rem)] max-w-6xl overflow-x-hidden sm:w-full">
        <h1 className="sr-only">{trainingMode?.pageTitle ?? "Practice"}</h1>

        {passageNotice && (
          <div className={clsx("mb-5 rounded-md border border-brass/25 bg-brass/10 px-4 py-3 font-mono text-body text-brass", isFocusMode && "invisible pointer-events-none")}>
            {passageNotice}
          </div>
        )}

        {shouldShowTypingHeader && (
          <section
            data-testid="practice-header"
            className={clsx(
              isCompactPractice
                ? "mx-auto mb-2 grid max-w-5xl grid-cols-1 items-start gap-x-3 gap-y-1 text-center sm:grid-cols-[minmax(0,1fr)_auto]"
                : "mx-auto mb-3 grid max-w-5xl grid-cols-1 items-start gap-x-4 gap-y-1.5 text-center sm:grid-cols-[minmax(0,1fr)_auto]",
              isFocusMode && "invisible pointer-events-none"
            )}
          >
            <div className="min-w-0">
              {trainingMode?.controls}

              {shouldShowPracticeHeader && (
                <>
                  <div
                    data-testid="practice-controls"
                    className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-1 font-mono text-control"
                  >
                    {!trainingMode && (
                      <TextChoiceGroup label="Practice language" icon={<Languages className="icon-control" />}>
                        {(["english", "chinese"] as const).map((language) => (
                          <TextChoiceButton
                            key={language}
                            selected={practiceLanguage === language}
                            disabled={isPassageLoading}
                            onClick={() => handlePracticeLanguage(language)}
                          >
                            {language === "english" ? "English" : "Chinese"}
                          </TextChoiceButton>
                        ))}
                      </TextChoiceGroup>
                    )}

                    {!trainingMode?.hidePassageControls && (
                      <>
                        <PracticeControlSeparator />
                        <TextChoiceGroup label="Practice passage source">
                          <TextChoiceButton
                            selected={selectedPassageId === RANDOM_PASSAGE_ID}
                            disabled={isRunning || isPassageLoading}
                            onClick={loadRandomPassage}
                            icon={<Shuffle className="icon-control" />}
                          >
                            Random
                          </TextChoiceButton>
                          <Link
                            href={`/passages?language=${practiceLanguage}`}
                            className="inline-flex min-h-7 items-center gap-1 px-1.5 py-1 text-control text-paper/45 outline-none transition hover:text-paper/80 focus-visible:text-brass focus-visible:ring-1 focus-visible:ring-brass/60"
                          >
                            <BookOpenText className="icon-inline" aria-hidden="true" />
                            Library
                          </Link>
                        </TextChoiceGroup>
                      </>
                    )}

                    {!trainingMode?.hidePracticeModeControls && (
                      <>
                        <PracticeControlSeparator />
                        <TextChoiceGroup label="Practice duration" icon={<Clock3 className="icon-control" />}>
                          {PRACTICE_MODE_OPTIONS.map((mode) => (
                            <TextChoiceButton
                              key={mode.id}
                              selected={practiceModeId === mode.id}
                              disabled={isRunning || isPassageLoading}
                              onClick={() => handlePracticeMode(mode.id)}
                            >
                              {mode.label}
                            </TextChoiceButton>
                          ))}
                        </TextChoiceGroup>
                      </>
                    )}
                  </div>

                  {!trainingMode?.hideMetadata && (
                    <p className="mx-auto mt-1 max-w-4xl truncate px-1 font-mono text-secondary text-paper/40" data-testid="practice-passage-metadata">
                      {passage ? `${formatPassageResultMetadata(passage)} · ${modeLabel}` : "Resolving passage..."}
                    </p>
                  )}
                </>
              )}
            </div>

          </section>
        )}

        <div
          tabIndex={0}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === "Tab" && rules.requireTabToStart && status === "idle") {
              event.preventDefault();
              isInputActivatedRef.current = true;
              setIsInputActivated(true);
              if (shouldUseChineseImeSink) {
                startSession();
                chineseImeInputRef.current?.focus({ preventScroll: true });
                return;
              }
              inputRef.current?.focus({ preventScroll: true });
            }
          }}
          className={clsx(
            "formaltype-practice-shell relative mx-auto flex w-full flex-col overflow-hidden outline-none transition-all duration-300 focus:ring-brass/30",
            isCompactPractice
              ? "h-[64vh] h-[64dvh] max-h-[64vh] max-h-[64dvh] max-w-5xl p-2 md:h-[72vh] md:h-[72dvh] md:max-h-[76vh] md:max-h-[76dvh] md:p-3"
              : "h-[60vh] h-[60dvh] max-h-[60vh] max-h-[60dvh] max-w-5xl rounded-lg bg-paper/[0.025] p-3 md:h-[68vh] md:h-[68dvh] md:max-h-[72vh] md:max-h-[72dvh] md:p-5"
          )}
          data-focus-mode={isFocusMode ? "true" : "false"}
        >
          {isFocusMode && <div className={clsx("pointer-events-none absolute z-10", isCompactPractice ? "left-2 top-2" : "left-4 top-3")}><TypingTimer value={formatTime(clockSeconds)} compact={isCompactPractice} /></div>}
          <div
            ref={typingWindowRef}
            data-testid={shouldUseChineseImeSink ? "chinese-target-viewport" : "typing-viewport"}
            className={clsx(
              "typing-scrollbar mx-auto h-full min-h-0 w-full max-w-5xl flex-1 overflow-y-auto overscroll-contain transition",
              isCompactPractice ? "px-2 py-2 md:px-4 md:py-4" : "rounded-md px-3 py-3 md:px-6 md:py-5"
            )}
          >
            <div
              ref={typingTextRef}
              className={clsx(
                "relative mx-auto",
                passage?.displayTokens?.length ? "w-fit max-w-full" : `formaltype-typing-width-${themeSettings.typingWidth}`
              )}
              data-testid="typing-text-container"
            >
              <p
                data-testid="typing-character-layer"
                className={clsx(
                  "whitespace-pre-wrap break-words text-paper/45",
                  `formaltype-typing-font-${themeSettings.typingFont}`,
                  `formaltype-typing-size-${themeSettings.typingTextSize}`,
                  `formaltype-typing-colors-${themeSettings.typingColorStyle}`,
                  isRunning && "text-paper/50"
                )}
              >
                {isPassageLoading ? (
                  <PassageLoadingPlaceholder />
                ) : (
                  <>
                    {passage?.displayTokens?.length ? (
                      <TrainingTokenCharacterLayer
                        characters={comparison.characters}
                        tokens={passage.displayTokens}
                        setCharacterRef={setCharacterRef}
                        showMistakes={rules.showMistakesImmediately || isFinished}
                        themeSettings={themeSettings}
                      />
                    ) : comparison.characters.map((character, index) => {
                      const isCurrent = character.status === "current";
                      const isLineBreak = character.expected === "\n" || character.actual === "\n";

                      if (isLineBreak) {
                        return (
                          <Fragment key={`${character.index}-${index}-${character.expected}-${character.actual}`}>
                            <span
                              ref={setCharacterRef(index, isCurrent)}
                              data-index={index}
                              aria-label={character.status === "wrong" ? "Missed line break" : "Line break"}
                              className={clsx(
                                "inline-block min-w-[0.7em]",
                                characterClass(character.status, rules.showMistakesImmediately || isFinished, themeSettings),
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
                          ref={setCharacterRef(index, isCurrent)}
                          data-index={index}
                          className={clsx(characterClass(character.status, rules.showMistakesImmediately || isFinished, themeSettings))}
                        >
                          {character.actual || character.expected}
                        </span>
                      );
                    })}
                  </>
                )}
              </p>
              {shouldShowPreviousPaceMarker && <PreviousPaceMarker ref={previousPaceMarkerRef} />}
            </div>
          </div>

          {shouldUseChineseImeSink ? (
            <div data-testid="chinese-input-area" className="mx-auto w-full max-w-5xl flex-none pt-3">
              <textarea
                ref={(node) => {
                  chineseImeInputRef.current = node;
                  inputRef.current = node;
                }}
                disabled={isPassageLoading || isFinished}
                onKeyDown={handleChineseImeKeyDown}
                onPaste={handlePaste}
                onCompositionStart={handleChineseCompositionStart}
                onCompositionUpdate={handleChineseCompositionUpdate}
                onBeforeInput={handleChineseBeforeInput}
                onInput={handleChineseInput}
                onChange={handleChineseChange}
                onCompositionEnd={handleChineseCompositionEnd}
                className={clsx(
                  "block min-h-[104px] w-full resize-none rounded-md border border-paper/10 bg-paper/[0.035] px-3 py-2 font-mono text-lg leading-relaxed text-paper/85 caret-brass outline-none transition placeholder:text-paper/25 focus:border-brass/45 focus:bg-paper/[0.055]",
                  `formaltype-typing-font-${themeSettings.typingFont}`
                )}
                aria-label="Typing input"
                placeholder="請在此按 Tab 後開始輸入"
                spellCheck={false}
              />
            </div>
          ) : (
            <textarea
              ref={inputRef}
              value={typedText}
              disabled={isPassageLoading || isFinished}
              onKeyDown={(event) => {
                if (
                  isPassageLoading ||
                  isFinished ||
                  finishedRef.current ||
                  (!isRunning && rules.requireTabToStart && !isInputActivated)
                ) {
                  pendingSoundKeyTypeRef.current = null;
                  event.preventDefault();
                  return;
                }
                if (!rules.allowBackspace && event.key === "Backspace") {
                  pendingSoundKeyTypeRef.current = null;
                  event.preventDefault();
                  return;
                }
                pendingSoundKeyTypeRef.current =
                  (isRunning || isInputActivatedRef.current) && isTypingSoundKey(event.nativeEvent)
                    ? getKeyboardSoundKeyType(event.key)
                    : null;
                if (event.key === "Backspace" && typedTextRef.current.length === 0) {
                  pendingSoundKeyTypeRef.current = null;
                }
              }}
              onPaste={handlePaste}
              onChange={(event) => handleTyping(event.target.value)}
              className="absolute inset-0 h-full w-full resize-none opacity-0"
              aria-label="Typing input"
              spellCheck={false}
            />
          )}
        </div>

        {(status === "idle" || isFocusMode) && (
          <div className={clsx("flex flex-wrap items-center font-mono text-paper/30", isCompactPractice ? "mt-2 gap-2 text-secondary" : "mt-3 gap-3 text-utility")}>
            {isCompactPractice && <KeyboardIcon className="icon-inline text-paper/25" aria-hidden="true" />}
            {status === "idle" || !shouldUseChineseImeSink ? (
              isTouchFirstInput ? (
                <span>Tap to start</span>
              ) : (
                <>
                  <span>Tab = start</span>
                  <span>Tab + Enter = restart</span>
                  <span>Esc = finish</span>
                </>
              )
            ) : <span>Timer running</span>}
          </div>
        )}

        <div
          data-testid={trainingMode ? "training-ad-slot" : "practice-ad-slot"}
          className={clsx(isCompactPractice ? "mt-4" : "mt-6", isFocusMode && "invisible pointer-events-none")}
        >
          <AdPlaceholder variant="banner" />
        </div>

        {lastResult && passage && (
          <ResultsPanel
            result={lastResult}
            metricLabel={getMetricLabel(passage)}
            onRestart={resetSession}
            onNextPassage={loadNextPassage}
            restartButtonRef={resultPanelRestartButtonRef}
            compact={isCompactPractice}
          />
        )}
        {lastResult && passage && isResultModalOpen && (
          <ResultModal
            result={lastResult}
            passage={passage}
            onRestart={resetSession}
            onNextPassage={loadNextPassage}
            previousResult={previousResult}
            recentResults={user ? recentResults : null}
            progressMilestones={progressMilestones}
            attemptTimeline={attemptTimeline}
            errorEvents={attemptErrorEvents}
            modeLabel={modeLabel}
            isSuspicious={isAttemptSuspicious}
            cloudSaveState={cloudSaveState}
            onClose={closeResultModal}
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

function TextChoiceGroup({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
      {icon && <span className="grid h-5 w-5 place-items-center text-paper/25" aria-hidden="true">{icon}</span>}
      {children}
    </div>
  );
}

function TextChoiceButton({
  selected,
  disabled,
  onClick,
  icon,
  children
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "inline-flex min-h-7 items-center px-1.5 py-1 text-control outline-none transition disabled:cursor-not-allowed disabled:opacity-45 focus-visible:text-brass focus-visible:ring-1 focus-visible:ring-brass/60",
        selected ? "text-brass" : "text-paper/45 hover:text-paper/75"
      )}
    >
      {icon && <span className="mr-1 inline-grid place-items-center" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
}

function PracticeControlSeparator() {
  return <span className="h-3 w-px bg-paper/10" aria-hidden="true" />;
}

function TrainingTokenCharacterLayer({
  characters,
  tokens,
  setCharacterRef,
  showMistakes,
  themeSettings
}: {
  characters: CharacterComparison[];
  tokens: string[];
  setCharacterRef: (index: number, isCurrent: boolean) => (node: HTMLSpanElement | null) => void;
  showMistakes: boolean;
  themeSettings: ThemeSettings;
}) {
  let characterIndex = 0;

  return (
    <>
      {tokens.map((token, tokenIndex) => {
        const tokenCharacters = Array.from(token).map((_, offset) => {
          const comparisonIndex = characterIndex + offset;
          const character = characters[comparisonIndex];
          const isCurrent = character?.status === "current";

          if (!character) {
            return null;
          }

          return (
            <span
              key={`${character.index}-${comparisonIndex}-${character.expected}-${character.actual}`}
              ref={setCharacterRef(comparisonIndex, isCurrent)}
              data-index={comparisonIndex}
              className={clsx(characterClass(character.status, showMistakes, themeSettings))}
            >
              {character.actual || character.expected}
            </span>
          );
        });
        characterIndex += token.length;

        return (
          <span key={`${token}-${tokenIndex}`} data-testid="training-token" className="mr-[0.9em] inline-block">
            {tokenCharacters}
          </span>
        );
      })}
      {characters.slice(characterIndex).map((character, offset) => {
        const comparisonIndex = characterIndex + offset;

        return (
          <span
            key={`${character.index}-${comparisonIndex}-${character.expected}-${character.actual}`}
            ref={setCharacterRef(comparisonIndex, character.status === "current")}
            data-index={comparisonIndex}
            className={clsx(characterClass(character.status, showMistakes, themeSettings))}
          >
            {character.actual || character.expected}
          </span>
        );
      })}
    </>
  );
}

const PreviousPaceMarker = React.forwardRef<HTMLSpanElement>(function PreviousPaceMarker(_, ref) {
  return (
    <span
      data-testid="previous-pace-marker"
      data-character-index="0"
      aria-hidden="true"
      ref={ref}
      className="formaltype-previous-pace-marker"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        display: "block",
        width: 2,
        height: "0.95em",
        transform: "translate3d(0px, 0px, 0)",
        transition: "opacity 120ms ease",
        opacity: 0,
        pointerEvents: "none",
        willChange: "transform"
      }}
    />
  );
});

function Metric({ label, value, flat = false }: { label: string; value: string | number; flat?: boolean }) {
  return (
    <div className={flat ? "border-t border-paper/10 px-1 py-2" : "rounded-md bg-paper/[0.035] px-4 py-3"}>
      <div className={clsx("font-mono uppercase text-paper/40", flat ? "text-secondary" : "text-secondary")}>{label}</div>
      <div className={clsx("font-mono font-semibold text-paper", flat ? "mt-0.5 text-xl md:text-2xl" : "mt-1 text-2xl md:text-3xl")}>{value}</div>
    </div>
  );
}

function getCategoryOptions(library: LibraryPassage[], language: PassageLanguage): PracticeCategory[] {
  const languageLibrary = filterLibraryPassagesByLanguage(library, language);
  return Array.from(new Set(languageLibrary.map((libraryPassage) => libraryPassage.category))).sort();
}

function getInitialCategory(library: LibraryPassage[], language: PassageLanguage): CategoryFilter {
  const storedCategory = getSelectedCategory();
  const categories = getCategoryOptions(library, language);

  if (storedCategory === ALL_FILTER || categories.includes(storedCategory as PracticeCategory)) {
    return storedCategory;
  }

  return ALL_FILTER;
}

function filterLibraryByCategory(library: LibraryPassage[], category: CategoryFilter) {
  return filterLibraryPassages(library, category, ALL_FILTER);
}

function getPreviousResultScope(duration: number, textMode: StoredPassageTextMode): PreviousResultScope {
  return textMode === "single" ? "infinite" : duration;
}

function buildTrainingModePassage(trainingMode: PracticeTrainingMode, durationSeconds: number): StoredPassage {
  const session = trainingMode.session;

  return trainingMode.buildPassage({
    durationSeconds,
    wordCount: session.kind === "words" ? session.wordCount : undefined,
    mode: session.kind
  });
}

function ResultsPanel({
  result,
  metricLabel,
  onRestart,
  onNextPassage,
  restartButtonRef,
  compact = false
}: {
  result: TypingResult;
  metricLabel: string;
  onRestart: () => void;
  onNextPassage: () => void;
  restartButtonRef: React.RefObject<HTMLButtonElement>;
  compact?: boolean;
}) {
  return (
    <section className={compact ? "mt-4 border-t border-paper/[0.08] pt-3" : "mt-6 rounded-lg bg-paper/[0.025] p-4 md:p-5"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={clsx("font-mono uppercase text-brass", compact ? "text-secondary" : "text-utility")}>Result</p>
          <h2 className={clsx("font-semibold text-paper", compact ? "mt-0.5 text-section" : "mt-1 text-page")}>{getCompletionLabel(result.completionReason)}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            ref={restartButtonRef}
            type="button"
            onClick={onRestart}
            className={clsx("inline-flex items-center rounded-md font-mono text-control text-paper/65 transition hover:bg-paper/[0.06] hover:text-paper", compact ? "min-h-8 gap-1.5 px-2.5" : "gap-2 bg-paper/[0.045] px-3 py-2")}
          >
            <RotateCcw className="icon-control" aria-hidden="true" />
            Restart
          </button>
          <button
            type="button"
            onClick={onNextPassage}
            className={clsx("inline-flex items-center rounded-md bg-brass/10 font-mono text-control text-brass transition hover:bg-brass/15", compact ? "min-h-8 gap-1.5 px-2.5" : "gap-2 px-3 py-2")}
          >
            <RefreshCw className="icon-control" aria-hidden="true" />
            Next passage
          </button>
        </div>
      </div>
      <div className={clsx("grid grid-cols-2 md:grid-cols-4", compact ? "mt-3 gap-x-3" : "mt-4 gap-2")}>
        <Metric label={metricLabel} value={result.wpm.toFixed(1)} flat={compact} />
        <Metric label="Accuracy" value={`${result.accuracy.toFixed(2)}%`} flat={compact} />
        <Metric label="Time" value={formatTime(result.timeUsedSeconds)} flat={compact} />
        <Metric label="Mistakes" value={result.incorrectCharacters} flat={compact} />
      </div>
    </section>
  );
}

function getMetricLabel(passage: StoredPassage | null | undefined) {
  return "WPM";
}

function getChineseComparableInput(value: string, passage: StoredPassage | null) {
  if (passage?.category === "training_chinese") {
    return Array.from(value).filter((character) => HAN_CHARACTER_PATTERN.test(character)).join("");
  }

  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function ResultModal({
  result,
  passage,
  onRestart,
  onNextPassage,
  previousResult,
  recentResults,
  progressMilestones = EMPTY_CELEBRATION_MILESTONES,
  attemptTimeline,
  errorEvents = [],
  modeLabel,
  isSuspicious = false,
  cloudSaveState = "idle",
  onGenerateImageCard = generateResultImageCard,
  onClose
}: {
  result: TypingResult;
  passage: StoredPassage;
  onRestart: () => void;
  onNextPassage: () => void;
  previousResult: PreviousTypingResult | null;
  recentResults: SupabaseOwnTypingResultRow[] | null;
  progressMilestones?: CelebrationMilestone[];
  attemptTimeline: AttemptTimelinePoint[];
  errorEvents?: AttemptErrorEvent[];
  modeLabel: string;
  isSuspicious?: boolean;
  cloudSaveState?: CloudSaveState;
  onGenerateImageCard?: (input: ResultImageCardInput) => Promise<void> | void;
  onClose: () => void;
}) {
  const completionLabel = getCompletionLabel(result.completionReason);
  const hasSavedHistory = recentResults !== null;
  const [imageCardError, setImageCardError] = useState("");
  const [isGeneratingImageCard, setIsGeneratingImageCard] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus({ preventScroll: true });

    function handleDialogKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ?? []
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDialogKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);
  const historySeries = hasSavedHistory
    ? buildResultHistorySeries({
        recentResults,
        result,
        previousResult,
        includeCurrent: !isSuspicious
      })
    : [];
  const milestones = useMemo(
    () => buildCelebrationMilestones(result, previousResult, progressMilestones),
    [progressMilestones, result, previousResult]
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/85 px-3 py-3 backdrop-blur md:px-4">
      <CelebrationToast milestones={milestones} />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-dialog-title"
        aria-describedby="result-dialog-description"
        tabIndex={-1}
        className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-brass/25 bg-ink-900 shadow-glow"
      >
        <div className="sticky top-0 z-10 border-b border-paper/10 bg-ink-900/95 px-4 py-3 backdrop-blur md:px-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-utility uppercase text-brass">Result</p>
              <h2 id="result-dialog-title" className="mt-0.5 text-page font-semibold leading-tight text-paper">{completionLabel}</h2>
              <div id="result-dialog-description" className="mt-1.5 truncate font-mono text-utility text-paper/45 md:text-body">
                {formatPassageResultMetadata(passage)}
              </div>
              {cloudSaveState !== "idle" && (
                <p
                  role={cloudSaveState === "failed" ? "alert" : "status"}
                  aria-live="polite"
                  className={`mt-2 font-mono text-utility ${cloudSaveState === "failed" ? "text-ember" : cloudSaveState === "saved" ? "text-mint" : "text-paper/45"}`}
                >
                  {cloudSaveState === "saving"
                    ? "Saving result…"
                    : cloudSaveState === "saved"
                      ? "Result saved to your account."
                      : "Cloud save failed. Your current result is still visible here."}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close result"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-paper/10 bg-ink-800 text-paper/75 transition hover:border-brass/50 hover:text-paper"
            >
              <X className="icon-control" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <div className="grid gap-5 md:grid-cols-[minmax(13rem,16rem)_minmax(0,1fr)] md:gap-6">
            <ThisResultColumn
              result={result}
              timeline={attemptTimeline}
              metricLabel={getMetricLabel(passage)}
              historicalErrorCount={errorEvents.length}
              imageAction={
                <ResultImageCardAction
                  disabled={isGeneratingImageCard}
                  error={imageCardError}
                  onGenerate={() => {
                    setImageCardError("");
                    setIsGeneratingImageCard(true);
                    Promise.resolve(onGenerateImageCard({ result, passage, modeLabel }))
                      .catch(() => {
                        setImageCardError("Could not generate image.");
                      })
                      .finally(() => {
                        setIsGeneratingImageCard(false);
                      });
                  }}
                />
              }
            />

            <section className="min-w-0 md:border-l md:border-paper/10 md:pl-6">
              <AttemptWpmGraph result={result} timeline={attemptTimeline} errorEvents={errorEvents} metricLabel={getMetricLabel(passage)} />

              <div className="mt-4 grid gap-4 border-t border-paper/10 pt-4 md:grid-cols-[0.7fr_1.3fr]">
                {hasSavedHistory && <HistoryStats points={historySeries} />}
                {previousResult && <PreviousAttemptComparison result={result} previousResult={previousResult} metricLabel={getMetricLabel(passage)} />}
              </div>
            </section>
          </div>

          {isSuspicious && (
            <div className="mt-4 rounded-md bg-brass/10 px-3 py-2 font-mono text-utility text-brass/80">
              {SUSPICIOUS_RESULT_NOTE}
            </div>
          )}

          {!recentResults && <SignInResultCta />}
          <SessionReview result={result} />
        </div>

        <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t border-paper/10 bg-ink-900 px-4 py-3 md:px-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-paper/10 bg-ink-800 px-4 py-1.5 font-mono text-control text-paper/70 transition hover:border-brass/50 hover:text-paper"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="rounded-md border border-paper/10 bg-ink-800 px-4 py-1.5 font-mono text-control text-paper/85 transition hover:border-brass/50"
          >
            Restart same passage
          </button>
          <button
            type="button"
            onClick={onNextPassage}
            className="rounded-md border border-brass/35 bg-brass/10 px-4 py-1.5 font-mono text-control text-brass transition hover:bg-brass/15"
          >
            Next passage
          </button>
        </div>
      </section>
    </div>
  );
}

function buildCelebrationMilestones(
  result: TypingResult,
  previousResult: PreviousTypingResult | null,
  progressMilestones: CelebrationMilestone[] = []
): CelebrationMilestone[] {
  const milestones: CelebrationMilestone[] = [];

  if (previousResult && result.wpm > previousResult.wpm) {
    milestones.push({
      id: "personal-best-wpm",
      title: "New Personal Best",
      value: `${previousResult.wpm.toFixed(1)} -> ${result.wpm.toFixed(1)} WPM`,
      effect: "ribbons"
    });
  }

  milestones.push(...progressMilestones);

  if (previousResult && result.accuracy > previousResult.accuracy) {
    milestones.push({
      id: "best-accuracy",
      title: "New Best Accuracy",
      value: `${previousResult.accuracy.toFixed(2)}% -> ${result.accuracy.toFixed(2)}% accuracy`,
      effect: "quiet"
    });
  }

  return milestones;
}

function buildProgressCelebrationMilestones(
  savedResults: SupabaseAnalyticsTypingResultRow[],
  passage: StoredPassage,
  result: TypingResult
): CelebrationMilestone[] {
  const analyticsDomain = getResultAnalyticsDomain({ passage_category: passage.category, passage_title: passage.title });
  const previousAnalytics = buildProgressAnalytics(savedResults, { domain: analyticsDomain });
  const nextAnalytics = buildProgressAnalytics([toCurrentAnalyticsResult(passage, result), ...savedResults], {
    domain: analyticsDomain
  });
  const milestones: CelebrationMilestone[] = [];

  if (nextAnalytics.progression.currentLevel > previousAnalytics.progression.currentLevel) {
    milestones.push({
      id: `level-up-${nextAnalytics.progression.currentLevel}`,
      title: "Level Up",
      value: `Level ${previousAnalytics.progression.currentLevel} -> Level ${nextAnalytics.progression.currentLevel}`,
      effect: "ribbons"
    });
  }

  const previouslyUnlockedAchievementIds = new Set(
    previousAnalytics.achievements.items
      .filter((achievement) => achievement.isUnlocked)
      .map((achievement) => achievement.id)
  );

  for (const achievement of nextAnalytics.achievements.items) {
    if (achievement.isUnlocked && !previouslyUnlockedAchievementIds.has(achievement.id)) {
      milestones.push({
        id: `achievement-${achievement.id}`,
        title: "Achievement Unlocked",
        value: achievement.title,
        subtitle: achievement.description,
        effect: "quiet"
      });
    }
  }

  return milestones;
}

function toCurrentAnalyticsResult(
  passage: StoredPassage,
  result: TypingResult
): SupabaseAnalyticsTypingResultRow {
  return {
    id: "__current_result__",
    passage_title: passage.title?.trim() || "Untitled passage",
    passage_category: passage.category,
    duration_seconds: result.durationSeconds,
    elapsed_seconds: result.timeUsedSeconds,
    wpm: result.wpm,
    accuracy: result.accuracy,
    correct_chars: result.correctCharacters,
    created_at: result.completedAt
  };
}

function CelebrationToast({ milestones }: { milestones: CelebrationMilestone[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [milestones]);

  useEffect(() => {
    if (milestones.length === 0 || activeIndex >= milestones.length) {
      return;
    }

    const dismissTimer = window.setTimeout(() => {
      setActiveIndex((currentIndex) => currentIndex + 1);
    }, ACHIEVEMENT_POP_DISMISS_MS);

    return () => window.clearTimeout(dismissTimer);
  }, [activeIndex, milestones.length]);

  const activeMilestone = milestones[activeIndex];

  if (!activeMilestone) {
    return null;
  }

  return (
    <div
      className="formaltype-celebration-stack pointer-events-none fixed right-4 top-4 z-[60] flex max-w-[calc(100vw-2rem)] flex-col gap-2 md:right-6 md:top-6"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        key={`${activeMilestone.id}-${activeIndex}`}
        className={clsx(
          "formaltype-celebration-toast",
          activeMilestone.effect === "quiet" && "formaltype-celebration-toast-quiet"
        )}
        role="status"
      >
        {activeMilestone.effect !== "quiet" && (
          <>
            <span className="formaltype-celebration-burst formaltype-celebration-burst-left" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="formaltype-celebration-burst formaltype-celebration-burst-right" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </>
        )}
        <p className="font-mono text-secondary uppercase tracking-[0.18em] text-brass">{activeMilestone.title}</p>
        <p className="mt-1 font-mono text-body font-semibold text-paper">{activeMilestone.value}</p>
        {activeMilestone.subtitle && <p className="mt-1 font-mono text-utility leading-5 text-paper/55">{activeMilestone.subtitle}</p>}
      </div>
    </div>
  );
}

function buildSavedHistorySeries(savedResults: SupabaseOwnTypingResultRow[]) {
  return savedResults
    .map((result) => ({
      id: result.id,
      wpm: result.wpm,
      completedAt: result.created_at
    }))
    .sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt))
    .slice(-10);
}

export function buildResultHistorySeries({
  recentResults,
  result,
  previousResult,
  includeCurrent
}: {
  recentResults: SupabaseOwnTypingResultRow[];
  result: TypingResult;
  previousResult: PreviousTypingResult | null;
  includeCurrent: boolean;
}): ConsistencyPoint[] {
  const comparableResults = addPreviousComparableResult(recentResults, result, previousResult);

  if (!includeCurrent) {
    return buildSavedHistorySeries(comparableResults);
  }

  return buildConsistencySeries(comparableResults, {
    wpm: result.wpm,
    completedAt: result.completedAt
  });
}

function addPreviousComparableResult(
  recentResults: SupabaseOwnTypingResultRow[],
  result: TypingResult,
  previousResult: PreviousTypingResult | null
): SupabaseOwnTypingResultRow[] {
  if (!previousResult || !isPreviousResultComparable(previousResult, result)) {
    return recentResults;
  }

  if (recentResults.some((recentResult) => isSameHistoryAttempt(recentResult, previousResult))) {
    return recentResults;
  }

  return [
    ...recentResults,
    {
      id: `previous-${previousResult.completedAt}`,
      passage_title: previousResult.passageTitle,
      duration_seconds: previousResult.durationSeconds ?? result.durationSeconds,
      wpm: previousResult.wpm,
      accuracy: previousResult.accuracy,
      created_at: previousResult.completedAt
    }
  ];
}

function isPreviousResultComparable(previousResult: PreviousTypingResult, result: TypingResult) {
  return !previousResult.durationSeconds || previousResult.durationSeconds === result.durationSeconds;
}

function isSameHistoryAttempt(recentResult: SupabaseOwnTypingResultRow, previousResult: PreviousTypingResult) {
  if (recentResult.created_at === previousResult.completedAt) {
    return true;
  }

  const recentCompletedAt = Date.parse(recentResult.created_at);
  const previousCompletedAt = Date.parse(previousResult.completedAt);

  return (
    recentResult.wpm === previousResult.wpm &&
    Number.isFinite(recentCompletedAt) &&
    Number.isFinite(previousCompletedAt) &&
    Math.abs(recentCompletedAt - previousCompletedAt) <= 10_000
  );
}

export function filterComparableRecentResults(
  savedResults: SupabaseOwnTypingResultRow[],
  passage: StoredPassage,
  result: Pick<TypingResult, "durationSeconds">
) {
  const comparableTitle = passage.title?.trim() || "Untitled passage";
  const comparableDomain = getResultAnalyticsDomain({ passage_category: passage.category, passage_title: passage.title });

  return savedResults
    .filter((savedResult) => savedResult.duration_seconds === result.durationSeconds)
    .filter((savedResult) => savedResult.passage_title === comparableTitle)
    .filter(
      (savedResult) =>
        (savedResult.passage_category ?? null) === (passage.category ?? null) ||
        getResultAnalyticsDomain(savedResult) === comparableDomain
    )
    .slice(0, 10);
}

function isSuspiciousInputChange(previousValue: string, nextValue: string, elapsedSeconds: number) {
  const addedCharacters = nextValue.length - previousValue.length;

  if (addedCharacters > MAX_CHARACTERS_PER_INPUT_EVENT) {
    return true;
  }

  if (elapsedSeconds < 1 || nextValue.length === 0) {
    return false;
  }

  const currentWpm = nextValue.length / 5 / (elapsedSeconds / 60);
  return currentWpm > SUSPICIOUS_WPM_THRESHOLD;
}

function ThisResultColumn({
  result,
  timeline,
  metricLabel,
  historicalErrorCount,
  imageAction
}: {
  result: TypingResult;
  timeline: AttemptTimelinePoint[];
  metricLabel: string;
  historicalErrorCount: number;
  imageAction: React.ReactNode;
}) {
  const consistency = getResultConsistency(timeline);

  return (
    <section>
      <p className="font-mono text-body uppercase text-brass">This Result</p>
      <div className="mt-3">
        <p className="font-mono text-utility uppercase text-paper/45">{metricLabel}</p>
        <div className="mt-0.5 font-mono text-5xl font-semibold leading-none text-paper md:text-6xl">
          {result.rawWpm.toFixed(1)}
        </div>
      </div>
      <div className="mt-3 space-y-0">
        <ResultMetricRow label={`Net ${metricLabel}`} value={result.wpm.toFixed(1)} tone="text-mint" />
        <ResultMetricRow label="Accuracy" value={`${result.accuracy.toFixed(2)}%`} />
        <ResultMetricRow label="Final mistakes" value={result.incorrectCharacters} />
        <ResultMetricRow label="Errors encountered" value={historicalErrorCount} tone={historicalErrorCount > 0 ? "text-ember" : "text-paper"} />
        <ResultMetricRow label="Time" value={formatTime(result.timeUsedSeconds)} />
        <ResultMetricRow
          label="Consistency"
          value={consistency === null ? "N/A" : `${consistency.toFixed(1)}%`}
          helpText={CONSISTENCY_HELP_TEXT}
        />
      </div>
      {imageAction}
    </section>
  );
}

function ResultMetricRow({
  label,
  value,
  tone = "text-paper",
  helpText
}: {
  label: string;
  value: string | number;
  tone?: string;
  helpText?: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(5rem,1fr)_auto] items-baseline gap-3 border-b border-paper/10 py-2 font-mono last:border-b-0">
      <span className="text-utility text-paper/50">
        {label}
        {helpText && (
          <span className="ml-1 cursor-help text-paper/30" title={helpText} aria-label={helpText}>
            ⓘ
          </span>
        )}
      </span>
      <span className={clsx("text-base font-semibold", tone)}>{value}</span>
    </div>
  );
}

function HistoryStats({ points }: { points: Array<{ wpm: number }> }) {
  const summary = getConsistencySummary(points);

  return (
    <section>
      <p className="font-mono text-body uppercase text-brass">History</p>
      <div className="mt-3 space-y-2 font-mono">
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
      <span className="text-utility">{label}</span>
      <span className="text-lg text-paper">{value}</span>
    </div>
  );
}

function PreviousAttemptComparison({
  result,
  previousResult,
  metricLabel
}: {
  result: TypingResult;
  previousResult: PreviousTypingResult;
  metricLabel: string;
}) {
  const rawWpmDifference = result.rawWpm - previousResult.rawWpm;
  const netWpmDifference = result.wpm - previousResult.wpm;
  const accuracyDifference = result.accuracy - previousResult.accuracy;

  return (
    <section>
      <p className="font-mono text-body uppercase text-brass">Previous Attempt</p>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 font-mono md:grid-cols-4">
        <PreviousComparisonStat
          label={metricLabel}
          delta={rawWpmDifference}
          previousValue={previousResult.rawWpm.toFixed(1)}
        />
        <PreviousComparisonStat
          label={`Net ${metricLabel}`}
          delta={netWpmDifference}
          previousValue={previousResult.wpm.toFixed(1)}
        />
        <PreviousComparisonStat
          label="Accuracy"
          delta={accuracyDifference}
          suffix="%"
          previousValue={formatPercent(previousResult.accuracy)}
        />
        <div>
          <p className="text-utility uppercase text-paper/40">Time</p>
          <p className="mt-2 text-body text-paper/45">-</p>
          <p className="mt-1.5 text-utility text-paper/55">previous {formatTime(previousResult.elapsedSeconds)}</p>
        </div>
      </div>
    </section>
  );
}

function PreviousComparisonStat({
  label,
  delta,
  previousValue,
  suffix = ""
}: {
  label: string;
  delta: number;
  previousValue: string;
  suffix?: string;
}) {
  const tone = delta > 0 ? "text-mint" : delta < 0 ? "text-ember" : "text-paper/80";

  return (
    <div>
      <p className="text-utility uppercase text-paper/40">{label}</p>
      <p className={clsx("mt-2 text-body", tone)}>{formatSigned(delta, suffix)}</p>
      <p className="mt-1.5 text-utility text-paper/55">previous {previousValue}</p>
    </div>
  );
}

function SignInResultCta() {
  return (
    <div data-testid="result-sign-in-cta" className="mt-5 text-center font-mono text-body text-paper/35">
      <Link href="/login" className="transition hover:text-brass">
        Sign in to save your result and see long-term progress.
      </Link>
    </div>
  );
}

function ResultImageCardAction({
  disabled,
  error,
  onGenerate
}: {
  disabled: boolean;
  error: string;
  onGenerate: () => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-2 border-t border-paper/10 pt-3 font-mono">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brass/10 text-brass">
          <ImageIcon className="icon-control" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-utility text-paper/85">Generate image card</p>
          <p className="truncate text-secondary text-paper/40">Create a shareable result image.</p>
          {error && <p className="mt-2 text-utility text-ember">{error}</p>}
        </div>
      </div>
      <button
        type="button"
        aria-label="Generate image card"
        onClick={onGenerate}
        disabled={disabled}
        className="shrink-0 rounded-md border border-paper/10 bg-transparent px-2.5 py-1.5 text-control text-paper/60 transition hover:border-brass/40 hover:text-paper disabled:cursor-not-allowed disabled:opacity-55"
      >
        {disabled ? "Generating..." : "Generate"}
      </button>
    </div>
  );
}

function AttemptWpmGraph({
  result,
  timeline,
  errorEvents,
  metricLabel
}: {
  result: TypingResult;
  timeline: AttemptTimelinePoint[];
  errorEvents: AttemptErrorEvent[];
  metricLabel: string;
}) {
  const [hoveredPoint, setHoveredPoint] = useState<PositionedAttemptPoint | null>(null);
  const points = getAttemptGraphPoints(timeline, result);
  const graph = getAttemptGraphLayout(points, result);
  const errorBuckets = getAttemptErrorBuckets(errorEvents);
  const maxErrorsPerSecond = Math.max(1, ...errorBuckets.map((bucket) => bucket.count));
  const errorTicks = getErrorTicks(maxErrorsPerSecond);

  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-body uppercase text-brass">{metricLabel} Over Time</p>
        <div className="hidden gap-5 font-mono text-utility uppercase text-paper/45 sm:flex">
          <span className="inline-flex items-center gap-2">
            <span className="w-8 border-t-2 border-dotted opacity-70" style={{ borderColor: "rgb(var(--chart-line-secondary))" }} />
            Burst
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-[3px] w-8 rounded-full" style={{ backgroundColor: "rgb(var(--chart-line))" }} />
            {metricLabel}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-px w-8 border-t border-dashed" style={{ borderColor: "rgb(var(--chart-line-secondary))" }} />
            Avg {result.wpm.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="mt-3 min-w-0">
        <svg
          viewBox={`0 0 ${graph.width} ${graph.height}`}
          role="img"
          aria-label={`${metricLabel} over time`}
          className="h-[260px] w-full overflow-visible"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          {graph.yTicks.map((tick) => {
            const y = getGraphY(tick, graph);
            return (
              <g key={tick}>
                <line
                  data-testid="attempt-chart-grid"
                  x1={graph.left}
                  x2={graph.right}
                  y1={y}
                  y2={y}
                  stroke="rgb(var(--chart-grid))"
                  strokeDasharray="4 6"
                />
                <text x={graph.left - 12} y={y + 4} textAnchor="end" className="formaltype-chart-muted-fill font-mono text-utility">
                  {formatGraphTick(tick)}
                </text>
              </g>
            );
          })}
          <line
            data-testid="attempt-chart-axis-y"
            x1={graph.left}
            x2={graph.left}
            y1={graph.top}
            y2={graph.bottom}
            stroke="rgb(var(--chart-axis))"
          />
          <line
            data-testid="attempt-chart-axis-x"
            x1={graph.left}
            x2={graph.right}
            y1={graph.bottom}
            y2={graph.bottom}
            stroke="rgb(var(--chart-axis))"
          />
          <line
            data-testid="attempt-chart-axis-errors"
            x1={graph.right}
            x2={graph.right}
            y1={graph.top}
            y2={graph.bottom}
            stroke="rgb(var(--chart-axis))"
          />
          <line
            data-testid="attempt-chart-average-line"
            x1={graph.left}
            x2={graph.right}
            y1={getGraphY(result.wpm, graph)}
            y2={getGraphY(result.wpm, graph)}
            stroke="rgb(var(--chart-line-secondary))"
            strokeDasharray="8 8"
          />
          {graph.xTicks.map((tick, index) => (
            <text
              key={`time-${index}`}
              x={getGraphX(tick, graph)}
              y={graph.bottom + 24}
              textAnchor="middle"
              className="formaltype-chart-muted-fill font-mono text-utility"
            >
              {formatGraphTick(tick)}
            </text>
          ))}
          <text x={graph.left - 30} y={graph.top - 14} className="formaltype-chart-muted-fill font-mono text-utility uppercase">
            {metricLabel}
          </text>
          <text x={graph.right + 4} y={graph.top - 14} className="formaltype-chart-muted-fill font-mono text-secondary uppercase">
            Errors
          </text>
          {errorTicks.map((tick) => {
            const y = getErrorGraphY(tick, maxErrorsPerSecond, graph);
            return (
              <text key={tick} x={graph.right + 10} y={y + 4} className="formaltype-chart-muted-fill font-mono text-secondary">
                {tick}
              </text>
            );
          })}
          <text
            x={(graph.left + graph.right) / 2}
            y={graph.height - 8}
            textAnchor="middle"
            className="formaltype-chart-muted-fill font-mono text-utility uppercase"
          >
            Time (seconds)
          </text>
          <path
            data-testid="attempt-chart-burst-line"
            d={graph.burstPath}
            fill="none"
            stroke="rgb(var(--chart-line-secondary))"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            strokeDasharray="2 6"
            opacity="0.72"
          />
          <path
            data-testid="attempt-chart-line"
            d={graph.path}
            fill="none"
            stroke="rgb(var(--chart-line))"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          {errorBuckets.map((error) => {
            const x = Math.min(graph.right - 7, Math.max(graph.left + 7, getGraphX(error.second, graph)));
            const y = getErrorGraphY(error.count, maxErrorsPerSecond, graph);
            return (
              <g key={error.second} data-testid="attempt-error-marker" data-error-count={error.count}>
                <line x1={x - 3.5} x2={x + 3.5} y1={y - 3.5} y2={y + 3.5} stroke="rgb(var(--chart-danger))" strokeWidth="2" />
                <line x1={x + 3.5} x2={x - 3.5} y1={y - 3.5} y2={y + 3.5} stroke="rgb(var(--chart-danger))" strokeWidth="2" />
                {error.count > 1 && (
                  <text x={x + 5} y={y - 5} className="font-mono text-secondary" fill="rgb(var(--chart-danger))">
                    {error.count}
                  </text>
                )}
              </g>
            );
          })}
          {graph.positionedPoints.map((point) => (
            <g key={`${point.timeSeconds}-${point.x}`}>
              <circle cx={point.x} cy={point.y} r="3.5" fill="rgb(var(--chart-line))" />
              <circle
                data-testid={`attempt-graph-point-${point.timeSeconds}`}
                aria-label={`${point.timeSeconds} seconds, ${metricLabel} ${point.wpm.toFixed(1)}, burst ${typeof point.burstWpm === "number" ? point.burstWpm.toFixed(1) : "unavailable"}, errors ${getAttemptErrorCountAtSecond(errorEvents, point.timeSeconds)}`}
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
            <g transform={`translate(${getTooltipX(hoveredPoint.x, graph)} ${Math.max(graph.top + 6, hoveredPoint.y - 94)})`}>
              <rect width="154" height="86" rx="6" className="formaltype-chart-tooltip" />
              <text x="12" y="18" className="formaltype-chart-tooltip-text-fill font-mono text-secondary">
                {hoveredPoint.timeSeconds}s
              </text>
              <text x="12" y="38" className="formaltype-chart-line-fill font-mono text-secondary">
                {metricLabel} {hoveredPoint.wpm.toFixed(1)}
              </text>
              <text x="12" y="56" className="font-mono text-secondary" fill="rgb(var(--chart-line-secondary))">
                Burst {typeof hoveredPoint.burstWpm === "number" ? hoveredPoint.burstWpm.toFixed(1) : "—"}
              </text>
              <text x="12" y="74" className="font-mono text-secondary" fill="rgb(var(--chart-danger))">
                Errors {getAttemptErrorCountAtSecond(errorEvents, hoveredPoint.timeSeconds)}
              </text>
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
  burstPath: string;
};

function buildAttemptTimelinePoint({
  elapsedSeconds,
  sourceText,
  typedText,
  category,
  language,
  rules
}: {
  elapsedSeconds: number;
  sourceText: string;
  typedText: string;
  category?: PracticeCategory;
  language?: PassageLanguage;
  rules: TypingRules;
}): AttemptTimelinePoint {
  const comparison = validateTypedText({ targetText: sourceText, typedText, rules });
  const minutes = Math.max(elapsedSeconds, 1) / 60;
  const usesCharacterPace = language === "chinese" || category === "training_chinese";
  const pace = usesCharacterPace ? comparison.correctCharacters / minutes : comparison.correctCharacters / 5 / minutes;

  return {
    timeSeconds: Math.round(elapsedSeconds),
    characterIndex: typedText.length,
    wpm: roundOne(pace),
    accuracy: comparison.accuracy
  };
}

function toPreviousPaceTimelinePoint(point: AttemptTimelinePoint): PreviousPaceTimelinePoint {
  return {
    timeSeconds: point.timeSeconds,
    characterIndex: Math.max(0, Math.round(point.characterIndex ?? 0)),
    wpm: point.wpm
  };
}

export function getPreviousPaceIndex(
  timeline: PreviousPaceTimelinePoint[] | null | undefined,
  currentElapsedSeconds: number
) {
  const interpolatedIndex = getInterpolatedPreviousPaceIndex(timeline, currentElapsedSeconds);

  return interpolatedIndex === null ? null : Math.max(0, Math.round(interpolatedIndex));
}

export function getInterpolatedPreviousPaceIndex(
  timeline: PreviousPaceTimelinePoint[] | null | undefined,
  currentElapsedSeconds: number
) {
  if (!timeline || timeline.length === 0) {
    return null;
  }

  const sortedTimeline = timeline
    .filter((point) => Number.isFinite(point.timeSeconds) && Number.isFinite(point.characterIndex))
    .sort((left, right) => left.timeSeconds - right.timeSeconds);

  if (sortedTimeline.length === 0) {
    return null;
  }

  if (currentElapsedSeconds <= 0) {
    return 0;
  }

  const exactPoint = sortedTimeline.find((point) => point.timeSeconds === currentElapsedSeconds);
  if (exactPoint) {
    return Math.max(0, exactPoint.characterIndex);
  }

  const nextPoint = sortedTimeline.find((point) => point.timeSeconds > currentElapsedSeconds);
  if (!nextPoint) {
    return Math.max(0, sortedTimeline[sortedTimeline.length - 1].characterIndex);
  }

  const previousPointIndex = sortedTimeline.indexOf(nextPoint) - 1;
  if (previousPointIndex < 0) {
    return Math.max(0, nextPoint.characterIndex);
  }

  const previousPoint = sortedTimeline[previousPointIndex];
  const elapsedRange = nextPoint.timeSeconds - previousPoint.timeSeconds;
  if (elapsedRange <= 0) {
    return Math.max(0, previousPoint.characterIndex);
  }

  const progress = (currentElapsedSeconds - previousPoint.timeSeconds) / elapsedRange;
  const interpolatedIndex =
    previousPoint.characterIndex + (nextPoint.characterIndex - previousPoint.characterIndex) * progress;
  return Math.max(0, interpolatedIndex);
}

export function addAttemptTimelinePoint(points: AttemptTimelinePoint[], point: AttemptTimelinePoint) {
  return upsertAttemptTimelinePoint(points, point);
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
  const points = sortedPoints[0]?.timeSeconds === 0 ? sortedPoints : [{ timeSeconds: 0, wpm: 0 }, ...sortedPoints];
  const finalPoint: AttemptTimelinePoint = {
    timeSeconds: result.timeUsedSeconds,
    wpm: result.wpm,
    accuracy: result.accuracy
  };

  if (!points.some((point) => point.timeSeconds === finalPoint.timeSeconds)) {
    points.push(finalPoint);
  }

  return points.sort((left, right) => left.timeSeconds - right.timeSeconds);
}

export function getAttemptGraphLayout(points: AttemptTimelinePoint[], result: TypingResult): AttemptGraphLayout {
  const normalizedPoints = getAttemptGraphPoints(points, result);
  const width = 640;
  const height = 280;
  const left = 48;
  const right = width - 48;
  const top = 32;
  const bottom = height - 46;
  const maxTime = Math.max(result.timeUsedSeconds, ...normalizedPoints.map((point) => point.timeSeconds), 1);
  const maxWpm = getStableGraphMax(normalizedPoints, result);
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
  const positionedPoints = normalizedPoints.map((point) => ({
    ...point,
    x: getGraphX(point.timeSeconds, graphBase),
    y: getGraphY(point.wpm, graphBase)
  }));

  return {
    ...graphBase,
    positionedPoints,
    path: buildSmoothPath(positionedPoints),
    burstPath: buildSmoothPath(
      normalizedPoints
        .filter((point) => typeof point.burstWpm === "number")
        .map((point) => ({
          x: getGraphX(point.timeSeconds, graphBase),
          y: getGraphY(point.burstWpm ?? 0, graphBase)
        }))
    )
  };
}

export function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${roundOne(points[0].x)} ${roundOne(points[0].y)}`;

  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const midX = (previous.x + point.x) / 2;
    return `${path} C ${roundOne(midX)} ${roundOne(previous.y)}, ${roundOne(midX)} ${roundOne(point.y)}, ${roundOne(point.x)} ${roundOne(point.y)}`;
  }, `M ${roundOne(points[0].x)} ${roundOne(points[0].y)}`);
}

function getBurstWpm(delays: number[], isChinese: boolean) {
  const recent = delays.filter((delay) => Number.isFinite(delay) && delay > 0).slice(-12);
  if (recent.length < 2) return undefined;
  const averageDelay = recent.reduce((total, delay) => total + delay, 0) / recent.length;
  const burst = (isChinese ? 60_000 : 12_000) / averageDelay;
  return roundOne(Math.max(0, Math.min(300, burst)));
}

function getGraphX(timeSeconds: number, graph: Pick<AttemptGraphLayout, "left" | "right" | "maxTime">) {
  const range = graph.right - graph.left;
  return graph.left + (Math.min(Math.max(timeSeconds, 0), graph.maxTime) / graph.maxTime) * range;
}

function getGraphY(wpm: number, graph: Pick<AttemptGraphLayout, "top" | "bottom" | "maxWpm">) {
  const range = graph.bottom - graph.top;
  return graph.bottom - (Math.min(Math.max(wpm, 0), graph.maxWpm) / graph.maxWpm) * range;
}

function getErrorGraphY(errorCount: number, maxErrors: number, graph: Pick<AttemptGraphLayout, "top" | "bottom">) {
  const range = graph.bottom - graph.top;
  return graph.bottom - (Math.min(Math.max(errorCount, 0), maxErrors) / maxErrors) * range;
}

function getAttemptErrorBuckets(errorEvents: AttemptErrorEvent[]) {
  const counts = new Map<number, number>();
  errorEvents.forEach((error) => {
    const second = getAttemptErrorSecond(error.timeSeconds);
    counts.set(second, (counts.get(second) ?? 0) + 1);
  });
  return Array.from(counts, ([second, count]) => ({ second, count })).sort((left, right) => left.second - right.second);
}

function getAttemptErrorCountAtSecond(errorEvents: AttemptErrorEvent[], timeSeconds: number) {
  const second = getAttemptErrorSecond(timeSeconds);
  return errorEvents.filter((error) => getAttemptErrorSecond(error.timeSeconds) === second).length;
}

function getAttemptErrorSecond(timeSeconds: number) {
  return Math.max(1, Math.ceil(Math.max(0, timeSeconds)));
}

function getTooltipX(x: number, graph: Pick<AttemptGraphLayout, "left" | "right">) {
  const tooltipWidth = 154;
  if (x > graph.right - tooltipWidth) {
    return graph.right - tooltipWidth;
  }

  return Math.max(graph.left, x + 12);
}

function getNiceGraphMax(value: number) {
  return Math.max(30, Math.ceil(value / 15) * 15);
}

function getWpmTicks(maxWpm: number) {
  return Array.from({ length: Math.floor(maxWpm / 15) + 1 }, (_, index) => index * 15);
}

function getTimeTicks(maxTime: number) {
  const divisions = maxTime < 15 ? Math.max(1, Math.round(maxTime)) : 10;
  return getEvenGraphTicks(maxTime, divisions);
}

function getEvenGraphTicks(maxValue: number, divisions: number) {
  return Array.from({ length: divisions + 1 }, (_, index) => roundOne((maxValue * index) / divisions));
}

function formatGraphTick(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function getErrorTicks(maxErrors: number) {
  if (maxErrors <= 5) return Array.from({ length: maxErrors + 1 }, (_, index) => index);
  const step = Math.ceil(maxErrors / 5);
  const ticks = Array.from({ length: Math.ceil(maxErrors / step) + 1 }, (_, index) => index * step);
  if (ticks[ticks.length - 1] !== maxErrors) ticks.push(maxErrors);
  return ticks;
}

function getStableGraphMax(points: AttemptTimelinePoint[], result: TypingResult) {
  const stablePoints = getStableTimelinePoints(points);
  const stableMax = Math.max(result.wpm, ...stablePoints.flatMap((point) => [point.wpm, point.burstWpm ?? 0]), 1);
  const allMax = Math.max(stableMax, ...points.flatMap((point) => [point.wpm, point.burstWpm ?? 0]), 1);
  const sensibleMax = Math.min(allMax, stableMax * 1.35);

  return getNiceGraphMax(sensibleMax);
}

function getStableTimelinePoints(points: AttemptTimelinePoint[]) {
  const stablePoints = points.filter((point) => point.timeSeconds >= 5);
  return stablePoints.length >= 3 ? stablePoints : points;
}

export function getResultConsistency(timeline: AttemptTimelinePoint[]) {
  return calculateTimelineConsistency(timeline);
}

function getCompletionLabel(completionReason: CompletionReason) {
  if (completionReason === "time_up") {
    return "Time up";
  }

  return "Session ended";
}

export async function generateResultImageCard({ result, passage, modeLabel }: ResultImageCardInput) {
  if (typeof document === "undefined") {
    throw new Error("Image card generation requires a browser.");
  }

  const canvas = document.createElement("canvas");
  const width = 1080;
  const height = 1080;
  const scale = Math.max(window.devicePixelRatio || 1, 1);
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not available.");
  }

  context.scale(scale, scale);
  drawResultImageCard(context, { result, passage, modeLabel }, width, height);
  const blob = await canvasToPngBlob(canvas);
  downloadBlob(blob, "typing-station-result-card.png");
}

function drawResultImageCard(
  context: CanvasRenderingContext2D,
  { result, passage, modeLabel }: ResultImageCardInput,
  width: number,
  height: number
) {
  const completedAt = new Date(result.completedAt);
  const dateLabel = Number.isNaN(completedAt.getTime())
    ? result.completedAt
    : completedAt.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

  context.fillStyle = "#080b0b";
  context.fillRect(0, 0, width, height);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(199, 156, 74, 0.16)");
  gradient.addColorStop(0.45, "rgba(85, 239, 160, 0.08)");
  gradient.addColorStop(1, "rgba(8, 11, 11, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(238, 231, 216, 0.12)";
  context.lineWidth = 2;
  context.strokeRect(36, 36, width - 72, height - 72);

  const metadata = formatPassageResultMetadata(passage);
  const cardMetadata = metadata.endsWith(` · ${modeLabel}`) ? metadata : `${metadata} · ${modeLabel}`;

  drawCardText(context, "Typing Station", 82, 112, 34, "#c79c4a", "600");
  drawCardText(context, metadata.split(" · ")[0] ?? "Untitled passage", 82, 176, 34, "rgba(238, 231, 216, 0.9)", "600", 850);
  drawCardText(context, cardMetadata, 82, 226, 22, "rgba(238, 231, 216, 0.48)", "400", 850);

  drawCardText(context, result.rawWpm.toFixed(1), 82, 540, 160, "#eee7d8", "700");
  drawCardText(context, "WPM", 92, 590, 26, "rgba(238, 231, 216, 0.46)");
  drawCardText(context, `Net WPM ${result.wpm.toFixed(1)}`, 92, 660, 36, "#55efa0", "600");

  const stats = [
    ["Accuracy", `${result.accuracy.toFixed(2)}%`],
    ["Mistakes", String(result.incorrectCharacters)],
    ["Time", formatTime(result.timeUsedSeconds)],
    ["Mode", modeLabel]
  ];
  stats.forEach(([label, value], index) => {
    const x = 560 + (index % 2) * 245;
    const y = 478 + Math.floor(index / 2) * 138;
    context.fillStyle = "rgba(238, 231, 216, 0.05)";
    context.fillRect(x - 20, y - 48, 205, 92);
    drawCardText(context, label, x, y - 12, 18, "rgba(238, 231, 216, 0.42)", "400", 180);
    drawCardText(context, value, x, y + 32, 34, "#eee7d8", "600", 180);
  });

  drawCardText(context, dateLabel, 82, height - 110, 22, "rgba(238, 231, 216, 0.44)", "400", 560);
  drawCardText(context, "typing station", width - 282, height - 110, 24, "rgba(199, 156, 74, 0.78)", "600", 220);
}

function drawCardText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight = "400",
  maxWidth = 960
) {
  context.fillStyle = color;
  context.font = `${weight} ${size}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  context.fillText(truncateCanvasText(context, text, maxWidth), x, y);
}

function truncateCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (context.measureText(text).width <= maxWidth) {
    return text;
  }

  let nextText = text;
  while (nextText.length > 1 && context.measureText(`${nextText}...`).width > maxWidth) {
    nextText = nextText.slice(0, -1);
  }

  return `${nextText}...`;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas export failed."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function characterClass(status: string, revealMistakes: boolean, themeSettings?: ThemeSettings) {
  if (status === "correct") {
    return "formaltype-typed-correct";
  }
  if (status === "wrong" || status === "extra") {
    return revealMistakes ? "formaltype-typed-wrong" : "formaltype-typed-hidden-mistake";
  }
  if (status === "current") {
    return clsx(
      "formaltype-typed-current",
      `formaltype-caret-${themeSettings?.caretStyle ?? DEFAULT_THEME_SETTINGS.caretStyle}`,
      (themeSettings?.caretBlink ?? DEFAULT_THEME_SETTINGS.caretBlink) === "off"
        ? "formaltype-caret-static"
        : "formaltype-caret-animated"
    );
  }
  return "formaltype-typed-pending";
}

function shouldShowLineBreakMarker(status: string, revealMistakes: boolean) {
  return status === "current" || ((status === "wrong" || status === "extra") && revealMistakes);
}

function TypingTimer({ value, compact = false }: { value: string; compact?: boolean }) {
  return (
    <div
      data-testid="typing-timer-slot"
      className={clsx(
        "justify-self-center text-center font-mono tabular-nums leading-none text-paper/40 sm:justify-self-end sm:text-right",
        compact ? "min-h-6 min-w-[4.5rem] text-lg md:text-xl" : "min-h-8 min-w-[5.5rem] text-2xl md:text-[2rem]"
      )}
      aria-label={`Timer ${value}`}
    >
      <span data-testid="typing-timer">{value}</span>
    </div>
  );
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

function createClientAttemptId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
