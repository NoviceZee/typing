import React from "react";
import { AnalyticsConsentPreference } from "@/components/AnalyticsConsentControls";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      summary="How Typing Station collects, uses, stores and gives you control over personal data."
      effectiveDate="27 August 2026"
    >
      <LegalSection title="What we collect">
        <p>
          When you create an account, we process your email address, account identifier, handle, profile information and avatar. When you use the service, we may store typing results, attempt details, achievements, friendships, public-profile choices and feedback.
        </p>
        <p>
          Practice results may be stored in your browser and, when you sign in, synced to your account. Theme, sound and typing preferences may also remain on your device.
        </p>
        <p>
          Browser-local practice data may include passage content, result summaries, expected and actual character details, timing data and, when you are signed in, an account ID used to scope stored results.
        </p>
      </LegalSection>

      <LegalSection title="Optional analytics">
        <p>
          Typing Station may use Google Analytics 4 only when you allow analytics. It is optional and is not required for core site functionality. We use it to understand aggregate site usage and improve the service.
        </p>
        <p>
          Analytics categories may include page views, referrer or traffic source, browser and device information, approximate broad location, and reviewed Enhanced Measurement interactions such as scrolls or outbound link clicks.
        </p>
        <p>
          We do not intentionally send typed text, passage text, email address, handle, account ID, feedback content, authentication tokens or detailed typing-performance data to Google Analytics. Public profile paths are recorded only as a generic route, and query strings and fragments are removed.
        </p>
        <p>
          Google may process analytics data as our service provider. See Google&apos;s{" "}
          <a
            href="https://policies.google.com/privacy"
            aria-label="Google privacy information"
            target="_blank"
            rel="noreferrer"
            className="text-brass underline decoration-brass/40 underline-offset-4 hover:decoration-brass"
          >
            privacy information
          </a>.
        </p>
        <p>
          You can decline analytics or withdraw a previous choice at any time on this Privacy page or in Settings. Withdrawing removes available Google Analytics cookies and reloads the page once so future analytics stops immediately.
        </p>
        <AnalyticsConsentPreference />
      </LegalSection>

      <LegalSection title="Storage and your choices">
        <p>
          Essential authentication and application storage is separate from optional analytics. Declining analytics does not disable sign-in, security, saved application preferences or local practice and result storage.
        </p>
        <p>
          Account settings let you delete saved statistics or permanently delete your account. You can also keep your public profile private and clear local browser data.
        </p>
      </LegalSection>

      <LegalSection title="Why we use it">
        <p>
          We use data to authenticate accounts, save and analyse practice results, operate leaderboards and friend comparisons, secure the service, respond to feedback and understand product performance.
        </p>
      </LegalSection>

      <LegalSection title="Sharing and processors">
        <p>
          Typing Station uses Supabase for authentication, database and file storage, Vercel for hosting, and Resend to deliver feedback messages and optional reply addresses. Google Analytics is an optional production integration controlled by your choice. We do not sell your typing history or profile data.
        </p>
      </LegalSection>

      <LegalSection title="Public information">
        <p>
          Your handle, enabled public profile, selected profile fields and qualifying leaderboard results may be visible to other users. Email addresses and private attempt details are not displayed publicly.
        </p>
      </LegalSection>

      <LegalSection title="Security and international processing">
        <p>
          We use access controls, row-level security and restricted service permissions. No online service can guarantee absolute security. Providers may process data outside Hong Kong subject to their contractual and technical safeguards.
        </p>
      </LegalSection>

      <LegalSection title="Your rights and contact">
        <p>
          You may request access or correction and use the in-product controls for deletion. Privacy questions can be sent through the Feedback link. We may update this policy as the Beta and its providers change.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
