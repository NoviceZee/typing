"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, FileText, Sparkles, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PracticeCategory, buildPracticePassage } from "@/lib/typing-engine";
import {
  ALL_FILTER,
  CATEGORIES,
  CategoryFilter,
  LibraryPassage,
  PassageSelectionMode,
  STYLES,
  StyleFilter,
  addPassagesToLibrary,
  clearPassageLibrary,
  createPassageLibraryExport,
  createLibraryPassage,
  deleteLibraryPassage,
  extractPassageTitle,
  filterLibraryPassages,
  importPassageLibraryExport,
  readActivePassageId,
  readPassageLibrary,
  readPassageSelectionMode,
  readSelectedCategory,
  readSelectedStyle,
  selectRandomLibraryPassage,
  splitPastedPassages,
  splitTextIntoPassages,
  toStoredPassage,
  writeActivePassageId,
  writePassageSelectionMode,
  writeSelectedCategory,
  writeSelectedStyle,
  writeStoredPassage
} from "@/lib/app-storage";

type UploadPreview = {
  count: number;
  titles: string[];
  totalWordCount: number;
};

type SelectOption = string | [string, string] | { value: string; label: string; disabled?: boolean };

export default function PassagesPage() {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [library, setLibrary] = useState<LibraryPassage[]>([]);
  const [activePassageId, setActivePassageId] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryFilter>(ALL_FILTER);
  const [style, setStyle] = useState<StyleFilter>(ALL_FILTER);
  const [durationSeconds, setDurationSeconds] = useState(300);
  const [pasteTitle, setPasteTitle] = useState("Pasted passage");
  const [pasteText, setPasteText] = useState("");
  const [message, setMessage] = useState("");
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(null);
  const [selectionMode, setSelectionMode] = useState<PassageSelectionMode>("specific");
  const [replaceExistingLibrary, setReplaceExistingLibrary] = useState(false);

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

  function refreshLibrary() {
    setLibrary(readPassageLibrary());
    setActivePassageId(readActivePassageId());
    setSelectionMode(readPassageSelectionMode());
    setCategory(readSelectedCategory());
    setStyle(readSelectedStyle());
  }

  function savePassages(passages: LibraryPassage[], successMessage: string) {
    if (passages.length === 0) {
      setMessage("No passage text found.");
      return;
    }

    addPassagesToLibrary(passages);
    const nextLibrary = readPassageLibrary();
    const firstPassage = passages[0];
    setActivePassage(firstPassage, nextLibrary);
    setLibrary(nextLibrary);
    setMessage(successMessage);
  }

  function setActivePassage(passage: LibraryPassage, sourceLibrary = filteredLibrary.length > 0 ? filteredLibrary : library) {
    writePassageSelectionMode("specific");
    writeActivePassageId(passage.id);
    writeStoredPassage(toStoredPassage(passage, durationSeconds, sourceLibrary));
    setActivePassageId(passage.id);
    setSelectionMode("specific");
    setMessage(`Active passage set to "${passage.title}".`);
  }

  function setRandomPassageMode() {
    writePassageSelectionMode("random");
    setSelectionMode("random");

    if (filteredLibrary.length === 0) {
      setMessage(
        library.length === 0
        ? "Random passage mode enabled. Add active passages to use it in Practice."
          : "No passages match this category/style. Please choose All or upload more passages."
      );
      return;
    }

    const randomPassage = selectRandomLibraryPassage(activePassageId ?? undefined, filteredLibrary) ?? filteredLibrary[0];
    writeActivePassageId(randomPassage.id);
    writeStoredPassage(toStoredPassage(randomPassage, durationSeconds, filteredLibrary));
    setActivePassageId(randomPassage.id);
    setMessage("Random passage mode enabled.");
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
      setActivePassage(selectedPassage);
    }
  }

  function updateCategory(value: string) {
    const nextCategory = value as CategoryFilter;
    setCategory(nextCategory);
    writeSelectedCategory(nextCategory);
  }

  function updateStyle(value: string) {
    setStyle(value);
    writeSelectedStyle(value);
  }

  function getCategoryForNewPassages(): PracticeCategory {
    return category === ALL_FILTER ? "Uncategorised" : category;
  }

  function getStyleForNewPassages(): string {
    return style === ALL_FILTER ? "General" : style;
  }

  function savePastedPassages() {
    const parts = splitPastedPassages(pasteText);
    const passages = parts.map((content, index) =>
      createLibraryPassage({
        title: parts.length === 1 ? pasteTitle : `${pasteTitle} ${index + 1}`,
        content,
        category: getCategoryForNewPassages(),
        style: getStyleForNewPassages(),
        source: "pasted"
      })
    );

    savePassages(passages, `Saved ${passages.length} pasted passage${passages.length === 1 ? "" : "s"}.`);
    setPasteText("");
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type === "text/plain" || file.name.endsWith(".txt"));
    if (files.length === 0) {
      setMessage("Choose one or more .txt files.");
      setUploadPreview(null);
      return;
    }

    const passages: LibraryPassage[] = [];

    for (const file of files) {
      const fileText = await file.text();
      const baseTitle = file.name.replace(/\.txt$/i, "");
      const validParts = splitTextIntoPassages(fileText).filter((part) => part.length >= 20);

      validParts.forEach((content, index) => {
        const fallbackTitle = validParts.length === 1 ? baseTitle : `${baseTitle} - Part ${index + 1}`;
        const extractedPassage = extractPassageTitle(content, fallbackTitle);

        if (extractedPassage.content.length < 20) {
          return;
        }

        passages.push(
          createLibraryPassage({
            title: extractedPassage.title,
            content: extractedPassage.content,
            category: getCategoryForNewPassages(),
            style: getStyleForNewPassages(),
            source: "uploaded"
          })
        );
      });
    }

    if (passages.length === 0) {
      setMessage("No valid passages found. Each passage must contain at least 20 characters.");
      setUploadPreview(null);
      event.target.value = "";
      return;
    }

    setUploadPreview({
      count: passages.length,
      titles: passages.map((passage) => passage.title),
      totalWordCount: passages.reduce((total, passage) => total + passage.wordCount, 0)
    });

    savePassages(passages, `Uploaded ${passages.length} passage${passages.length === 1 ? "" : "s"} from ${files.length} file${files.length === 1 ? "" : "s"}.`);
    event.target.value = "";
  }

  function generateSamplePassage() {
    const minutes = durationSeconds / 60;
    const generatedCategory = getCategoryForNewPassages();
    const generatedStyle = getStyleForNewPassages();
    const passage = createLibraryPassage({
      title: `${generatedCategory} sample (${minutes} min)`,
      content: buildPracticePassage(generatedCategory, durationSeconds),
      category: generatedCategory,
      style: generatedStyle,
      source: "generated"
    });

    savePassages([passage], "Generated and saved one long local passage.");
  }

  function removePassage(id: string) {
    deleteLibraryPassage(id);
    refreshLibrary();
    setMessage("Passage deleted.");
  }

  function clearAllPassages() {
    clearPassageLibrary();
    refreshLibrary();
    setMessage("Passage library cleared.");
  }

  function exportLibrary() {
    const exportData = createPassageLibraryExport();
    const fileDate = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `formaltype-passage-library-${fileDate}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${exportData.passages.length} passages.`);
  }

  async function importLibrary(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const summary = importPassageLibraryExport(parsed, replaceExistingLibrary);
      refreshLibrary();
      setMessage(
        `Imported ${summary.imported} passages. Skipped ${summary.skippedDuplicates} duplicates. Failed ${summary.failedInvalidItems} invalid items.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed. Please choose a valid FormalType JSON export.");
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
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

        <div className="mt-8 grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="space-y-5">
            <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow">
              <h2 className="font-mono text-sm uppercase text-paper/65">Setup</h2>
              <div className="mt-4 space-y-4">
                <Select label="Category" value={category} onChange={updateCategory} options={[ALL_FILTER, ...CATEGORIES]} />
                <Select label="Style" value={style} onChange={updateStyle} options={[ALL_FILTER, ...STYLES]} />
                <Select
                  label="Generated length"
                  value={String(durationSeconds)}
                  onChange={(value) => setDurationSeconds(Number(value))}
                  options={[
                    ["60", "1 minute"],
                    ["300", "5 minutes"],
                    ["600", "10 minutes"]
                  ]}
                />
                <Select
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

            <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow">
              <h2 className="font-mono text-sm uppercase text-paper/65">Upload .txt files</h2>
              <label className="mt-4 flex cursor-pointer items-center justify-between rounded-md border border-paper/10 bg-ink-900 px-4 py-3 font-mono text-sm text-paper/75 transition hover:border-brass/50">
                <span className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-brass" />
                  Upload one or many
                </span>
                <input type="file" accept=".txt,text/plain" multiple className="sr-only" onChange={handleUpload} />
              </label>
              {uploadPreview && (
                <div className="mt-4 rounded-md border border-paper/10 bg-ink-900 p-3">
                  <p className="font-mono text-xs uppercase text-paper/45">Last upload</p>
                  <p className="mt-2 font-mono text-sm text-paper/75">
                    {uploadPreview.count} passages · {uploadPreview.totalWordCount} words
                  </p>
                  <ul className="mt-2 space-y-1 font-mono text-xs text-paper/45">
                    {uploadPreview.titles.slice(0, 5).map((title) => (
                      <li key={title}>{title}</li>
                    ))}
                    {uploadPreview.titles.length > 5 && <li>+{uploadPreview.titles.length - 5} more</li>}
                  </ul>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow">
              <h2 className="font-mono text-sm uppercase text-paper/65">Generate sample</h2>
              <button
                type="button"
                onClick={generateSamplePassage}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-brass/35 bg-brass/10 px-4 py-3 font-mono text-sm text-brass transition hover:bg-brass/15"
              >
                <Sparkles className="h-4 w-4" />
                Generate and save
              </button>
            </section>

            <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow">
              <h2 className="font-mono text-sm uppercase text-paper/65">Backup JSON</h2>
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={exportLibrary}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-brass/35 bg-brass/10 px-4 py-3 font-mono text-sm text-brass transition hover:bg-brass/15"
                >
                  <Download className="h-4 w-4" />
                  Export library
                </button>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-paper/10 bg-ink-900 px-4 py-3 font-mono text-sm text-paper/70 transition hover:border-brass/50 hover:text-paper"
                >
                  <Upload className="h-4 w-4" />
                  Import library
                </button>
              </div>
              <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                onChange={importLibrary}
                className="sr-only"
              />
              <label className="mt-4 flex items-center gap-2 font-mono text-xs text-paper/55">
                <input
                  type="checkbox"
                  checked={replaceExistingLibrary}
                  onChange={(event) => setReplaceExistingLibrary(event.target.checked)}
                />
                Replace existing library
              </label>
            </section>
          </aside>

          <div className="space-y-5">
            <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-paper">Paste passages</h2>
                <p className="font-mono text-xs text-paper/40">Use ---, ###, ===, or [new passage] to split entries</p>
              </div>
              <input
                value={pasteTitle}
                onChange={(event) => setPasteTitle(event.target.value)}
                className="mt-4 w-full rounded-md border border-paper/10 bg-ink-900 px-4 py-3 font-mono text-sm text-paper/80 outline-none transition focus:border-brass"
                placeholder="Title"
              />
              <textarea
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                rows={9}
                className="mt-3 w-full resize-y rounded-md border border-paper/10 bg-ink-900 px-4 py-4 font-mono text-sm leading-6 text-paper/80 outline-none transition focus:border-brass"
                placeholder="Paste one passage, or paste several separated by ---"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={savePastedPassages}
                  className="rounded-md border border-brass/35 bg-brass/10 px-4 py-2 font-mono text-sm text-brass transition hover:bg-brass/15"
                >
                  Save pasted text
                </button>
              </div>
            </section>

            <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-paper">Saved passages</h2>
                  <p className="mt-1 font-mono text-sm text-paper/45">
                    {filteredLibrary.length} shown / {activeLibrary.length} active · Active: {activePassage?.title ?? "none"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearAllPassages}
                  disabled={library.length === 0}
                  className="rounded-md border border-paper/10 bg-ink-800 px-4 py-2 font-mono text-sm text-paper/65 transition hover:border-ember/50 hover:text-ember disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Clear all
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {library.length === 0 && (
                  <div className="rounded-md border border-dashed border-paper/10 bg-ink-900/60 p-6 text-center font-mono text-sm text-paper/45">
                    No saved passages yet.
                  </div>
                )}

                {library.length > 0 && filteredLibrary.length === 0 && (
                  <div className="rounded-md border border-dashed border-paper/10 bg-ink-900/60 p-6 text-center font-mono text-sm text-paper/45">
                    No passages match this category/style. Please choose All or upload more passages.
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
                              Active
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
                          onClick={() => setActivePassage(passage)}
                          className="inline-flex items-center gap-2 rounded-md border border-brass/35 bg-brass/10 px-3 py-2 font-mono text-xs text-brass transition hover:bg-brass/15"
                        >
                          <Check className="h-4 w-4" />
                          Set active
                        </button>
                        <button
                          type="button"
                          onClick={() => removePassage(passage.id)}
                          className="rounded-md border border-paper/10 bg-ink-800 p-2 text-paper/55 transition hover:border-ember/50 hover:text-ember"
                          aria-label={`Delete ${passage.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
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

function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}) {
  return (
    <label className="block">
      <span className="font-mono text-xs uppercase text-paper/45">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-paper/10 bg-ink-900 px-3 py-2 font-mono text-sm outline-none transition focus:border-brass"
      >
        {options.map((option) => {
          const optionValue = Array.isArray(option) ? option[0] : typeof option === "string" ? option : option.value;
          const optionLabel = Array.isArray(option) ? option[1] : typeof option === "string" ? option : option.label;
          const disabled = typeof option === "object" && !Array.isArray(option) ? option.disabled : false;
          return (
            <option key={optionValue} value={optionValue} disabled={disabled}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
}
