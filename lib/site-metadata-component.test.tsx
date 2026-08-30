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

    expect(container.querySelector("title")?.textContent).toBe("Typing Practice & Typing Test | Typing Station");
    expect(container.querySelector('meta[name="description"]')?.getAttribute("content")).toContain("one-, five-, and ten-minute tests");
    expect(container.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("index, follow");
    expect(container.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://typing.example.com/practice");
    expect(container.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe("https://typing.example.com/practice");
    expect(container.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe("https://typing.example.com/typingstation-share.png");
    expect(container.querySelector('meta[name="twitter:title"]')?.getAttribute("content")).toContain("Typing Practice & Typing Test");
    expect(container.querySelector('meta[name="twitter:image"]')?.getAttribute("content")).toBe("https://typing.example.com/typingstation-share.png");
  });

  it("renders noindex without a canonical for private routes", () => {
    const { container } = render(<SiteMetadata pathname="/login" siteUrl="https://typing.example.com" />);

    expect(container.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
    expect(container.querySelector('link[rel="canonical"]')).toBeNull();
    expect(container.querySelector('meta[property="og:url"]')).toBeNull();
  });

  it("includes valid WebApplication and WebSite structured data only on the homepage", () => {
    const home = render(<SiteMetadata pathname="/" siteUrl="https://typing.example.com" />);
    const scripts = Array.from(home.container.querySelectorAll('script[type="application/ld+json"]'));
    const structuredData = scripts.map((script) => JSON.parse(script.textContent || "{}"));

    expect(structuredData.map((data) => data["@type"])).toEqual(["WebApplication", "WebSite"]);
    expect(structuredData[1]).toEqual(expect.objectContaining({
      name: "Typing Station",
      url: "https://typing.example.com/"
    }));

    home.unmount();
    const practice = render(<SiteMetadata pathname="/practice" siteUrl="https://typing.example.com" />);
    expect(practice.container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it("publishes standards-based favicon and manifest links", () => {
    const { container } = render(<SiteMetadata pathname="/" siteUrl="https://typing.example.com" />);

    expect(container.querySelector('link[rel="icon"][type="image/png"][sizes="48x48"]')?.getAttribute("href"))
      .toBe("/favicon-48x48.png");
    expect(container.querySelector('link[rel="icon"][type="image/svg+xml"]')?.getAttribute("href"))
      .toBe("/favicon.svg");
    expect(container.querySelector('link[rel="shortcut icon"]')?.getAttribute("href"))
      .toBe("/favicon.ico");
    expect(container.querySelector('link[rel="apple-touch-icon"][sizes="180x180"]')?.getAttribute("href"))
      .toBe("/apple-touch-icon.png");
    expect(container.querySelector('link[rel="manifest"]')?.getAttribute("href"))
      .toBe("/site.webmanifest");
  });
});
