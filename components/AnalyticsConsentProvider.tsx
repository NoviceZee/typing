"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ANALYTICS_CONSENT_CHANGE_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  AnalyticsConsent,
  clearGoogleAnalyticsCookies,
  parseAnalyticsConsent,
  readAnalyticsConsent,
  setGoogleAnalyticsCollectionDisabled,
  writeAnalyticsConsent
} from "@/lib/analyticsConsent";

type AnalyticsConsentContextValue = {
  consent: AnalyticsConsent;
  isHydrated: boolean;
  allowAnalytics: () => boolean;
  declineAnalytics: () => boolean;
};

const AnalyticsConsentContext = createContext<AnalyticsConsentContextValue | null>(null);

export function AnalyticsConsentProvider({
  children,
  reload,
  storage,
  measurementId
}: {
  children: React.ReactNode;
  reload?: () => void;
  storage?: Storage | null;
  measurementId?: string;
}) {
  const [consent, setConsent] = useState<AnalyticsConsent>("unknown");
  const [isHydrated, setIsHydrated] = useState(false);
  const consentRef = useRef<AnalyticsConsent>("unknown");
  const hydratedRef = useRef(false);
  const didReloadRef = useRef(false);

  const applyConsent = useCallback((nextConsent: AnalyticsConsent) => {
    const previousConsent = consentRef.current;
    consentRef.current = nextConsent;
    setConsent(nextConsent);

    if (
      hydratedRef.current &&
      previousConsent === "granted" &&
      nextConsent === "denied" &&
      !didReloadRef.current
    ) {
      didReloadRef.current = true;
      const activeMeasurementId = measurementId ?? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
      if (activeMeasurementId) setGoogleAnalyticsCollectionDisabled(activeMeasurementId, true);
      clearGoogleAnalyticsCookies();
      if (reload) reload();
      else if (typeof window !== "undefined") window.location.reload();
    }
  }, [measurementId, reload]);

  useEffect(() => {
    const initialConsent = readAnalyticsConsent(storage);
    consentRef.current = initialConsent;
    setConsent(initialConsent);
    hydratedRef.current = true;
    setIsHydrated(true);

    const handleSameTabChange = (event: Event) => {
      const nextConsent = (event as CustomEvent<unknown>).detail;
      if (nextConsent === "granted" || nextConsent === "denied") applyConsent(nextConsent);
    };
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === ANALYTICS_CONSENT_STORAGE_KEY) {
        applyConsent(parseAnalyticsConsent(event.newValue));
      }
    };

    window.addEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, handleSameTabChange);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, handleSameTabChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [applyConsent, storage]);

  const persistConsent = useCallback((nextConsent: "granted" | "denied") => {
    return storage === undefined
      ? writeAnalyticsConsent(nextConsent)
      : writeAnalyticsConsent(nextConsent, storage);
  }, [storage]);

  const value = useMemo<AnalyticsConsentContextValue>(() => ({
    consent,
    isHydrated,
    allowAnalytics: () => persistConsent("granted"),
    declineAnalytics: () => persistConsent("denied")
  }), [consent, isHydrated, persistConsent]);

  return <AnalyticsConsentContext.Provider value={value}>{children}</AnalyticsConsentContext.Provider>;
}

export function useOptionalAnalyticsConsent() {
  return useContext(AnalyticsConsentContext);
}

export function useAnalyticsConsent() {
  const context = useOptionalAnalyticsConsent();
  if (!context) throw new Error("useAnalyticsConsent must be used within AnalyticsConsentProvider");
  return context;
}
