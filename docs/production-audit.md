# FormalType production-readiness audit

Audit date: 2026-07-13–14 (Asia/Hong_Kong)
Scope: Next.js Pages Router application, React/TypeScript client, Supabase Auth/Postgres/RLS/Storage, Vercel build, local persistence, tests and primary user journeys.

This is a living report. `Status` is updated as remediation is verified. A finding marked **verified** was reproduced by a failing test, command, rendered behavior, or direct executable code path. **Code-level risk** means the unsafe path is present but could not be exercised against the linked production Supabase project without dedicated test credentials. **Suspected** requires real-browser or production confirmation.

## Executive architecture summary

- The product is a client-rendered Pages Router application. `/practice` is also the shared engine behind `/training`, `/training/numbers`, and `/training/symbols`.
- Typing is intentionally local and latency-sensitive: keystrokes/IME events update local refs and React state; a 250 ms timer records pace; completion calculates a `TypingResult`; local previous-pace and private attempt-detail data are written before asynchronous Supabase writes.
- Auth is managed by `AuthProvider` using Supabase browser sessions. Handle onboarding is enforced after profile resolution. `ProtectedRoute` is a UX guard; database RLS is the real authorization boundary.
- Passage reads use public active rows, with local/built-in fallback. Passage management is protected by `public.is_admin()` policies after migration `202607110001_create_app_roles.sql`.
- Private result and attempt-detail reads use base tables protected by `user_id = auth.uid()`. Leaderboard and public profile reads use intentionally public views. Friend actions use RLS plus guarded security-definer RPCs.
- Progress, XP, levels, streaks, achievements and challenges are derived on read from saved results; there are no independent award or XP tables.

## Route and feature map

| Route | Access | Primary responsibility |
| --- | --- | --- |
| `/` | Public | Marketing/entry page |
| `/practice` | Public; cloud save when signed in | English/Chinese practice, IME lifecycle, timer, result review |
| `/training` | Public; cloud save when signed in | Words/numbers/symbols/code/Chinese generated drills |
| `/training/numbers`, `/training/symbols` | Public | Preset wrappers around the shared training/practice engine |
| `/passages` | Public | Filter, select and launch active passages |
| `/passages/manage` | Admin | Create/import/edit/hide/delete passages |
| `/admin/passages` | Admin compatibility redirect | Redirects to passage management |
| `/leaderboard` | Public | Public result projection and filters |
| `/login`, `/logout`, `/onboarding/handle` | Public/auth transition | Session and public-handle lifecycle |
| `/profile` | Authenticated | Private stats, identity, charts, achievements and insights |
| `/profile/account` | Authenticated; recovery callback without an existing session | Name/password/stats/account deletion, or a dedicated new-password recovery form |
| `/profile/friends` | Authenticated | Requests, friendships and comparisons |
| `/profile/public`, `/analytics` | Compatibility redirects | Redirect to current profile information architecture |
| `/u/[handle]` | Public | Public/private-profile state and public-safe statistics |
| `/settings` | Public | Local theme, typing behavior and sound persistence |
| `/terms`, `/privacy`, `/security` | Public | Legal/trust content |
| `/robots.txt`, `/sitemap.xml` | Public server output | Discovery metadata |

## Core lifecycle and data boundaries

1. A passage is resolved from Supabase, then local active passages/built-in samples. Language, category, mode and passage selection are persisted locally.
2. `Tab` activates the input. English uses a controlled hidden textarea. Chinese uses a visible persistent textarea and explicit `compositionstart/update/end` handling with a zero-delay fallback for browser event ordering.
3. Keystrokes never await the network. Refs hold the authoritative status, start time, typed text, error events and per-character delays; React state renders feedback.
4. Time-up, text completion, or `Escape` runs `calculateResult`. The result is written to local previous-pace history; signed-in users also write a private attempt detail and a Supabase `typing_results` row asynchronously.
5. Base `profiles`, `typing_results`, `typing_attempt_details` and `friendships` rows are private through RLS. `typing_results_leaderboard`, `public_profiles`, and `public_profile_typing_results` are explicitly public projections and therefore require stricter projection/eligibility controls.

## Baseline verification

