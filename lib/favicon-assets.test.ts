import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const publicPath = (...segments: string[]) => path.join(process.cwd(), "public", ...segments);

function readPngDimensions(filename: string) {
  const image = fs.readFileSync(publicPath(filename));
  expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
}

describe("favicon assets", () => {
  it.each([
    ["favicon-48x48.png", 48],
    ["apple-touch-icon.png", 180],
    ["favicon-192x192.png", 192]
  ])("provides a square %s at the declared size", (filename, size) => {
    expect(readPngDimensions(filename)).toEqual({ width: size, height: size });
  });

  it("provides a standard square ICO favicon", () => {
    const icon = fs.readFileSync(publicPath("favicon.ico"));

    expect(icon.subarray(0, 4)).toEqual(Buffer.from([0, 0, 1, 0]));
    expect(icon.readUInt16LE(4)).toBeGreaterThan(0);
    expect(icon[6] || 256).toBe(icon[7] || 256);
    expect(icon[6] || 256).toBeGreaterThanOrEqual(48);
  });

  it("keeps the manifest limited to brand identity and icon references", () => {
    const manifest = JSON.parse(fs.readFileSync(publicPath("site.webmanifest"), "utf8"));

    expect(manifest).toEqual({
      name: "Typing Station",
      short_name: "Typing Station",
      icons: [
        { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
        { src: "/favicon-192x192.png", sizes: "192x192", type: "image/png" }
      ]
    });
  });
});
