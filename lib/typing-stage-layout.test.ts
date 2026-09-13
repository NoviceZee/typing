import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const practiceSource = readFileSync("pages/practice.tsx", "utf8");
const trainingSource = readFileSync("pages/training.tsx", "utf8");
const globalStyles = readFileSync("styles/globals.css", "utf8");
const appShellSource = readFileSync("components/AppShell.tsx", "utf8");

describe("shared Practice and Training stage spacing", () => {
  it("uses one stage wrapper for Practice and Training without page-local top margins", () => {
    expect(practiceSource).toContain("formaltype-typing-stage");
    expect(practiceSource).not.toMatch(/practice-header[\s\S]{0,300}?\bmb-(?:2|3)\b/);
    expect(trainingSource).not.toMatch(/training-controls[\s\S]{0,160}?\bmb-2\b/);
  });

  it("defines compact, intentional stage spacing in one responsive contract", () => {
    expect(globalStyles).toMatch(
      /\.formaltype-typing-stage\s*\{[\s\S]*?margin-top:\s*clamp\(1rem,[^;]*1\.25rem\);[^}]*gap:\s*0\.75rem;/
    );
    expect(globalStyles).toMatch(
      /@media\s*\(min-width:\s*768px\)[\s\S]*?\.formaltype-typing-stage\s*\{[^}]*margin-top:\s*1\.25rem;[^}]*gap:\s*0\.75rem;/
    );
  });

  it("positions the active timer independently so starting does not move the typing canvas", () => {
    const timerRule = globalStyles.match(/\.formaltype-typing-timer-region\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(timerRule).toContain("position: absolute");
    expect(timerRule).toContain("transform: translateY");
    expect(practiceSource).toContain("{isFocusMode && (");
    expect(practiceSource).not.toContain("typing-timer-overlay");
    expect(practiceSource).not.toMatch(/formaltype-typing-canvas[^\n]*overflow-hidden/);
    expect(appShellSource).toContain("!focusMode || typingWorkspace");
    expect(appShellSource).toContain('focusMode && typingWorkspace && "invisible pointer-events-none"');
  });

  it("continues to expose all three shared typing text sizes", () => {
    for (const size of ["small", "medium", "large"]) {
      expect(globalStyles).toContain(`.formaltype-typing-size-${size}`);
    }
  });

  it("uses a clipped three-line viewport instead of a viewport-height stage", () => {
    expect(practiceSource).toContain("formaltype-typing-viewport");
    expect(practiceSource).toContain("formaltype-typing-track");
    for (const oldStageHeight of ["h-[60vh]", "h-[60dvh]", "h-[64vh]", "h-[64dvh]", "h-[68vh]", "h-[68dvh]", "h-[72vh]", "h-[72dvh]"]) {
      expect(practiceSource).not.toContain(oldStageHeight);
    }

    const viewportRule = globalStyles.match(/\.formaltype-typing-viewport\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(viewportRule).toContain("height: calc(var(--formaltype-typing-line-height) + var(--formaltype-typing-line-height) + var(--formaltype-typing-line-height))");
    expect(viewportRule).toContain("overflow-y: hidden");
    expect(viewportRule).not.toContain("padding-block");

    const trackRule = globalStyles.match(/\.formaltype-typing-track\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(trackRule).not.toContain("padding-block");
    expect(practiceSource).not.toMatch(/formaltype-typing-viewport[^\n]*\bpy-/);
  });

  it("uses a wider independent responsive canvas instead of the controls width", () => {
    expect(globalStyles).toMatch(/@media\s*\(min-width:\s*768px\)[\s\S]*?\.formaltype-typing-width-comfortable\s*\{[^}]*max-width:\s*76rem;/);
    expect(globalStyles).toMatch(/\.formaltype-typing-canvas\s*\{[^}]*max-width:\s*80rem;/);
    expect(appShellSource).toContain('min-h-screen px-4 py-4 text-paper md:px-6');
    expect(globalStyles).not.toMatch(/\.formaltype-workspace-root\s*\{[^}]*(?:padding-block|padding-inline):/);
    expect(practiceSource).toContain("formaltype-typing-experience");
    expect(practiceSource).toContain("formaltype-typing-canvas");
    expect(practiceSource).not.toMatch(/formaltype-typing-experience[^\n]*max-w-6xl/);
    expect(practiceSource).not.toMatch(/formaltype-typing-viewport[^\n]*max-w-6xl/);
    expect(practiceSource).toContain("max-w-5xl");
    expect(practiceSource).toContain("typingWorkspace");
    expect(appShellSource).toContain("formaltype-workspace-frame");
    expect(appShellSource).toContain("formaltype-workspace-content");
    expect(appShellSource).toContain('data-testid="site-chrome-row"');
  });

  it("keeps the controls, canvas, and hints in one compact non-centred interaction group", () => {
    const workspaceStart = globalStyles.indexOf(".formaltype-practice-shell");
    const responsiveBreakpoint = globalStyles.indexOf("@media (min-width: 768px)", workspaceStart);
    const baseWorkspaceStyles = globalStyles.slice(workspaceStart, responsiveBreakpoint);

    expect(baseWorkspaceStyles).toMatch(/\.formaltype-workspace-frame\s*\{[^}]*display:\s*flex;[^}]*min-height:\s*min\(calc\(100dvh - 2rem\),\s*54rem\);/);
    expect(globalStyles).toMatch(/\.formaltype-typing-center\s*\{[^}]*flex:\s*0 0 auto;[^}]*justify-content:\s*flex-start;[^}]*padding-block:\s*clamp\(4rem,\s*14vh,\s*9\.5rem\) 1rem;/);
    expect(practiceSource).toContain("formaltype-typing-center");
    expect(practiceSource).toContain("max-w-4xl truncate");
  });

  it("keeps responsive navigation and Practice settings overlays out of document flow", () => {
    expect(appShellSource).toMatch(/mobile-navigation[\s\S]{0,300}?className="[^"]*absolute/);
    expect(practiceSource).toContain("formaltype-practice-settings-compact");
    expect(practiceSource).toContain("formaltype-practice-settings-panel");
    expect(globalStyles).toMatch(
      /@media\s*\(max-width:\s*1023px\)[\s\S]*?\.formaltype-practice-settings-panel\s*\{[^}]*position:\s*absolute;/
    );
    expect(globalStyles).toMatch(
      /\.formaltype-practice-settings-summary\s*\{[^}]*overflow:\s*hidden;[^}]*white-space:\s*nowrap;/
    );
  });

  it("uses fluid pre-desktop type metrics instead of jumping at the workspace breakpoint", () => {
    expect(globalStyles).toMatch(/\.formaltype-typing-size-small\s*\{[^}]*--formaltype-typing-line-height:\s*clamp\(/);
    expect(globalStyles).toMatch(/\.formaltype-typing-size-medium\s*\{[^}]*--formaltype-typing-line-height:\s*clamp\(/);
    expect(globalStyles).toMatch(/\.formaltype-typing-size-large\s*\{[^}]*--formaltype-typing-line-height:\s*clamp\(/);
    expect(globalStyles).toMatch(/\.site-chrome-row\s*\{[^}]*height:\s*2\.75rem;/);
    expect(globalStyles).not.toMatch(/\.formaltype-workspace-header > div\s*\{/);
    expect(globalStyles).not.toMatch(/\.formaltype-workspace-brand\s*\{/);
    expect(appShellSource).not.toContain('compact={!typingWorkspace}');
  });

  it("centres keyboard guidance independently beneath the typing canvas", () => {
    expect(practiceSource).toContain("formaltype-typing-hints");
    expect(globalStyles).toMatch(/\.formaltype-typing-hints\s*\{[^}]*justify-content:\s*center;[^}]*text-align:\s*center;/);
    expect(practiceSource).toContain('isCompactPractice ? "mt-3 gap-2 text-secondary" : "mt-4 gap-3 text-utility"');
  });

  it("keeps the existing desktop typing sizes and exposes their exact line heights to the viewport", () => {
    expect(globalStyles).toMatch(/\.formaltype-typing-size-small\s*\{[^}]*--formaltype-typing-line-height:\s*clamp\(2\.2rem,[^;]*2\.8rem\);[^}]*font-size:\s*clamp\(1\.45rem,[^;]*1\.85rem\);/);
    expect(globalStyles).toMatch(/\.formaltype-typing-size-medium\s*\{[^}]*--formaltype-typing-line-height:\s*clamp\(2\.55rem,[^;]*3\.25rem\);[^}]*font-size:\s*clamp\(1\.7rem,[^;]*2\.15rem\);/);
    expect(globalStyles).toMatch(/\.formaltype-typing-size-large\s*\{[^}]*--formaltype-typing-line-height:\s*clamp\(2\.9rem,[^;]*3\.7rem\);[^}]*font-size:\s*clamp\(1\.95rem,[^;]*2\.45rem\);/);
    expect(globalStyles).toMatch(/@media\s*\(min-width:\s*768px\)[\s\S]*?\.formaltype-typing-size-small\s*\{[^}]*--formaltype-typing-line-height:\s*2\.8rem;[^}]*font-size:\s*1\.85rem;/);
    expect(globalStyles).toMatch(/@media\s*\(min-width:\s*768px\)[\s\S]*?\.formaltype-typing-size-medium\s*\{[^}]*--formaltype-typing-line-height:\s*3\.25rem;[^}]*font-size:\s*2\.15rem;/);
    expect(globalStyles).toMatch(/@media\s*\(min-width:\s*768px\)[\s\S]*?\.formaltype-typing-size-large\s*\{[^}]*--formaltype-typing-line-height:\s*3\.7rem;[^}]*font-size:\s*2\.45rem;/);
  });

  it("allows typing pages to hide the reserved document scrollbar without disabling natural overflow", () => {
    expect(practiceSource).toContain('document.documentElement.classList.add("formaltype-typing-page")');
    expect(practiceSource).toContain('document.documentElement.classList.remove("formaltype-typing-page")');
    expect(globalStyles).toMatch(/html\.formaltype-typing-page\s*\{[^}]*overflow-y:\s*auto;/);
  });
});