- `pnpm lint`: passed with no warnings.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm build`: passed; 24 routes generated. Shared first-load JS was 171 kB; `/practice` 197 kB and `/training` 205 kB.
- `pnpm test`: failed: 402 passed, 5 failed. Two failures expose a Chinese punctuation normalization regression; one checks an outdated Chinese running-state label; one Settings test queries the global footer instead of the settings nav; one correctly detects three storage writes bypassing the safe wrapper.
- `pnpm audit --prod`: 15 advisories: 5 high, 8 moderate, 2 low. All originate from unsupported Next.js 14.2.35 or its bundled PostCSS.
- Live Supabase RLS scripts could not be run: `.env.local` has public connection values but no `SUPABASE_TEST_EMAIL` / `SUPABASE_TEST_PASSWORD`. This is recorded as an environment verification gap, not treated as proof that policies fail.

## Finding counts

| Severity | Count |
| --- | ---: |
| Critical | 0 |
| High | 7 |
| Medium | 22 |
| Low | 5 |
| **Total** | **34** |

## Prioritized findings

### FT-DEP-001 — Unsupported Next.js line has known production advisories

- Severity / priority: **High / P0**
- Category: Dependency security / deployment
- Affected: `package.json`, `pnpm-lock.yaml`
- Reproduction: run `pnpm audit --prod`.
- Expected: production dependencies have no known high-severity advisories and the framework is on a supported release line.
- Actual: Next.js 14.2.35 is unsupported and the baseline audit reports 5 high, 8 moderate and 2 low advisories; the latest rescan requires 15.5.18 plus patched PostCSS for the complete reported set.
- Impact: exposure to framework DoS/SSRF/cache/middleware issues depending on deployed features; no future routine security fixes on 14.x.
- Proposed fix: upgrade Next.js and `eslint-config-next` to a patched 15.x Maintenance LTS release, retain Pages Router/React 18 compatibility, run the full regression suite and build.
- Regression risk: **High** (major framework upgrade), mitigated by the full regression suite and route smoke tests.
- Evidence / status: **Verified and fixed locally with Next.js 15.5.18 plus patched PostCSS 8.5.10; final production advisory scan reports no known vulnerabilities**.

### FT-SEC-002 — Public leaderboard trusts client-submitted performance metrics

- Severity / priority: **High / P0**
- Category: Security / data integrity
- Affected: `lib/typingResultStorage.ts`; `202606140002_create_typing_results.sql`; leaderboard views
- Reproduction: an authenticated Supabase client can insert its own row with arbitrary positive `wpm`, valid-range `accuracy`, duration and counts; RLS checks ownership only.
- Expected: public ranking accepts only coherent, eligible attempts and applies server-side bounds/timestamps.
- Actual: ownership is enforced, but performance fields and `created_at` remain client-controllable through direct REST calls.
- Impact: fabricated ranks, manipulated date ranges, distorted public trust and derived profile awards.
- Proposed fix: harden new inserts with server timestamp/owner trigger, finite/bounded constraints, persisted elapsed/completion metadata and leaderboard eligibility. Treat full anti-cheat as a separate server-verified protocol risk.
- Regression risk: **Medium**; existing legacy rows need a conservative backfill.
- Evidence / status: **Verified code-level risk and materially mitigated. Migrations `202607130002` and `202607130004` are applied. Live checks confirm domain-aware coherence, server-owned official-passage metadata, inactive-passage exclusion and the ranked-domain projection; the anonymous public result set decreased from 28 legacy rows to 18 qualifying rows without deleting private history. A client can still submit fabricated metrics that are mutually coherent, so a full server-verified attempt protocol remains a residual launch risk**.

### FT-DATA-003 — `isRankable` is discarded and unrankable sessions are public

- Severity / priority: **High / P0**
- Category: Calculation / leaderboard integrity
- Affected: `pages/practice.tsx`, `lib/typing-engine.ts`, `lib/typingResultStorage.ts`, leaderboard view migrations
- Reproduction: finish before 15 seconds or below 70% accuracy; `calculateResult` returns `isRankable=false`, but the saved row has no eligibility field and the view includes it.
- Expected: all results may remain in private history, while only rankable results appear publicly.
- Actual: the eligibility decision exists only in memory.
- Impact: short bursts and low-quality results can rank; manual finishes also store selected duration rather than measured elapsed duration.
- Proposed fix: persist `elapsed_seconds`, `completion_reason`, and derived eligibility; filter the leaderboard view.
- Regression risk: **Medium** due to legacy result classification.
- Evidence / status: **Verified from executable path and schema; fixed in client and the applied migration `202607130002`. The live anonymous public-boundary check returned only qualifying public rows**.

### FT-FUNC-004 — Unicode compatibility normalization changes Chinese punctuation

- Severity / priority: **High / P1**
- Category: Chinese IME / functional correctness
- Affected: `lib/typing-engine.ts`, `/practice`
- Reproduction: load a target containing `，` or `！`; `normalizeComparableUnicode` applies NFKC, so rendered comparison characters become `,` and `!`.
- Expected: visually authored Chinese punctuation remains unchanged while variation selectors do not create false errors.
- Actual: compatibility normalization mutates target punctuation and breaks punctuation/newline regression tests.
- Impact: Chinese passages display incorrectly and strict punctuation practice no longer reflects source content.
- Proposed fix: use canonical NFC normalization and retain explicit variation-selector removal; add fullwidth punctuation tests.
- Regression risk: **Low**.
- Evidence / status: **Verified by 2 failing tests and direct reproduction; fixed and covered by regression tests**.

### FT-DATA-005 — Result writes have no durable idempotency key

- Severity / priority: **Medium / P1**
- Category: Data integrity / network failure
- Affected: result insert schema and `saveSupabaseTypingResult`
- Reproduction: repeat the same authenticated insert after a lost response or invoke the client call twice; each insert receives a new database UUID.
- Expected: one logical attempt maps to one row, including retries.
- Actual: in-component refs prevent common double finish events, but the database cannot recognize retries.
- Impact: duplicated history, XP, achievements and ranks.
- Proposed fix: persist a per-attempt client identifier with a unique `(user_id, client_attempt_id)` index and recover the existing row on a duplicate-key response.
- Regression risk: **Low–Medium**.
- Evidence / status: **Verified code-level risk; fixed in client and the applied migration `202607130002`, with duplicate-key recovery tests. An authenticated lost-response retry still requires staging credentials for live exercise**.

### FT-PRIV-006 — Private profiles still expose and render avatar identity

- Severity / priority: **Medium / P1**
- Category: Privacy
- Affected: `202606230001_public_profile_private_state.sql`, `/u/[handle]`
- Reproduction: set `public_profile_enabled=false`; `public_profiles` still returns `avatar_style` and `avatar_path`, and the private card renders the avatar.
- Expected: a private profile exposes only the minimum state required to show that the handle exists and is private.
- Actual: avatar metadata and the public storage URL remain visible.
- Impact: identity leakage after a user disables their public profile.
- Proposed fix: project null avatar fields for private profiles and render a neutral private-state icon.
- Regression risk: **Low**.
- Evidence / status: **Verified from view and component; migration `202607130003` is applied and the live public projection exposes no private identity fields. The current dataset has no private profile row, so that exact redaction branch is not live-exercised**.

### FT-SEC-007 — Security response headers are absent

- Severity / priority: **Medium / P1**
- Category: Security hardening / deployment
- Affected: missing Next configuration
- Reproduction: inspect current app configuration/build; no global `X-Content-Type-Options`, frame protection, referrer policy, permissions policy or HSTS is configured.
- Expected: baseline browser hardening is applied without breaking Supabase/Auth/AdSense.
- Actual: deployment relies entirely on host defaults.
- Impact: weaker defense in depth for clickjacking, MIME sniffing and referrer/feature leakage.
- Proposed fix: add conservative global headers and an enforced source allow-list CSP that covers the configured Supabase, analytics and advertising integrations.
- Regression risk: **Low** for selected headers.
- Evidence / status: **Verified configuration gap; fixed with HSTS, MIME/referrer/feature/frame protections and an enforced CSP, with configuration regression coverage. Pages Router hydration still requires `unsafe-inline`; a nonce-only CSP would require a separately tested rendering change. Preview/production response verification remains required**.

### FT-DATA-008 — “Current streak” can remain active indefinitely

- Severity / priority: **Medium / P1**
- Category: Statistics / timezone
- Affected: `lib/analytics.ts`
- Reproduction: pass consecutive results whose latest day is weeks before `now`; streak counting starts from the latest saved date and never checks whether it is today/yesterday.
- Expected: current streak is zero after missing the allowed current-day boundary.
- Actual: an old historical streak is reported as current and grants XP/achievements.
- Impact: incorrect levels, streak achievements and challenge motivation.
- Proposed fix: make streak calculation `now`-aware in local time; retain a streak only when the last active date is today or yesterday.
- Regression risk: **Low**, but existing displayed XP may decrease to the correct value.
- Evidence / status: **Verified code-level calculation; fixed and covered by stale-date boundary tests**.

### FT-DATA-009 — Malformed numeric/timestamp rows poison analytics

- Severity / priority: **Medium / P1**
- Category: Calculation robustness
- Affected: `lib/analytics.ts`, result row mapping, schema constraints
- Reproduction: pass `NaN`, `Infinity`, a negative duration, or an invalid timestamp into `buildProgressAnalytics`; averages, maxima, sorting or date logic can become invalid.
- Expected: malformed partial/legacy data is excluded or safely normalized.
- Actual: analytics assumes every row is finite and parseable; PostgreSQL `numeric` also needs explicit upper/NaN defenses.
- Impact: broken charts, `NaN` UI, invalid XP and unstable ordering.
- Proposed fix: validate analytics inputs and add bounded future-row constraints.
- Regression risk: **Low**.
- Evidence / status: **Verified code-level risk; fixed in analytics and covered by malformed-row tests. The applied `202607130002` constraints protect new rows; legacy constraint validation remains a database verification item**.

### FT-FUNC-010 — Failed cloud saves are silent

- Severity / priority: **Medium / P1**
- Category: Error state / data loss perception
- Affected: `/practice` result lifecycle
- Reproduction: reject the Supabase result insert; the only feedback is `console.warn`.
- Expected: the result modal states saving/saved/failed and clarifies whether a local copy remains.
- Actual: the user can close the modal believing cloud history was saved.
- Impact: unnoticed loss during expired sessions or network failures.
- Proposed fix: expose non-blocking save state in an ARIA live region and keep typing input independent of the request.
- Regression risk: **Low**.
- Evidence / status: **Verified from catch path; fixed with non-blocking live-region feedback and regression coverage**.

### FT-FUNC-011 — Library fallback differs from Practice fallback

- Severity / priority: **Medium / P1**
- Category: Empty state / cross-page consistency
- Affected: `/passages`, `pages/practice.tsx`, `lib/app-storage.ts`
- Reproduction: Supabase returns zero rows, or returns English rows without Chinese rows. Practice adds built-in Chinese samples/local fallback; Library shows no matching passages.
- Expected: both pages resolve the same active public/sample library.
- Actual: Library only falls back on a thrown request, not on empty/partial data.
- Impact: users can type passages they cannot discover or select in Library.
- Proposed fix: merge built-in samples with remote rows and use active local fallback for an empty response.
- Regression risk: **Low**.
- Evidence / status: **Verified code path; fixed by sharing active local/built-in fallback behavior**.

### FT-UX-012 — Leaderboard duration labels are inaccurate

- Severity / priority: **Medium / P2**
- Category: UI/UX correctness
- Affected: `/leaderboard`
- Reproduction: a 15-second result formats as `0 min`, 30 seconds as `1 min`; the no-duration filter value `All` is labelled `Infinite`.
- Expected: exact seconds/minutes and truthful filter labels.
- Actual: rounded minute display and a mismatched label/value.
- Impact: users misread training ranks and filtering scope.
- Proposed fix: format sub-minute results in seconds and label the unfiltered choice `All`.
- Regression risk: **Low**.
- Evidence / status: **Verified; fixed and covered by exact-duration tests**.

### FT-A11Y-013 — Application landmark hierarchy is invalid

- Severity / priority: **Medium / P1**
- Category: WCAG landmarks
- Affected: `components/AppShell.tsx`
- Reproduction: inspect the DOM: the outer `<main>` contains header, nav, page content, aside and footer; the skip target is a generic `<div>`.
- Expected: one main landmark containing primary page content, with header/nav/footer outside it.
- Actual: landmark boundaries are misleading to screen-reader navigation.
- Impact: less predictable landmark and skip-link use across every app-shell route.
- Proposed fix: use an outer `<div>` and promote `#main-content` to `<main>`.
- Regression risk: **Low**.
- Evidence / status: **Verified DOM; fixed, unit-tested and browser-smoke-tested**.

