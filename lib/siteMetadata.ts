const FALLBACK_SITE_URL = "https://typing-puce-one.vercel.app";

export function getSiteUrl(configuredUrl = process.env.NEXT_PUBLIC_SITE_URL): string {
  return (configuredUrl?.trim() || FALLBACK_SITE_URL).replace(/\/+$/, "");
}

export function getShareImageUrl(configuredUrl = process.env.NEXT_PUBLIC_SITE_URL): string {
  return `${getSiteUrl(configuredUrl)}/formaltype-share.png`;
}
