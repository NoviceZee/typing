# Typing Station beta launch checklist

## Already implemented

- Public landing page with clear practice and training entry points
- Page descriptions, Open Graph/Twitter metadata, favicon and 1200×630 share artwork
- Dynamic `robots.txt` and `sitemap.xml`
- Reduced-motion support, entry animation and interaction polish
- Global recovery screen for unexpected render errors
- Persistent beta feedback entry point
- Optional Google Analytics and AdSense wiring; both stay off without environment values

## Connect before beta

- [x] Set `NEXT_PUBLIC_SITE_URL` to the current HTTPS production origin (`https://typing-puce-one.vercel.app`)
- [ ] Point `NEXT_PUBLIC_FEEDBACK_URL` at a dedicated feedback form; until then, Feedback opens the GitHub issue form
- [ ] Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` and verify page views in analytics realtime view
- [ ] Choose an error tracker and connect it to the `formaltype:error` browser event
- [ ] Add AdSense client and slot values only after the site is approved; verify layout on mobile and desktop
- [ ] In AdSense → Privacy & messaging, publish a European regulations message for the production domain, use `/privacy` as the privacy-policy URL, and enable Consent Mode before serving EEA/UK/Swiss traffic
- [x] Add Supabase public URL/key to Vercel Production and Preview
- [ ] Configure a verified custom SMTP provider in Supabase Auth; do not rely on the built-in team-only, best-effort sender for beta users
- [ ] Verify sender-domain DNS and test delivery, bounce handling and recovery links with a non-team mailbox
- [x] Apply `202607130002` and `202607130003`
- [x] Apply `202607130004_tighten_result_coherence.sql` before deploying the client that writes `metric_domain`
- [ ] Apply `202607140005_profile_handle_cooldown_and_user_blocks.sql` before enabling handle changes and block controls
- [x] Run anonymous public-boundary checks against the linked Supabase project
- [ ] Run user-A/user-B/admin RLS checks and inspect a genuinely private profile projection

## Domain and release

- [ ] Add the custom domain in the hosting provider and copy the required DNS records
- [ ] Confirm HTTPS certificate, `www`/apex redirect and canonical origin
- [ ] Verify `/`, `/practice`, `/robots.txt`, `/sitemap.xml` and the share preview on production
- [x] Add the production domain to Supabase Auth site URL and redirect allow-list
- [x] Allow `/profile/account?recovery=1` on production and the exact latest protected preview origin
- [x] Test reset email delivery, recovery completion, post-reset sign-out and rejection of the previous password with a permitted team test account
- [ ] Repeat signup and recovery delivery with a non-team mailbox after custom SMTP is enabled
- [ ] Test signup, login, logout, password recovery, onboarding and a saved result
- [x] Test keyboard-only navigation and simulated mobile/tablet viewports, including compact-nav focus restoration and no-overflow checks
- [ ] Test native Safari IME and one physical mobile device
- [x] Run the final local suite: 48 files / 454 tests, lint, typecheck, 24-route production build and production dependency audit all pass
- [x] Re-run live Supabase checks and deployed preview smoke after applying `202607130004`
- [x] Verify security headers, primary route status, 404 behavior and absolute share metadata on the deployed Vercel preview
- [ ] Exercise a failed authenticated result save on the deployed Vercel preview (the local failure/live-region regression test passes)
- [ ] Check browser console, failed network requests and analytics consent requirements for launch regions

## First 48 hours

- [ ] Watch error volume, auth failures and result-save failures
- [ ] Review feedback at least daily and label blocking issues
- [ ] Compare landing → practice conversion and first-session completion
- [x] Keep ads disabled until core flows and layout stability are confirmed (AdSense environment values are absent)
