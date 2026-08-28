# GA4 implementation and activation boundary

## Current state

The code integration is implemented but deliberately dormant. `NEXT_PUBLIC_GA_MEASUREMENT_ID` remains unset in the repository and no production configuration has been changed. GA4 cannot load unless all of these conditions are true at the same time:

1. the user has explicitly allowed analytics;
2. the application is running with `NODE_ENV=production`;
3. the browser hostname is exactly `typingstation.app`;
4. `NEXT_PUBLIC_GA_MEASUREMENT_ID` is configured.

Localhost, loopback addresses, Vercel preview domains, retired domains, unknown consent and declined consent remain untracked.

## Consent and withdrawal

The first-party preference uses the versioned localStorage key `formaltype.analytics_consent.v1` with `unknown`, `granted` and `denied` states. It is separate from Supabase sessions, account data, theme and typing preferences, and local practice/results.

The same preference is available in three places:

- a compact first-visit notice while the state is unknown;
- the public `/privacy` page, including for anonymous visitors;
- the `/settings` Privacy section as a convenience for signed-in users.

Changes synchronize within the current tab and across other open tabs through the browser `storage` event. A transition from granted to denied removes visible `_ga` and `_ga_*` cookies, stops the active route listener and reloads each open document no more than once. A first-time decline does not reload.

## Page-view policy

The integration uses direct `gtag.js` with `send_page_view: false`. One manual page view is sent after the initial client route is ready and one after each successful `routeChangeComplete` event. Failed or cancelled routes do not emit an event.

Only explicitly allowlisted application paths are reported. Public user paths are mapped to `/u/[handle]`. Query strings and fragments are removed. Referrers are reduced to their origin. Unrecognised paths disable all GA collection for the visit to that route; only the real `/404` route is reported as `/404`. Each configuration and event supplies an explicit canonical location on `https://typingstation.app` and the generic title `Typing Station`.

No User-ID, account identifiers, email addresses, handles, typed or passage content, feedback content, auth/recovery tokens, detailed typing data, advertising audiences, remarketing data, or custom typing events are sent.

## GA4 dashboard prerequisites before activation

Before configuring the Measurement ID in production, review the GA4 web stream and:

- disable Enhanced Measurement history-based page changes, because the application sends its own SPA page views;
- disable form interactions initially;
- disable site-search extraction initially;
- leave Google Signals, advertising features, Ads linking, remarketing and User-ID disabled;
- review scroll and outbound-click measurement and retain them only if their collected URLs remain non-sensitive.

These are dashboard settings and are intentionally not changed by application code.

## Review-only verification before activation

The automated suite simulates a production host and stubs `gtag`, without contacting Google. It verifies dormant states, privacy flags, consent transitions, route listener cleanup, duplicate prevention, cookie cleanup and sanitised payloads.

After this implementation report is reviewed, activation should be a separate explicitly approved operation. At that time, set the public Measurement ID only in the intended production environment, deploy through the normal release process, then verify GA4 Realtime or DebugView for:

- one initial page view;
- one page view per client navigation, including back and forward;
- no duplicate history events;
- no traffic from localhost or previews;
- no query strings, fragments, handles, account data, typed text or passage content in request payloads.

No Measurement ID, environment change, commit, push or deployment is part of this implementation.
