# FormalType beta launch checklist

## Already implemented

- Public landing page with clear practice and training entry points
- Page descriptions, Open Graph/Twitter metadata, favicon and 1200×630 share artwork
- Dynamic `robots.txt` and `sitemap.xml`
- Reduced-motion support, entry animation and interaction polish
- Global recovery screen for unexpected render errors
- Persistent beta feedback entry point
- Optional Google Analytics and AdSense wiring; both stay off without environment values

## Connect before beta

- [ ] Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS origin
- [ ] Point `NEXT_PUBLIC_FEEDBACK_URL` at the chosen feedback form, or confirm `feedback@formaltype.app` works
- [ ] Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` and verify page views in analytics realtime view
- [ ] Choose an error tracker and connect it to the `formaltype:error` browser event
- [ ] Add AdSense client and slot values only after the site is approved; verify layout on mobile and desktop
- [ ] In AdSense → Privacy & messaging, publish a European regulations message for the production domain, use `/privacy` as the privacy-policy URL, and enable Consent Mode before serving EEA/UK/Swiss traffic
- [ ] Add Supabase production URL/key and apply all migrations to the production project

## Domain and release

- [ ] Add the custom domain in the hosting provider and copy the required DNS records
- [ ] Confirm HTTPS certificate, `www`/apex redirect and canonical origin
- [ ] Verify `/`, `/practice`, `/robots.txt`, `/sitemap.xml` and the share preview on production
- [ ] Add the domain to Supabase Auth site URL and redirect allow-list
- [ ] Test signup, login, logout, password recovery, onboarding and a saved result
- [ ] Test keyboard-only navigation and one mobile device
- [ ] Run `pnpm test` and `pnpm build` with production environment values
- [ ] Check browser console, failed network requests and analytics consent requirements for launch regions

## First 48 hours

- [ ] Watch error volume, auth failures and result-save failures
- [ ] Review feedback at least daily and label blocking issues
- [ ] Compare landing → practice conversion and first-session completion
- [ ] Keep ads disabled until core flows and layout stability are confirmed
