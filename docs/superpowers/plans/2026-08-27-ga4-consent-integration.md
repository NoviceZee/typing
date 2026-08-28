# GA4 Consent Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dormant, consent-gated, production-only GA4 integration with sanitised manual page views, shared consent controls, accurate privacy disclosure, and regression coverage.

**Architecture:** A device-local consent module supplies one versioned state to a React provider. `SiteTelemetry` consumes that state, applies pure eligibility and route-sanitisation functions, and queues exactly one initial and one successful-route page view. Shared controls render in the first-visit notice, Privacy, and Settings while remaining separate from Supabase/account settings.

**Tech Stack:** Next.js 15 Pages Router, React 18, TypeScript, `next/script`, Vitest, Testing Library, first-party localStorage/cookies.

## Global Constraints

- Do not hard-code or configure the production Measurement ID; keep `NEXT_PUBLIC_GA_MEASUREMENT_ID` unset.
- Do not commit, push, deploy, change Vercel, or activate production analytics.
- Do not add Google Tag Manager, Vercel Analytics, a CMP package, or another analytics dependency.
- GA eligibility requires consent `granted`, `NODE_ENV === "production"`, hostname exactly `typingstation.app`, and a configured Measurement ID.
- Unknown/unrecognised routes emit no page view. Only the actual `/404` route emits `/404`.
- Send no User-ID, account identifiers, typed/passage content, query strings, fragments, feedback content, auth tokens, detailed typing data, or custom typing events.
- Dashboard-only follow-up: disable Enhanced Measurement history page changes, form interactions, and site-search extraction before activation.
- Because commits are explicitly forbidden, every task ends with tests rather than a commit.

---

## File structure

- Create `lib/analyticsConsent.ts`: consent types/key, safe persistence, same-tab event, GA-cookie cleanup.
- Create `lib/siteTelemetry.ts`: static route allowlist, URL sanitiser, eligibility predicate, safe page-view payload.
- Create `components/AnalyticsConsentProvider.tsx`: hydrated shared state, same-tab/cross-tab sync, once-only withdrawal reload.
- Create `components/AnalyticsConsentControls.tsx`: shared preference control and compact first-visit notice.
- Modify `components/SiteTelemetry.tsx`: gated direct gtag queue and one manual route listener.
- Modify `pages/_app.tsx`: provider composition and global notice.
- Modify `pages/privacy.tsx`: disclosure plus shared control.
- Modify `pages/settings.tsx`: Privacy section plus shared control.
- Create focused tests in `lib/analytics-consent.test.ts`, `lib/site-telemetry.test.tsx`, and `lib/analytics-consent-ui.test.tsx`; extend `lib/settings-page.test.tsx`.
- Create `docs/ga4-implementation.md`: activation boundary, dashboard prerequisites, and verification notes.

### Task 1: Consent persistence and withdrawal primitives

**Files:**
- Create: `lib/analyticsConsent.ts`
- Test: `lib/analytics-consent.test.ts`

**Interfaces:**
- Produces: `AnalyticsConsent`, `ANALYTICS_CONSENT_STORAGE_KEY`, `ANALYTICS_CONSENT_CHANGE_EVENT`, `readAnalyticsConsent(storage?)`, `writeAnalyticsConsent(consent, storage?)`, and `clearGoogleAnalyticsCookies(document?, hostname?)`.

- [ ] **Step 1: Write failing persistence tests**

Create jsdom tests asserting missing/invalid/blocked storage returns `unknown`, successful writes persist only `formaltype.analytics_consent.v1`, failed writes return `false`, and writes dispatch the same-tab event.

```ts
expect(readAnalyticsConsent()).toBe("unknown");
expect(writeAnalyticsConsent("granted")).toBe(true);
expect(localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("granted");
expect(localStorage.getItem("formaltype.theme.v1")).toBe("paper");
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test -- lib/analytics-consent.test.ts`

Expected: FAIL because `@/lib/analyticsConsent` does not exist.

- [ ] **Step 3: Implement minimal safe storage primitives**

Implement strict value validation and catch unavailable/SecurityError/quota failures without enabling analytics:

