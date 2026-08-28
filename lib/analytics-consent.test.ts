/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_CONSENT_CHANGE_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  clearGoogleAnalyticsCookies,
  readAnalyticsConsent,
  writeAnalyticsConsent
} from "@/lib/analyticsConsent";

describe("analytics consent persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults safely for missing, invalid, and unavailable storage", () => {
    expect(readAnalyticsConsent()).toBe("unknown");

    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "maybe");
    expect(readAnalyticsConsent()).toBe("unknown");

    const blockedStorage = {
      getItem: vi.fn(() => {
        throw new DOMException("blocked", "SecurityError");
      })
    } as unknown as Storage;
    expect(readAnalyticsConsent(blockedStorage)).toBe("unknown");
  });

  it("persists only the shared analytics preference and dispatches a same-tab event", () => {
    window.localStorage.setItem("formaltype.theme.v1", "paper");
    const listener = vi.fn();
    window.addEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, listener);

    expect(writeAnalyticsConsent("granted")).toBe(true);
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("granted");
    expect(window.localStorage.getItem("formaltype.theme.v1")).toBe("paper");
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toBe("granted");

    window.removeEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, listener);
  });

  it("returns false and emits no event when persistence fails", () => {
    const storage = {
      setItem: vi.fn(() => {
        throw new DOMException("full", "QuotaExceededError");
      })
    } as unknown as Storage;
    const listener = vi.fn();
    window.addEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, listener);

    expect(writeAnalyticsConsent("denied", storage)).toBe(false);
    expect(listener).not.toHaveBeenCalled();

    window.removeEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, listener);
  });
});

describe("Google Analytics cookie cleanup", () => {
  beforeEach(() => {
    window.localStorage.clear();
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0]?.trim();
      if (name) document.cookie = `${name}=; Max-Age=0; path=/`;
    }
  });

  it("expires only GA cookies without clearing application data or consent", () => {
    document.cookie = "_ga=client; path=/";
    document.cookie = "_ga_TEST=session; path=/";
    document.cookie = "typing_session=keep; path=/";
    window.localStorage.setItem("formaltype.theme.v1", "paper");
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "denied");

    clearGoogleAnalyticsCookies(document, "typingstation.app");

    expect(document.cookie).not.toContain("_ga=");
    expect(document.cookie).not.toContain("_ga_TEST=");
    expect(document.cookie).toContain("typing_session=keep");
    expect(window.localStorage.getItem("formaltype.theme.v1")).toBe("paper");
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("denied");
  });
});
