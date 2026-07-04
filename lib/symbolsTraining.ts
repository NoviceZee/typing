import { buildTrainingPassage, buildTrainingText } from "./trainingText";
import type { StoredPassage } from "./app-storage";

export function buildSymbolsTrainingText(durationSeconds = 60): string {
  return buildTrainingText({
    contentTypes: ["symbols"],
    tokenCount: Math.max(300, Math.min(600, Math.ceil(durationSeconds * 5)))
  });
}

export function buildSymbolsTrainingPassage(durationSeconds = 60): StoredPassage {
  return buildTrainingPassage({ contentTypes: ["symbols"], mode: "time", durationSeconds });
}
