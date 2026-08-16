# SEO and Search Discoverability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Typing Station's existing English and Chinese typing surfaces understandable and indexable without changing the typing experience or adding marketing-heavy content.

**Architecture:** A shared route metadata contract will own indexability, titles, descriptions, canonical URLs, social metadata, sitemap entries, robots output, and homepage structured data. The app shell will render that contract centrally while the homepage receives only concise visible copy and crawlable links.

**Tech Stack:** Next.js Pages Router, React 18, TypeScript, Vitest, Next Head/Document.

## Global Constraints

- Do not change typing calculations, session lifecycle, timer, IME, completion, eligibility, Previous Pace, Corpus v2 prose, database schema, or production data.
- Do not add hidden SEO text, keyword stuffing, doorway pages, analytics, trackers, hreflang, invented facts, ratings, reviews, pricing, or offers.
- Keep query and filter variants canonicalized to their clean public route.
- Conservatively noindex public profiles because privacy visibility resolves after client hydration.
- Keep the homepage typing-first and add no third-party scripts or large bundles.

---

### Task 1: Shared metadata and indexability contract

**Files:**
- Modify: `lib/siteMetadata.ts`
- Modify: `lib/siteMetadata.test.ts`
- Create: `components/SiteMetadata.tsx`
- Create: `lib/site-metadata-component.test.tsx`
- Modify: `pages/_app.tsx`
- Create: `pages/_document.tsx`

**Interfaces:**
- Produces: `INDEXABLE_SITE_ROUTES`, `getRouteSeoMetadata()`, `getCanonicalUrl()`, `getWebApplicationStructuredData()`, and `SiteMetadata`.

- [x] Add failing tests for distinct public metadata, noindex utility/private routes, clean canonicals, social tags, parseable homepage JSON-LD, and `lang="en"`.
- [x] Run the focused tests and confirm they fail because the shared contract and component do not exist.
- [x] Implement the pure route policy and central head renderer, using only the configured production site origin.
- [x] Run the focused tests and confirm they pass.

### Task 2: Sitemap, robots, and visible homepage context

**Files:**
- Modify: `pages/sitemap.xml.tsx`
- Modify: `pages/robots.txt.tsx`
- Modify: `pages/index.tsx`
- Modify: `lib/home-page.test.tsx`
- Modify: `pages/faq.tsx`
- Modify: `components/LegalLayout.tsx`

**Interfaces:**
- Consumes: the shared indexable route allowlist and absolute URL helpers.
- Produces: one sitemap policy, a valid robots response, concise English/Traditional Chinese homepage context, and crawlable links to Practice, Training, Library, and Leaderboard.

- [x] Add failing tests for sitemap allowlisting, robots sitemap reference, visible bilingual homepage copy, and meaningful internal links.
- [x] Run the focused tests and confirm the current shared metadata and homepage fail those expectations.
- [x] Reuse the central policy in sitemap/robots, remove competing per-page Head declarations, and add the smallest visible homepage copy/link treatment.
- [x] Run the focused tests and confirm they pass.

### Task 3: Verification and release

**Files:**
- Test: all changed files and existing suites.

**Interfaces:**
- Produces: a verified SEO-only commit on `main`.

- [x] Run focused tests, the complete test suite, TypeScript, ESLint, `pnpm build`, and `git diff --check`.
- [x] Inspect generated HTML and browser-rendered head/layout at 375, 768, 1024, and 1440 pixels.
- [x] Review the complete diff for hidden content, keyword stuffing, private indexing, preview canonicals, typing-core/Corpus/database changes, and unrelated files.
- [x] Stage explicit SEO files only, commit as `feat: improve search discoverability`, push `main` to `origin/main`, and observe deployment status.
