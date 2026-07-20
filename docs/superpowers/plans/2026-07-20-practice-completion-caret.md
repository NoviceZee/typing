# Practice Completion and Caret Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Infinite Practice finish on full-text completion, keep the blue input caret reliably visible across Practice and Training, and ensure Escape results are visible but never persisted or counted.

**Architecture:** Keep `PracticePage` as the session coordinator and preserve `finishTest` as the sole result-calculation path. Derive persistence eligibility from `CompletionReason`, extend full-text completion only to untimed Practice, and harden the existing character-attached caret rather than introducing a second positioning system.

**Tech Stack:** Next.js 15, React 18, TypeScript, Tailwind/CSS, Vitest, Testing Library, local browser QA.

## Global Constraints

- `time_up` and `text_completed` are eligible completed results; `manual` is display-only.
- A manual result must not update local previous results, typing-attempt details, cloud results, cloud attempt details, analytics, achievements, or progress milestones.
- Timed Practice and timed Training continue to end by timer; Training Words retains full-text completion.
- Practice Infinite ends immediately when its normalized target is fully typed.
- The blue input caret remains distinct from the previous-pace marker and respects the saved caret style and blink settings.
- Preserve unrelated user changes in `pages/index.tsx`, `lib/home-page.test.tsx`, `.claude/`, and `artifacts/`.

## File structure

- Modify `pages/practice.tsx`: completion eligibility, Infinite completion trigger, manual-result copy, and current-caret rendering contract.
- Modify `styles/globals.css`: caret stacking and minimum visible blink opacity.
- Modify `lib/practice-page.test.tsx`: Practice completion, persistence, and caret regressions.
- Modify `lib/training-page.test.tsx`: Training caret and unchanged Words completion regressions.

---

### Task 1: Make manual results display-only

**Files:**
- Modify: `pages/practice.tsx:575-713`
- Modify: `pages/practice.tsx:2179-2204`
- Test: `lib/practice-page.test.tsx:392-570`

**Interfaces:**
- Consumes: `CompletionReason = "time_up" | "text_completed" | "manual"`.
- Produces: `isPersistableCompletion(completionReason: CompletionReason): boolean` and a visible `Manual result — not saved.` result note.

- [ ] **Step 1: Write the failing manual-result regression test**

Add a test that authenticates the user, starts Practice, types a prefix, presses Escape, and asserts all of the following:

```tsx
it("shows an Escape result without saving or counting it", async () => {
  window.localStorage.setItem(
    PASSAGE_LIBRARY_STORAGE_KEY,
    JSON.stringify([makePassage("local", "Local active", "Local fallback body text.")])
  );
  mockedGetSupabasePassageLibrary.mockResolvedValue([]);
  authState.user = { id: "user-1" };

  render(<PracticePage />);
  await screen.findByText(/Local fallback body text/);
  fireEvent.keyDown(window, { key: "Tab" });
  typeIncrementally(screen.getByLabelText("Typing input"), "Local");
  fireEvent.keyDown(window, { key: "Escape" });

  expect(await screen.findByText("Manual result — not saved.")).toBeTruthy();
  expect(screen.getByRole("dialog", { name: /Session ended/i })).toBeTruthy();
  expect(readPreviousResult("local", 60)).toBeNull();
  expect(readTypingAttemptDetails("user-1")).toEqual([]);
  expect(mockedSaveSupabaseTypingResult).not.toHaveBeenCalled();
  expect(mockedGetSupabaseAnalyticsTypingResults).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node_modules/.bin/vitest run lib/practice-page.test.tsx -t "shows an Escape result without saving or counting it"`

Expected: FAIL because the manual result note is absent and the result is currently written locally and uploaded.

- [ ] **Step 3: Add the minimal persistence eligibility guard**

Add the helper near the other completion helpers:

```ts
function isPersistableCompletion(completionReason: CompletionReason) {
  return completionReason !== "manual";
}
```

Inside `finishTest`, derive `const shouldPersistResult = isPersistableCompletion(completionReason);`. Require both `shouldPersistResult` and `!isSuspicious` before `writePreviousResult`, `appendTypingAttemptDetail`, cloud save, attempt-detail upload, and progress analytics. Keep result calculation, `setLastResult`, timeline display, modal opening, and previous saved comparison reads unchanged.

In `ResultModal`, render this message when `result.completionReason === "manual"`:

```tsx
<p className="mt-1 font-mono text-secondary text-paper/45">Manual result — not saved.</p>
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node_modules/.bin/vitest run lib/practice-page.test.tsx -t "shows an Escape result without saving or counting it"`

