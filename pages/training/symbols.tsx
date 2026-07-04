import React from "react";
import PracticePage, { PracticeTrainingMode } from "../practice";
import { buildTrainingPassage } from "@/lib/trainingText";

const SYMBOLS_TRAINING_MODE: PracticeTrainingMode = {
  pageTitle: "Symbols Training",
  passageId: "training-symbols",
  configKey: "symbols-time-60",
  session: { kind: "time", seconds: 60 },
  buildPassage: ({ durationSeconds, mode }) => ({
    ...buildTrainingPassage({ contentTypes: ["symbols"], mode, durationSeconds }),
    id: "training-symbols",
    title: "Symbols training",
    style: "Symbol drills"
  }),
  hidePassageControls: true,
  hidePracticeModeControls: true
};

export default function TrainingSymbolsPage() {
  return <PracticePage trainingMode={SYMBOLS_TRAINING_MODE} />;
}
