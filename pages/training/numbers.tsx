import React from "react";
import PracticePage, { PracticeTrainingMode } from "../practice";
import { buildTrainingPassage } from "@/lib/trainingText";

const NUMBERS_TRAINING_MODE: PracticeTrainingMode = {
  pageTitle: "Numbers Training",
  passageId: "training-numbers",
  configKey: "numbers-time-60",
  session: { kind: "time", seconds: 60 },
  buildPassage: ({ durationSeconds, mode }) => ({
    ...buildTrainingPassage({ contentTypes: ["numbers"], mode, durationSeconds }),
    id: "training-numbers",
    title: "Numbers training",
    style: "Numeric drills"
  }),
  hidePassageControls: true,
  hidePracticeModeControls: true
};

export default function TrainingNumbersPage() {
  return <PracticePage trainingMode={NUMBERS_TRAINING_MODE} />;
}