Expected: PASS with one displayed manual result and zero persistence side effects.

- [ ] **Step 5: Run the Practice persistence regressions**

Run: `node_modules/.bin/vitest run lib/practice-page.test.tsx -t "finishes and saves|Escape result|previous comparison"`

Expected: PASS; time-up results still save exactly once and manual results do not replace previous comparisons.

- [ ] **Step 6: Commit the manual-result boundary**

```bash
git add pages/practice.tsx lib/practice-page.test.tsx
git commit -m "fix: exclude manual typing results from progress"
```

### Task 2: Finish Practice Infinite on full target completion

**Files:**
- Modify: `pages/practice.tsx:1022-1039`
- Test: `lib/practice-page.test.tsx:544-570`

**Interfaces:**
- Consumes: `isTimedMode`, `trainingSession`, `isTypedTextComplete(sourceText, nextValue, rules)`.
- Produces: full-text completion when `trainingSession?.kind === "words" || (!trainingMode && !isTimedMode)`.

- [ ] **Step 1: Write failing English and Chinese Infinite tests**

Add separate English and Chinese tests. Each selects Infinite, starts input, commits the complete target, and expects a `text_completed` result plus one cloud save for an authenticated user:

```tsx
it("finishes English Infinite Practice when the full target is typed", async () => {
  const text = "Complete this infinite passage.";
  window.localStorage.setItem(PASSAGE_LIBRARY_STORAGE_KEY, JSON.stringify([
    makePassage("english", "English Infinite", text, "english")
  ]));
  mockedGetSupabasePassageLibrary.mockResolvedValue([]);
  authState.user = { id: "user-1" };

  render(<PracticePage />);
  await screen.findByText(text);
  fireEvent.click(screen.getByRole("button", { name: "Infinite" }));
  fireEvent.keyDown(window, { key: "Tab" });
  typeIncrementally(screen.getByLabelText("Typing input"), text);

  expect(await screen.findByRole("dialog", { name: /Session ended/i })).toBeTruthy();
  expect(mockedSaveSupabaseTypingResult).toHaveBeenCalledTimes(1);
  expect(mockedSaveSupabaseTypingResult.mock.calls[0][0].result.completionReason).toBe("text_completed");
});
```

The Chinese variant uses `fireEvent.input` with the full Chinese value and verifies the saved passage language is `chinese`.

- [ ] **Step 2: Run both focused tests and verify RED**

Run: `node_modules/.bin/vitest run lib/practice-page.test.tsx -t "finishes .* Infinite Practice when the full target is typed"`

Expected: both tests FAIL because current code only completes `trainingSession.kind === "words"`.

- [ ] **Step 3: Extend only the untimed full-text completion condition**

Replace the Training-only condition with:

```ts
const shouldFinishCompletedText =
  trainingSession?.kind === "words" || (!trainingMode && !isTimedMode);

if (shouldFinishCompletedText && isTypedTextComplete(sourceText, nextValue, rules)) {
  finishTest("text_completed");
}
```

Do not enable this condition for timed Practice, timed Training, or Code Training.

- [ ] **Step 4: Run Infinite and timed completion tests and verify GREEN**

Run: `node_modules/.bin/vitest run lib/practice-page.test.tsx lib/training-page.test.tsx -t "Infinite|timer expires|Code mode|words mode"`

Expected: PASS; Infinite completes by text, Training Words remains unchanged, and timed modes do not finish early.

- [ ] **Step 5: Commit Infinite completion**

```bash
git add pages/practice.tsx lib/practice-page.test.tsx
git commit -m "fix: finish infinite practice on text completion"
```

### Task 3: Harden the blue input caret across Practice and Training

**Files:**
- Modify: `pages/practice.tsx:1641-1697`
- Modify: `pages/practice.tsx:1900-1941`
- Modify: `pages/practice.tsx:3403-3420`
- Modify: `styles/globals.css:890-940`
- Test: `lib/practice-page.test.tsx:1235-1290`
- Test: `lib/training-page.test.tsx:221-265`

**Interfaces:**
- Consumes: `CharacterComparison.status === "current"`, `ThemeSettings.caretStyle`, and `ThemeSettings.caretBlink`.
- Produces: exactly one `[data-typing-caret="true"]` current character while an unfinished target exists.

- [ ] **Step 1: Write failing caret contract tests**

Add a shared assertion in each test file or inline assertions that check idle and running states:

