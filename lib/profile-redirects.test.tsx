/**
 * @vitest-environment jsdom
 */
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnalyticsRedirectPage from "../pages/analytics";
import SettingsRedirectPage from "../pages/settings";

const mockRouter = vi.hoisted(() => ({
  replace: vi.fn()
}));

vi.mock("next/router", () => ({
  useRouter: () => mockRouter
}));

describe("profile compatibility redirects", () => {
  beforeEach(() => {
    mockRouter.replace.mockClear();
  });

  it("redirects /analytics to /profile", async () => {
    render(<AnalyticsRedirectPage />);

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith("/profile");
    });
  });

  it("redirects /settings to /profile", async () => {
    render(<SettingsRedirectPage />);

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith("/profile");
    });
  });
});
