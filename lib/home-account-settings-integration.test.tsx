/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import React, { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccountSettingsProvider,
  useOptionalAccountSettings
} from "@/components/AccountSettingsProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import {
  createDefaultAccountSettings,
  supabaseAccountSettingsRepository
} from "@/lib/accountSettings";
import Home from "@/pages/index";
import FeedbackPage from "@/pages/feedback";

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isLoading: true
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => authState
}));

let pageProbeMounts = 0;

function PageProbe({ pathname }: { pathname: string }) {
  const accountSettings = useOptionalAccountSettings();

  useEffect(() => {
    pageProbeMounts += 1;
  }, []);

  return (
    <>
      <span data-testid="route">{pathname}</span>
      <span data-testid="settings-context">
        {accountSettings
          ? `${accountSettings.settings.appearance.themePreset}:${accountSettings.settings.appearance.accentColor}:${accountSettings.settings.appearance.appFont}`
          : "settings-unavailable"}
      </span>
      {pathname === "/" ? <Home /> : pathname === "/feedback" ? <FeedbackPage /> : <main>Authenticated route</main>}
    </>
  );
}

function AppHarness({ pathname }: { pathname: string }) {
  return (
    <AccountSettingsProvider renderChildrenWhileHydrating={pathname === "/" || pathname === "/feedback"}>
      <ThemeProvider>
        <PageProbe pathname={pathname} />
      </ThemeProvider>
    </AccountSettingsProvider>
  );
}

function makeCloudAppearance() {
  const settings = createDefaultAccountSettings();
  settings.appearance.themePreset = "paper";
  settings.appearance.accentColor = "rose";
  settings.appearance.appFont = "sans";
  return settings;
}

async function expectHydratedAppearance() {
  await waitFor(() => {
    expect(screen.getByTestId("settings-context").textContent).toBe("paper:rose:sans");
  });
  expect(document.documentElement.dataset).toEqual(expect.objectContaining({
    theme: "light",
    themePreset: "paper",
    accent: "rose",
    appFont: "sans"
  }));
}

describe("homepage account-settings integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-preset");
    document.documentElement.removeAttribute("data-accent");
    document.documentElement.removeAttribute("data-app-font");
    authState.user = null;
    authState.isLoading = true;
    pageProbeMounts = 0;
    vi.restoreAllMocks();
  });

  it("hydrates a signed-out direct homepage load without remounting its nullable context subtree", async () => {
    window.localStorage.setItem("formaltype.theme.v1", JSON.stringify({
      themePreset: "paper",
      accentColor: "rose",
      appFont: "sans"
    }));

    const view = render(<AppHarness pathname="/" />);

    expect(screen.getByTestId("settings-context").textContent).toBe("settings-unavailable");
    expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: /Start a one-minute test/i }).getAttribute("href")).toBe("/practice");

    authState.isLoading = false;
    view.rerender(<AppHarness pathname="/" />);

    await expectHydratedAppearance();
    expect(pageProbeMounts).toBe(1);
  });

  it("renders the feedback utility during hydration and recovers settings without remounting", async () => {
    const view = render(<AppHarness pathname="/feedback" />);

    expect(screen.getByTestId("settings-context").textContent).toBe("settings-unavailable");
    expect(screen.getByRole("heading", { name: "Send us feedback." })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy email address" })).toBeTruthy();

    authState.isLoading = false;
    view.rerender(<AppHarness pathname="/feedback" />);

    await waitFor(() => {
      expect(screen.getByTestId("settings-context").textContent).not.toBe("settings-unavailable");
    });
    expect(pageProbeMounts).toBe(1);
  });

  it("hydrates a signed-in direct homepage load and recovers account appearance and auth CTAs without remounting", async () => {
    vi.spyOn(supabaseAccountSettingsRepository, "load").mockResolvedValue(makeCloudAppearance());

    const view = render(<AppHarness pathname="/" />);
    expect(screen.getByTestId("settings-context").textContent).toBe("settings-unavailable");

    authState.user = { id: "user-1" };
    authState.isLoading = false;
    view.rerender(<AppHarness pathname="/" />);

    await expectHydratedAppearance();
    expect(screen.getByRole("link", { name: "Profile" }).getAttribute("href")).toBe("/profile");
    expect(screen.getByRole("link", { name: /Continue practising/i }).getAttribute("href")).toBe("/practice");
    expect(pageProbeMounts).toBe(1);
  });

  it("preserves hydrated account context when navigating from an authenticated route to the homepage", async () => {
    authState.user = { id: "user-1" };
    authState.isLoading = false;
    vi.spyOn(supabaseAccountSettingsRepository, "load").mockResolvedValue(makeCloudAppearance());

    const view = render(<AppHarness pathname="/profile" />);

    expect(await screen.findByText("Authenticated route")).toBeTruthy();
    await expectHydratedAppearance();
    expect(pageProbeMounts).toBe(1);

    view.rerender(<AppHarness pathname="/" />);

    expect(screen.getByRole("heading", { name: /Type with purpose/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Profile" }).getAttribute("href")).toBe("/profile");
    await expectHydratedAppearance();
    expect(pageProbeMounts).toBe(1);
  });

  it("preserves hydrated account context when navigating from the homepage back to an authenticated route", async () => {
    authState.user = { id: "user-1" };
    authState.isLoading = false;
    vi.spyOn(supabaseAccountSettingsRepository, "load").mockResolvedValue(makeCloudAppearance());

    const view = render(<AppHarness pathname="/" />);

    expect(screen.getByRole("heading", { name: /Type with purpose/i })).toBeTruthy();
    await expectHydratedAppearance();
    expect(pageProbeMounts).toBe(1);

    view.rerender(<AppHarness pathname="/profile" />);

    expect(screen.getByText("Authenticated route")).toBeTruthy();
    await expectHydratedAppearance();
    expect(pageProbeMounts).toBe(1);
  });
});
