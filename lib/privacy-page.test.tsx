/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { AnalyticsConsentProvider } from "@/components/AnalyticsConsentProvider";
import PrivacyPage from "@/pages/privacy";

describe("PrivacyPage analytics disclosure", () => {
  it("is available anonymously and accurately explains optional GA4", async () => {
    render(
      <AnalyticsConsentProvider reload={vi.fn()}>
        <PrivacyPage />
      </AnalyticsConsentProvider>
    );

    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Optional analytics" })).toBeTruthy();
    expect(screen.getByText(/Google Analytics 4/i)).toBeTruthy();
    expect(screen.getByText(/typed text, passage text, email address, handle, account ID/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Google.*privacy/i }).getAttribute("href")).toContain("policies.google.com/privacy");
    expect((await screen.findAllByRole("button", { name: "Allow analytics" })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Decline analytics" }).length).toBeGreaterThan(0);
  });

  it("distinguishes essential application storage from optional analytics", () => {
    render(
      <AnalyticsConsentProvider reload={vi.fn()}>
        <PrivacyPage />
      </AnalyticsConsentProvider>
    );

    expect(screen.getByText(/authentication and application storage.*separate/i)).toBeTruthy();
    expect(screen.getByText(/practice results may be stored in your browser and, when you sign in, synced/i)).toBeTruthy();
    expect(screen.getByText(/passage content, result summaries, expected and actual character details, timing data/i)).toBeTruthy();
    expect(screen.getByText(/Privacy page or in Settings/i)).toBeTruthy();
  });
});