### FT-A11Y-014 — Admin dialogs do not trap or restore focus

- Severity / priority: **Medium / P1**
- Category: WCAG dialog interaction
- Affected: `/passages/manage` edit and preview dialogs
- Reproduction: open either dialog and press Tab past its last control; focus can move behind the modal. Close it; original trigger focus is not restored.
- Expected: initial focus, focus trap, Escape close and trigger restoration.
- Actual: only initial focus and Escape are implemented.
- Impact: keyboard and screen-reader users lose context in an admin-critical flow.
- Proposed fix: add a reusable focus-containment/restoration hook and modal scroll lock.
- Regression risk: **Low–Medium**.
- Evidence / status: **Verified from interaction code; fixed with containment, Escape, restoration and scroll locking; admin browser verification requires a real admin session**.

### FT-A11Y-015 — Notification popover lacks Escape/focus semantics

- Severity / priority: **Medium / P2**
- Category: Keyboard interaction
- Affected: `components/NotificationCenter.tsx`
- Reproduction: open with keyboard and press Escape; it remains open. The trigger has no `aria-controls`/`aria-haspopup`, and closure does not deliberately restore focus.
- Expected: expanded relationship is announced; Escape closes and returns focus.
- Actual: only pointer-outside and repeat-trigger closure are supported.
- Impact: keyboard friction in global navigation.
- Proposed fix: add popup semantics, Escape handling and focus restoration.
- Regression risk: **Low**.
- Evidence / status: **Verified; fixed with popup semantics, Escape and focus restoration**.

