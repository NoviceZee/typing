# Privacy-Conscious GA4 Integration Design

## Goal

Add a dormant, consent-gated Google Analytics 4 integration that can measure basic production traffic after a future environment-variable activation without collecting account identifiers, typed content, query strings, or unrecognised path values.

The implementation must not add the GA4 Measurement ID to source code or any deployment environment. It must not activate analytics in production as part of this work.

## Constraints

- Use direct `gtag.js`; do not add Google Tag Manager, Vercel Analytics, a CMP, or another analytics dependency.
- Analytics runs only when consent is explicitly granted, `NODE_ENV` is `production`, the browser hostname is exactly `typingstation.app`, and `NEXT_PUBLIC_GA_MEASUREMENT_ID` is configured.
- Consent remains device-local and separate from Supabase authentication, account-synced settings, application preferences, and practice storage.
- Send no custom typing events, User-ID, account-derived user properties, advertising signals, or remarketing data.
- Use one manual page-view mechanism. GA4 Enhanced Measurement history-based page changes, form interactions, and site-search extraction must be disabled separately in the GA4 dashboard.

## Architecture

### Consent state

Create a focused analytics-consent module with:

- `AnalyticsConsent = "unknown" | "granted" | "denied"`;
- a versioned localStorage key dedicated to analytics consent;
- pure read, write, and GA-cookie-cleanup functions;
- a browser event used for same-tab notification after a write.

An `AnalyticsConsentProvider` owns the hydrated state and exposes it through a hook. It reads storage after hydration, listens for both the same-tab event and the browser `storage` event, and never reads or writes Supabase account settings.

The provider exposes explicit `allowAnalytics` and `declineAnalytics` actions. A first-time decline stores `denied` without reloading. A transition from `granted` to `denied`, whether initiated in the current tab or observed through a storage event, stops React-managed tracking, removes GA cookies, and reloads that active document at most once. Because the persisted state is already `denied`, the new document does not reload again or load GA. The once-only guard prevents loops and repeated reloads.

### Consent UI

One shared analytics-consent preference component renders the current state and equal-weight Allow and Decline controls. It is embedded in:

- the public Privacy page, available without authentication;
- the existing Settings page as an additional convenience.

A compact global first-visit notice renders only after consent storage has hydrated and the resulting state is `unknown`. It uses the same provider actions and presents `Allow analytics` and `Decline` with comparable accessibility and visual weight. It does not block essential authentication or application storage.

### Telemetry eligibility

`SiteTelemetry` remains mounted globally but is inert unless all eligibility conditions pass. Eligibility is implemented as a pure, separately tested function accepting consent, node environment, hostname, and Measurement ID.

When eligibility becomes true, the component creates or reuses the `dataLayer`/`gtag` queue and configures the stream once with:

```text
send_page_view: false
allow_google_signals: false
allow_ad_personalization_signals: false
```

It registers one `routeChangeComplete` listener and removes it when eligibility becomes false or the component unmounts. Cancelled and failed routes are not tracked because only successful completion is observed.

The initial page view is emitted once after `router.isReady` and initialization. A transition from `unknown` to `granted` activates the same initialization path; it must not create a second initial call through a competing effect or script callback. Re-renders must not re-register the listener or repeat the initial page view. Back/forward navigation is measured through successful `routeChangeComplete` events.

### Route sanitisation

Create a pure `sanitizeAnalyticsPath` function that:

- accepts relative or absolute route URLs;
- removes query strings and fragments before classification;
- normalises safe path syntax;
- returns an explicitly allowed static path unchanged;
- maps `/u/<any single profile segment>` to `/u/[handle]`;
- returns `/404` only for the actual `/404` route;
- returns `null` for every unrecognised or uncovered path.

A `null` result suppresses the page view. The implementation must not invent `/404` or another aggregate category for unknown paths because an arbitrary path could contain an email address, username, token, or other identifying value.

Every emitted page view uses the sanitised pathname, an explicitly constructed `https://typingstation.app<sanitised-path>` page location, and the generic title `Typing Station`. Explicitly setting the safe page location prevents GA from falling back to the browser's raw URL. The event does not include the raw router URL, query data, fragment data, redirect targets, recovery values, document title, or dynamic identifiers.

