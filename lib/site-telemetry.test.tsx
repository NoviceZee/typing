/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsConsentProvider } from "@/components/AnalyticsConsentProvider";
import { AnalyticsConsentNotice, AnalyticsConsentPreference } from "@/components/AnalyticsConsentControls";
import { SiteTelemetry } from "@/components/SiteTelemetry";
import { ANALYTICS_CONSENT_STORAGE_KEY } from "@/lib/analyticsConsent";
import {
  buildPageViewPayload,
  isAnalyticsEligible,
  sanitizeAnalyticsPath,
  sanitizeAnalyticsReferrer
} from "@/lib/siteTelemetry";

const routerMock = vi.hoisted(() => {
  const handlers = new Map<string, Set<(url: string) => void>>();
  const events = {
    on: vi.fn((name: string, handler: (url: string) => void) => {
      const registered = handlers.get(name) ?? new Set();
      registered.add(handler);
      handlers.set(name, registered);
    }),
    off: vi.fn((name: string, handler: (url: string) => void) => {
      handlers.get(name)?.delete(handler);
    }),
    emit(name: string, url: string) {
      handlers.get(name)?.forEach((handler) => handler(url));
    }
  };
  return {
    router: { asPath: "/settings", isReady: true, events },
    events,
    handlers
  };
});

vi.mock("next/router", () => ({
  useRouter: () => routerMock.router
}));

vi.mock("next/script", () => ({
  default: ({ src }: { src?: string }) => <script data-testid="ga-script" data-src={src} />
}));

const productionRuntime = {
  measurementId: "G-TEST",
  nodeEnv: "production",
  hostname: "typingstation.app"
};

function renderTelemetry({
  consent = "granted",
  runtime = productionRuntime
}: {
  consent?: "unknown" | "granted" | "denied";
  runtime?: typeof productionRuntime;
} = {}) {
  window.localStorage.clear();
  if (consent !== "unknown") window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
  return render(
    <AnalyticsConsentProvider reload={vi.fn()} measurementId={runtime.measurementId}>
      <SiteTelemetry runtime={runtime} />
      <AnalyticsConsentNotice />
      <AnalyticsConsentPreference />
    </AnalyticsConsentProvider>
  );
}

describe("analytics route sanitisation", () => {
  it.each([
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
  ])("allows the static route %s", (path) => {
    expect(sanitizeAnalyticsPath(path)).toBe(path);
  });

  it("strips queries and fragments and maps public handles to a non-identifying template", () => {
    expect(sanitizeAnalyticsPath("/login?redirectTo=%2Fu%2Fprivate#token")).toBe("/login");
    expect(sanitizeAnalyticsPath("https://typingstation.app/settings?tab=private#secret")).toBe("/settings");
    expect(sanitizeAnalyticsPath("/u/some-handle?recovery=1")).toBe("/u/[handle]");
    expect(sanitizeAnalyticsPath("/privacy/")).toBe("/privacy");
  });

  it("suppresses unknown and malformed routes instead of classifying them as 404", () => {
    expect(sanitizeAnalyticsPath("/john@example.com")).toBeNull();
    expect(sanitizeAnalyticsPath("/u/handle/extra")).toBeNull();
    expect(sanitizeAnalyticsPath("/api/feedback")).toBeNull();
    expect(sanitizeAnalyticsPath("/private/550e8400-e29b-41d4-a716-446655440000")).toBeNull();
    expect(sanitizeAnalyticsPath("not a URL at all")).toBeNull();
  });

  it("builds an explicit canonical payload without raw browser data", () => {
    expect(buildPageViewPayload("/u/kristin?email=private@example.com#token")).toEqual({
      page_path: "/u/[handle]",
      page_location: "https://typingstation.app/u/[handle]",
      page_title: "Typing Station"
    });
    expect(buildPageViewPayload("/unrecognised?secret=1")).toBeNull();
  });

  it("reduces referrers to a safe origin and suppresses unsupported values", () => {
    expect(sanitizeAnalyticsReferrer("https://www.google.com/search?q=private@example.com#result")).toBe(
      "https://www.google.com/"
    );
    expect(sanitizeAnalyticsReferrer("https://typingstation.app/u/private-handle?token=secret")).toBe(
      "https://typingstation.app/"
    );
    expect(sanitizeAnalyticsReferrer("javascript:alert(1)")).toBe("");
    expect(sanitizeAnalyticsReferrer("")).toBe("");
  });
});

