const FALLBACK_SITE_URL = "https://typingstation.app";

export interface RouteSeoMetadata {
  title: string;
  description: string;
  indexable: boolean;
  canonicalPath?: string;
}

const PUBLIC_ROUTE_METADATA: Record<string, Omit<RouteSeoMetadata, "indexable" | "canonicalPath">> = {
  "/": {
    title: "Typing Station — English & Chinese Typing Practice",
    description: "Practice English and Chinese typing with timed tests, focused training, curated passages, and clear speed, accuracy, and progress feedback."
  },
  "/practice": {
    title: "Typing Practice & Typing Test | Typing Station",
    description: "Practice English or Chinese typing with one-, five-, and ten-minute tests or an infinite mode. Review speed, accuracy, consistency, and mistakes."
  },
  "/training": {
    title: "Typing Training — Words, Numbers, Symbols & Code | Typing Station",
    description: "Build control with focused typing drills for words, numbers, symbols, code, and Chinese. Choose timed or word-count sessions and difficulty."
  },
  "/passages": {
    title: "English & Chinese Typing Passages | Typing Station",
    description: "Browse curated English and Chinese typing passages by language and category, then open any passage for a timed or untimed practice session."
  },
  "/leaderboard": {
    title: "Typing Speed Leaderboard | Typing Station",
    description: "Compare qualifying English, Chinese, and code typing results by speed and accuracy across time, duration, and category filters."
  },
  "/faq": {
    title: "Typing Practice FAQ | Typing Station",
    description: "Answers about Typing Station practice, training, results, accounts, privacy, and Chinese IME support."
  },
  "/terms": {
    title: "Terms of Use | Typing Station",
    description: "The rules for using Typing Station accounts, public profiles, typing results, and community features."
  },
  "/privacy": {
    title: "Privacy Policy | Typing Station",
    description: "How Typing Station collects, uses, stores, and gives you control over personal data."
  },
  "/security": {
    title: "Security | Typing Station",
    description: "How Typing Station protects accounts and data, and how to report a potential vulnerability."
  }
};

const PRIVATE_ROUTE_METADATA: Record<string, Omit<RouteSeoMetadata, "indexable">> = {
  "/login": { title: "Log in | Typing Station", description: "Log in to save and review your Typing Station progress." },
  "/logout": { title: "Log out | Typing Station", description: "End your current Typing Station session." },
  "/feedback": { title: "Feedback | Typing Station", description: "Contact Typing Station with feedback, bug reports, or suggestions." },
  "/settings": { title: "Settings | Typing Station", description: "Adjust your private Typing Station preferences." },
  "/profile": { title: "Your Profile | Typing Station", description: "Review your private Typing Station activity and progress." },
  "/profile/friends": { title: "Friends | Typing Station", description: "Manage your Typing Station friends and requests." },
  "/profile/account": { title: "Account Settings | Typing Station", description: "Manage your private Typing Station account." },
  "/profile/public": { title: "Public Profile Settings | Typing Station", description: "Choose what your Typing Station public profile displays." },
  "/passages/manage": { title: "Manage Library | Typing Station", description: "Manage Typing Station passage records." },
  "/admin/passages": { title: "Manage Library | Typing Station", description: "Manage Typing Station passage records." },
  "/analytics": { title: "Insights | Typing Station", description: "Review your private Typing Station insights." },
  "/onboarding/handle": { title: "Choose a Handle | Typing Station", description: "Finish setting up your Typing Station account." },
  "/404": { title: "Page Not Found | Typing Station", description: "The requested Typing Station page could not be found." },
  "/500": { title: "Server Error | Typing Station", description: "Typing Station could not load this page." }
};

export const INDEXABLE_SITE_ROUTES = Object.freeze(Object.keys(PUBLIC_ROUTE_METADATA));

export function getSiteUrl(configuredUrl = process.env.NEXT_PUBLIC_SITE_URL): string {
  return (configuredUrl?.trim() || FALLBACK_SITE_URL).replace(/\/+$/, "");
}

export function getShareImageUrl(configuredUrl = process.env.NEXT_PUBLIC_SITE_URL): string {
  return `${getSiteUrl(configuredUrl)}/typingstation-share.png`;
}

function normalizePath(pathname: string): string {
  const cleanPath = (pathname.split(/[?#]/, 1)[0] || "/").replace(/\/+$/, "");
  return cleanPath || "/";
}

export function getRouteSeoMetadata(pathname: string): RouteSeoMetadata {
  const route = normalizePath(pathname);
  const publicMetadata = PUBLIC_ROUTE_METADATA[route];
  if (publicMetadata) {
    return { ...publicMetadata, indexable: true, canonicalPath: route };
  }

  if (route.startsWith("/u/")) {
    return {
      title: "Public Profile | Typing Station",
      description: "A Typing Station public profile.",
      indexable: false
    };
  }

  const privateMetadata = PRIVATE_ROUTE_METADATA[route];
  if (privateMetadata) return { ...privateMetadata, indexable: false };

  return {
    title: "Typing Station",
    description: "English and Chinese typing practice, training, passages, and progress feedback.",
    indexable: false
  };
}

export function getCanonicalUrl(pathname: string, configuredUrl = process.env.NEXT_PUBLIC_SITE_URL): string | null {
  const metadata = getRouteSeoMetadata(pathname);
  if (!metadata.indexable || !metadata.canonicalPath) return null;
  return metadata.canonicalPath === "/"
    ? getSiteUrl(configuredUrl)
    : `${getSiteUrl(configuredUrl)}${metadata.canonicalPath}`;
}

export function getWebApplicationStructuredData(configuredUrl = process.env.NEXT_PUBLIC_SITE_URL) {
  const siteUrl = getSiteUrl(configuredUrl);
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Typing Station",
    url: siteUrl,
    description: PUBLIC_ROUTE_METADATA["/"].description,
    applicationCategory: "EducationalApplication",
    inLanguage: ["en", "zh-Hant"],
    featureList: [
      "English and Chinese typing practice",
      "Timed and infinite typing tests",
      "Focused words, numbers, symbols, code, and Chinese training",
      "Curated typing passages",
      "Speed, accuracy, and progress feedback"
    ]
  };
}

export function getWebsiteStructuredData(configuredUrl = process.env.NEXT_PUBLIC_SITE_URL) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Typing Station",
    url: `${getSiteUrl(configuredUrl)}/`
  };
}

export function buildSitemapXml(configuredUrl = process.env.NEXT_PUBLIC_SITE_URL): string {
  const urls = INDEXABLE_SITE_ROUTES.map((route) => {
    const location = route === "/" ? getSiteUrl(configuredUrl) : `${getSiteUrl(configuredUrl)}${route}`;
    return `<url><loc>${location}</loc><changefreq>weekly</changefreq></url>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export function buildRobotsTxt(configuredUrl = process.env.NEXT_PUBLIC_SITE_URL): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${getSiteUrl(configuredUrl)}/sitemap.xml\n`;
}