### FT-STOR-016 — Three production storage writes bypass quota-safe persistence

- Severity / priority: **Medium / P2**
- Category: Reliability / local persistence
- Affected: `announcementStorage.ts`, `notificationSettings.ts`, `profileDisplaySettings.ts`
- Reproduction: `lib/storageSafety.test.ts` reports all three files; force localStorage quota failure to throw from these writes.
- Expected: app-owned writes go through the central safe wrapper and never interrupt UI interactions.
- Actual: direct `localStorage.setItem` calls can throw.
- Impact: notification/settings actions may fail noisily in constrained/private storage environments.
- Proposed fix: use `safeSetJsonStorageItem` and retain safe read fallbacks.
- Regression risk: **Low**.
- Evidence / status: **Verified failing test; fixed through the central quota-safe wrapper and regression test**.

### FT-AUTH-017 — No password recovery flow

- Severity / priority: **Medium / P2**
- Category: Authentication lifecycle
- Affected: `/login`, `/profile/account`
- Reproduction: a logged-out existing user who forgot their password has no recovery action.
- Expected: production accounts can request Supabase password recovery and complete the recovery session safely.
- Actual: the original product only exposed login/signup and in-session password change. The first recovery callback also reused the general Account page instead of isolating the password-reset task.
- Impact: permanent account lockout without operator intervention.
- Proposed fix: add a minimal recovery request and a dedicated recovery-session form, require password confirmation, sign out after success, and verify the redirect allow-list.
- Regression risk: **Medium** because it requires production Auth URL configuration and email testing.
- Evidence / status: **Verified product gap; fixed, regression-tested and live-verified with a dedicated team test account. A fresh email opened the dedicated recovery-only form, the new password was accepted, the session signed out, and the previous password was rejected on the next login. Invalid/expired-link handling is also covered. The live Supabase Auth Site URL and redirect allow-list were compared through the authenticated CLI without changing MFA/email/OTP settings. FT-AUTH-027 remains a separate public-delivery risk because this successful test used an address permitted by the built-in sender**.