```tsx
const getTypingCaret = () =>
  screen.getByTestId("typing-character-layer").querySelectorAll('[data-typing-caret="true"]');

expect(getTypingCaret()).toHaveLength(1);
fireEvent.keyDown(window, { key: "Tab" });
fireEvent.change(screen.getByLabelText("Typing input"), { target: { value: "A" } });
expect(getTypingCaret()).toHaveLength(1);
expect(getTypingCaret()[0].className).toContain("formaltype-caret-bar");
```

Cover English Practice, Chinese Practice through `fireEvent.input`, English Training after a word boundary, and Chinese Training after a committed character. Include a target containing `"A strong"` so the current comparison position is whitespace after `A`.

Add a separate line-break assertion using a passage such as `"first line\nsecond line"`: type `"first line"`, verify the single caret element has `aria-label="Line break"`, then type the newline and verify the single caret moves to the `s` in `second line`.

- [ ] **Step 2: Run focused caret tests and verify RED**

Run: `node_modules/.bin/vitest run lib/practice-page.test.tsx lib/training-page.test.tsx -t "typing caret"`

Expected: FAIL because current characters do not expose the explicit caret contract.

- [ ] **Step 3: Add the explicit current-caret attribute**

Where character spans are rendered in the normal layer and `TrainingTokenCharacterLayer`, add:

```tsx
data-typing-caret={isCurrent ? "true" : undefined}
```

For the trailing Training character map use `character.status === "current"`. Keep `characterClass` as the single source of caret style and blink classes.

- [ ] **Step 4: Strengthen caret visibility without disabling preferences**

Update the CSS contract:

```css
.formaltype-typed-current {
  color: rgb(var(--color-paper));
  isolation: isolate;
  position: relative;
  z-index: 1;
}

.formaltype-typed-current::after {
  animation: none;
  content: "";
  opacity: 1;
  pointer-events: none;
  position: absolute;
}

.formaltype-caret-bar::after,
.formaltype-caret-underline::after {
  box-shadow: 0 0 0.16em rgb(var(--color-accent) / 0.28);
  z-index: 2;
}

@keyframes formaltype-caret-blink {
  50% {
    opacity: 0.68;
  }
}
```

Keep block-caret `z-index: -1` so the character stays readable.

- [ ] **Step 5: Run caret tests and verify GREEN**

Run: `node_modules/.bin/vitest run lib/practice-page.test.tsx lib/training-page.test.tsx -t "typing caret|typing appearance|visually separates Chinese terms"`

Expected: PASS with exactly one current input caret in each tested state.

- [ ] **Step 6: Perform browser visual checks**

Start the existing local Next.js development server without reinstalling dependencies. In the local browser, verify Practice English, Practice Chinese, Training English, and Training Chinese at idle and after one committed character. For each state confirm:

```js
({
  count: document.querySelectorAll('[data-typing-caret="true"]').length,
  display: getComputedStyle(document.querySelector('[data-typing-caret="true"]'), "::after").display,
  opacity: getComputedStyle(document.querySelector('[data-typing-caret="true"]'), "::after").opacity,
  background: getComputedStyle(document.querySelector('[data-typing-caret="true"]'), "::after").backgroundColor
})
```

Expected: `count` is `1`, display is not `none`, opacity is at least `0.68`, and the background uses the active accent colour.

- [ ] **Step 7: Commit caret reliability**

```bash
git add pages/practice.tsx styles/globals.css lib/practice-page.test.tsx lib/training-page.test.tsx
git commit -m "fix: keep typing caret visible across modes"
```

### Task 4: Full verification

**Files:**
- Verify: all modified production and test files.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: fresh evidence that the requested behaviour and repository quality gates pass.

- [ ] **Step 1: Run the complete automated test suite**

Run: `node_modules/.bin/vitest run`

Expected: all test files pass with zero failures.

- [ ] **Step 2: Run static verification**

Run: `node_modules/.bin/tsc --noEmit`

Expected: exit code 0.

Run: `node_modules/.bin/eslint pages components lib scripts next.config.js --ext .js,.ts,.tsx`

Expected: exit code 0 with no errors.

- [ ] **Step 3: Run the production build**

Run: `node_modules/.bin/next build`

Expected: exit code 0 and all routes compile successfully.

- [ ] **Step 4: Review final diff and scope**

Run: `git diff --check HEAD~3..HEAD` and `git status --short`.

Expected: no whitespace errors; unrelated pre-existing files remain untouched by these commits.