```ts
export type AnalyticsConsent = "unknown" | "granted" | "denied";
export const ANALYTICS_CONSENT_STORAGE_KEY = "formaltype.analytics_consent.v1";
export const ANALYTICS_CONSENT_CHANGE_EVENT = "typing-station-analytics-consent-change";

export function readAnalyticsConsent(storage = getLocalStorage()): AnalyticsConsent {
  try {
    const value = storage?.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : "unknown";
  } catch {
    return "unknown";
  }
}

export function writeAnalyticsConsent(consent: Exclude<AnalyticsConsent, "unknown">, storage = getLocalStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
    window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_CHANGE_EVENT, { detail: consent }));
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Add failing GA-cookie cleanup tests**

Set `_ga`, `_ga_TEST`, an unrelated cookie, and an application storage key. Assert cleanup expires only names beginning `_ga` and does not clear localStorage or auth data.

- [ ] **Step 5: Run the focused test and verify RED**

Run: `pnpm test -- lib/analytics-consent.test.ts`

Expected: persistence tests PASS; cookie cleanup test FAIL because cleanup is absent.

- [ ] **Step 6: Implement cookie cleanup and verify GREEN**

Enumerate visible cookie names matching `/^_ga(?:_|$)/` and write expired variants for `/`, the current host, `typingstation.app`, and `.typingstation.app`. Do not call `localStorage.clear()` or remove unrelated keys.

Run: `pnpm test -- lib/analytics-consent.test.ts`

Expected: PASS.

### Task 2: Route sanitisation and telemetry eligibility

**Files:**
- Create: `lib/siteTelemetry.ts`
- Test: `lib/site-telemetry.test.tsx`

**Interfaces:**
- Consumes: `AnalyticsConsent` from `lib/analyticsConsent.ts`.
- Produces: `sanitizeAnalyticsPath(rawUrl): string | null`, `isAnalyticsEligible(input): boolean`, and `buildPageViewPayload(rawUrl): { page_path: string; page_location: string; page_title: "Typing Station" } | null`.

- [ ] **Step 1: Write failing pure-function tests**

Cover all static Pages Router paths, query/fragment stripping, absolute URLs, `/u/some-handle` → `/u/[handle]`, actual `/404`, and suppression of values such as `/john@example.com`, `/u/handle/extra`, `/api/feedback`, and arbitrary UUID/token paths.

```ts
expect(sanitizeAnalyticsPath("/login?redirectTo=%2Fu%2Fprivate#token")).toBe("/login");
expect(sanitizeAnalyticsPath("/u/some-handle?recovery=1")).toBe("/u/[handle]");
expect(sanitizeAnalyticsPath("/john@example.com")).toBeNull();
expect(sanitizeAnalyticsPath("/404")).toBe("/404");
```

Eligibility tests vary consent, node environment, hostname, and Measurement ID one at a time.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test -- lib/site-telemetry.test.tsx`

Expected: FAIL because `@/lib/siteTelemetry` does not exist.

- [ ] **Step 3: Implement allowlist, profile mapping, payload, and eligibility**

Use an explicit `Set` of current static routes. Parse with `new URL(rawUrl, "https://typingstation.app")`, use only `pathname`, normalise trailing slash, special-case exactly one `/u/<segment>`, and return `null` otherwise. Build an explicit canonical `page_location` so GA never falls back to the raw browser URL.

```ts
return {
  page_path: safePath,
  page_location: `https://typingstation.app${safePath === "/" ? "/" : safePath}`,
  page_title: "Typing Station"
};
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm test -- lib/site-telemetry.test.tsx`

Expected: pure-function tests PASS.

### Task 3: Shared consent provider and controls

**Files:**
- Create: `components/AnalyticsConsentProvider.tsx`
- Create: `components/AnalyticsConsentControls.tsx`
- Test: `lib/analytics-consent-ui.test.tsx`

**Interfaces:**
- Consumes: Task 1 primitives.
- Produces: `useAnalyticsConsent()`, `AnalyticsConsentProvider`, `AnalyticsConsentPreference`, and `AnalyticsConsentNotice`.

- [ ] **Step 1: Write failing provider tests**

Test hydration from all three states, failed persistence leaving consent unchanged, same-tab change propagation, cross-tab `StorageEvent` propagation, first decline without reload, and each observed `granted` → `denied` transition causing cookie cleanup and no more than one reload per mounted document.

Use an injectable optional `reload?: () => void` provider prop for deterministic tests; production defaults to `window.location.reload()`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test -- lib/analytics-consent-ui.test.tsx`

Expected: FAIL because the provider and controls do not exist.

- [ ] **Step 3: Implement provider state and synchronization**

Hydrate in `useEffect`, listen to `ANALYTICS_CONSENT_CHANGE_EVENT` and `storage`, never rewrite storage in an event listener, and use refs for the current consent and once-only reload guard. Only reload when the prior hydrated state was `granted` and the next state is `denied`.

- [ ] **Step 4: Add failing accessibility tests for shared UI**

Assert the unknown notice has an accessible status/dialog label plus `Allow analytics` and `Decline`; persisted choice hides it. Assert the preference component reports its current state and exposes both equally accessible actions.

- [ ] **Step 5: Implement the small shared UI and verify GREEN**

Use existing Tailwind design tokens, ordinary buttons with visible focus styles, equal minimum height, and no preselected choice. Avoid modal focus trapping or blocking the app.

Run: `pnpm test -- lib/analytics-consent-ui.test.tsx`

Expected: PASS without accessibility query failures or React warnings.

### Task 4: Gated direct gtag and manual page views

**Files:**
- Modify: `components/SiteTelemetry.tsx`
- Modify: `pages/_app.tsx`
- Test: `lib/site-telemetry.test.tsx`

**Interfaces:**
- Consumes: `useAnalyticsConsent`, `isAnalyticsEligible`, and `buildPageViewPayload`.
- Produces: globally gated `SiteTelemetry` with no public tracking API.

- [ ] **Step 1: Write failing component tests**

