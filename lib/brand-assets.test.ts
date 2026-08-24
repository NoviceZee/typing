import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const publicPath = (...segments: string[]) => path.join(process.cwd(), "public", ...segments);

describe("production brand assets", () => {
  it("publishes the Typing Station social image under its branded filename", () => {
    const image = fs.readFileSync(publicPath("typingstation-share.png"));

    expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect({ width: image.readUInt32BE(16), height: image.readUInt32BE(20) }).toEqual({ width: 1200, height: 630 });
    expect(fs.readFileSync(publicPath("typingstation-share.svg"), "utf8")).toContain("TYPING STATION");
    expect(fs.existsSync(publicPath("formaltype-share.png"))).toBe(false);
    expect(fs.existsSync(publicPath("formaltype-share.svg"))).toBe(false);
  });
});
