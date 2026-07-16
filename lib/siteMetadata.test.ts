import { describe, expect, it } from "vitest";
import { getShareImageUrl, getSiteUrl } from "./siteMetadata";

describe("site metadata URLs", () => {
  it("uses the production fallback when no public site URL is configured", () => {
    expect(getSiteUrl("")).toBe("https://typing-puce-one.vercel.app");
    expect(getShareImageUrl("")).toBe("https://typing-puce-one.vercel.app/formaltype-share.png");
  });

  it("normalizes a configured URL before building absolute metadata URLs", () => {
    expect(getSiteUrl(" https://typing.example.com/// ")).toBe("https://typing.example.com");
    expect(getShareImageUrl("https://typing.example.com/"))
      .toBe("https://typing.example.com/formaltype-share.png");
  });
});
