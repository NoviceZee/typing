/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { AccountSettingsProvider } from "@/components/AccountSettingsProvider";
import { INDEXABLE_SITE_ROUTES } from "@/lib/siteMetadata";
import { shouldRenderRouteWhileSettingsHydrate } from "@/lib/publicRouteRendering";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: null, isLoading: true })
}));

function InitialBody({ pathname }: { pathname: string }) {
  return (
    <AccountSettingsProvider renderChildrenWhileHydrating={shouldRenderRouteWhileSettingsHydrate(pathname)}>
      <main>
        <h1>{pathname}</h1>
        <p>Meaningful initial route content.</p>
      </main>
    </AccountSettingsProvider>
  );
}

describe("public route initial rendering", () => {
  it.each(INDEXABLE_SITE_ROUTES)("renders %s while auth and settings hydrate", (pathname) => {
    render(<InitialBody pathname={pathname} />);

    expect(screen.getByRole("heading", { level: 1, name: pathname })).toBeTruthy();
    expect(screen.getByText("Meaningful initial route content.")).toBeTruthy();
  });

  it.each(["/login", "/profile", "/settings", "/passages/manage"])(
    "keeps noindex route %s withheld while auth and settings hydrate",
    (pathname) => {
      const { container } = render(<InitialBody pathname={pathname} />);

      expect(container.textContent).toBe("");
    }
  );

  it("preserves the existing feedback-page hydration exception", () => {
    render(<InitialBody pathname="/feedback" />);

    expect(screen.getByRole("heading", { level: 1, name: "/feedback" })).toBeTruthy();
  });
});
