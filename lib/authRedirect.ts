const REDIRECT_VALIDATION_ORIGIN = "https://typingstation.app";

export function getSafeAuthRedirect(
  value: string | string[] | undefined,
  fallback = "/practice"
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return fallback;

  try {
    const resolved = new URL(candidate, REDIRECT_VALIDATION_ORIGIN);
    return resolved.origin === REDIRECT_VALIDATION_ORIGIN && candidate.startsWith("/")
      ? candidate
      : fallback;
  } catch {
    return fallback;
  }
}
