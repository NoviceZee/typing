import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const publicPath = (...segments: string[]) => path.join(process.cwd(), "public", ...segments);

describe("production brand assets", () => {
  it("publishes the two supplied Typing Station marks without altering their bytes", () => {
    const expectedHashes = {
      "typing-station-mark-light.png": "d458ee6fa041c3f4e8f34640ff0c515f7cef190b8ef8573f5ebc32278cdd887a",
      "typing-station-mark-dark.png": "e78766406c0f6055e29d3992854897d75cb670a0d0f8c7b62450d5d042984921"
    };

    for (const [filename, expectedHash] of Object.entries(expectedHashes)) {
      const mark = fs.readFileSync(publicPath(filename));
      expect(createHash("sha256").update(mark).digest("hex")).toBe(expectedHash);
      expect({ width: mark.readUInt32BE(16), height: mark.readUInt32BE(20) }).toEqual({ width: 1536, height: 1024 });
    }
    expect(fs.existsSync(publicPath("typing-station-mark.svg"))).toBe(false);
  });

  it("publishes the Typing Station social image under its branded filename", () => {
    const image = fs.readFileSync(publicPath("typingstation-share.png"));

    expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect({ width: image.readUInt32BE(16), height: image.readUInt32BE(20) }).toEqual({ width: 1200, height: 630 });
    expect(fs.readFileSync(publicPath("typingstation-share.svg"), "utf8")).toContain("TYPING STATION");
    expect(fs.existsSync(publicPath("formaltype-share.png"))).toBe(false);
    expect(fs.existsSync(publicPath("formaltype-share.svg"))).toBe(false);
  });
});
