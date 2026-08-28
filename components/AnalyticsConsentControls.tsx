"use client";

import React from "react";
import { useOptionalAnalyticsConsent } from "@/components/AnalyticsConsentProvider";

const CHOICE_LABELS = {
  unknown: "Not chosen",
  granted: "Allowed",
  denied: "Declined"
} as const;

function ChoiceButtons({ compact = false }: { compact?: boolean }) {
  const analytics = useOptionalAnalyticsConsent();
  if (!analytics) return null;

  const sharedClassName = compact
    ? "inline-flex min-h-9 items-center justify-center rounded-md border px-3 py-2 font-mono text-control outline-none transition focus-visible:ring-2 focus-visible:ring-brass/60"
    : "inline-flex min-h-10 min-w-36 items-center justify-center rounded-md border px-4 py-2 font-mono text-control outline-none transition focus-visible:ring-2 focus-visible:ring-brass/60";

  return (
    <div role="group" aria-label="Analytics consent choice" className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-label="Allow analytics"
        aria-pressed={analytics.consent === "granted"}
        onClick={analytics.allowAnalytics}
        className={`${sharedClassName} ${analytics.consent === "granted" ? "border-brass/70 bg-brass/15 text-brass" : "border-paper/15 bg-paper/[0.04] text-paper/70 hover:border-brass/45 hover:text-paper"}`}
      >
        Allow analytics
      </button>
      <button
        type="button"
        aria-label="Decline analytics"
        aria-pressed={analytics.consent === "denied"}
        onClick={analytics.declineAnalytics}
        className={`${sharedClassName} ${analytics.consent === "denied" ? "border-brass/70 bg-brass/15 text-brass" : "border-paper/15 bg-paper/[0.04] text-paper/70 hover:border-brass/45 hover:text-paper"}`}
      >
        Decline analytics
      </button>
    </div>
  );
}

export function AnalyticsConsentPreference() {
  const analytics = useOptionalAnalyticsConsent();
  if (!analytics) return null;

  return (
    <div className="rounded-lg border border-paper/10 bg-ink-950/35 p-4">
      <p className="font-mono text-body text-paper/85">Analytics preference</p>
      <p className="mt-1 text-body text-paper/55">
        Current choice: {CHOICE_LABELS[analytics.consent]}
      </p>
      <div className="mt-4">
        <ChoiceButtons />
      </div>
    </div>
  );
}

export function AnalyticsConsentNotice() {
  const analytics = useOptionalAnalyticsConsent();
  if (!analytics?.isHydrated || analytics.consent !== "unknown") return null;

  return (
    <aside
      role="region"
      aria-label="Analytics privacy notice"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-lg border border-brass/35 bg-ink-950/95 p-4 shadow-2xl backdrop-blur sm:inset-x-5 sm:flex sm:items-center sm:justify-between sm:gap-5"
    >
      <div>
        <p className="font-mono text-control uppercase tracking-wide text-brass">Optional analytics</p>
        <p className="mt-1 max-w-2xl text-body text-paper/70">
          Help improve Typing Station by allowing privacy-limited Google Analytics. We do not send typed content, account identifiers, query strings or advertising signals.
        </p>
      </div>
      <div className="mt-3 shrink-0 sm:mt-0">
        <ChoiceButtons compact />
      </div>
    </aside>
  );
}