### FT-RLS-018 — Authorization verification is not automated with separate principals

- Severity / priority: **Medium / P1**
- Category: Security testing
- Affected: `scripts/testSupabase*.ts`, deployment process
- Reproduction: current scripts require one optional test account and are not part of `pnpm test`; no repeatable two-user checks prove cross-user denial for profiles/results/friendships/attempt details.
- Expected: a disposable test environment verifies anon/user-A/user-B/admin allow/deny matrices after migrations.
- Actual: migrations look structurally sound, but live authorization could not be exercised in this workspace.
- Impact: policy or migration-order regressions may reach production undetected.
- Proposed fix: add SQL/CLI verification for a fresh local or staging Supabase project; never run destructive tests against real user data.
- Regression risk: **Low**; environment setup required.
- Evidence / status: **Partially fixed. A repeatable anonymous public-boundary script passed against the linked Supabase project after migration `202607130004`: private base tables returned no rows, 131 passages were active/public, and both public result views returned 18 qualifying rows. A separate opt-in staging script now covers user-A/user-B/admin cross-read, cross-write, server-owned result and admin-passage checks with temporary-row cleanup; execution remains open pending three dedicated test accounts. The genuinely-private-profile projection branch also remains unexercised because the current data set contains no private profile**.

### FT-DOC-019 — Repository has no README/fresh-setup contract

- Severity / priority: **Low / P3**
- Category: Maintainability / deployment
- Affected: repository root
- Reproduction: `README.md` is absent; setup is split between `DEV_NOTES.md` and `LAUNCH_CHECKLIST.md`.
- Expected: required Node/pnpm versions, environment variables, migration order and verification commands are documented.
- Actual: a fresh operator must infer setup.
- Impact: deployment and recovery mistakes.
- Proposed fix: add a concise production-focused README and environment matrix.
- Regression risk: **None**.
- Evidence / status: **Verified; fixed with a fresh-setup and production-operation README**.

### FT-ERR-020 — Default 404 and no route-level production error page

- Severity / priority: **Low / P3**
- Category: Error handling / polish
- Affected: Pages Router special pages
- Reproduction: build route table shows the generated default `/404`; there is no custom `pages/404.tsx` or `pages/500.tsx`.
- Expected: broken links and server errors retain product navigation and recovery action.
- Actual: global React render failures have a boundary, but route/server failures use defaults.
- Impact: inconsistent recovery and brand experience.
- Proposed fix: add minimal, accessible 404/500 pages using existing visual language.
- Regression risk: **Low**.
- Evidence / status: **Verified; fixed with restrained accessible 404 and 500 pages**.

### FT-UX-021 — Tablet-width header overflows horizontally

- Severity / priority: **Medium / P2**
- Category: Responsive navigation
- Affected: `components/AppShell.tsx`; all AppShell routes at approximately 768 px
- Reproduction: render `/settings` at 768 px; the desktop navigation and account/login controls make the document 773 px wide and clip the final control.
- Expected: no horizontal page overflow; compact navigation remains available until the full row fits.
- Actual: the desktop navigation breakpoint activates five pixels too early for the complete header.
- Impact: horizontal panning and a partially clipped login/account action on common tablet and 200%-zoom-equivalent layouts.
- Proposed fix: keep the accessible compact navigation through tablet widths and activate the desktop row at the large breakpoint.
- Regression risk: **Low**.
- Evidence / status: **Verified in a real browser at 768 px; fixed and reverified with no overflow and working Escape/focus restoration**.

### FT-PRIV-022 — Public profile view exposes non-qualifying result history

- Severity / priority: **Medium / P1**
- Category: Privacy / public data projection
- Affected: `public.public_profile_typing_results`; `/u/[handle]`; `pages/privacy.tsx`
- Reproduction: enable a public profile, then save an attempt shorter than 15 seconds or below 70% accuracy; the public-profile result view returns it even though it is not leaderboard-eligible.
- Expected: the public projection matches the published privacy statement and exposes only qualifying public results; complete history remains private to the account owner.
- Actual: every saved result for an enabled public profile is projected, including incomplete, low-accuracy and manually ended attempts.
- Impact: a user can unintentionally disclose practice history that the product describes as non-qualifying.
- Proposed fix: filter the public-profile result view on server-derived `is_rankable`; retain all rows in the owner-only base table.
- Regression risk: **Low–Medium** because public profile totals may decrease to the privacy-aligned subset.
- Evidence / status: **Verified from the view definition and privacy copy; fixed by the applied migrations `202607130003` and `202607130004`. The final live anonymous public-boundary check returned 18 qualifying public-profile rows and no non-qualifying row**.

