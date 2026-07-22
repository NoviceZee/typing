/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PracticePage, { filterComparableRecentResults, PracticeTrainingMode } from "../pages/practice";
import type { LibraryPassage } from "@/lib/app-storage";
import {
  ACTIVE_PASSAGE_ID_STORAGE_KEY,
  PASSAGE_LIBRARY_STORAGE_KEY,
  PASSAGE_SELECTION_MODE_STORAGE_KEY,
  readPreviousResult
} from "@/lib/app-storage";
import { getSupabasePassageLibrary } from "@/lib/passageStorage";
import { getSupabaseAnalyticsTypingResults, saveSupabaseTypingResult } from "@/lib/typingResultStorage";
import { readTypingAttemptDetails } from "@/lib/typingStatistics";
import { getResultAnalyticsDomain } from "@/lib/analyticsDomain";

vi.mock("@/components/AppShell", () => ({
  AppShell: ({
    children,
    sideAd,
    topAd
  }: {
    children: React.ReactNode;
    sideAd?: boolean;
    topAd?: boolean;
  }) => (
    <div data-testid="app-shell" data-side-ad={String(sideAd)} data-top-ad={String(topAd)}>
      {topAd && <div data-testid="top-ad-slot">Top ad</div>}
      {sideAd && <div data-testid="side-ad-slot">Side ad</div>}
      {children}
    </div>
  ),
  AdPlaceholder: () => <div>Ad space</div>
}));

vi.mock("next/link", () => ({
  default: React.forwardRef<
    HTMLAnchorElement,
    React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
  >(function MockNextLink({ href, children, ...props }, ref) {
    return <a ref={ref} href={href} {...props}>{children}</a>;
  })
}));

const authState: { user: { id: string } | null } = { user: null };

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: authState.user })
}));

vi.mock("@/lib/passageStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/passageStorage")>("@/lib/passageStorage");

  return {
    ...actual,
    getSupabasePassageLibrary: vi.fn()
  };
});

const mockedGetSupabasePassageLibrary = vi.mocked(getSupabasePassageLibrary);

vi.mock("@/lib/typingResultStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/typingResultStorage")>("@/lib/typingResultStorage");

  return {
    ...actual,
    getSupabaseAnalyticsTypingResults: vi.fn().mockResolvedValue([]),
    getSupabaseOwnTypingResults: vi.fn().mockResolvedValue([]),
    saveSupabaseTypingResult: vi.fn().mockResolvedValue({
      id: "saved-result",
      created_at: "2026-06-19T00:00:00.000Z"
    })
  };
});

vi.mock("@/lib/typingAttemptStorage", () => ({
  saveSupabaseTypingAttemptDetail: vi.fn().mockResolvedValue(undefined)
}));

const mockedGetSupabaseAnalyticsTypingResults = vi.mocked(getSupabaseAnalyticsTypingResults);
const mockedSaveSupabaseTypingResult = vi.mocked(saveSupabaseTypingResult);
const TOUCH_FIRST_INPUT_MEDIA_QUERY = "(hover: none) and (pointer: coarse)";
const SOUND_PACKS = [
  "mechanical",
  "clicky",
  "soft",
  "typewriter",
  "laptop",
  "recorded",
  "recorded-1",
  "recorded-2",
  "recorded-3",
  "recorded-4",
  "recorded-5",
  "recorded-6",
  "recorded-9",
  "recorded-10"
];

function mockTouchFirstInput(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: TOUCH_FIRST_INPUT_MEDIA_QUERY,
    onchange: null,
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true)
  } as unknown as MediaQueryList;

  vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));

  return {
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      const event = { matches, media: TOUCH_FIRST_INPUT_MEDIA_QUERY } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    }
  };
}

