"use client";

import Script from "next/script";
import { useRouter } from "next/router";
import React, { useEffect, useRef } from "react";
import { useOptionalAnalyticsConsent } from "@/components/AnalyticsConsentProvider";
import { setGoogleAnalyticsCollectionDisabled } from "@/lib/analyticsConsent";
import {
  SafePageViewPayload,
  buildPageViewPayload,
  isAnalyticsEligible,
  sanitizeAnalyticsReferrer
} from "@/lib/siteTelemetry";

declare global {
  interface Window {
    dataLayer: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

type SiteTelemetryRuntime = {
  measurementId: string | undefined;
  nodeEnv: string | undefined;
  hostname: string;
};

type SafeAnalyticsContext = {
  page_location: string;
  page_title: "Typing Station";
  page_referrer: string;
};

function ensureGoogleTagQueue() {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer.push(args);
    };
  }
}

function getSafeAnalyticsContext(payload: SafePageViewPayload, pageReferrer: string): SafeAnalyticsContext {
  return {
    page_location: payload.page_location,
    page_title: payload.page_title,
    page_referrer: pageReferrer
  };
}

export function SiteTelemetry({ runtime }: { runtime?: SiteTelemetryRuntime }) {
  const router = useRouter();
  const analytics = useOptionalAnalyticsConsent();
  const measurementId = runtime
    ? runtime.measurementId
    : process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const nodeEnv = runtime ? runtime.nodeEnv : process.env.NODE_ENV;
  const hostname = runtime
    ? runtime.hostname
    : typeof window === "undefined"
      ? ""
      : window.location.hostname;
  const eligible = isAnalyticsEligible({
    consent: analytics?.consent ?? "unknown",
    nodeEnv,
    hostname,
    measurementId
  });
  const currentPathRef = useRef(router.asPath);
  const initializedMeasurementIdRef = useRef<string | null>(null);
  const sentInitialPageViewRef = useRef(false);
  const lastSafeLocationRef = useRef<string | null>(null);

  currentPathRef.current = router.asPath;

  useEffect(() => {
    if (!measurementId) return;

    if (!eligible || !router.isReady) {
      setGoogleAnalyticsCollectionDisabled(measurementId, true);
      initializedMeasurementIdRef.current = null;
      sentInitialPageViewRef.current = false;
      lastSafeLocationRef.current = null;
      return;
    }

    const configureSafeRoute = (
      payload: SafePageViewPayload,
      pageReferrer: string,
      sendPageView: boolean
    ) => {
      ensureGoogleTagQueue();
      const safeContext = getSafeAnalyticsContext(payload, pageReferrer);
      const isInitialConfiguration = initializedMeasurementIdRef.current !== measurementId;

      if (isInitialConfiguration) window.gtag?.("js", new Date());
      window.gtag?.("set", safeContext);
      setGoogleAnalyticsCollectionDisabled(measurementId, false);
      window.gtag?.("config", measurementId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        ...safeContext,
        ...(isInitialConfiguration ? {} : { update: true })
      });

      initializedMeasurementIdRef.current = measurementId;
      if (sendPageView) window.gtag?.("event", "page_view", payload);
      lastSafeLocationRef.current = payload.page_location;
    };

    const handleRouteChangeStart = () => {
      setGoogleAnalyticsCollectionDisabled(measurementId, true);
    };
    const handleRouteChangeComplete = (rawUrl: string) => {
      const payload = buildPageViewPayload(rawUrl);
      if (!payload) {
        setGoogleAnalyticsCollectionDisabled(measurementId, true);
        lastSafeLocationRef.current = null;
        return;
      }

      configureSafeRoute(payload, lastSafeLocationRef.current ?? "", true);
      sentInitialPageViewRef.current = true;
    };
    const handleRouteChangeError = () => {
      setGoogleAnalyticsCollectionDisabled(measurementId, !lastSafeLocationRef.current);
    };

    router.events.on("routeChangeStart", handleRouteChangeStart);
    router.events.on("routeChangeComplete", handleRouteChangeComplete);
    router.events.on("routeChangeError", handleRouteChangeError);

    const initialPayload = buildPageViewPayload(currentPathRef.current);
    if (!initialPayload) {
      setGoogleAnalyticsCollectionDisabled(measurementId, true);
    } else if (!sentInitialPageViewRef.current) {
      configureSafeRoute(initialPayload, sanitizeAnalyticsReferrer(document.referrer), true);
      sentInitialPageViewRef.current = true;
    }

    return () => {
      setGoogleAnalyticsCollectionDisabled(measurementId, true);
      router.events.off("routeChangeStart", handleRouteChangeStart);
      router.events.off("routeChangeComplete", handleRouteChangeComplete);
      router.events.off("routeChangeError", handleRouteChangeError);
    };
  }, [eligible, measurementId, router.events, router.isReady]);

  const hasSafeCurrentRoute = router.isReady && Boolean(buildPageViewPayload(router.asPath));
  if (!eligible || !measurementId || !hasSafeCurrentRoute) return null;

  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
      strategy="afterInteractive"
    />
  );
}
