import React, { useCallback, useMemo, useState } from "react";
import PracticePage, { PracticeTrainingMode } from "./practice";
import {
  TrainingContentType,
  TrainingMode,
  TrainingWordDifficulty,
  buildTrainingPassage
} from "@/lib/trainingText";

const CONTENT_OPTIONS: Array<{ value: TrainingContentType; label: string }> = [
  { value: "words", label: "Words" },
  { value: "numbers", label: "Numbers" },
  { value: "symbols", label: "Symbols" }
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

  const toggleContentType = useCallback((contentType: TrainingContentType) => {
    setContentTypes((current) => {
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
        className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 font-mono text-xs lg:flex-nowrap"
      >
        <div role="group" aria-label="Content" className="flex items-center gap-2">
          {CONTENT_OPTIONS.map((option) => (
            <ToggleButton
              key={option.value}
              label={option.label}
              isSelected={contentTypes.includes(option.value)}
              onClick={() => toggleContentType(option.value)}
            />
          ))}
        </div>

        <Separator />

        <div role="group" aria-label="Mode" className="flex items-center gap-2">
          <ToggleButton label="Time" isSelected={mode === "time"} onClick={() => setMode("time")} />
          <ToggleButton label="Words" isSelected={mode === "words"} onClick={() => setMode("words")} />
        </div>

        <Separator />

        <div role="group" aria-label="Length" className="flex items-center gap-2">
          {mode === "time"
            ? TIME_OPTIONS.map((seconds) => (
                <ToggleButton
                  key={seconds}
                  label={String(seconds)}
                  isSelected={durationSeconds === seconds}
                  onClick={() => setDurationSeconds(seconds)}
                />
              ))
            : WORD_COUNT_OPTIONS.map((count) => (
                <ToggleButton
                  key={count}
                  label={String(count)}
                  isSelected={wordCount === count}
                  onClick={() => setWordCount(count)}
                />
              ))}
        </div>

        <Separator />

        <div role="group" aria-label="Difficulty" className="flex items-center gap-2">
          {DIFFICULTY_OPTIONS.map((option) => (
            <ToggleButton
              key={option.value}
              label={option.label}
              isSelected={wordDifficulty === option.value}
              onClick={() => setWordDifficulty(option.value)}
            />
          ))}
        </div>
      </section>
    ),
    [contentTypes, durationSeconds, mode, toggleContentType, wordCount, wordDifficulty]
  );

  const trainingMode = useMemo<PracticeTrainingMode>(
    () => ({
      pageTitle: "Training",
      passageId: `training-${contentTypes.join("-")}`,
      configKey: `${contentTypes.join("-")}-${mode}-${durationSeconds}-${wordCount}-${wordDifficulty}`,
      controls,
      session: mode === "time" ? { kind: "time", seconds: durationSeconds } : { kind: "words", wordCount },
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
    [contentTypes, controls, durationSeconds, mode, wordCount, wordDifficulty]
  );

  return <PracticePage trainingMode={trainingMode} />;
}

function Separator() {
  return <span aria-hidden="true" className="h-4 w-px bg-paper/15" />;
}

function ToggleButton({
  label,
  isSelected,
  onClick
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      className={`min-h-8 px-0.5 font-mono text-xs leading-none transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-brass ${
        isSelected ? "text-brass" : "text-paper/45 hover:text-paper/75"
      }`}
    >
      {label}
    </button>
  );
}