describe("PracticePage passage loading", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    authState.user = null;
    mockedGetSupabasePassageLibrary.mockReset();
    mockedGetSupabaseAnalyticsTypingResults.mockClear();
    mockedSaveSupabaseTypingResult.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shows a quiet reserved placeholder until Supabase passage resolution finishes", async () => {
    let resolveSupabaseLibrary: (library: LibraryPassage[]) => void = () => {};
    mockedGetSupabasePassageLibrary.mockReturnValue(
      new Promise((resolve) => {
        resolveSupabaseLibrary = resolve;
      })
    );

    const { container } = render(<PracticePage />);

    expect(screen.getByTestId("passage-loading-placeholder")).toBeTruthy();
    expect(screen.queryByText("Loading passage...")).toBeNull();
    expect(container.textContent).not.toContain("Please review");
    expect(container.textContent).not.toContain("Local fallback body text");

    resolveSupabaseLibrary([makePassage("supabase", "Supabase active", "Supabase final body text.")]);

    await waitFor(() => {
      expect(container.textContent).toContain("Supabase final body text.");
    });
    expect(screen.queryByTestId("passage-loading-placeholder")).toBeNull();
  });

  it("uses local fallback only after Supabase returns no active public passages", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    expect(screen.getByTestId("passage-loading-placeholder")).toBeTruthy();
    expect(screen.queryByText("Loading passage...")).toBeNull();
    expect(container.textContent).not.toContain("Local fallback body text.");

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text.");
    });
    expect(screen.queryByTestId("passage-loading-placeholder")).toBeNull();
  });

  it("shows compact passage actions and metadata without category or passage dropdowns", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text.");
    });

    expect(screen.getByTestId("practice-passage-metadata").textContent).toContain("Local active · Business email · Formal · 1m");
    expect(screen.getByRole("group", { name: "Practice language" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Practice passage source" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "English" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Chinese" })).toBeTruthy();
    const randomButton = screen.getByRole("button", { name: "Random" });
    expect(randomButton.querySelector("svg")).toBeTruthy();
    expect(randomButton.textContent).toBe("Random");
    expect(screen.getByRole("link", { name: "Library" }).getAttribute("href")).toBe("/passages?language=english");
    expect(screen.getByRole("button", { name: "1m" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "5m" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "10m" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Infinite" })).toBeTruthy();
    expect(screen.getByTestId("practice-controls").className).not.toMatch(/rounded-full|border|bg-/);
    expect(container.querySelector("select")).toBeNull();
    expect(screen.queryByLabelText("Category")).toBeNull();
    expect(screen.queryByLabelText("Passage")).toBeNull();
  });

  it("keeps one stable Practice timer outside the typing viewport", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text.");
    });

    const shell = container.querySelector(".formaltype-practice-shell");
    const viewport = screen.getByTestId("typing-viewport");
    const timerRegion = screen.getByTestId("typing-timer-region");
    expect(screen.queryByTestId("typing-timer")).toBeNull();
    expect(screen.queryByTestId("typing-timer-overlay")).toBeNull();
    expect(shell?.contains(timerRegion)).toBe(true);
    expect(timerRegion.compareDocumentPosition(viewport) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(timerRegion.className).toContain("formaltype-typing-timer-region");

    fireEvent.keyDown(window, { key: "Tab" });
    const timer = screen.getByTestId("typing-timer");
    expect(timer.textContent).toBe("1:00");
    expect(timer.parentElement?.className).toContain("formaltype-typing-timer");
    expect(timer.parentElement?.className).not.toMatch(/text-lg|text-xl|text-2xl|text-\[/);
    expect(shell?.contains(timer)).toBe(true);
    expect(timerRegion.contains(timer)).toBe(true);
    expect(viewport.contains(timer)).toBe(false);
    typeIncrementally(screen.getByLabelText("Typing input"), "L");

    expect(screen.getByTestId("typing-timer").textContent).toBe("1:00");
  });

  it.each([
    ["paired", "「文字」", [0x300c, 0x6587, 0x5b57, 0x300d]],
    ["nested", "「『文字』」", [0x300c, 0x300e, 0x6587, 0x5b57, 0x300f, 0x300d]]
  ])("compares final committed Chinese %s quotation input character-for-character", async (_label, target, codePoints) => {
    render(<PracticePage trainingMode={makeChineseQuoteTrainingMode(target as string)} />);

    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent).toBe(target);
    });

    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.compositionStart(input);
    fireEvent.input(input, {
      target: { value: "transient" },
      nativeEvent: { isComposing: true, data: "transient" }
    });
    expect(screen.getByTestId("typing-character-layer").querySelector('[data-index="0"]')?.className).toContain(
      "formaltype-typed-current"
    );

    fireEvent.compositionEnd(input, { data: target, target: { value: target } });
    fireEvent.input(input, {
      target: { value: target },
      nativeEvent: { isComposing: false, data: target }
    });
    fireEvent.input(input, {
      target: { value: target },
      nativeEvent: { isComposing: false, data: target }
    });

    expect(input.value).toBe(target);
    expect(Array.from(input.value, (character) => character.codePointAt(0))).toEqual(codePoints);
    expect(Array.from(target as string, (character) => character.codePointAt(0))).toEqual(codePoints);
    expect(screen.getByTestId("typing-character-layer").querySelectorAll(".formaltype-typed-wrong")).toHaveLength(0);
    expect(screen.getByTestId("typing-character-layer").querySelectorAll(".formaltype-typed-correct")).toHaveLength(
      Array.from(target as string).length
    );
  });

  it("does not treat alternate Chinese quotation code points as equivalent", async () => {
    const target = "「文字」";
    const committed = "『文字』";
    render(<PracticePage trainingMode={makeChineseQuoteTrainingMode(target)} />);

    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent).toBe(target);
    });

    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.compositionStart(input);
    fireEvent.compositionEnd(input, { data: committed, target: { value: committed } });
    fireEvent.input(input, {
      target: { value: committed },
      nativeEvent: { isComposing: false, data: committed }
    });

    expect(input.value).toBe(committed);
    expect(Array.from(input.value, (character) => character.codePointAt(0))).toEqual([
      0x300e,
      0x6587,
      0x5b57,
      0x300f
    ]);
    expect(screen.getByTestId("typing-character-layer").querySelectorAll(".formaltype-typed-wrong")).toHaveLength(2);
  });

  it("keeps the English Practice target layout stable when typing starts", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for stable layout.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for stable layout.");
    });

    const shell = container.querySelector(".formaltype-practice-shell") as HTMLElement;
    const viewport = screen.getByTestId("typing-viewport");
    const textContainer = screen.getByTestId("typing-text-container");
    const idleShellClassName = shell.className;
    const idleViewportClassName = viewport.className;
    const idleTextContainerClassName = textContainer.className;

    expect(idleShellClassName).toContain("flex");
    expect(idleShellClassName).not.toContain("ring-1");
    expect(idleShellClassName).not.toContain("ring-paper/5");
    expect(idleViewportClassName).toContain("h-full");
    expect(idleViewportClassName).not.toContain("h-[340px]");

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "L");

    expect(shell.className).toBe(idleShellClassName);
    expect(shell.getAttribute("data-focus-mode")).toBe("true");
    expect(screen.getByTestId("practice-header").className).toContain("invisible");
    expect(screen.getByTestId("typing-viewport").className).toBe(idleViewportClassName);
    expect(screen.getByTestId("typing-text-container").className).toBe(idleTextContainerClassName);
  });

  it("keeps the Chinese Practice target layout stable when committed input starts", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([
        makePassage("english", "English active", "English body text for typing.", "english"),
        makePassage("chinese", "中文穩定", "客戶測試", "chinese", "工作", "一般")
      ])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("English body text for typing.");
    });
    fireEvent.click(screen.getByRole("button", { name: "Chinese" }));

    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent).toContain("客戶測試");
    });

    const shell = container.querySelector(".formaltype-practice-shell") as HTMLElement;
    const viewport = screen.getByTestId("chinese-target-viewport");
    const inputArea = screen.getByTestId("chinese-input-area");
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const textContainer = screen.getByTestId("typing-text-container");
    const idleShellClassName = shell.className;
    const idleViewportClassName = viewport.className;
    const idleInputAreaClassName = inputArea.className;
    const idleTextContainerClassName = textContainer.className;

    expect(inputArea.className).toContain("w-full");
    expect(inputArea.className).toContain("max-w-5xl");
    expect(inputArea.className).not.toMatch(/fit|max-content|max-w-3xl/);
    expect(input.className).toContain("w-full");
    expect(input.className).toContain("min-h-[104px]");

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.input(input, {
      target: { value: "客" },
      nativeEvent: { isComposing: false, data: "客" }
    });

    expect(shell.className).toBe(idleShellClassName);
    expect(shell.getAttribute("data-focus-mode")).toBe("true");
    expect(screen.getByTestId("practice-header").className).toContain("invisible");
    expect(screen.getByTestId("chinese-target-viewport").className).toBe(idleViewportClassName);
    expect(screen.getByTestId("chinese-input-area").className).toBe(idleInputAreaClassName);
    expect(screen.getByTestId("typing-text-container").className).toBe(idleTextContainerClassName);
  });

  it("reveals Infinite Practice elapsed time only after Tab", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text.");
    });

    fireEvent.click(screen.getByRole("button", { name: "Infinite" }));

    await waitFor(() => {
      expect(screen.getByTestId("practice-passage-metadata").textContent).toContain("Infinite");
    });

    expect(screen.queryByTestId("typing-timer")).toBeNull();
    fireEvent.keyDown(window, { key: "Tab" });
    const timer = screen.getByTestId("typing-timer");
    expect(screen.getAllByTestId("typing-timer")).toHaveLength(1);
    expect(timer.textContent).toBe("0:00");
    expect(container.querySelector(".formaltype-practice-shell")?.contains(timer)).toBe(true);
    expect(screen.queryByTestId("typing-timer-overlay")).toBeNull();
  });

  it("does not finish a timed Practice attempt before the first accepted input", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);
    authState.user = { id: "user-1" };

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text.");
    });

    vi.useFakeTimers();
    fireEvent.keyDown(window, { key: "Tab" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_500);
    });

    expect(screen.getByTestId("typing-timer").textContent).toBe("1:00");
    expect(screen.queryByText("Time up")).toBeNull();
    expect(mockedSaveSupabaseTypingResult).not.toHaveBeenCalled();
  });

  it("finishes and saves English 1m Practice exactly once when the timer expires", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for timer expiry.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);
    authState.user = { id: "user-1" };

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for timer expiry.");
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T12:00:00.000Z"));
    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_250);
    });

    expect(screen.getAllByText("Time up").length).toBeGreaterThan(0);
    expect(mockedSaveSupabaseTypingResult).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("typing-timer")).toBeNull();
    expect(mockedSaveSupabaseTypingResult.mock.calls[0][0].result.durationSeconds).toBe(60);
    expect(getResultAnalyticsDomain({ category: mockedSaveSupabaseTypingResult.mock.calls[0][0].passage.category })).toBe("english");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(mockedSaveSupabaseTypingResult).toHaveBeenCalledTimes(1);
  });

  it("shows an Escape result without saving or counting it", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);
    authState.user = { id: "user-1" };

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text.");
    });

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

  it("keeps the active Practice session usable when local result persistence hits quota", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for quota failure.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);
    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation((key: string, value: string) => {
      if (key === "formaltype_previous_results" || key === "formaltype.typing_attempt_details.v1") {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      }

      return originalSetItem.call(window.localStorage, key, value);
    });

    try {
      const { container } = render(<PracticePage />);

      await waitFor(() => {
        expect(container.textContent).toContain("Local fallback body text for quota failure.");
      });

      await expect(finishTimedPractice("Local fallback")).resolves.toBeUndefined();
      expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();
      expect(screen.getByText("Session review")).toBeTruthy();
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it("finishes English 5m Practice and keeps the result open when typing continues", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for five minute expiry.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);
    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for five minute expiry.");
    });
    fireEvent.click(screen.getByRole("button", { name: "5m" }));
    expect(screen.queryByTestId("typing-timer")).toBeNull();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T12:00:00.000Z"));
    fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByTestId("typing-timer").textContent).toBe("5:00");
    fireEvent.change(screen.getByLabelText("Typing input"), { target: { value: "L" } });

    vi.setSystemTime(new Date("2026-07-07T12:05:00.250Z"));
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(screen.getAllByText("Time up").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5:00").length).toBeGreaterThan(0);
    expect(mockedSaveSupabaseTypingResult).not.toHaveBeenCalled();
    expect(screen.queryByTestId("typing-timer")).toBeNull();

    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const valueAtFinish = input.value;
    fireEvent.change(input, { target: { value: `${valueAtFinish}X` } });
    expect(input.value).toBe(valueAtFinish);

    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByRole("dialog", { name: /Time up/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();
  });

  it("finishes and saves Chinese 1m Practice as Chinese when the timer expires", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([
        makePassage("english", "English active", "English body text for typing.", "english"),
        makePassage("chinese", "中文計時", "客戶測試確認", "chinese", "工作", "一般")
      ])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);
    authState.user = { id: "user-1" };

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("English body text for typing.");
    });
    fireEvent.click(screen.getByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent).toContain("客戶測試確認");
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T12:00:00.000Z"));
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.input(screen.getByLabelText("Typing input"), {
      target: { value: "客戶" },
      nativeEvent: { isComposing: false, data: "客戶" }
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_250);
    });

    expect(screen.getAllByText("Time up").length).toBeGreaterThan(0);
    expect(mockedSaveSupabaseTypingResult).toHaveBeenCalledTimes(1);
    const savedPayload = mockedSaveSupabaseTypingResult.mock.calls[0][0];
    expect(savedPayload.passage.language).toBe("chinese");
    expect(getResultAnalyticsDomain({ category: savedPayload.passage.category })).toBe("chinese");
  });

  it("does not auto-finish Infinite Practice from elapsed time", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for infinite mode.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);
    authState.user = { id: "user-1" };

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for infinite mode.");
    });
    fireEvent.click(screen.getByRole("button", { name: "Infinite" }));
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T12:00:00.000Z"));
    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_250);
    });

    expect(screen.queryByText("Time up")).toBeNull();
    expect(mockedSaveSupabaseTypingResult).not.toHaveBeenCalled();
    expect(screen.getByTestId("typing-timer").textContent).toBe("2:00");
  });

  it("finishes English Infinite Practice when the full target is typed", async () => {
    const text = "Complete this infinite passage.";
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("english", "English Infinite", text, "english")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);
    authState.user = { id: "user-1" };

    const { container } = render(<PracticePage />);
    await waitFor(() => expect(container.textContent).toContain(text));
    const infiniteButton = screen.getByRole("button", { name: "Infinite" });
    fireEvent.click(infiniteButton);
    await waitFor(() => expect(infiniteButton.getAttribute("aria-pressed")).toBe("true"));
    await waitFor(() => expect(screen.getByTestId("typing-character-layer").textContent).toBe(text));
    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), text);

    expect(await screen.findByRole("dialog", { name: /Session ended/i })).toBeTruthy();
    expect(mockedSaveSupabaseTypingResult).toHaveBeenCalledTimes(1);
    expect(mockedSaveSupabaseTypingResult.mock.calls[0][0].result.completionReason).toBe("text_completed");
  });

  it("finishes Chinese Infinite Practice when the full target is typed", async () => {
    const text = "客戶測試確認";
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([
        makePassage("english", "English active", "English body text.", "english"),
        makePassage("chinese", "中文 Infinite", text, "chinese", "工作", "一般")
      ])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);
    authState.user = { id: "user-1" };

    render(<PracticePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Chinese" }));
    await waitFor(() => expect(screen.getByTestId("typing-character-layer").textContent).toContain(text));
    const infiniteButton = screen.getByRole("button", { name: "Infinite" });
    fireEvent.click(infiniteButton);
    await waitFor(() => expect(infiniteButton.getAttribute("aria-pressed")).toBe("true"));
    await waitFor(() => {
      const currentTarget = screen.getByTestId("typing-character-layer").textContent ?? "";
      expect(currentTarget.length).toBeGreaterThan(0);
      expect(currentTarget.length).toBeLessThan(200);
    });
    const currentTarget = screen.getByTestId("typing-character-layer").textContent ?? "";
    fireEvent.keyDown(window, { key: "Tab" });
    const input = screen.getByLabelText("Typing input");
    let typedValue = "";
    for (const character of currentTarget) {
      typedValue += character;
      fireEvent.input(input, {
        target: { value: typedValue },
        nativeEvent: { isComposing: false, data: character }
      });
    }

    expect(await screen.findByRole("dialog", { name: /Session ended/i })).toBeTruthy();
    expect(mockedSaveSupabaseTypingResult).toHaveBeenCalledTimes(1);
    expect(mockedSaveSupabaseTypingResult.mock.calls[0][0].result.completionReason).toBe("text_completed");
    expect(mockedSaveSupabaseTypingResult.mock.calls[0][0].passage.language).toBe("chinese");
  });

  it("keeps the existing practice controls visible", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    render(<PracticePage />);

    await waitFor(() => {
      expect(screen.getByTestId("practice-passage-metadata").textContent).toContain("Local active");
    });

    expect(screen.getByRole("button", { name: "Random" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Library" }).getAttribute("href")).toBe("/passages?language=english");
    expect(screen.getByRole("button", { name: "1m" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "5m" })).toBeTruthy();
    expect(screen.getByLabelText("Typing input")).toBeTruthy();
  });

  it("uses built-in Chinese samples quietly when remote passages contain no saved Chinese records", async () => {
    mockedGetSupabasePassageLibrary.mockResolvedValue([
      makePassage("remote-english", "Remote English", "Remote English body text for typing.", "english")
    ]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Remote English body text for typing.");
    });

    fireEvent.click(screen.getByRole("button", { name: "Chinese" }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Library" }).getAttribute("href")).toBe("/passages?language=chinese");
      expect(screen.getByTestId("typing-character-layer").textContent).toMatch(/[\u3400-\u9fff]/);
    });
    expect(screen.queryByText("No active saved passages found. Using a sample passage.")).toBeNull();
    expect(screen.getByLabelText("Typing input")).toBeTruthy();
  });

  it("prioritizes saved Chinese passages over built-in Chinese samples", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([
        makePassage("english", "English active", "English body text for typing.", "english"),
        makePassage("saved-chinese", "Saved Chinese", "保存中文內容", "chinese", "工作", "一般")
      ])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("English body text for typing.");
    });

    fireEvent.click(screen.getByRole("button", { name: "Chinese" }));

    await waitFor(() => {
      expect(container.textContent).toContain("保存中文內容");
    });
    expect(screen.getByTestId("practice-passage-metadata").textContent).toContain("Saved Chinese");
    expect(screen.queryByText("No active saved passages found. Using a sample passage.")).toBeNull();
  });

  it("shows only the touch hint for touch-first input capabilities", async () => {
    mockTouchFirstInput(true);
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    render(<PracticePage />);

    await waitFor(() => {
      expect(screen.queryByTestId("passage-loading-placeholder")).toBeNull();
    });

    expect(window.matchMedia).toHaveBeenCalledWith(TOUCH_FIRST_INPUT_MEDIA_QUERY);
    expect(screen.getByText("Tap to start")).toBeTruthy();
    expect(screen.queryByText("Tab = start")).toBeNull();
    expect(screen.queryByText("Tab + Enter = restart")).toBeNull();
    expect(screen.queryByText("Esc = finish")).toBeNull();
  });

  it("shows only keyboard shortcuts for keyboard-first input capabilities", async () => {
    mockTouchFirstInput(false);
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    render(<PracticePage />);

    await waitFor(() => {
      expect(screen.queryByTestId("passage-loading-placeholder")).toBeNull();
    });

    expect(screen.queryByText("Tap to start")).toBeNull();
    expect(screen.getByText("Tab = start")).toBeTruthy();
    expect(screen.getByText("Tab + Enter = restart")).toBeTruthy();
    expect(screen.getByText("Esc = finish")).toBeTruthy();
  });

  it("updates the hint bar when the primary input capability changes", async () => {
    const inputCapability = mockTouchFirstInput(false);
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    render(<PracticePage />);

    await waitFor(() => {
      expect(screen.queryByTestId("passage-loading-placeholder")).toBeNull();
    });
    expect(screen.getByText("Tab = start")).toBeTruthy();

    act(() => {
      inputCapability.setMatches(true);
    });

    expect(screen.getByText("Tap to start")).toBeTruthy();
    expect(screen.queryByText("Tab = start")).toBeNull();
  });

  it("switching Practice language resets the active session and loads that language only", async () => {
    mockTouchFirstInput(false);
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([
        makePassage("english", "English active", "English body text for typing.", "english"),
        makePassage("chinese", "忙碌生活中的休息", "今天，天氣很好。", "chinese", "生活", "一般")
      ])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("English body text for typing.");
    });

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "English");
    expect(screen.getByText("Tab = start")).toBeTruthy();
    expect(screen.queryByText("Tap to start")).toBeNull();

    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Chinese" }));

    await waitFor(() => {
      expect(container.textContent).toContain("今天，天氣很好。");
    });
    expect(container.textContent).not.toContain("English body text for typing.");
    expect(screen.getByText("Tab = start")).toBeTruthy();
    expect((screen.getByLabelText("Typing input") as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByRole("link", { name: "Library" }).getAttribute("href")).toBe("/passages?language=chinese");
    expect(mockedGetSupabasePassageLibrary).toHaveBeenCalledTimes(1);
  });

  it("uses the persistent Chinese textarea value for Practice punctuation and newlines", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([
        makePassage("english", "English active", "English body text for typing.", "english"),
        makePassage("chinese", "中文標點", "今天，天氣很好。\n明天再見！", "chinese", "生活", "一般")
      ])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    render(<PracticePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent).toContain("今天，天氣很好。");
    });

    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.compositionStart(input, { data: "" });
    fireEvent.input(input, { target: { value: "cw" }, nativeEvent: { isComposing: true, data: "cw" } });
    fireEvent.compositionUpdate(input, { data: "cw" });

    expect(screen.getByText("Timer running")).toBeTruthy();
    expect(screen.getByTestId("typing-character-layer").textContent).not.toContain("cw");

    fireEvent.compositionEnd(input, { data: "今天" });
    fireEvent.input(input, { target: { value: "今天，" }, nativeEvent: { isComposing: false, data: "今天，" } });

    await waitFor(() => {
      expect(screen.getByText("Timer running")).toBeTruthy();
    });
    expect(input.value).toBe("今天，");

    fireEvent.change(input, { target: { value: "今天，天氣很好。\n明天再見！" } });
    expect(input.value).toContain("\n");
  });

  it("maps Chinese Practice results to Chinese analytics with Chinese WPM", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([
        makePassage("english", "English active", "English body text for typing.", "english"),
        makePassage("chinese", "中文速度", "客戶測試", "chinese", "工作", "一般")
      ])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);
    authState.user = { id: "user-1" };

    render(<PracticePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent).toContain("客戶測試");
    });
    const input = await screen.findByLabelText("Typing input");

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.input(input, { target: { value: "客戶測試" }, nativeEvent: { isComposing: false, data: "客戶測試" } });
    expect(await screen.findByRole("dialog")).toBeTruthy();

    await waitFor(() => {
      expect(mockedSaveSupabaseTypingResult).toHaveBeenCalled();
    });
    const savedPayload = mockedSaveSupabaseTypingResult.mock.calls[0][0];
    expect(savedPayload.passage.language).toBe("chinese");
    expect(getResultAnalyticsDomain({ category: savedPayload.passage.category })).toBe("chinese");
    expect(savedPayload.result.wpm).toBeGreaterThanOrEqual(4);
  });

  it("opens the result immediately when an Infinite Chinese passage is completed", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([
        makePassage("english", "English active", "English body text for typing.", "english"),
        makePassage("chinese", "完整中文", "客戶測試", "chinese", "工作", "一般")
      ])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    render(<PracticePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent).toContain("客戶測試");
    });
    fireEvent.click(screen.getByRole("button", { name: "Infinite" }));
    await waitFor(() => {
      expect(screen.getByTestId("practice-passage-metadata").textContent).toContain("Infinite");
    });
    const targetText = screen.getByTestId("typing-character-layer").textContent ?? "";
    expect(targetText.length).toBeGreaterThan(0);

    const input = screen.getByLabelText("Typing input");
    fireEvent.keyDown(window, { key: "Tab" });
    await waitFor(() => {
      expect(screen.getByText("Timer running")).toBeTruthy();
    });
    fireEvent.compositionStart(input, { data: "" });
    fireEvent.input(input, {
      target: { value: "ke hu ce shi" },
      nativeEvent: { isComposing: true, data: "ke hu ce shi" }
    });
    fireEvent.compositionEnd(input, { data: targetText });
    fireEvent.input(input, {
      target: { value: targetText },
      nativeEvent: { isComposing: false, data: targetText }
    });

    const resultDialog = await screen.findByRole("dialog");
    expect(resultDialog.textContent).toContain("Session ended");
  });

  it("uses one bottom ad only on the Practice typing page", async () => {
    render(<PracticePage />);

    await waitFor(() => {
      expect(screen.getByText("Tab = start")).toBeTruthy();
    });

    expect(screen.getByTestId("app-shell").getAttribute("data-top-ad")).toBe("false");
    expect(screen.getByTestId("app-shell").getAttribute("data-side-ad")).toBe("false");
    expect(screen.queryByTestId("top-ad-slot")).toBeNull();
    expect(screen.queryByTestId("side-ad-slot")).toBeNull();
    expect(screen.getAllByText("Ad space")).toHaveLength(1);
    expect(screen.getByTestId("practice-ad-slot").textContent).toContain("Ad space");
    expect(
      screen.getByText("Esc = finish").compareDocumentPosition(screen.getByTestId("practice-ad-slot")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("keeps previous comparison data after restarting the same passage without a pre-test pace row", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    await finishTimedPractice("L");

    expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const justFinishedResult = readPreviousResult("local", 60);

    expect(justFinishedResult).toBeTruthy();
    expect(screen.queryByTestId("previous-pace-display")).toBeNull();
    expect(screen.queryByText(/Previous pace:/)).toBeNull();
    expect(screen.queryByText("WPM Over Time")).toBeNull();
    expect((screen.getByLabelText("Typing input") as HTMLTextAreaElement).value).toBe("");
  });

  it("keeps previous comparison data after starting the restarted same-passage attempt", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    await finishTimedPractice("Local fallback body text");

    expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const justFinishedResult = readPreviousResult("local", 60);

    expect(justFinishedResult).toBeTruthy();
    expect(screen.queryByTestId("previous-pace-display")).toBeNull();

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "L");

    expect(screen.queryByText(/Previous pace:/)).toBeNull();
  });

  it("keeps previous comparison data after a time-up finish and same-passage restart", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T12:00:00.000Z"));
    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_250);
    });

    expect(screen.getAllByText("Time up").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const justFinishedResult = readPreviousResult("local", 60);

    expect(justFinishedResult).toBeTruthy();
    expect(screen.queryByTestId("previous-pace-display")).toBeNull();

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "L");

    expect(screen.queryByText(/Previous pace:/)).toBeNull();
  }, 10_000);

  it("renders the previous pace marker as an overlay after a time-up same-passage restart", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T12:00:00.000Z"));
    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_250);
    });

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const justFinishedResult = readPreviousResult("local", 60);

    expect(justFinishedResult).toBeTruthy();
    expect(justFinishedResult?.previousPaceTimeline?.some((point) => point.timeSeconds === 10)).toBe(true);

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "L");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    const marker = screen.getByTestId("previous-pace-marker");
    const characterLayer = screen.getByTestId("typing-character-layer");

    expect(marker).toBeTruthy();
    expect(marker.getAttribute("data-character-index")).toBe(String("Local fallback body text".length));
    expect(marker.className).toContain("formaltype-previous-pace-marker");
    expect(marker.style.position).toBe("absolute");
    expect(marker.style.pointerEvents).toBe("none");
    expect(marker.style.transform).toContain("translate3d(");
    expect(marker.style.willChange).toBe("transform");
    expect(marker.style.transition).toBe("opacity 120ms ease");
    expect(characterLayer.contains(marker)).toBe(false);
    expect(marker.textContent).toBe("");
    expect(marker.style.height).toBe("0.95em");

    typeIncrementally(screen.getByLabelText("Typing input"), "L");

    expect(screen.getByTestId("previous-pace-marker")).toBeTruthy();
  }, 10_000);

  it("keeps character text unchanged when the previous pace marker is visible", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    const initialCharacterLayer = screen.getByTestId("typing-character-layer");
    const initialCharacterText = initialCharacterLayer.textContent;

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T12:00:00.000Z"));
    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_250);
    });

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "L");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getByTestId("previous-pace-marker")).toBeTruthy();
    expect(screen.getByTestId("typing-character-layer").textContent).toBe(initialCharacterText);
  }, 10_000);

  it("removes the previous pace marker overlay when switching passages", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([
        makePassage("local", "Local active", "Local fallback body text for typing."),
        makePassage("other", "Other active", "Other passage body text for typing.")
      ])
    );
    window.localStorage.setItem(PASSAGE_SELECTION_MODE_STORAGE_KEY, "specific");
    window.localStorage.setItem(ACTIVE_PASSAGE_ID_STORAGE_KEY, "local");
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T12:00:00.000Z"));
    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_250);
    });

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "L");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getByTestId("previous-pace-marker")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyUp(window, { key: "Tab" });
    vi.useRealTimers();

    fireEvent.click(screen.getByRole("button", { name: "Random" }));

    await waitFor(() => {
      expect(container.textContent).toContain("Other passage body text for typing");
    });
    expect(screen.queryByTestId("previous-pace-marker")).toBeNull();
  }, 10_000);

  it("preserves 5-minute previous comparison data after restarting the same passage", async () => {
    const fiveMinutePassage = makePassage(
      "local",
      "Local active",
      "Local fallback body text for five minute typing."
    );
    // This test covers result scoping, while timed-passage expansion is covered in app-storage.test.ts.
    // Mark the fixture as already long enough so concurrent DOM tests do not render thousands of unrelated spans.
    fiveMinutePassage.wordCount = 1_100;
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([fiveMinutePassage])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for five minute typing");
    });

    fireEvent.click(screen.getByRole("button", { name: "5m" }));

    await finishTimedPractice("L", 300);

    expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const justFinishedResult = readPreviousResult("local", 300);

    expect(justFinishedResult).toBeTruthy();
    expect(readPreviousResult("local", 60)).toBeNull();
    expect(screen.queryByTestId("previous-pace-display")).toBeNull();
    expect(screen.queryByText(/Previous pace:/)).toBeNull();
    expect(screen.queryByText("WPM Over Time")).toBeNull();
    expect((screen.getByLabelText("Typing input") as HTMLTextAreaElement).value).toBe("");
  });

  it("keeps previous comparison after closing the result modal and restarting", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    await finishTimedPractice("Local fallback body text");

    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();

    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Restart" })));
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    const justFinishedResult = readPreviousResult("local", 60);

    expect(justFinishedResult).toBeTruthy();
    expect(screen.queryByTestId("previous-pace-display")).toBeNull();
    expect(screen.queryByText(/Previous pace:/)).toBeNull();
    const restartedCaret = screen.getByTestId("typing-character-layer").querySelector('[data-typing-caret-indicator="true"]');
    expect(restartedCaret).toBeTruthy();
    expect(restartedCaret?.parentElement?.getAttribute("data-index")).toBe("0");
  });

  it("shows the restarted same-passage attempt as the previous comparison in the next result modal", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    await finishTimedPractice("Local fallback body text");

    expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const firstResult = readPreviousResult("local", 60);

    expect(firstResult).toBeTruthy();
    expect(screen.queryByTestId("previous-pace-display")).toBeNull();

    vi.useRealTimers();
    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByText("Previous Attempt")).toBeTruthy();
      expect(screen.getAllByText(`previous ${firstResult?.wpm.toFixed(1)}`).length).toBeGreaterThan(0);
    });
  });

  it("changes the previous comparison data when selecting a different passage", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([
        makePassage("local", "Local active", "Local fallback body text for typing."),
        makePassage("other", "Other active", "Other passage body text for typing.")
      ])
    );
    window.localStorage.setItem(PASSAGE_SELECTION_MODE_STORAGE_KEY, "specific");
    window.localStorage.setItem(ACTIVE_PASSAGE_ID_STORAGE_KEY, "local");
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    await finishTimedPractice("Local fallback body text");

    expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const localResult = readPreviousResult("local", 60);

    expect(localResult).toBeTruthy();
    expect(screen.queryByTestId("previous-pace-display")).toBeNull();

    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "Random" }));

    await waitFor(() => {
      expect(container.textContent).toContain("Other passage body text for typing");
    });
    expect(screen.queryByText(/Previous pace:/)).toBeNull();
  });

  it("prevents pasted text without showing a paste warning", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    fireEvent.keyDown(window, { key: "Tab" });
    const input = screen.getByLabelText("Typing input");
    const pasteEvent = fireEvent.paste(input);

    expect(pasteEvent).toBe(false);
    expect(screen.queryByText("Pasting is disabled for fair results.")).toBeNull();
    expect((input as HTMLTextAreaElement).value).toBe("");
  });

  it("applies saved typing appearance only to the practice text container", async () => {
    window.localStorage.setItem(
      "formaltype.theme.v1",
      JSON.stringify({
        mode: "dark",
        accentColor: "amber",
        appFont: "serif",
        typingFont: "serif",
        typingTextSize: "large",
        typingWidth: "compact",
        caretStyle: "underline",
        caretBlink: "off",
        typingColorStyle: "high-contrast"
      })
    );
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    const typingTextContainer = screen.getByTestId("typing-text-container");
    const characterLayer = screen.getByTestId("typing-character-layer");

    expect(typingTextContainer.className).toContain("formaltype-typing-width-compact");
    expect(container.querySelector(".formaltype-typing-surface")).toBeNull();
    expect(container.querySelector('[data-testid="practice-visual-progress"]')).toBeNull();
    expect(characterLayer.className).toContain("formaltype-typing-font-serif");
    expect(characterLayer.className).toContain("formaltype-typing-size-large");
    expect(characterLayer.className).toContain("formaltype-typing-colors-high-contrast");
    const currentCharacter = characterLayer.querySelector('[data-index="0"]');
    expect(currentCharacter?.className).toContain("formaltype-caret-underline");
    expect(currentCharacter?.className).toContain("formaltype-caret-static");
    expect(currentCharacter?.className).not.toContain("px-0.5");
    expect(currentCharacter?.className).not.toContain("rounded-sm");
    expect(container.querySelector(".formaltype-typing-font-serif")?.getAttribute("data-testid")).toBe(
      "typing-character-layer"
    );
  });

  it("marks the visible Practice caret across English spaces, line breaks, and Chinese text", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([
        makePassage("english", "English caret", "A B\nC", "english"),
        makePassage("chinese", "中文游標", "今天再見", "chinese", "生活", "一般")
      ])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    render(<PracticePage />);
    await waitFor(() => expect(screen.getByTestId("typing-character-layer").textContent).toContain("A BC"));

    const englishInput = screen.getByLabelText("Typing input");
    expect(screen.getByTestId("typing-character-layer").querySelector('[data-typing-caret="true"]')?.getAttribute("data-index")).toBe("0");
    expect(screen.getByTestId("typing-character-layer").querySelectorAll('[data-typing-caret-indicator="true"]')).toHaveLength(1);
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.change(englishInput, { target: { value: "A" } });
    expect(screen.getByTestId("typing-character-layer").querySelector('[data-typing-caret="true"]')?.getAttribute("data-index")).toBe("1");
    fireEvent.change(englishInput, { target: { value: "A B" } });
    expect(screen.getByTestId("typing-character-layer").querySelector('[data-typing-caret="true"]')?.getAttribute("data-index")).toBe("3");

    fireEvent.click(screen.getByRole("button", { name: "Chinese" }));
    await waitFor(() => expect(screen.getByTestId("typing-character-layer").textContent).toContain("今天再見"));
    expect(screen.getByTestId("typing-character-layer").querySelector('[data-typing-caret="true"]')?.getAttribute("data-index")).toBe("0");
  });

  it("shows passage metadata only once in the idle practice chrome", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    expect(screen.getAllByText("Local active · Business email · Formal · 1m")).toHaveLength(1);
  });

  it("keeps wrong-character styling dimension-stable", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.change(screen.getByLabelText("Typing input"), { target: { value: "x" } });

    const wrongCharacter = screen.getByTestId("typing-character-layer").querySelector('[data-index="0"]');
    expect(wrongCharacter?.className).toContain("formaltype-typed-wrong");
    expect(wrongCharacter?.className).not.toContain("px-");
    expect(wrongCharacter?.className).not.toContain("underline");
    expect(wrongCharacter?.className).not.toContain("border");
  });

  it("shows finger and classification metadata in the session review for mistakes", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Aocal fallback body text");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByText("Session review")).toBeTruthy();
    });

    expect(screen.getByText("Expected finger")).toBeTruthy();
    expect(screen.getByText("Typed finger")).toBeTruthy();
    expect(screen.getByText("Classification")).toBeTruthy();
    expect(screen.getByText("Right Ring")).toBeTruthy();
    expect(screen.getAllByText("Left Pinky").length).toBeGreaterThan(0);
    expect(screen.getByText("Wrong hand")).toBeTruthy();
    const errorMarker = screen.getByRole("img", { name: "WPM over time" }).querySelector('[data-testid="attempt-error-marker"]');
    expect(errorMarker).toBeTruthy();
    expect(errorMarker?.querySelector("line")?.getAttribute("stroke")).toBe("rgb(var(--chart-danger))");
  });

  it("keeps a corrected typo visible as an X on the result graph", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    const input = screen.getByLabelText("Typing input");
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.change(input, { target: { value: "X" } });
    fireEvent.change(input, { target: { value: "Xo" } });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "X" } });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "L" } });
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByText("Errors encountered")).toBeTruthy();
    });
    const chart = screen.getByRole("img", { name: "WPM over time" });
    const marker = chart.querySelector('[data-testid="attempt-error-marker"]');
    expect(marker).toBeTruthy();
    expect(marker?.getAttribute("data-error-count")).toBe("2");
    expect(marker?.querySelector("line")?.getAttribute("stroke")).toBe("rgb(var(--chart-danger))");
    expect(screen.getByText("Errors encountered").parentElement?.textContent).toContain("2");
    expect(screen.queryByText("Corrected errors")).toBeNull();
  });

  it("plays keyboard sound only for valid typing changes during a running session", async () => {
    window.localStorage.setItem("formaltype.keyboard_sound.v1", "mechanical");
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    const audioMock = installAudioContextMock();
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    const input = screen.getByLabelText("Typing input");

    fireEvent.keyDown(input, { key: "a" });
    fireEvent.change(input, { target: { value: "a" } });
    expect(audioMock.oscillators).toHaveLength(0);

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.keyDown(input, { key: "Shift", shiftKey: true });
    expect(audioMock.oscillators).toHaveLength(0);

    fireEvent.keyDown(input, { key: "a" });
    fireEvent.change(input, { target: { value: "a" } });
    expect(audioMock.oscillators).toHaveLength(1);

    fireEvent.keyDown(input, { key: "Meta", metaKey: true });
    fireEvent.keyDown(input, { key: "v", metaKey: true });
    fireEvent.paste(input);
    expect(audioMock.oscillators).toHaveLength(1);
  });

  it("uses the saved keyboard sound volume during practice playback", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    window.localStorage.setItem("formaltype.keyboard_sound.v1", "mechanical");
    window.localStorage.setItem("formaltype.keyboard_sound_volume.v1", "0.25");
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    const audioMock = installAudioContextMock();
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    const input = screen.getByLabelText("Typing input");
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.keyDown(input, { key: "a" });
    fireEvent.change(input, { target: { value: "a" } });

    expect(audioMock.gains[0].gain.setValueAtTime.mock.calls[0][0]).toBeCloseTo(0.00528);
    expect(audioMock.gains[0].gain.setValueAtTime.mock.calls[0][1]).toBe(1);
    randomSpy.mockRestore();
  });

  it.each(SOUND_PACKS)("respects saved %s keyboard sound during practice playback", async (soundPack) => {
    window.localStorage.setItem("formaltype.keyboard_sound.v1", soundPack);
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    const audioMock = installAudioContextMock();
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    const input = screen.getByLabelText("Typing input");
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.keyDown(input, { key: "a" });
    fireEvent.change(input, { target: { value: "a" } });

    expect(audioMock.oscillators).toHaveLength(1);
  });

  it("falls back safely when the saved keyboard sound is unknown", async () => {
    window.localStorage.setItem("formaltype.keyboard_sound.v1", "mystery-pack");
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    const audioMock = installAudioContextMock();
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    const input = screen.getByLabelText("Typing input");
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.keyDown(input, { key: "a" });
    fireEvent.change(input, { target: { value: "a" } });

    expect(audioMock.oscillators).toHaveLength(0);
  });

  it("does not render sound settings and respects a saved off sound setting", async () => {
    window.localStorage.setItem("formaltype.keyboard_sound.v1", "off");
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    const audioMock = installAudioContextMock();
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    expect(screen.queryByLabelText("Keyboard sound")).toBeNull();

    const input = screen.getByLabelText("Typing input");
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.keyDown(input, { key: "a" });
    fireEvent.change(input, { target: { value: "a" } });

    expect(audioMock.oscillators).toHaveLength(0);
  });

  it("stores private attempt details for typing statistics when a user completes an attempt", async () => {
    authState.user = { id: "user-1" };
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    await finishTimedPractice("Local fallback body text");

    expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();

    const details = readTypingAttemptDetails("user-1");
    expect(details).toHaveLength(1);
    expect(details[0].userId).toBe("user-1");
    expect(details[0].characters.some((character) => character.expected === "L" && character.actual === "L")).toBe(true);
  });

  it("keeps the result visible and announces a cloud save failure", async () => {
    authState.user = { id: "user-1" };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockedSaveSupabaseTypingResult.mockRejectedValueOnce(new Error("offline"));
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);
    await waitFor(() => expect(container.textContent).toContain("Local fallback body text for typing"));

    await finishTimedPractice("L");
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole("alert").textContent).toContain("Cloud save failed");
    expect(screen.getByText("This Result")).toBeTruthy();
    expect(warnSpy).toHaveBeenCalledWith("Supabase typing result save failed", expect.any(Error));
    warnSpy.mockRestore();
  });

  it("does not let an older save response overwrite a restarted session", async () => {
    authState.user = { id: "user-1" };
    let resolveFirstSave: (value: any) => void = () => {};
    let resolveSecondSave: (value: any) => void = () => {};
    mockedSaveSupabaseTypingResult
      .mockReturnValueOnce(new Promise<any>((resolve) => { resolveFirstSave = resolve; }))
      .mockReturnValueOnce(new Promise<any>((resolve) => { resolveSecondSave = resolve; }));
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);
    await waitFor(() => expect(container.textContent).toContain("Local fallback body text for typing"));

    await finishTimedPractice("L");
    expect(screen.getByText("Saving result…")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    await finishTimedPractice("L");
    expect(screen.getByText("Saving result…")).toBeTruthy();

    await act(async () => {
      resolveFirstSave({ id: "first-result", created_at: "2026-07-14T01:00:00.000Z" });
      await Promise.resolve();
    });

    expect(screen.getByText("Saving result…")).toBeTruthy();
    expect(screen.queryByText("Result saved to your account.")).toBeNull();

    await act(async () => {
      resolveSecondSave({ id: "second-result", created_at: "2026-07-14T01:01:00.000Z" });
      await Promise.resolve();
    });
    expect(screen.getByText("Result saved to your account.")).toBeTruthy();
  });

  it("flags suspicious bursts and does not save or update previous pace", async () => {
    authState.user = { id: "user-1" };
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.change(screen.getByLabelText("Typing input"), {
      target: { value: "Local " }
    });
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByText("This result was not saved because suspicious input was detected.")).toBeTruthy();
    });

    expect(mockedSaveSupabaseTypingResult).not.toHaveBeenCalled();
    expect(readPreviousResult("local", 60)).toBeNull();
  });

  it("scopes Training history stats to the same comparable content and duration", () => {
    const comparable = filterComparableRecentResults(
      [
        makeRecentResult("code-60", "Training Code", 60, 52, "training_code"),
        makeRecentResult("code-30", "Training Code", 30, 60, "training_code"),
        makeRecentResult("words-60", "Training Words", 60, 44, "training_words"),
        makeRecentResult("chinese-60", "Training Chinese", 60, 88, "training_chinese"),
        makeRecentResult("chinese-title-collision", "Training Code", 60, 88, "training_chinese"),
        makeRecentResult("chinese-100", "Training Chinese", 100, 92, "training_chinese"),
        makeRecentResult("practice-60", "Local active", 60, 70, "Business email")
      ],
      {
        id: "training-code",
        title: "Training Code",
        category: "training_code",
        style: "60s",
        source: "generated",
        text: "const total = price * quantity;",
        updatedAt: "2026-07-04T00:00:00.000Z"
      },
      { durationSeconds: 60 }
    );

    expect(comparable.map((result) => result.id)).toEqual(["code-60"]);
  });
});

