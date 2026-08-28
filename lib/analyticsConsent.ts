import { safeSetStorageItem } from "@/lib/storageSafety";

export type AnalyticsConsent = "unknown" | "granted" | "denied";

export const ANALYTICS_CONSENT_STORAGE_KEY = "formaltype.analytics_consent.v1";
export const ANALYTICS_CONSENT_CHANGE_EVENT = "typing-station-analytics-consent-change";

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function parseAnalyticsConsent(value: string | null): AnalyticsConsent {
  return value === "granted" || value === "denied" ? value : "unknown";
}

export function readAnalyticsConsent(storage: Storage | null = getLocalStorage()): AnalyticsConsent {
  try {
    return parseAnalyticsConsent(storage?.getItem(ANALYTICS_CONSENT_STORAGE_KEY) ?? null);
  } catch {
    return "unknown";
  }
}

export function writeAnalyticsConsent(
  consent: Exclude<AnalyticsConsent, "unknown">,
  storage?: Storage | null
): boolean {
  const explicitStorage = arguments.length >= 2;

  try {
    const didPersist = explicitStorage
      ? (() => {
          if (!storage) return false;
          storage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
          return true;
        })()
      : safeSetStorageItem(ANALYTICS_CONSENT_STORAGE_KEY, consent, {
          context: "analytics-consent"
        }).ok;

    if (!didPersist) return false;

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<Exclude<AnalyticsConsent, "unknown">>(ANALYTICS_CONSENT_CHANGE_EVENT, {
          detail: consent
        })
      );
    }

    return true;
  } catch {
    return false;
  }
}

export function setGoogleAnalyticsCollectionDisabled(measurementId: string, disabled: boolean): void {
  if (typeof window === "undefined" || !measurementId) return;
  (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = disabled;
}

export function clearGoogleAnalyticsCookies(
  targetDocument: Pick<Document, "cookie"> | null = typeof document === "undefined" ? null : document,
  hostname = typeof window === "undefined" ? "" : window.location.hostname
): void {
  if (!targetDocument) return;

  const cookieNames = targetDocument.cookie
    .split(";")
    .map((cookie) => cookie.split("=")[0]?.trim())
    .filter((name): name is string => Boolean(name) && /^_ga(?:_|$)/.test(name));

  const domainCandidates = new Set(
    [hostname, "typingstation.app", ".typingstation.app"].filter(Boolean)
  );

  for (const name of cookieNames) {
    targetDocument.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    domainCandidates.forEach((domain) => {
      targetDocument.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}; SameSite=Lax`;
    });
  }
}