## Data flow

1. The app hydrates with analytics consent unresolved and no GA code loaded.
2. The provider reads the versioned local preference and resolves `unknown`, `granted`, or `denied`.
3. Unknown state displays the first-visit notice. Granted state is passed to `SiteTelemetry`; denied state leaves it inert.
4. `SiteTelemetry` independently checks production environment, exact hostname, and configured public Measurement ID.
5. When eligible, it queues the privacy-preserving GA configuration and emits one sanitised initial page view.
6. Successful client route completions are sanitised; recognised routes emit one page view and unrecognised routes emit none.
7. Consent changes propagate immediately in the current tab and through storage events to other tabs.
8. Withdrawal removes GA cookies and reloads each document that observed an active granted-to-denied transition no more than once, leaving the subsequent document inert.

## Privacy policy

Update the Privacy Policy in plain language to state:

- GA4 is optional and loads only after the user allows analytics;
- it is used for aggregate site usage and service improvement;
- reviewed categories may include sanitised page views, referrer/traffic source, browser/device information, broad location, scroll, and outbound-click interactions;
- typed text, passage text, email address, handle, account ID, feedback content, authentication tokens, and detailed typing-performance data are not intentionally sent;
- Google may process analytics data as a service provider;
- consent can be declined or withdrawn through either Privacy or Settings;
- essential authentication/application storage is separate from optional analytics;
- browser-local practice storage may contain passage content, result summaries, expected/actual character details, timing data, and an account ID when signed in, and some of that practice data may be synchronised to Supabase.

Include an appropriate link to Google privacy information without making jurisdiction-specific legal promises.

## Error handling and storage behavior

- Unavailable, blocked, or malformed localStorage resolves conservatively to `unknown`; GA remains off.
- Invalid stored values resolve to `unknown`.
- A failed storage write does not optimistically enable GA. Consent becomes granted only after persistence succeeds.
- Cookie cleanup targets `_ga` and `_ga_*` cookies for the current host, the canonical host, and relevant domain/path variants where browser rules permit removal.
- Analytics consent cleanup never removes Supabase auth storage, theme/preferences, typing settings, passage data, or result storage.
- An absent Measurement ID, non-production build, or non-canonical hostname produces no script, configuration call, listener, or page view.

## Testing strategy

Use Vitest and Testing Library with production-host runtime inputs and mocked router events. Follow test-driven development for every new behavior.

Separate tests cover:

- consent storage validation, persistence failure, same-tab updates, storage-event synchronization, and separation from other keys;
- cookie cleanup and once-only reload on an active withdrawal;
- allowlisted static paths, query/fragment stripping, profile-route redaction, real `/404`, and suppression of unrecognised/auth-sensitive arbitrary paths;
- analytics eligibility for consent, Measurement ID, environment, and exact hostname;
- one initial page view, one successful route-completion page view, back/forward completions, listener cleanup, no duplicate listener after re-render, and no event for suppressed paths;
- unknown-to-granted activation without a duplicate initial page view;
- denial or withdrawal stopping later events;
- absence of typed content or raw dynamic values in every GA call;
- first-visit notice accessibility and both actions;
- the shared preference component on Privacy and Settings;
- accurate Privacy Policy disclosures and Google privacy link.

Verification includes the focused tests, full Vitest suite, TypeScript, ESLint, production build without a GA Measurement ID, and `git diff --check`. No live GA request or production activation is required.

## Expected files

- Create a focused analytics consent/state module under `lib/`.
- Create a provider, first-visit notice, and shared preference component under `components/`.
- Refactor `components/SiteTelemetry.tsx`.
- Wrap the app in the provider and render the global notice in `pages/_app.tsx`.
- Embed the shared preference control in `pages/privacy.tsx` and `pages/settings.tsx`.
- Add focused Vitest/Testing Library regression files under `lib/` following the repository convention.
- Add implementation notes documenting the required GA4 dashboard settings without changing them from code.

## Activation boundary

The source continues to read `NEXT_PUBLIC_GA_MEASUREMENT_ID`, but this task does not populate it anywhere. The implementation is therefore dormant after tests and build. Production activation remains a separate, explicitly authorised operation after review and after the corresponding GA4 dashboard settings are changed.
