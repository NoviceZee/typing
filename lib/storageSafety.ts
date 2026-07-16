export type StorageKind = "localStorage" | "sessionStorage";

export type SafeStorageWriteResult =
  | { ok: true; key: string; bytes: number }
  | { ok: false; key: string; bytes: number; reason: "quota_exceeded" | "unavailable" };

export type TypingStationStorageEntry = {
  key: string;
  characters: number;
  approximateBytes: number;
  disposable: boolean;
};

export type TypingStationStorageReport = {
  entries: TypingStationStorageEntry[];
  totalApproximateBytes: number;
};

export const TYPING_STATION_STORAGE_MIGRATION_KEY = "formaltype_storage_migration_v2";
export const OBSOLETE_TYPING_STATION_STORAGE_KEYS = ["formaltype.passage.v1"];
export const DISPOSABLE_TYPING_STATION_STORAGE_KEYS = [
  ...OBSOLETE_TYPING_STATION_STORAGE_KEYS,
  "formaltype_current_passage",
  "formaltype.typing_attempt_details.v1"
];

const TYPING_STATION_KEY_PATTERNS = [
  /^formaltype(?:[._-]|$)/,
  /^formaltype_/,
  /^formaltype_passage_library$/,
  /^formaltype_previous_results$/
];

function getStorage(kind: StorageKind): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return kind === "localStorage" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function isTypingStationStorageKey(key: string): boolean {
  return TYPING_STATION_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function getApproximateStorageBytes(value: string): number {
  return value.length * 2;
}

export function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22)
  );
}

export function safeSetStorageItem(
  key: string,
  value: string,
  {
    storageKind = "localStorage",
    context = "unspecified"
  }: {
    storageKind?: StorageKind;
    context?: string;
  } = {}
): SafeStorageWriteResult {
  const storage = getStorage(storageKind);
  const bytes = getApproximateStorageBytes(value);

  if (!storage) {
    logStorageWrite({ storageKind, key, bytes, context, ok: false, reason: "unavailable" });
    return { ok: false, key, bytes, reason: "unavailable" };
  }

  try {
    storage.setItem(key, value);
    logStorageWrite({ storageKind, key, bytes, context, ok: true });
    return { ok: true, key, bytes };
  } catch (error) {
    if (isQuotaExceededError(error)) {
      logStorageWrite({ storageKind, key, bytes, context, ok: false, reason: "quota_exceeded" });
      return { ok: false, key, bytes, reason: "quota_exceeded" };
    }

    if (error instanceof DOMException && error.name === "SecurityError") {
      logStorageWrite({ storageKind, key, bytes, context, ok: false, reason: "unavailable" });
      return { ok: false, key, bytes, reason: "unavailable" };
    }

    throw error;
  }
}

export function safeSetJsonStorageItem(
  key: string,
  value: unknown,
  options?: {
    storageKind?: StorageKind;
    context?: string;
  }
): SafeStorageWriteResult {
  return safeSetStorageItem(key, JSON.stringify(value), options);
}

export function getTypingStationStorageReport(storage: Storage | null = getStorage("localStorage")): TypingStationStorageReport {
  if (!storage) {
    return { entries: [], totalApproximateBytes: 0 };
  }

  const entries: TypingStationStorageEntry[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (!key || !isTypingStationStorageKey(key)) {
      continue;
    }

    const value = storage.getItem(key) ?? "";
    entries.push({
      key,
      characters: value.length,
      approximateBytes: getApproximateStorageBytes(value),
      disposable: DISPOSABLE_TYPING_STATION_STORAGE_KEYS.includes(key)
    });
  }

  entries.sort((first, second) => second.approximateBytes - first.approximateBytes || first.key.localeCompare(second.key));

  return {
    entries,
    totalApproximateBytes: entries.reduce((total, entry) => total + entry.approximateBytes, 0)
  };
}

export function runTypingStationStorageMigration(storage: Storage | null = getStorage("localStorage")) {
  if (!storage || storage.getItem(TYPING_STATION_STORAGE_MIGRATION_KEY) === "complete") {
    return;
  }

  for (const key of OBSOLETE_TYPING_STATION_STORAGE_KEYS) {
    storage.removeItem(key);
  }

  safeSetStorageItem(TYPING_STATION_STORAGE_MIGRATION_KEY, "complete", {
    context: "storage-migration"
  });
}

export function installTypingStationStorageDebugHelper() {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production") {
    return;
  }

  runTypingStationStorageMigration();

  const params = new URLSearchParams(window.location.search);
  if (params.get("storageDebug") !== "1") {
    return;
  }

  const helper = {
    report: () => getTypingStationStorageReport(),
    clearDisposable: () => {
      const storage = window.localStorage;
      for (const key of DISPOSABLE_TYPING_STATION_STORAGE_KEYS) {
        storage.removeItem(key);
      }
      return getTypingStationStorageReport();
    }
  };

  (window as typeof window & { formalTypeStorageDebug?: typeof helper }).formalTypeStorageDebug = helper;
  console.info("[Typing Station storage] report", helper.report());
}

function logStorageWrite({
  storageKind,
  key,
  bytes,
  context,
  ok,
  reason
}: {
  storageKind: StorageKind;
  key: string;
  bytes: number;
  context: string;
  ok: boolean;
  reason?: string;
}) {
  if (process.env.NODE_ENV === "production" || !isTypingStationStorageKey(key)) {
    return;
  }

  if (ok) {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    console.info("[Typing Station storage]", {
      storage: storageKind,
      key,
      payloadLength: Math.ceil(bytes / 2),
      approximateBytes: bytes,
      context,
      ok
    });
    return;
  }

  if (reason === "quota_exceeded") {
    console.warn(`STORAGE QUOTA FAILURE key=${key} size=${bytes} context=${context}`, {
      storage: storageKind,
      key,
      approximateBytes: bytes,
      context,
      reason
    });
    return;
  }

  console.warn("[Typing Station storage]", {
    storage: storageKind,
    key,
    approximateBytes: bytes,
    context,
    ok,
    reason
  });
}