describe("analytics runtime eligibility", () => {
  const eligible = {
    consent: "granted" as const,
    nodeEnv: "production",
    hostname: "typingstation.app",
    measurementId: "G-TEST"
  };

  it("requires all four activation conditions", () => {
    expect(isAnalyticsEligible(eligible)).toBe(true);
    expect(isAnalyticsEligible({ ...eligible, consent: "unknown" })).toBe(false);
    expect(isAnalyticsEligible({ ...eligible, consent: "denied" })).toBe(false);
    expect(isAnalyticsEligible({ ...eligible, nodeEnv: "development" })).toBe(false);
    expect(isAnalyticsEligible({ ...eligible, hostname: "www.typingstation.app" })).toBe(false);
    expect(isAnalyticsEligible({ ...eligible, hostname: "typingstation.vercel.app" })).toBe(false);
    expect(isAnalyticsEligible({ ...eligible, measurementId: undefined })).toBe(false);
    expect(isAnalyticsEligible({ ...eligible, measurementId: "  " })).toBe(false);
  });
});

describe("SiteTelemetry lifecycle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    routerMock.router.asPath = "/settings";
    routerMock.router.isReady = true;
    routerMock.handlers.clear();
    routerMock.events.on.mockClear();
    routerMock.events.off.mockClear();
    window.dataLayer = [];
    window.gtag = vi.fn();
    delete (window as unknown as Record<string, unknown>)["ga-disable-G-TEST"];
  });

  it.each([
    ["missing ID", { ...productionRuntime, measurementId: "" }, "granted"],
    ["unknown consent", productionRuntime, "unknown"],
    ["denied consent", productionRuntime, "denied"],
    ["development", { ...productionRuntime, nodeEnv: "development" }, "granted"],
    ["localhost", { ...productionRuntime, hostname: "localhost" }, "granted"],
    ["preview host", { ...productionRuntime, hostname: "typingstation.vercel.app" }, "granted"],
    ["retired host", { ...productionRuntime, hostname: "formaltype.app" }, "granted"]
  ] as const)("stays dormant with %s", async (_label, runtime, consent) => {
    renderTelemetry({ runtime: { ...runtime }, consent });
    await waitFor(() => expect(screen.queryByTestId("ga-script")).toBeNull());
    expect(routerMock.events.on).not.toHaveBeenCalled();
    expect(window.gtag).not.toHaveBeenCalled();
  });

  it("initializes direct gtag with privacy flags and one safe initial page view", async () => {
    renderTelemetry();

    expect((await screen.findByTestId("ga-script")).getAttribute("data-src")).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-TEST"
    );
    await waitFor(() => expect(window.gtag).toHaveBeenCalledWith("config", "G-TEST", {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: "https://typingstation.app/settings",
      page_title: "Typing Station",
      page_referrer: ""
    }));
    expect(window.gtag).toHaveBeenCalledWith("event", "page_view", {
      page_path: "/settings",
      page_location: "https://typingstation.app/settings",
      page_title: "Typing Station"
    });
    expect(window.gtag).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ user_id: expect.anything() }));
    expect(routerMock.events.on).toHaveBeenCalledTimes(3);
    expect(routerMock.events.on).toHaveBeenCalledWith("routeChangeComplete", expect.any(Function));
    expect(routerMock.events.on).toHaveBeenCalledWith("routeChangeStart", expect.any(Function));
    expect(routerMock.events.on).toHaveBeenCalledWith("routeChangeError", expect.any(Function));
  });

  it("does not load or configure GA on an unknown initial route", async () => {
    routerMock.router.asPath = "/private/private@example.com?token=secret#recovery";

    renderTelemetry();

    await waitFor(() => expect(routerMock.events.on).toHaveBeenCalledWith("routeChangeComplete", expect.any(Function)));
    expect(screen.queryByTestId("ga-script")).toBeNull();
    expect(window.gtag).not.toHaveBeenCalled();
    expect((window as unknown as Record<string, unknown>)["ga-disable-G-TEST"]).toBe(true);
  });

  it("disables all collection across unknown routes and restores only with safe context", async () => {
    renderTelemetry();
    await waitFor(() => expect(window.gtag).toHaveBeenCalledWith("event", "page_view", expect.any(Object)));
    vi.mocked(window.gtag!).mockClear();

    act(() => routerMock.events.emit("routeChangeStart", "/private/private@example.com?token=secret"));
    expect((window as unknown as Record<string, unknown>)["ga-disable-G-TEST"]).toBe(true);
    act(() => routerMock.events.emit("routeChangeComplete", "/private/private@example.com?token=secret"));
    expect(window.gtag).not.toHaveBeenCalled();

    act(() => routerMock.events.emit("routeChangeStart", "/privacy?token=secret"));
    act(() => routerMock.events.emit("routeChangeComplete", "/privacy?token=secret"));

    expect((window as unknown as Record<string, unknown>)["ga-disable-G-TEST"]).toBe(false);
    expect(window.gtag).toHaveBeenCalledWith("set", {
      page_location: "https://typingstation.app/privacy",
      page_title: "Typing Station",
      page_referrer: ""
    });
    expect(JSON.stringify(vi.mocked(window.gtag!).mock.calls)).not.toContain("private@example.com");
    expect(JSON.stringify(vi.mocked(window.gtag!).mock.calls)).not.toContain("token=secret");
  });

  it("queues only safe global context when gtag is not yet available", async () => {
    window.gtag = undefined;
    window.dataLayer = [];

    renderTelemetry();

    await waitFor(() => expect(window.dataLayer.length).toBeGreaterThan(0));
    expect(JSON.stringify(window.dataLayer)).toContain("https://typingstation.app/settings");
    expect(JSON.stringify(window.dataLayer)).not.toContain("location.href");
    expect(JSON.stringify(window.dataLayer)).not.toContain("private");
  });

  it("sends one safe event per completed allowlisted route and suppresses unknown routes", async () => {
    renderTelemetry();
    await waitFor(() => expect(window.gtag).toHaveBeenCalledWith("event", "page_view", expect.any(Object)));
    vi.mocked(window.gtag!).mockClear();

    act(() => routerMock.events.emit("routeChangeComplete", "/u/private-handle?token=secret"));
    act(() => routerMock.events.emit("routeChangeComplete", "/unrecognised/private@example.com"));
    act(() => routerMock.events.emit("routeChangeError", "/privacy"));
    act(() => routerMock.events.emit("routeChangeComplete", "/practice?typedText=never-send-this#passage-content"));

    const pageViews = vi.mocked(window.gtag!).mock.calls.filter(
      (call) => call[0] === "event" && call[1] === "page_view"
    );
    expect(pageViews).toHaveLength(2);
    expect(pageViews[0]).toEqual(["event", "page_view", {
      page_path: "/u/[handle]",
      page_location: "https://typingstation.app/u/[handle]",
      page_title: "Typing Station"
    }]);
    expect(pageViews[1]).toEqual(["event", "page_view", {
      page_path: "/practice",
      page_location: "https://typingstation.app/practice",
      page_title: "Typing Station"
    }]);
    expect(JSON.stringify(vi.mocked(window.gtag!).mock.calls)).not.toContain("never-send-this");
  });

  it("tracks browser back and forward completions once each", async () => {
    renderTelemetry();
    await waitFor(() => expect(window.gtag).toHaveBeenCalledWith("event", "page_view", expect.any(Object)));
    vi.mocked(window.gtag!).mockClear();

    act(() => routerMock.events.emit("routeChangeComplete", "/privacy"));
    act(() => routerMock.events.emit("routeChangeComplete", "/settings"));

    expect(vi.mocked(window.gtag!).mock.calls.filter((call) => call[0] === "event")).toHaveLength(2);
  });

  it("does not duplicate the initial page view or listener on an ordinary rerender", async () => {
    const view = renderTelemetry();
    await waitFor(() => expect(window.gtag).toHaveBeenCalledWith("event", "page_view", expect.any(Object)));
    const initialPageViews = vi.mocked(window.gtag!).mock.calls.filter((call) => call[0] === "event").length;

    view.rerender(
      <AnalyticsConsentProvider reload={vi.fn()}>
        <SiteTelemetry runtime={productionRuntime} />
        <AnalyticsConsentNotice />
        <AnalyticsConsentPreference />
      </AnalyticsConsentProvider>
    );

    expect(vi.mocked(window.gtag!).mock.calls.filter((call) => call[0] === "event")).toHaveLength(initialPageViews);
    expect(routerMock.events.on).toHaveBeenCalledTimes(3);
  });

  it("emits exactly one initial page view when unknown consent becomes granted", async () => {
    renderTelemetry({ consent: "unknown" });
    const allow = (await screen.findAllByRole("button", { name: "Allow analytics" }))[0];
    expect(window.gtag).not.toHaveBeenCalled();

    fireEvent.click(allow);

    await waitFor(() => {
      const pageViews = vi.mocked(window.gtag!).mock.calls.filter(
        (call) => call[0] === "event" && call[1] === "page_view"
      );
      expect(pageViews).toHaveLength(1);
    });
    expect(routerMock.events.on).toHaveBeenCalledTimes(3);
  });

  it("unregisters route tracking on withdrawal and unmount", async () => {
    const view = renderTelemetry();
    await waitFor(() => expect(routerMock.events.on).toHaveBeenCalledTimes(3));

    fireEvent.click(await screen.findByRole("button", { name: "Decline analytics" }));
    await waitFor(() => expect(routerMock.events.off).toHaveBeenCalledTimes(3));
    expect(screen.queryByTestId("ga-script")).toBeNull();
    vi.mocked(window.gtag!).mockClear();
    act(() => routerMock.events.emit("routeChangeComplete", "/privacy"));
    expect(window.gtag).not.toHaveBeenCalled();

    view.unmount();
    expect(routerMock.handlers.get("routeChangeComplete")?.size ?? 0).toBe(0);
  });
});
