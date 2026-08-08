import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const practiceSource = readFileSync("pages/practice.tsx", "utf8");
const trainingSource = readFileSync("pages/training.tsx", "utf8");
const globalStyles = readFileSync("styles/globals.css", "utf8");

describe("shared Practice and Training stage spacing", () => {
  it("uses one stage wrapper for Practice and Training without page-local top margins", () => {
    expect(practiceSource).toContain("formaltype-typing-stage");
    expect(practiceSource).not.toMatch(/practice-header[\s\S]{0,300}?\bmb-(?:2|3)\b/);
    expect(trainingSource).not.toMatch(/training-controls[\s\S]{0,160}?\bmb-2\b/);
  });

  it("defines the approved mobile and desktop gaps in one responsive contract", () => {
    expect(globalStyles).toMatch(
      /\.formaltype-typing-stage\s*\{[\s\S]*?margin-top:\s*1rem;[^}]*gap:\s*0\.75rem;/
    );
    expect(globalStyles).toMatch(
      /@media\s*\(min-width:\s*768px\)[\s\S]*?\.formaltype-typing-stage\s*\{[^}]*margin-top:\s*1\.5rem;[^}]*gap:\s*1rem;/
    );
  });

  it("keeps the 40px timer track in normal flow without overlay positioning", () => {
    const timerRule = globalStyles.match(/\.formaltype-typing-timer-region\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(timerRule).toContain("min-height: 2.5rem");
    expect(timerRule).toContain("flex: none");
    expect(timerRule).not.toMatch(/position:\s*(?:absolute|fixed)/);
    expect(practiceSource).not.toContain("typing-timer-overlay");
  });

  it("continues to expose all three shared typing text sizes", () => {
    for (const size of ["small", "medium", "large"]) {
      expect(globalStyles).toContain(`.formaltype-typing-size-${size}`);
    }
  });
});
