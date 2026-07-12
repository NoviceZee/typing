import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export default function SecurityPage() { return <LegalLayout title="Security" summary="How FormalType protects accounts and data, and how to report a potential vulnerability.">
  <LegalSection title="Current safeguards"><p>FormalType uses Supabase authentication, row-level database policies, user-scoped reads and writes, private attempt details, restricted admin roles and HTTPS hosting. Passwords are handled by the authentication provider and are not stored in the FormalType application database.</p></LegalSection>
  <LegalSection title="Account controls"><p>You can change your password, make your public profile private, delete saved statistics or permanently delete your account. Use a unique password and sign out on shared devices.</p></LegalSection>
  <LegalSection title="Responsible disclosure"><p>If you believe you found a vulnerability, contact feedback@formaltype.app with clear reproduction steps and the affected URL. Do not access other users’ data, disrupt the service, perform denial-of-service testing or publicly disclose an unresolved issue.</p></LegalSection>
  <LegalSection title="Response"><p>We will acknowledge useful reports when practical, investigate based on severity and work toward a proportionate fix. This Beta does not currently operate a paid bug-bounty programme.</p></LegalSection>
  <LegalSection title="Limits"><p>No system is perfectly secure. This page describes current practices rather than a warranty, certification or independent security audit.</p></LegalSection>
</LegalLayout>; }