### FT-TEST-023 — Passing component tests still emit asynchronous update warnings

- Severity / priority: **Low / P3**
- Category: Test maintainability
- Affected: primarily `lib/app-shell.test.tsx`; Vitest/Vite configuration
- Reproduction: run the full suite; several AppShell cases print React `act(...)` warnings, and Vitest prints the Vite CommonJS API deprecation notice.
- Expected: a green suite is also warning-clean so new interaction warnings remain visible.
- Actual: all assertions pass, but known harness warnings add noise.
- Impact: no production behavior impact; future regressions can be easier to overlook in CI output.
- Proposed fix: await the relevant asynchronous header/notification updates and migrate the test config away from Vite's deprecated CommonJS API during a focused tooling update.
- Regression risk: **Low**, but broad test-harness edits were deliberately excluded from this production fix set.
- Evidence / status: **Verified and fixed. AppShell tests now settle only relevant asynchronous work, Vitest is on 3.2.4, and the ESM test configuration removes the Vite CommonJS warning. Targeted and full runs are warning-clean apart from intentional failure-path logging**.

### FT-PERF-024 — Local attempt-detail history exceeds a practical aggregate storage budget

- Severity / priority: **Medium / P2**
- Category: Performance / local persistence
- Affected: `lib/typingStatistics.ts`
- Reproduction: append 75 fallback details containing 1,500 keystrokes and 120 timeline points each; every write reparses and serializes up to 50 maximum-sized records.
- Expected: fallback history remains bounded by both record count and total payload so saving a result does not cause long main-thread work or predictable storage quota exhaustion.
- Actual: per-record and record-count limits still permit a multi-megabyte aggregate payload; the stress regression exceeded the five-second test limit.
- Impact: unusually long passages/history can make result persistence lag and eventually discard local fallback data when storage quota is reached.
- Proposed fix: retain 50 session summaries while budgeting detailed local data newest-first to 15,000 keystroke events and 3,000 timeline points; cloud detail remains independently bounded by the database schema.
- Regression risk: **Low**; older fallback summaries remain, while their oldest per-key detail may be omitted after the aggregate budget is consumed.
- Evidence / status: **Verified by a timed-out stress test; fixed with stronger aggregate-bound assertions. The targeted test decreased from approximately 5.8 seconds to 0.9 seconds**.

### FT-SEO-025 — Canonical and social preview image URLs are relative

- Severity / priority: **Low / P2**
- Category: Deployment metadata / link previews
- Affected: `/`, `pages/_app.tsx`, `pages/index.tsx`, `public/formaltype-share.*`
- Reproduction: inspect the deployed preview HTML; canonical is `/` and Open Graph/Twitter images are `/formaltype-share.svg`.
- Expected: crawlers receive absolute canonical/share URLs and a broadly supported 1200×630 raster image.
- Actual: relative URLs and SVG make link-preview resolution dependent on crawler behavior.
- Impact: shared links may omit or misresolve their preview image; canonical interpretation is less explicit.
- Proposed fix: build all metadata URLs from the configured production origin, publish a PNG version of the existing artwork and declare its type/dimensions.
- Regression risk: **Low**; no visible layout or navigation behavior changes.
- Evidence / status: **Verified on the protected Vercel preview, fixed, unit-tested and redeployed. The final HTML contains absolute production URLs; the served PNG is 1200×630, `image/png`, and byte-identical to the local asset**.

### FT-DEP-026 — Local production CSP upgrades HTTP assets to unavailable HTTPS

- Severity / priority: **Low / P2**
- Category: Deployment / local verification
- Affected: `next.config.js`; any local `next start` production smoke test
- Reproduction: run the production build on `http://127.0.0.1`; the response includes `upgrade-insecure-requests`, so the browser requests local CSS/scripts over HTTPS and renders an unstyled document because no TLS listener exists.
- Expected: Vercel HTTPS deployments enforce secure upgrades and HSTS; local HTTP production verification remains usable while retaining the other baseline security headers.
- Actual: the original environment check treated every non-development process as HTTPS-capable.
- Impact: local production UI, recovery and responsive checks produce false failures and cannot exercise JavaScript reliably.
- Proposed fix: emit HTTPS-only directives only when `VERCEL=1`; keep CSP, frame denial, MIME, referrer and permissions headers for local production.
- Regression risk: **Low**.
- Evidence / status: **Verified in a real browser and response headers; fixed and covered by environment-specific header tests. The rebuilt local page is styled and interactive, returns HTTP 200, omits HSTS/HTTPS upgrade, and retains the remaining security headers**.

### FT-AUTH-027 — Supabase default email service is not production-capable

