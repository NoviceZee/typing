import type { PassageLanguage } from "@/lib/app-storage";
import type { PracticeModeId } from "@/lib/practiceModes";

type RouteQueryValue = string | string[] | undefined;

const PRACTICE_LANGUAGES = new Set<PassageLanguage>(["english", "chinese"]);
const PRACTICE_MODES = new Set<PracticeModeId>(["1m", "5m", "10m", "infinite"]);

export function parsePracticeRoutePreset(query: {
  language?: RouteQueryValue;
  mode?: RouteQueryValue;
}): { language: PassageLanguage | null; mode: PracticeModeId } {
  const language = getSingleQueryValue(query.language);
  const mode = getSingleQueryValue(query.mode);

  return {
    language: language && PRACTICE_LANGUAGES.has(language as PassageLanguage)
      ? language as PassageLanguage
      : null,
    mode: mode && PRACTICE_MODES.has(mode as PracticeModeId)
      ? mode as PracticeModeId
      : "1m"
  };
}

export function parseTrainingRoutePreset(query: {
  content?: RouteQueryValue;
}): "chinese" | null {
  return getSingleQueryValue(query.content) === "chinese" ? "chinese" : null;
}

function getSingleQueryValue(value: RouteQueryValue): string | null {
  return typeof value === "string" ? value : null;
}
