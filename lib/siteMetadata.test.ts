import { describe, expect, it } from "vitest";
import {
  INDEXABLE_SITE_ROUTES,
  buildRobotsTxt,
  buildSitemapXml,
  getCanonicalUrl,
  getRouteSeoMetadata,
  getShareImageUrl,
  getSiteUrl,
  getWebsiteStructuredData,
  getWebApplicationStructuredData
} from "./siteMetadata";

describe("site metadata URLs", () => {
  it("uses the production fallback when no public site URL is configured", () => {
    expect(getSiteUrl("")).toBe("https://typingstation.app");
    expect(getShareImageUrl("")).toBe("https://typingstation.app/typingstation-share.png");
  });

  it("normalizes a configured URL before building absolute metadata URLs", () => {
    expect(getSiteUrl(" https://typing.example.com/// ")).toBe("https://typing.example.com");
    expect(getShareImageUrl("https://typing.example.com/"))
      .toBe("https://typing.example.com/typingstation-share.png");
  });
});

describe("route search metadata", () => {
  it("gives every primary public route distinct, accurate metadata", () => {
    const routes = ["/", "/practice", "/training", "/passages", "/leaderboard"];
    const metadata = routes.map(getRouteSeoMetadata);

    expect(metadata.every((entry) => entry.indexable)).toBe(true);
    expect(new Set(metadata.map((entry) => entry.title))).toHaveLength(routes.length);
    expect(new Set(metadata.map((entry) => entry.description))).toHaveLength(routes.length);
    expect(metadata[1].title).toContain("Typing Practice");
    expect(metadata[2].description).toContain("numbers");
    expect(metadata[3].description).toContain("passages");
  });

  it("assigns the approved generic-search metadata to the primary typing routes", () => {
    expect(getRouteSeoMetadata("/practice")).toEqual(expect.objectContaining({
      title: "Typing Practice & Typing Test | Typing Station",
      description: "Practice English or Chinese typing with one-, five-, and ten-minute tests or an infinite mode. Review speed, accuracy, consistency, and mistakes."
    }));
    expect(getRouteSeoMetadata("/training")).toEqual(expect.objectContaining({
      title: "Typing Training — Words, Numbers, Symbols & Code | Typing Station",
      description: "Build control with focused typing drills for words, numbers, symbols, code, and Chinese. Choose timed or word-count sessions and difficulty."
    }));
    expect(getRouteSeoMetadata("/passages")).toEqual(expect.objectContaining({
      title: "English & Chinese Typing Passages | Typing Station",
      description: "Browse curated English and Chinese typing passages by language and category, then open any passage for a timed or untimed practice session."
    }));
  });

  it("publishes the approved Traditional Chinese route metadata", () => {
    expect(getRouteSeoMetadata("/chinese-typing")).toEqual({
      title: "中文打字練習 | Chinese Typing Practice | Typing Station",
      description: "繁體中文打字練習，可選一、五、十分鐘或不限時模式，並瀏覽中文文章及詞語訓練。支援輸入法組字，完成後查看中文輸入速度、準確度、穩定度和錯誤。",
      indexable: true,
      canonicalPath: "/chinese-typing"
    });
    expect(getCanonicalUrl("/chinese-typing?source=home", "https://typing.example.com/"))
      .toBe("https://typing.example.com/chinese-typing");
  });

  it.each([
    "/login",
    "/settings",
    "/feedback",
    "/profile",
    "/profile/friends",
    "/passages/manage",
    "/u/novice",
    "/auth/recovery",
    "/does-not-exist"
  ])("keeps private, utility, dynamic profile, and unknown routes out of the index: %s", (pathname) => {
    expect(getRouteSeoMetadata(pathname).indexable).toBe(false);
    expect(getCanonicalUrl(pathname, "https://typing.example.com")).toBeNull();
  });

  it("gives the feedback utility page accurate noindex metadata", () => {
    expect(getRouteSeoMetadata("/feedback")).toEqual({
      title: "Feedback | Typing Station",
      description: "Contact Typing Station with feedback, bug reports, or suggestions.",
      indexable: false
    });
  });

  it("canonicalizes filter and selection query variants to the clean public route", () => {
    expect(getCanonicalUrl("/practice?language=chinese&mode=1m", "https://typing.example.com/"))
      .toBe("https://typing.example.com/practice");
    expect(getCanonicalUrl("/training?content=chinese", "https://typing.example.com/"))
      .toBe("https://typing.example.com/training");
    expect(getCanonicalUrl("/passages/?language=chinese#results", "https://typing.example.com"))
      .toBe("https://typing.example.com/passages");
    expect(getCanonicalUrl("/?duration=60", "https://typing.example.com"))
      .toBe("https://typing.example.com");
  });
});

describe("crawl discovery documents", () => {
  it("publishes only the public indexable allowlist in the sitemap", () => {
    const xml = buildSitemapXml("https://typing.example.com/");

    for (const route of INDEXABLE_SITE_ROUTES) {
      const expectedUrl = route === "/" ? "https://typing.example.com" : `https://typing.example.com${route}`;
      expect(xml).toContain(`<loc>${expectedUrl}</loc>`);
    }
    expect(xml).not.toContain("/login");
    expect(xml).not.toContain("/settings");
    expect(xml).not.toContain("/profile");
    expect(xml).not.toContain("/passages/manage");
    expect(xml).toContain("<loc>https://typing.example.com/chinese-typing</loc>");
    expect(Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g), (match) => match[1]).every((url) => !url.includes("?"))).toBe(true);
  });

  it("allows public crawling and points at the absolute sitemap", () => {
    expect(buildRobotsTxt("https://typing.example.com/"))
      .toBe("User-agent: *\nAllow: /\n\nSitemap: https://typing.example.com/sitemap.xml\n");
  });

  it("creates truthful, parseable WebApplication structured data", () => {
    const data = JSON.parse(JSON.stringify(getWebApplicationStructuredData("https://typing.example.com/")));

    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("WebApplication");
    expect(data.url).toBe("https://typing.example.com");
    expect(data.inLanguage).toEqual(["en", "zh-Hant"]);
    expect(data.featureList).toContain("English and Chinese typing practice");
    expect(data).not.toHaveProperty("aggregateRating");
    expect(data).not.toHaveProperty("offers");
  });

  it("creates the exact WebSite site-name signal for the canonical homepage", () => {
    const data = getWebsiteStructuredData("https://typingstation.app/");

    expect(data).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Typing Station",
      url: "https://typingstation.app/"
    });
    expect(data).not.toHaveProperty("alternateName");
  });
});
