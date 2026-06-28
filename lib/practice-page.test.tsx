/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PracticePage from "../pages/practice";
import type { LibraryPassage } from "@/lib/app-storage";
import {
  ACTIVE_PASSAGE_ID_STORAGE_KEY,
  PASSAGE_LIBRARY_STORAGE_KEY,
  PASSAGE_SELECTION_MODE_STORAGE_KEY,
  readPreviousResult
} from "@/lib/app-storage";
import { getSupabasePassageLibrary } from "@/lib/passageStorage";
import { saveSupabaseTypingResult } from "@/lib/typingResultStorage";

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>
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
    getSupabaseOwnTypingResults: vi.fn().mockResolvedValue([]),
    saveSupabaseTypingResult: vi.fn().mockResolvedValue({
      id: "saved-result",
      created_at: "2026-06-19T00:00:00.000Z"
    })
  };
});

const mockedSaveSupabaseTypingResult = vi.mocked(saveSupabaseTypingResult);
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

describe("PracticePage passage loading", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    authState.user = null;
    mockedGetSupabasePassageLibrary.mockReset();
    mockedSaveSupabaseTypingResult.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
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
    expect(screen.getByRole("button", { name: "Random passage" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Choose in Passages" }).getAttribute("href")).toBe("/passages");
    expect(screen.getByRole("button", { name: "1m" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "5m" })).toBeTruthy();
    expect(screen.queryByLabelText("Category")).toBeNull();
    expect(screen.queryByLabelText("Passage")).toBeNull();
  });

  it("shows the just-finished previous pace after restarting the same passage", async () => {
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
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const justFinishedResult = readPreviousResult("local", 60);

    await waitFor(() => {
      expect(justFinishedResult).toBeTruthy();
      expect(screen.getByText(`Previous pace: ${justFinishedResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();
    });
    expect(screen.queryByText("WPM Over Time")).toBeNull();
    expect((screen.getByLabelText("Typing input") as HTMLTextAreaElement).value).toBe("");
  });

  it("keeps previous pace visible after starting the restarted same-passage attempt", async () => {
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
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const justFinishedResult = readPreviousResult("local", 60);

    await waitFor(() => {
      expect(screen.getByText(`Previous pace: ${justFinishedResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();
    });

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "L");

    expect(screen.getByText(`Previous pace: ${justFinishedResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();
  });

  it("shows previous pace after a time-up finish and same-passage restart", async () => {
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
    expect(screen.getByText(`Previous pace: ${justFinishedResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "L");

    expect(screen.getByText(`Previous pace: ${justFinishedResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();
  });

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
  });

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

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getByTestId("previous-pace-marker")).toBeTruthy();
    expect(screen.getByTestId("typing-character-layer").textContent).toBe(initialCharacterText);
  });

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

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getByTestId("previous-pace-marker")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyUp(window, { key: "Tab" });
    vi.useRealTimers();

    fireEvent.click(screen.getByRole("button", { name: "Random passage" }));

    await waitFor(() => {
      expect(container.textContent).toContain("Other passage body text for typing");
    });
    expect(screen.queryByTestId("previous-pace-marker")).toBeNull();
  });

  it("preserves 5-minute previous pace after restarting the same passage", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for five minute typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for five minute typing");
    });

    fireEvent.click(screen.getByRole("button", { name: "5m" }));

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for five minute typing");
    });

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const justFinishedResult = readPreviousResult("local", 300);

    await waitFor(() => {
      expect(justFinishedResult).toBeTruthy();
      expect(screen.getByText(`Previous pace: ${justFinishedResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();
    });
    expect(readPreviousResult("local", 60)).toBeNull();
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

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    const justFinishedResult = readPreviousResult("local", 60);

    await waitFor(() => {
      expect(justFinishedResult).toBeTruthy();
      expect(screen.getByText(`Previous pace: ${justFinishedResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();
    });
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

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const firstResult = readPreviousResult("local", 60);

    await waitFor(() => {
      expect(firstResult).toBeTruthy();
      expect(screen.getByText(`Previous pace: ${firstResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();
    });

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByText("Previous Attempt")).toBeTruthy();
      expect(screen.getAllByText(`previous ${firstResult?.wpm.toFixed(1)}`).length).toBeGreaterThan(0);
    });
  });

  it("changes the previous pace comparison when selecting a different passage", async () => {
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

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const localResult = readPreviousResult("local", 60);

    await waitFor(() => {
      expect(screen.getByText(`Previous pace: ${localResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Random passage" }));

    await waitFor(() => {
      expect(container.textContent).toContain("Other passage body text for typing");
    });
    expect(screen.queryByText(`Previous pace: ${localResult?.wpm.toFixed(1)} WPM`)).toBeNull();
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
        typingFont: "ibm-plex-mono",
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
    expect(characterLayer.className).toContain("formaltype-typing-font-ibm-plex-mono");
    expect(characterLayer.className).toContain("formaltype-typing-size-large");
    expect(characterLayer.className).toContain("formaltype-typing-colors-high-contrast");
    const currentCharacter = characterLayer.querySelector('[data-index="0"]');
    expect(currentCharacter?.className).toContain("formaltype-caret-underline");
    expect(currentCharacter?.className).toContain("formaltype-caret-static");
    expect(currentCharacter?.className).not.toContain("px-0.5");
    expect(currentCharacter?.className).not.toContain("rounded-sm");
    expect(container.querySelector(".formaltype-typing-font-ibm-plex-mono")?.getAttribute("data-testid")).toBe(
      "typing-character-layer"
    );
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
});

function makePassage(id: string, title: string, content: string): LibraryPassage {
  return {
    id,
    title,
    category: "Business email",
    style: "Formal",
    content,
    source: "uploaded",
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z",
    wordCount: content.split(/\s+/).filter(Boolean).length,
    characterCount: content.length,
    isActive: true
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
