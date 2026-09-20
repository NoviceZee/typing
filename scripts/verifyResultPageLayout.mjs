/**
 * Run with an installed Playwright module (no app dependency needed):
 * PLAYWRIGHT_MODULE_PATH=/path/to/playwright/index.mjs node scripts/verifyResultPageLayout.mjs
 * Uses installed Chrome by default; override PLAYWRIGHT_CHANNEL for another channel.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const fixtureDir = mkdtempSync(join(tmpdir(), "result-page-layout-"));
execFileSync(resolve("node_modules/.bin/vitest"), ["run", "lib/result-page-layout.test.tsx"], {
  env: { ...process.env, RESULT_LAYOUT_OUTPUT: fixtureDir }, stdio: "inherit"
});
execFileSync(resolve("node_modules/.bin/tailwindcss"), ["-i", "styles/globals.css", "-o", join(fixtureDir, "app.css")], { stdio: "inherit" });
const css = readFileSync(join(fixtureDir, "app.css"), "utf8");
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome", headless: true });
try {
  const page = await browser.newPage();
  for (const viewport of [{ width: 1440, height: 1080 }, { width: 1024, height: 768 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    let maxHeight = 0;
    for (const file of readdirSync(fixtureDir).filter((file) => file.endsWith(".html"))) {
      await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${readFileSync(join(fixtureDir, file), "utf8")}</body></html>`);
      const geometry = await page.evaluate(() => {
        const page = document.querySelector('article[aria-labelledby="result-page-title"]');
        const dashboard = document.querySelector('[data-testid="result-dashboard"]');
        const footer = document.querySelector('[aria-label="Result actions"]');
        const chart = document.querySelector('[aria-label="WPM over time"]');
        const composition = document.querySelector('[data-testid="primary-result-composition"]');
        const primarySummary = document.querySelector('[data-testid="primary-result-summary"]');
        const metadata = document.querySelector('#result-page-description');
        const actionButtons = [...footer.querySelectorAll('button')];
        const actionRects = actionButtons.map((button) => button.getBoundingClientRect());
        const errorMarkers = [...chart.querySelectorAll('[data-testid="attempt-error-marker"] line')];
        const rect = page.getBoundingClientRect();
        return {
          height: rect.height,
          verticalOverflow: dashboard.scrollHeight - dashboard.clientHeight,
          horizontalOverflow: page.scrollWidth - page.clientWidth,
          metadataOverflow: metadata.scrollWidth - metadata.clientWidth,
          clippedMetadata: getComputedStyle(metadata).textOverflow === "ellipsis",
          chartHeight: chart.getBoundingClientRect().height,
          chartWidth: chart.getBoundingClientRect().width,
          summaryWidth: primarySummary.getBoundingClientRect().width,
          summaryLeft: primarySummary.getBoundingClientRect().left,
          summaryRight: primarySummary.getBoundingClientRect().right,
          chartLeft: chart.getBoundingClientRect().left,
          chartRight: chart.getBoundingClientRect().right,
          compositionWidth: composition.getBoundingClientRect().width,
          integerTimeTicks: [...chart.querySelectorAll('[data-testid="attempt-chart-time-tick"]')]
            .every((tick) => /^\d+$/.test(tick.textContent || "")),
          netInPrimary: primarySummary.textContent.includes("Net WPM"),
          footerVisible: footer.getBoundingClientRect().bottom <= innerHeight && rect.top >= 0,
          actionHeightSpread: Math.max(...actionRects.map((button) => button.height)) - Math.min(...actionRects.map((button) => button.height)),
          actionLabelsFit: actionButtons.every((button) => button.scrollWidth <= button.clientWidth),
          actionIconsAligned: actionButtons.every((button) => {
            const icon = button.querySelector('svg');
            return icon && Math.abs(icon.getBoundingClientRect().top + icon.getBoundingClientRect().height / 2 - (button.getBoundingClientRect().top + button.getBoundingClientRect().height / 2)) <= 1;
          }),
          actionFocusRings: actionButtons.every((button) => button.dataset.focusRing === "standard"),
          errorMarkerCount: errorMarkers.length,
          errorMarkersVisible: errorMarkers.every((line) => Number(line.getAttribute("stroke-width")) > 0),
          dashboardOverflow: getComputedStyle(dashboard).overflowY,
          footerPosition: getComputedStyle(footer).position,
          hasDialog: Boolean(document.querySelector('[role="dialog"]')),
          hasOverlay: Boolean(document.querySelector('.fixed.inset-0'))
        };
      });
      const label = `${viewport.width}×${viewport.height} ${file}`;
      assert.ok(geometry.verticalOverflow <= 1, `${label}: vertical overflow ${JSON.stringify(geometry)}`);
      assert.ok(geometry.horizontalOverflow <= 1 && geometry.metadataOverflow <= 1, `${label}: horizontal overflow`);
      if (viewport.width >= 1024) {
        assert.ok(geometry.footerVisible && geometry.height <= viewport.height + 1, `${label}: collapsed result does not fit ${JSON.stringify(geometry)}`);
      }
      assert.ok(geometry.dashboardOverflow !== "auto" && geometry.dashboardOverflow !== "scroll", `${label}: nested dashboard scrollbar`);
      assert.ok(geometry.netInPrimary, `${label}: Net WPM is missing from the metric column`);
      if (viewport.width >= 820) {
        assert.ok(geometry.summaryLeft < geometry.chartLeft && geometry.summaryRight <= geometry.chartLeft, `${label}: metric column is not beside the chart`);
        assert.ok(geometry.chartWidth > geometry.summaryWidth * 2, `${label}: chart is not the main result region`);
      }
      assert.ok(geometry.integerTimeTicks, `${label}: chart rendered fractional time labels`);
      assert.ok(geometry.actionHeightSpread <= 1 && geometry.actionLabelsFit && geometry.actionIconsAligned && geometry.actionFocusRings, `${label}: action geometry failed ${JSON.stringify(geometry)}`);
      assert.ok(geometry.errorMarkersVisible, `${label}: chart error markers are not visible`);
      assert.ok(geometry.footerPosition === "static", `${label}: actions are not in normal document flow`);
      assert.ok(!geometry.hasDialog && !geometry.hasOverlay && !geometry.clippedMetadata, `${label}: modal behavior remains`);
      assert.ok(geometry.chartHeight >= (viewport.width >= 820 ? 250 : 220), `${label}: chart too small`);
      maxHeight = Math.max(maxHeight, geometry.height);
      if (file === "long-metadata-mistakes.html") {
        await page.screenshot({ path: join(fixtureDir, `${viewport.width}.png`) });
        assert.ok(await page.getByRole("button", { name: "Review mistakes" }).isVisible());
      }
      if (file === "corrected-errors.html") {
        assert.ok(geometry.errorMarkerCount > 0, `${label}: expected chart error markers`);
      }
    }
    console.log(`${viewport.width}×${viewport.height}: all 11 collapsed states passed; maximum result page height ${maxHeight}px`);
  }
  console.log(`Mobile uses natural page flow. Browser fixtures/screenshots: ${fixtureDir}`);
} finally {
  await browser.close();
}