function makePassage(
  id: string,
  title: string,
  content: string,
  language: LibraryPassage["language"] = "english",
  category: LibraryPassage["category"] = "Business email",
  style = "Formal"
): LibraryPassage {
  return {
    id,
    title,
    category,
    style,
    language,
    content,
    source: "uploaded",
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z",
    wordCount: content.split(/\s+/).filter(Boolean).length,
    characterCount: content.length,
    isActive: true
  };
}

function makeChineseQuoteTrainingMode(text: string): PracticeTrainingMode {
  return {
    pageTitle: "Training",
    passageId: "training-chinese-quotes",
    configKey: `training-chinese-quotes-${text}`,
    session: { kind: "time", seconds: 60 },
    buildPassage: () => ({
      id: "training-chinese-quotes",
      title: "Chinese quotation diagnostic",
      category: "training_chinese",
      style: "60s",
      source: "generated",
      text,
      comparableText: text,
      displayTokens: [text],
      metricUnit: "wpm",
      updatedAt: "2026-07-22T00:00:00.000Z"
    }),
    hidePassageControls: true,
    hidePracticeModeControls: true,
    hideMetadata: true
  };
}

function typeIncrementally(input: HTMLElement, value: string) {
  let currentValue = "";

  for (const character of value) {
    currentValue += character;
    fireEvent.change(input, {
      target: { value: currentValue }
    });
  }
}

