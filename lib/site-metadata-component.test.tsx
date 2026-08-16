/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteMetadata } from "@/components/SiteMetadata";

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

describe("SiteMetadata", () => {
  it("renders route-specific canonical and social metadata for public pages", () => {
    const { container } = render(<SiteMetadata pathname="/practice?category=Articles" siteUrl="https://typing.example.com/" />);

    expect(container.querySelector("title")?.textContent).toBe("Typing Practice — English & Chinese | Typing Station");
    expect(container.querySelector('meta[name="description"]')?.getAttribute("content")).toContain("timed or infinite");
    expect(container.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("index, follow");
    expect(container.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://typing.example.com/practice");
    expect(container.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe("https://typing.example.com/practice");
    expect(container.querySelector('meta[name="twitter:title"]')?.getAttribute("content")).toContain("Typing Practice");
  });

  it("renders noindex without a canonical for private routes", () => {
    const { container } = render(<SiteMetadata pathname="/login" siteUrl="https://typing.example.com" />);

    expect(container.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
    expect(container.querySelector('link[rel="canonical"]')).toBeNull();
    expect(container.querySelector('meta[property="og:url"]')).toBeNull();
  });

  it("includes valid WebApplication structured data only on the homepage", () => {
    const home = render(<SiteMetadata pathname="/" siteUrl="https://typing.example.com" />);
    const script = home.container.querySelector('script[type="application/ld+json"]');

    expect(script).not.toBeNull();
    expect(JSON.parse(script?.textContent || "{}")["@type"]).toBe("WebApplication");

    home.unmount();
    const practice = render(<SiteMetadata pathname="/practice" siteUrl="https://typing.example.com" />);
    expect(practice.container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });
});