- Severity / priority: **High / P0**
- Category: Authentication availability / external configuration
- Affected: Supabase Auth email confirmation and password recovery
- Reproduction: request recovery repeatedly on the linked project; the live Auth response returns `email rate limit exceeded`. Supabase documents that its default sender is best-effort, limited to project-team recipients and currently capped at two messages per hour.
- Expected: real users can reliably receive signup, confirmation and recovery email with an operator-controlled sender, monitored deliverability and suitable rate limits.
- Actual: the linked project still uses the built-in sender; the application cannot raise that service's production limits.
- Impact: non-team users may receive no account email, and valid users can be locked out of recovery during ordinary retries.
- Proposed fix: configure a verified custom SMTP provider in Supabase Auth, set suitable Auth email limits, test signup/recovery to a non-team mailbox, and monitor bounces/delivery before beta.
- Regression risk: **Medium** because sender DNS, templates, redirect links and deliverability must be verified together; no SMTP secret belongs in client code.
- Evidence / status: **Verified live infrastructure failure and official platform limitation. Application UX is mitigated: raw provider errors are replaced with a non-enumerating, actionable rate-limit message announced as an error. Infrastructure remediation remains open and is a launch blocker for public email/password authentication**.

## Follow-up product review (2026-07-14)

- **FT-FUNC-028 — Time-up result could be displaced by a held key** — High / P1, `/practice`. Reproduced in the interaction path where the timer completed while a keyboard shortcut/input event was still queued. The result modal now synchronously locks finished state, blurs both input paths, clears pending sound, and rejects post-finish input. Covered by the 5-minute time-up regression test.
- **FT-PERF-029 — Chinese switching could refetch the full passage library** — Medium / P2, `/practice`. Code-level risk reproduced by rapid language switching; an in-flight library promise and shared cache now prevent duplicate Supabase reads. Native Safari/network latency remains a device check.
- **FT-UX-030 — Feedback control covered footer/result content** — Medium / P2, `FeedbackButton`. Reproduced in short/desktop layouts; the control is now in document flow with safe-area spacing rather than viewport-fixed.
- **FT-UX-031 — App-font preference did not cover all interface utilities** — Medium / P2, theme CSS/Tailwind config. Reproduced by hard-coded utility font stacks; runtime font variables now drive body, interface, controls and utility classes while the typing font remains independent.
- **FT-UX-032 — Announcement read state was not scoped reliably to the signed-in account** — Medium / P2, notification center. Reproduced as a read-state collision across account sessions; read IDs now use a per-user key with legacy migration and are marked when the panel opens. Storage-blocked/private-mode persistence remains a browser limitation.
- **FT-AUTH-033 — Password manager suggestions obscured manual password replacement** — Medium / P1, `/profile/account`. Reproduced with generated password autofill; account password fields are now modal-only, use `new-password` and unique names, ignore common manager hints, and expose a clear-fields action. Safari/password-manager verification remains manual.
- **FT-AUTH-034 — Handle cooldown and user blocking needed a server boundary** — High / P0, account/friends/public profile. Client controls and UI are implemented; migration `202607140005_profile_handle_cooldown_and_user_blocks.sql` adds the 30-day trigger, guarded RPCs, block table and friendship restrictions. It must be applied before release; live RLS verification is still pending.

## RLS and privacy assessment

The reviewed policies correctly prevent direct client writes to other users' profiles, base results, attempt details, friendships and roles. Admin passage authorization is not solely frontend-based after the roles migration. Public views intentionally bypass private-table visibility by projecting selected fields; therefore view definitions are security-critical. The concrete projection issues are leaderboard eligibility/trust, private avatar leakage, and public exposure of non-qualifying profile history. Security-definer friend/account RPCs check `auth.uid()` and revoke anonymous execution. No service-role secret is present in client code; the checked environment example contains only a publishable Supabase key.

## Implementation order

1. P0: dependency upgrade; result/leaderboard schema hardening and eligibility.
2. P1: Chinese punctuation regression; privacy projection; stale streak/malformed data; save feedback; library fallback; landmarks/dialog focus; RLS regression fixtures where environment permits.
3. Low-risk P2: storage wrappers, notification keyboard behavior, duration labels, mobile/modal polish.
4. P3: README and minimal error pages after functional verification.

## Production-only verification still required

- Run the prepared user-A/user-B/admin allow/deny matrix with three dedicated staging accounts, including the genuinely-private-profile branch and lost-response result retry.
- Configure a verified custom SMTP sender, then test signup, login, onboarding, password confirmation and recovery delivery end to end using a non-team test mailbox. Supabase Auth Site URL and callback allow-list configuration are already verified.
- Repeat browser-console, failed-network-save, native Safari IME and physical-mobile checks while authenticated. Keyboard navigation and simulated viewport checks passed locally; Vercel Deployment Protection prevented anonymous interactive preview inspection, but authenticated HTTP smoke checks passed.
- Promote only after the chosen production/custom domain and HTTPS redirect are final; recheck canonical/share previews on that production release.
- Design a server-verified attempt protocol if leaderboard anti-cheat must resist coherent direct-API fabrication rather than only reject implausible/ineligible rows.
- Confirm GA/AdSense consent and CSP/source requirements before enabling either integration; both remain disabled.

