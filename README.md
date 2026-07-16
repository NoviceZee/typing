# Typing Station

Typing Station is a production-oriented typing practice application for English, Chinese IME input, generated training drills, passage libraries, public leaderboards and private progress analytics. It uses the Next.js Pages Router, React, TypeScript and Supabase Auth/Postgres/RLS/Storage.

## Requirements

- Node.js 24.x (matches the Vercel project runtime)
- pnpm 11
- A Supabase project for auth, cloud results, profiles, friends, passages and avatars

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The anon/publishable key is safe for the browser; never add a service-role key to a `NEXT_PUBLIC_*` variable.
3. Apply every SQL file in `supabase/migrations` in filename order to a fresh or staging Supabase project.
4. Bootstrap the first admin as described in `DEV_NOTES.md`.
5. Install and run:

```bash
pnpm install
pnpm dev
```

Use the exact URL printed by the active development server. Supabase Auth must allow the local and production origins. Password recovery also requires `/profile/account?recovery=1` on the production origin in the redirect allow-list.

Before public beta, configure a verified custom SMTP provider in Supabase Auth and test confirmation/recovery delivery with a non-team mailbox. Supabase's built-in sender is a development convenience with a very low, best-effort quota and is not the production mail path. Keep SMTP credentials in Supabase/provider configuration; never expose them through `NEXT_PUBLIC_*` variables.

## Verification

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm audit --prod
```

The optional live Supabase scripts require a disposable test account through `SUPABASE_TEST_EMAIL` and `SUPABASE_TEST_PASSWORD`. Run them against local/staging data, not real user data:

```bash
pnpm test:supabase-passages
pnpm test:supabase-typing-results
pnpm test:supabase-leaderboard
pnpm test:supabase-own-results
pnpm test:supabase-public-boundary
```

Authenticated RLS verification is intentionally opt-in and must use three dedicated accounts in a disposable staging project:

```text
SUPABASE_TEST_USER_A_EMAIL
SUPABASE_TEST_USER_A_PASSWORD
SUPABASE_TEST_USER_B_EMAIL
SUPABASE_TEST_USER_B_PASSWORD
SUPABASE_TEST_ADMIN_EMAIL
SUPABASE_TEST_ADMIN_PASSWORD
SUPABASE_AUTHORIZATION_TEST_WRITES=true
```

Then run `pnpm test:supabase-authorization`. It verifies cross-user denial, server-owned result identity/timestamps and admin-only passage writes, then removes the temporary result and passage rows it creates.

## Security model

- Browser route guards provide UX only. Supabase RLS and guarded database functions are the authorization boundary.
- Base profile, result, attempt-detail and friendship rows are private to involved users.
- Leaderboard and public-profile views expose deliberately limited projections.
- Passage management requires the trusted `user_roles` admin role in the database.
- Typing stays local and network-independent during a session; cloud writes occur only after completion.

See `docs/production-audit.md` for the current launch audit, verified findings, migrations and remaining production-only checks. `LAUNCH_CHECKLIST.md` contains the release checklist.