Mock `next/script` and Next router events. Inject optional runtime values into `SiteTelemetry` for deterministic tests. Assert no script/config/listener for absent ID, unknown/denied consent, development, localhost, preview, or retired host. Assert granted canonical production renders one script and queues config values with all three privacy flags.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test -- lib/site-telemetry.test.tsx`

Expected: FAIL against the old unconditional-by-consent implementation.

- [ ] **Step 3: Implement eligibility and direct gtag initialization**

Declare `window.dataLayer` and `window.gtag`, create a queue function if absent, issue one `js` and one `config` command with `send_page_view: false`, `allow_google_signals: false`, and `allow_ad_personalization_signals: false`, then emit a manual `page_view` event using only the safe payload.

- [ ] **Step 4: Add failing lifecycle and duplication tests**

Assert one initial view after `router.isReady`, one view per `routeChangeComplete`, no views for `routeChangeError`, cleanup on unmount/denial, no duplicate listener or initial event after rerender, one initial event when unknown transitions to granted, repeated safe dynamic-profile events are allowed, and back/forward completion events each produce one safe view.

- [ ] **Step 5: Implement one effect-driven lifecycle and verify GREEN**

Use one eligibility/router-ready effect with refs for initialization and initial emission, register only `routeChangeComplete`, and cleanly unregister. Reset refs only when a new eligible activation is legitimately needed. Do not use a script callback to send another initial event.

Wrap `_app` content with `AnalyticsConsentProvider`, render `AnalyticsConsentNotice`, and keep `SiteTelemetry` inside the provider but outside account/auth synchronization.

Run: `pnpm test -- lib/site-telemetry.test.tsx lib/analytics-consent-ui.test.tsx`

Expected: PASS.

### Task 5: Privacy and Settings integration

**Files:**
- Modify: `pages/privacy.tsx`
- Modify: `pages/settings.tsx`
- Modify: `lib/settings-page.test.tsx`
- Test: `lib/analytics-consent-ui.test.tsx`

**Interfaces:**
- Consumes: `AnalyticsConsentPreference`.
- Produces: anonymous Privacy control and Settings convenience section backed by the same provider.

- [ ] **Step 1: Write failing page tests**

Render Privacy and Settings inside the provider. Assert both show the shared `Analytics preferences` group, changing one persists the single consent key, and the Privacy page includes GA4, optionality, aggregate purpose, categories, exclusions, Google processing/privacy link, withdrawal locations, essential-storage separation, and accurate local practice-storage wording.

- [ ] **Step 2: Run page tests and verify RED**

Run: `pnpm test -- lib/analytics-consent-ui.test.tsx lib/settings-page.test.tsx`

Expected: FAIL because neither page embeds the shared control and the policy is incomplete.

- [ ] **Step 3: Update Privacy and Settings**

Expand `pages/privacy.tsx` into readable sections, add the shared preference component, and link to `https://policies.google.com/privacy`. In Settings add a `Privacy` section/card and sidebar item using a privacy-related Lucide icon; do not add consent to account settings or Supabase persistence.

- [ ] **Step 4: Run page tests and verify GREEN**

Run: `pnpm test -- lib/analytics-consent-ui.test.tsx lib/settings-page.test.tsx`

Expected: PASS.

### Task 6: Implementation notes and full verification

**Files:**
- Create: `docs/ga4-implementation.md`
- Review: all files changed in Tasks 1–5

**Interfaces:**
- Produces: operator-facing activation prerequisites without changing live settings.

- [ ] **Step 1: Write implementation notes**

Document that analytics remains dormant without `NEXT_PUBLIC_GA_MEASUREMENT_ID`; before any future activation, disable Enhanced Measurement history-based page changes, form interactions, and site-search extraction; keep Signals/Ads off; then verify Realtime/DebugView, one initial/SPA view, consent denial, preview/local exclusion, and payload sanitisation.

- [ ] **Step 2: Run focused tests**

Run: `pnpm test -- lib/analytics-consent.test.ts lib/site-telemetry.test.tsx lib/analytics-consent-ui.test.tsx lib/settings-page.test.tsx`

Expected: all focused tests PASS with no warnings.

- [ ] **Step 3: Run the full suite**

Run: `pnpm test`

Expected: all repository tests PASS.

- [ ] **Step 4: Run static checks**

Run: `pnpm typecheck`

Run: `pnpm lint`

Expected: both exit 0.

- [ ] **Step 5: Run production build without activation**

Confirm the shell environment and `.env.local` do not define `NEXT_PUBLIC_GA_MEASUREMENT_ID`, then run `pnpm build`.

Expected: build and homepage verification PASS; no Measurement ID is introduced.

- [ ] **Step 6: Run final repository checks**

Run: `git diff --check`

Run a repository search for the production Measurement ID and confirm it is absent from source and configuration.

Run: `git status --short`

Expected: no whitespace errors; the Measurement ID is absent; only intended GA implementation/spec/plan files plus pre-existing user changes are reported.

- [ ] **Step 7: Review the diff against the approved spec**

Confirm unknown routes suppress events, real `/404` remains, unknown-to-granted emits one initial event, withdrawal reloads at most once per active document, storage events synchronise tabs, and no auth/application storage is gated or removed.
