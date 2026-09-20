import type { PreviousTypingResult, StoredPassage } from "./app-storage";
import { safeSetJsonStorageItem } from "./storageSafety";
import type { SupabaseOwnTypingResultRow } from "./typingResultStorage";
import type { TypingResult } from "./typing-engine";

const RESULT_PAGE_STORAGE_PREFIX = "typing-station.result-page.v1:";
const RESULT_RETURN_STORAGE_PREFIX = "typing-station.result-return.v1:";
const resultPageMemory = new Map<string, ResultPageSnapshot>();
const resultReturnMemory = new Map<string, ResultReturnAction>();
export const RESULT_PAGE_UPDATED_EVENT = "typing-station:result-page-updated";

export type ResultPageCloudSaveState = "idle" | "saving" | "saved" | "failed";

export type ResultPageSnapshot = {
  version: 1;
  attemptId: string;
  result: TypingResult;
  passage: StoredPassage;
  previousResult: PreviousTypingResult | null;
  restartPreviousResult: PreviousTypingResult | null;
  restartTargetIdentity?: string | null;
  recentResults: SupabaseOwnTypingResultRow[] | null;
  progressMilestones: Array<{
    id: string;
    title: string;
    value: string;
    subtitle?: string;
    effect?: "ribbons" | "quiet";
  }>;
  attemptTimeline: Array<{
    timeSeconds: number;
    characterIndex?: number;
    wpm: number;
    accuracy?: number;
    burstWpm?: number;
    errorCount?: number;
  }>;
  errorEvents: Array<{ timeSeconds: number; characterIndex: number }>;
  modeLabel: string;
  isSuspicious: boolean;
  cloudSaveState: ResultPageCloudSaveState;
  originHref: string;
};

export type ResultReturnAction = {
  attemptId: string;
  action: "restart" | "next";
};

export function writeResultPageSnapshot(snapshot: ResultPageSnapshot) {
  if (typeof window === "undefined") return;
  resultPageMemory.set(snapshot.attemptId, snapshot);
  try {
    safeSetJsonStorageItem(getResultPageKey(snapshot.attemptId), snapshot, {
      storageKind: "sessionStorage",
      context: "writeResultPageSnapshot"
    });
    window.dispatchEvent(new CustomEvent(RESULT_PAGE_UPDATED_EVENT, { detail: snapshot.attemptId }));
  } catch (error) {
    console.warn("Result page session storage write failed", error);
  }
}

export function readResultPageSnapshot(attemptId: string): ResultPageSnapshot | null {
  if (typeof window === "undefined" || !attemptId) return null;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(getResultPageKey(attemptId)) ?? "null");
    return isResultPageSnapshot(value) ? value : resultPageMemory.get(attemptId) ?? null;
  } catch {
    return resultPageMemory.get(attemptId) ?? null;
  }
}

export function updateResultPageSnapshot(
  attemptId: string,
  update: Partial<Omit<ResultPageSnapshot, "version" | "attemptId">>
) {
  const snapshot = readResultPageSnapshot(attemptId);
  if (!snapshot) return;
  writeResultPageSnapshot({ ...snapshot, ...update });
}

export function writeResultReturnAction(action: ResultReturnAction) {
  if (typeof window === "undefined") return;
  resultReturnMemory.set(action.attemptId, action);
  try {
    safeSetJsonStorageItem(getResultReturnKey(action.attemptId), action, {
      storageKind: "sessionStorage",
      context: "writeResultReturnAction"
    });
  } catch (error) {
    console.warn("Result return action storage write failed", error);
  }
}

export function readResultReturnAction(attemptId: string): ResultReturnAction | null {
  if (typeof window === "undefined" || !attemptId) return null;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(getResultReturnKey(attemptId)) ?? "null");
    return value?.attemptId === attemptId && (value.action === "restart" || value.action === "next")
      ? value as ResultReturnAction
      : resultReturnMemory.get(attemptId) ?? null;
  } catch {
    return resultReturnMemory.get(attemptId) ?? null;
  }
}

export function clearResultReturnAction(attemptId: string) {
  if (typeof window === "undefined") return;
  resultReturnMemory.delete(attemptId);
  try {
    window.sessionStorage.removeItem(getResultReturnKey(attemptId));
  } catch {
    // A failed cleanup only leaves an inert handoff without matching route parameters.
  }
}

export function appendResultReturnQuery(
  originHref: string,
  attemptId: string,
  action: ResultReturnAction["action"]
) {
  const separator = originHref.includes("?") ? "&" : "?";
  return `${originHref}${separator}resultAction=${action}&attempt=${encodeURIComponent(attemptId)}`;
}

function getResultPageKey(attemptId: string) {
  return `${RESULT_PAGE_STORAGE_PREFIX}${attemptId}`;
}

function getResultReturnKey(attemptId: string) {
  return `${RESULT_RETURN_STORAGE_PREFIX}${attemptId}`;
}

function isResultPageSnapshot(value: unknown): value is ResultPageSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ResultPageSnapshot>;
  return snapshot.version === 1 &&
    typeof snapshot.attemptId === "string" &&
    typeof snapshot.originHref === "string" &&
    Boolean(snapshot.result && typeof snapshot.result === "object") &&
    Boolean(snapshot.passage && typeof snapshot.passage === "object") &&
    Array.isArray(snapshot.attemptTimeline) &&
    Array.isArray(snapshot.errorEvents);
}
