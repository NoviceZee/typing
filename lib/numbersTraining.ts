import { buildTrainingPassage, buildTrainingText } from "./trainingText";
import type { StoredPassage } from "./app-storage";

export function buildNumbersTrainingText(durationSeconds = 60): string {
  return buildTrainingText({
    contentTypes: ["numbers"],
    tokenCount: Math.max(300, Math.min(600, Math.ceil(durationSeconds * 5)))
  });
}

export function buildNumbersTrainingPassage(durationSeconds = 60): StoredPassage {
  return buildTrainingPassage({ contentTypes: ["numbers"], mode: "time", durationSeconds });
}
