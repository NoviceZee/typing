import type { AnalyticsConsent } from "@/lib/analyticsConsent";

const STATIC_ANALYTICS_PATHS = new Set([
  "/",
  "/404",
  "/500",
  "/admin/passages",
  "/analytics",
  "/faq",
  "/feedback",
  "/leaderboard",
  "/login",
  "/logout",
  "/onboarding/handle",
  "/passages",
  "/passages/manage",
  "/practice",
  "/privacy",
  "/profile",
  "/profile/account",
  "/profile/friends",
  "/profile/public",
  "/robots.txt",
  "/security",
  "/settings",
  "/sitemap.xml",
  "/terms",
  "/training",
  "/training/numbers",
  "/training/symbols"
]);

export type AnalyticsEligibilityInput = {
  consent: AnalyticsConsent;
  nodeEnv: string | undefined;
  hostname: string;
  measurementId: string | undefined;
};

export type SafePageViewPayload = {
  page_path: string;
  page_location: string;
  page_title: "Typing Station";
};

export function sanitizeAnalyticsPath(rawUrl: string): string | null {
  try {
    const pathname = new URL(rawUrl, "https://typingstation.app").pathname;
    const normalizedPath = pathname !== "/" && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

    if (STATIC_ANALYTICS_PATHS.has(normalizedPath)) return normalizedPath;
    if (/^\/u\/[^/]+$/.test(normalizedPath)) return "/u/[handle]";
    return null;
  } catch {
    return null;
  }
}

export function buildPageViewPayload(rawUrl: string): SafePageViewPayload | null {
  const safePath = sanitizeAnalyticsPath(rawUrl);
  if (!safePath) return null;

  return {
    page_path: safePath,
    page_location: `https://typingstation.app${safePath}`,
    page_title: "Typing Station"
  };
}

export function sanitizeAnalyticsReferrer(rawReferrer: string): string {
  if (!rawReferrer) return "";

  try {
    const referrer = new URL(rawReferrer);
    if (referrer.protocol !== "https:" && referrer.protocol !== "http:") return "";
    return `${referrer.origin}/`;
  } catch {
    return "";
  }
}

export function isAnalyticsEligible({
  consent,
  nodeEnv,
  hostname,
  measurementId
}: AnalyticsEligibilityInput): boolean {
  return (
    consent === "granted" &&
    nodeEnv === "production" &&
    hostname === "typingstation.app" &&
    Boolean(measurementId?.trim())
  );
}
