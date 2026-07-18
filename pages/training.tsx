import React, { useCallback, useMemo, useState } from "react";
import { Gauge, Hash, Keyboard, Timer } from "lucide-react";
import PracticePage, { PracticeTrainingMode } from "./practice";
import { FilterControl, SecondaryToolbar, ToolbarGroup, ToolbarSeparator } from "@/components/SecondaryNavigation";
import {
  TrainingContentType,
  TrainingMode,
  TrainingWordDifficulty,
  buildTrainingPassage
} from "@/lib/trainingText";

const CONTENT_OPTIONS: Array<{ value: TrainingContentType; label: string }> = [
  { value: "words", label: "Words" },
  { value: "numbers", label: "Numbers" },
  { value: "symbols", label: "Symbols" },
  { value: "code", label: "Code" },
  { value: "chinese", label: "Chinese" }
];

const TIME_OPTIONS = [15, 30, 60, 120];
const WORD_COUNT_OPTIONS = [10, 25, 50, 100];
const DIFFICULTY_OPTIONS: Array<{ value: TrainingWordDifficulty; label: string }> = [
  { value: "basic", label: "Basic" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "mixed", label: "Mixed" }
];

export default function TrainingPage() {
  const [contentTypes, setContentTypes] = useState<TrainingContentType[]>(["words"]);
  const [mode, setMode] = useState<TrainingMode>("time");
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [wordCount, setWordCount] = useState(25);
  const [wordDifficulty, setWordDifficulty] = useState<TrainingWordDifficulty>("intermediate");
  const isCodeActive = contentTypes.includes("code");
  const activeMode: TrainingMode = isCodeActive ? "time" : mode;

  const toggleContentType = useCallback((contentType: TrainingContentType) => {
    if (contentType === "code" || contentType === "chinese") {
      setMode("time");
      setContentTypes([contentType]);
      return;
    }

    setContentTypes((current) => {
      if (current.includes("code") || current.includes("chinese")) {
        return [contentType];
      }

      if (current.includes(contentType)) {
        return current.length === 1 ? current : current.filter((selected) => selected !== contentType);
      }

      return [...current, contentType];
    });
  }, []);

  const controls = useMemo(
    () => (
      <section
        data-testid="training-controls"
        className="mx-auto mb-2 flex max-w-fit justify-center px-1"
      >
        <SecondaryToolbar className="justify-center lg:flex-nowrap" label="Training controls">
        <ToolbarGroup label="Content" icon={Keyboard} className="lg:flex-nowrap">
          {CONTENT_OPTIONS.map((option) => (
            <FilterControl
              key={option.value}
              selected={contentTypes.includes(option.value)}
              onClick={() => toggleContentType(option.value)}
            >
              {option.label}
            </FilterControl>
          ))}
        </ToolbarGroup>

        <ToolbarSeparator />

        <ToolbarGroup label="Mode" icon={Timer} className="lg:flex-nowrap">
          <FilterControl selected={activeMode === "time"} onClick={() => setMode("time")}>Time</FilterControl>
          {!isCodeActive && <FilterControl selected={activeMode === "words"} onClick={() => setMode("words")}>Words</FilterControl>}
        </ToolbarGroup>

        <ToolbarSeparator />

        <ToolbarGroup label="Length" icon={Hash} className="lg:flex-nowrap">
          {activeMode === "time"
            ? TIME_OPTIONS.map((seconds) => (
                <FilterControl
                  key={seconds}
                  selected={durationSeconds === seconds}
                  onClick={() => setDurationSeconds(seconds)}
                >
                  {seconds}
                </FilterControl>
              ))
            : WORD_COUNT_OPTIONS.map((count) => (
                <FilterControl
                  key={count}
                  selected={wordCount === count}
                  onClick={() => setWordCount(count)}
                >
                  {count}
                </FilterControl>
              ))}
        </ToolbarGroup>

        <ToolbarSeparator />

        <ToolbarGroup label="Difficulty" icon={Gauge} className="lg:flex-nowrap">
          {DIFFICULTY_OPTIONS.map((option) => (
            <FilterControl
              key={option.value}
              selected={wordDifficulty === option.value}
              onClick={() => setWordDifficulty(option.value)}
            >
              {option.label}
            </FilterControl>
          ))}
        </ToolbarGroup>
        </SecondaryToolbar>
      </section>
    ),
    [activeMode, contentTypes, durationSeconds, isCodeActive, toggleContentType, wordCount, wordDifficulty]
  );

  const trainingMode = useMemo<PracticeTrainingMode>(
    () => ({
      pageTitle: "Training",
      passageId: `training-${contentTypes.join("-")}`,
      configKey: `${contentTypes.join("-")}-${activeMode}-${durationSeconds}-${wordCount}-${wordDifficulty}`,
      controls,
      session:
        activeMode === "time"
          ? { kind: "time", seconds: durationSeconds }
          : { kind: "words", wordCount },
      buildPassage: ({ durationSeconds: currentDurationSeconds, wordCount: currentWordCount, mode: currentMode }) =>
        buildTrainingPassage({
          contentTypes,
          mode: currentMode,
          durationSeconds: currentDurationSeconds,
          wordCount: currentWordCount,
          wordDifficulty
        }),
      hidePassageControls: true,
      hidePracticeModeControls: true,
      hideMetadata: true
    }),
    [activeMode, contentTypes, controls, durationSeconds, wordCount, wordDifficulty]
  );

  return <PracticePage trainingMode={trainingMode} />;
}
