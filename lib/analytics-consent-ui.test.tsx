/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnalyticsConsentProvider,
  useAnalyticsConsent
} from "@/components/AnalyticsConsentProvider";
import {
  AnalyticsConsentNotice,
  AnalyticsConsentPreference
} from "@/components/AnalyticsConsentControls";
import {
  ANALYTICS_CONSENT_CHANGE_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY
} from "@/lib/analyticsConsent";

function ConsentProbe() {
  const { consent, isHydrated } = useAnalyticsConsent();
  return <output data-testid="consent-probe">{isHydrated ? consent : "hydrating"}</output>;
}

function renderConsent(options: { reload?: () => void; storage?: Storage | null; measurementId?: string } = {}) {
  return render(
    <AnalyticsConsentProvider
      reload={options.reload}
      storage={options.storage}
      measurementId={options.measurementId}
    >
      <ConsentProbe />
      <AnalyticsConsentNotice />
      <AnalyticsConsentPreference />
    </AnalyticsConsentProvider>
  );
}

describe("AnalyticsConsentProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0]?.trim();
      if (name) document.cookie = `${name}=; Max-Age=0; path=/`;
    }
  });

  it.each(["unknown", "granted", "denied"] as const)("hydrates the shared %s state", async (consent) => {
    if (consent !== "unknown") {
      window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
    }

    renderConsent();

    await waitFor(() => expect(screen.getByTestId("consent-probe").textContent).toBe(consent));
  });

  it("keeps state unknown when persistence fails", async () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new DOMException("full", "QuotaExceededError");
      })
    } as unknown as Storage;
    renderConsent({ storage });
    await waitFor(() => expect(screen.getByTestId("consent-probe").textContent).toBe("unknown"));

    fireEvent.click(screen.getAllByRole("button", { name: "Allow analytics" })[0]);

    expect(screen.getByTestId("consent-probe").textContent).toBe("unknown");
  });

  it("synchronizes same-tab custom events and cross-tab storage events", async () => {
    renderConsent({ reload: vi.fn() });
    await waitFor(() => expect(screen.getByTestId("consent-probe").textContent).toBe("unknown"));

    act(() => {
      window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_CHANGE_EVENT, { detail: "granted" }));
    });
    expect(screen.getByTestId("consent-probe").textContent).toBe("granted");

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: ANALYTICS_CONSENT_STORAGE_KEY,
          newValue: "denied"
        })
      );
    });
    expect(screen.getByTestId("consent-probe").textContent).toBe("denied");
  });

  it("does not reload on a first decline", async () => {
    const reload = vi.fn();
    renderConsent({ reload });
    await waitFor(() => expect(screen.getByTestId("consent-probe").textContent).toBe("unknown"));

    fireEvent.click(screen.getAllByRole("button", { name: "Decline analytics" })[0]);

    expect(screen.getByTestId("consent-probe").textContent).toBe("denied");
    expect(reload).not.toHaveBeenCalled();
  });

  it("clears GA cookies and reloads at most once on explicit or cross-tab withdrawal", async () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    document.cookie = "_ga=client; path=/";
    document.cookie = "app_session=keep; path=/";
    const reload = vi.fn();
    renderConsent({ reload });
    await waitFor(() => expect(screen.getByTestId("consent-probe").textContent).toBe("granted"));

    fireEvent.click(screen.getAllByRole("button", { name: "Decline analytics" })[0]);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: ANALYTICS_CONSENT_STORAGE_KEY,
          newValue: "denied"
        })
      );
    });

    expect(document.cookie).not.toContain("_ga=");
    expect(document.cookie).toContain("app_session=keep");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("disables GA synchronously before a cross-tab withdrawal reload", async () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    const reload = vi.fn(() => {
      expect((window as unknown as Record<string, unknown>)["ga-disable-G-TEST"]).toBe(true);
    });
    renderConsent({ reload, measurementId: "G-TEST" });
    await waitFor(() => expect(screen.getByTestId("consent-probe").textContent).toBe("granted"));

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: ANALYTICS_CONSENT_STORAGE_KEY,
          newValue: "denied"
        })
      );
    });

    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe("shared analytics consent controls", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows an accessible first-visit notice with no preselected choice", async () => {
    renderConsent();

    const notice = await screen.findByRole("region", { name: "Analytics privacy notice" });
    expect(notice).toBeTruthy();
    expect(screen.getByText("Optional analytics")).toBeTruthy();
    expect(screen.getByText("Help improve Typing Station with privacy-limited analytics.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/privacy");
    expect(screen.getByText("Allow")).toBeTruthy();
    expect(screen.getByText("Decline")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Allow analytics" })[0].getAttribute("aria-pressed")).toBe("false");
    expect(screen.getAllByRole("button", { name: "Decline analytics" })[0].getAttribute("aria-pressed")).toBe("false");
    expect(screen.getAllByRole("button", { name: "Allow analytics" })[1].textContent).toBe("Allow analytics");
    expect(screen.getAllByRole("button", { name: "Decline analytics" })[1].textContent).toBe("Decline analytics");
  });

  it("hides the notice after a choice while the shared preference reports and changes it", async () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "denied");
    renderConsent();
    await waitFor(() => expect(screen.getByTestId("consent-probe").textContent).toBe("denied"));

    expect(screen.queryByRole("region", { name: "Analytics privacy notice" })).toBeNull();
    expect(screen.getByText("Current choice: Declined")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Allow analytics" }));
    expect(screen.getByTestId("consent-probe").textContent).toBe("granted");
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("granted");
  });
});
