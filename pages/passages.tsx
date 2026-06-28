"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Check, FileText } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  ALL_FILTER,
  CATEGORIES,
  CategoryFilter,
  LibraryPassage,
  PassageSelectionMode,
  STYLES,
  StyleFilter,
  filterLibraryPassages,
  selectRandomLibraryPassage,
  toStoredPassage,
  writeStoredPassage
} from "@/lib/app-storage";
import {
  getActivePassageId,
  getPassageLibrary,
  getPassageSelectionMode,
  getSelectedCategory,
  getSelectedStyle,
  getSupabasePassageLibrary,
  setPassageSelectionMode,
  setSelectedCategory,
  setSelectedStyle,
  setActivePassageId as setStoredActivePassageId
} from "@/lib/passageStorage";

export default function PassagesPage() {
  const router = useRouter();
  const [library, setLibrary] = useState<LibraryPassage[]>([]);
  const [activePassageId, setActivePassageId] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryFilter>(ALL_FILTER);
  const [style, setStyle] = useState<StyleFilter>(ALL_FILTER);
  const [message, setMessage] = useState("");
  const [selectionMode, setSelectionMode] = useState<PassageSelectionMode>("specific");
  const [hasLoadedLibrary, setHasLoadedLibrary] = useState(false);

  const activeLibrary = useMemo(() => library.filter((passage) => passage.isActive), [library]);
  const activePassage = useMemo(
    () => activeLibrary.find((passage) => passage.id === activePassageId) ?? null,
    [activeLibrary, activePassageId]
  );
  const filteredLibrary = useMemo(() => filterLibraryPassages(activeLibrary, category, style), [activeLibrary, category, style]);
  const articleSelectorValue =
    selectionMode === "random" || !filteredLibrary.some((passage) => passage.id === activePassageId)
      ? "random"
      : activePassageId ?? "random";

  useEffect(() => {
    refreshLibrary();
  }, []);

  async function refreshLibrary() {
    try {
      setLibrary(await getSupabasePassageLibrary());
    } catch {
      setLibrary(getPassageLibrary());
    }

    setActivePassageId(getActivePassageId());
    setSelectionMode(getPassageSelectionMode());
    setCategory(getSelectedCategory());
    setStyle(getSelectedStyle());
    setHasLoadedLibrary(true);
  }

  function selectPracticePassage(passage: LibraryPassage, sourceLibrary = filteredLibrary.length > 0 ? filteredLibrary : activeLibrary) {
    setPassageSelectionMode("specific");
    setStoredActivePassageId(passage.id);
    writeStoredPassage(toStoredPassage(passage, 60, sourceLibrary));
    setActivePassageId(passage.id);
    setSelectionMode("specific");
    setMessage(`"${passage.title}" is selected for practice.`);
  }

  function setRandomPassageMode() {
    setPassageSelectionMode("random");
    setSelectionMode("random");

    if (filteredLibrary.length === 0) {
      setMessage(
        activeLibrary.length === 0
          ? "No passages are available yet."
          : "No passages match this category/style. Please choose All or another filter."
      );
      return;
    }

    const randomPassage = selectRandomLibraryPassage(activePassageId ?? undefined, filteredLibrary) ?? filteredLibrary[0];
    setStoredActivePassageId(randomPassage.id);
    writeStoredPassage(toStoredPassage(randomPassage, 60, filteredLibrary));
    setActivePassageId(randomPassage.id);
    setMessage("Random passage mode is selected for practice.");
  }

  function handleArticleSelection(value: string) {
    if (value === "random") {
      setRandomPassageMode();
      return;
    }

    if (value === "__none") {
      return;
    }

    const selectedPassage = filteredLibrary.find((passage) => passage.id === value);
    if (selectedPassage) {
      selectPracticePassage(selectedPassage);
    }
  }

  function startPractice(passage: LibraryPassage) {
    selectPracticePassage(passage);
    router.push("/practice");
  }

  function updateCategory(value: string) {
    const nextCategory = value as CategoryFilter;
    setCategory(nextCategory);
    setSelectedCategory(nextCategory);
  }

  function updateStyle(value: string) {
    setStyle(value);
    setSelectedStyle(value);
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase text-brass">Passages</p>
        <h1 className="mt-2 text-3xl font-semibold text-paper md:text-4xl">Passage library</h1>

        {message && (
          <div className="mt-5 rounded-md border border-brass/25 bg-brass/10 px-4 py-3 font-mono text-sm text-brass">
            {message}
          </div>
        )}

        <div className="mt-8 grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
          <aside className="space-y-5 lg:sticky lg:top-5" data-testid="passages-setup-panel">
            <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow backdrop-blur">
              <h2 className="font-mono text-sm uppercase text-paper/65">Setup</h2>
              <div className="mt-4 space-y-5">
                <ChoiceGroup
                  label="Category"
                  value={category}
                  onChange={updateCategory}
                  options={[ALL_FILTER, ...CATEGORIES].map((option) => ({ value: option, label: option }))}
                />
                <ChoiceGroup
                  label="Style"
                  value={style}
                  onChange={updateStyle}
                  options={[ALL_FILTER, ...STYLES].map((option) => ({ value: option, label: option }))}
                />
                <PassageChoiceList
                  label="Article / Passage"
                  value={articleSelectorValue}
                  onChange={handleArticleSelection}
                  options={[
                    ["random", "Random passage"],
                    ...(filteredLibrary.length > 0
                      ? filteredLibrary.map((passage) => [passage.id, passage.title] as [string, string])
                      : [{ value: "__none", label: "No passages found", disabled: true }])
                  ]}
                />
              </div>
            </section>
          </aside>

          <div className="space-y-5">
            <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-paper">Available passages</h2>
                  <p className="mt-1 font-mono text-sm text-paper/45">
                    {filteredLibrary.length} shown / {activeLibrary.length} available · Selected: {activePassage?.title ?? "none"}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {!hasLoadedLibrary && (
                  <div className="rounded-md border border-dashed border-paper/10 bg-ink-900/60 p-6 text-center font-mono text-sm text-paper/45">
                    Loading passages...
                  </div>
                )}

                {hasLoadedLibrary && library.length === 0 && (
                  <div className="rounded-md border border-dashed border-paper/10 bg-ink-900/60 p-6 text-center font-mono text-sm text-paper/45">
                    No passages are available yet.
                  </div>
                )}

                {hasLoadedLibrary && library.length > 0 && filteredLibrary.length === 0 && (
                  <div className="rounded-md border border-dashed border-paper/10 bg-ink-900/60 p-6 text-center font-mono text-sm text-paper/45">
                    No passages match this category/style. Please choose All or another filter.
                  </div>
                )}

                {filteredLibrary.map((passage) => (
                  <article
                    key={passage.id}
                    className="rounded-md border border-paper/10 bg-ink-900 p-4 transition hover:border-brass/35"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <FileText className="h-4 w-4 text-brass" />
                          <h3 className="font-semibold text-paper">{passage.title}</h3>
                          {passage.id === activePassageId && (
                            <span className="rounded-sm border border-mint/30 bg-mint/10 px-2 py-0.5 font-mono text-[0.68rem] uppercase text-mint">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="mt-2 font-mono text-xs text-paper/45">
                          {passage.category} · {passage.style} · {passage.source} · {passage.wordCount} words ·{" "}
                          {passage.characterCount} chars
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startPractice(passage)}
                          className="inline-flex items-center gap-2 rounded-md border border-brass/35 bg-brass/10 px-3 py-2 font-mono text-xs text-brass transition hover:bg-brass/15"
                        >
                          <Check className="h-4 w-4" />
                          Practice this passage
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-paper/55">{passage.content}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function ChoiceGroup({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}) {
  return (
    <fieldset>
      <legend className="font-mono text-xs uppercase text-paper/45">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              aria-label={`${option.label} ${label.toLowerCase()}`}
              aria-pressed={isSelected}
              disabled={option.disabled}
              onClick={() => onChange(option.value)}
              className={`rounded-full border px-3 py-1.5 font-mono text-[0.72rem] transition disabled:cursor-not-allowed disabled:opacity-45 ${
                isSelected
                  ? "border-brass/70 bg-brass/15 text-brass"
                  : "border-paper/10 bg-paper/[0.035] text-paper/55 hover:border-brass/35 hover:bg-paper/[0.055] hover:text-paper/80"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function PassageChoiceList({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string] | { value: string; label: string; disabled?: boolean }>;
}) {
  return (
    <fieldset>
      <legend className="font-mono text-xs uppercase text-paper/45">{label}</legend>
      <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
        {options.map((option) => {
          const optionValue = Array.isArray(option) ? option[0] : option.value;
          const optionLabel = Array.isArray(option) ? option[1] : option.label;
          const disabled = !Array.isArray(option) ? option.disabled : false;
          const isSelected = optionValue === value;

          return (
            <button
              key={optionValue}
              type="button"
              aria-label={optionValue === "random" ? optionLabel : `Select ${optionLabel}`}
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onChange(optionValue)}
              className={`block w-full rounded-md border px-3 py-2 text-left font-mono text-xs transition disabled:cursor-not-allowed disabled:opacity-45 ${
                isSelected
                  ? "border-brass/70 bg-brass/15 text-brass"
                  : "border-paper/10 bg-paper/[0.035] text-paper/65 hover:border-brass/35 hover:bg-paper/[0.055] hover:text-paper/85"
              }`}
            >
              {optionLabel}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
