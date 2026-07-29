import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("styles/globals.css", "utf8");

describe("typing visual contracts", () => {
  it.each(["small", "medium", "large"])(
    "defines the shared active-line caret height for %s typing text",
    (size) => {
      expect(styles).toMatch(
        new RegExp(
          String.raw`\.formaltype-typing-size-${size}\s*\{[\s\S]*?--formaltype-active-line-caret-height:\s*0\.92em;`
        )
      );
    }
  );

  it("renders Previous Pace at exactly half the shared active line-caret height", () => {
    expect(styles).toMatch(
      /\.formaltype-previous-pace-fixed\s*\{[\s\S]*?--formaltype-previous-pace-height:\s*calc\(var\(--formaltype-active-line-caret-height\) \/ 2\);/
    );
    expect(styles).toMatch(
      /\.formaltype-previous-pace-fixed\s*\{[\s\S]*?height:\s*var\(--formaltype-previous-pace-height\);/
    );
    expect(styles).toMatch(
      /\.formaltype-caret-line > \.formaltype-caret-indicator,[\s\S]*?height:\s*var\(--formaltype-active-line-caret-height\);/
    );
  });

  it("top-aligns Previous Pace with the full-height active line caret", () => {
    expect(styles).toMatch(
      /\.formaltype-previous-pace-fixed\s*\{[\s\S]*?top:\s*var\(--formaltype-caret-top\);/
    );
    expect(styles).toMatch(
      /\.formaltype-caret-line > \.formaltype-caret-indicator,[\s\S]*?top:\s*var\(--formaltype-caret-top\);/
    );
    expect(styles).not.toMatch(
      /\.formaltype-previous-pace-fixed\s*\{[\s\S]*?top:\s*(?:50%|calc\()[^;]*;/
    );
    expect(styles).not.toMatch(
      /\.formaltype-previous-pace-fixed\s*\{[\s\S]*?transform:\s*translateY/
    );
  });
});
