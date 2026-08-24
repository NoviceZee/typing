import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("site document language", () => {
  it("identifies the primarily English interface without inventing hreflang alternates", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "pages/_document.tsx"), "utf8");

    expect(source).toContain('<Html lang="en">');
    expect(source).not.toContain("hreflang");
  });

  it("runs the existing appearance preference bootstrap before page content hydrates", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "pages/_document.tsx"), "utf8");

    expect(source).toContain("THEME_BOOTSTRAP_SCRIPT");
    expect(source.indexOf("THEME_BOOTSTRAP_SCRIPT")).toBeLessThan(source.indexOf("<Main />"));
  });
});