async function finishTimedPractice(value: string, durationSeconds = 60) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-07T12:00:00.000Z"));
  fireEvent.keyDown(window, { key: "Tab" });
  typeIncrementally(screen.getByLabelText("Typing input"), value);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(durationSeconds * 1_000 + 250);
  });
}

function makeRecentResult(id: string, passage_title: string, duration_seconds: number, wpm: number, passage_category = "Business email") {
  return {
    id,
    passage_title,
    passage_category,
    duration_seconds,
    wpm,
    accuracy: 99,
    created_at: "2026-07-04T00:00:00.000Z"
  };
}

function installAudioContextMock() {
  const oscillators: Array<{ frequency: { value: number }; type: OscillatorType; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
  const gains: Array<{ gain: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> } }> = [];

  class AudioContextMock {
    currentTime = 1;
    destination = {};
    state = "running";
    resume = vi.fn().mockResolvedValue(undefined);
    createOscillator = vi.fn(() => {
      const oscillator = {
        frequency: { value: 0 },
        type: "square" as OscillatorType,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      };
      oscillators.push(oscillator);
      return oscillator;
    });
    createGain = vi.fn(() => {
      const gain = {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn()
        },
        connect: vi.fn()
      };
      gains.push(gain);
      return gain;
    });
  }

  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    writable: true,
    value: AudioContextMock
  });

  return { oscillators, gains };
}