## Current verification

- Full Vitest suite: **48 files, 454 tests passed; no failed or skipped tests** (deterministic single-worker configuration).
- ESLint: **passed with no errors**.
- TypeScript (`tsc --noEmit`): **passed**.
- Next.js 15.5.18 production build: **passed; 24 routes generated**. Shared first-load JavaScript is 173 kB; `/practice` is 200 kB and `/training` is 208 kB.
- Production dependency advisory scan: **no known vulnerabilities found**.
- Browser route/overflow smoke: `/practice`, `/training`, `/passages`, `/leaderboard`, `/settings`, `/login`, a public profile path, and a missing route were exercised. No horizontal overflow was found at 320, 375, 390, 1024, 1280, 1440 or 1920 px. A verified 768 px overflow was fixed and rechecked; the final local build also passed the route set at the available 1265 px browser viewport with exactly one main landmark per route.
- Keyboard/IME smoke: skip/main landmark and compact navigation Escape/focus restoration passed. English Practice accepted `Tab` and exposed its running timer; Chinese Practice rendered the persistent IME textarea and current passage correctly. Native Safari/system-IME completion remains verified by the Safari-order composition regression tests rather than a physical Safari device.
- Local HTTP response verification: CSP, MIME sniffing, frame denial, referrer and permissions headers are present. HTTPS-only HSTS and `upgrade-insecure-requests` are intentionally omitted for local HTTP and remain enabled on Vercel; environment-specific regression tests cover both branches and prove `unsafe-eval` is absent.
- Vercel project `novicetech-projects/typing` is linked. Supabase public variables exist for Production and Preview; `NEXT_PUBLIC_SITE_URL=https://typing-puce-one.vercel.app` is configured for both. Ad/analytics environment values are absent, so those integrations remain disabled.
- Live anonymous Supabase public-boundary checks passed after migration `202607130004`: private base projections returned zero rows, 131 active passages remained public, and the leaderboard/public-profile views each returned 18 qualifying results (down from 28 before the tighter coherence migration). Authenticated RLS still requires dedicated staging credentials. Password recovery completed end to end with a permitted team test address and the old password was rejected; delivery to ordinary non-team users remains blocked pending custom SMTP (FT-AUTH-027).
- Live Supabase Auth configuration comparison passed: the Site URL is `https://typing-puce-one.vercel.app`; the production wildcard and the latest preview's exact recovery callback are allowed; MFA TOTP, confirmed-email policy, OTP length/frequency and all unrelated service settings were preserved. After replacing the previous preview callback, a second comparison reported API, DB, Auth and Storage configs up to date.
- Vercel preview `typing-k1yv4g4dt-novicetech-projects.vercel.app` (`dpl_7ueKNJXeQvLiLirTn2WMzuw1FXjD`) is READY on Node 24.16.0. Authenticated smoke checks returned 200 for the landing page, Practice and recovery request route, plus 404 for a missing route. CSP upgrade/HSTS/frame/MIME/referrer/permissions headers passed and preview is `noindex`. Error-level and HTTP 500 log queries returned no records. Deployment Protection still prevents an anonymous interactive preview pass, so authenticated account and physical-device branches remain manual.
- React `act(...)` and Vite CommonJS deprecation warnings are fixed. The quota failure log is an intentional assertion path, not a harness warning.
- A final PR-style regression review fixed stale result-save responses crossing session boundaries, destructive local-detail upserts, thrown-network busy states, false local-persistence success, measured-time totals, Safari storage/viewport fallbacks, over-broad HSTS policy, and result-dialog focus restoration. These paths are covered by user-behaviour tests and the final local browser smoke.
- Follow-up fixes cover the time-up keyboard race, duplicate passage-library fetches, account edit dialogs/password autofill, announcement read scoping, app-font propagation, feedback placement, bulk punctuation normalization and server-enforced handle/block controls. Migration `202607140005` remains the only new database prerequisite.

## Remediation status summary

| State | Findings |
| --- | --- |
| Fixed and locally verified | FT-FUNC-004, FT-SEC-007, FT-DATA-008, FT-DATA-009, FT-FUNC-010, FT-FUNC-011, FT-UX-012, FT-A11Y-013, FT-A11Y-015, FT-STOR-016, FT-AUTH-017, FT-DOC-019, FT-ERR-020, FT-UX-021, FT-TEST-023, FT-PERF-024, FT-SEO-025, FT-DEP-026, FT-FUNC-028, FT-PERF-029, FT-UX-030, FT-UX-031, FT-UX-032, FT-AUTH-033 |
| Implemented; production/staging configuration or live branch verification required | FT-DEP-001, FT-DATA-003, FT-DATA-005, FT-PRIV-006, FT-A11Y-014, FT-PRIV-022, FT-AUTH-034 |
| Partially mitigated; residual launch risk remains | FT-SEC-002 |
| Partially closed environment-level verification gap | FT-RLS-018 |
| Open external launch blocker | FT-AUTH-027 |
