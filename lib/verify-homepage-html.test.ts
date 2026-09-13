import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const verifierSource = readFileSync("scripts/verifyHomepageHtml.mjs", "utf8");

function routeContract(route: string, nextRoute: string) {
  const start = verifierSource.indexOf(`route: "${route}"`);
  const end = verifierSource.indexOf(`route: "${nextRoute}"`, start);
  return verifierSource.slice(start, end);
}

describe("generated public HTML verification contract", () => {
  it("does not require removed Practice or Training workspace introductions", () => {
    const practiceContract = routeContract("/practice", "/training");
    const trainingContract = routeContract("/training", "/passages");

    expect(practiceContract).not.toContain("visible descriptive h1");
    expect(practiceContract).not.toContain("Typing practice and speed test");
    expect(practiceContract).not.toContain("concise practice introduction");
    expect(practiceContract).not.toContain("Choose English or Chinese");

    expect(trainingContract).not.toContain("visible descriptive h1");
    expect(trainingContract).not.toContain("Focused typing training");
    expect(trainingContract).not.toContain("concise training introduction");
    expect(trainingContract).not.toContain("Choose the content, session length");
  });

  it("retains meaningful route HTML checks without weakening unrelated routes", () => {
    const practiceContract = routeContract("/practice", "/training");
    const trainingContract = routeContract("/training", "/passages");

    expect(practiceContract).toContain("semantic main content");
    expect(practiceContract).toContain("practice language controls");
    expect(trainingContract).toContain("semantic main content");
    expect(trainingContract).toContain("training controls");

    expect(verifierSource).toContain("visible descriptive h1");
    expect(verifierSource).toContain("concise passage introduction");
    expect(verifierSource).toContain("visible Traditional Chinese h1");
    expect(verifierSource).toContain("leaderboard h1");
    expect(verifierSource).toContain("descriptive faq h1");
  });
});
