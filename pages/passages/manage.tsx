"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FilePlus, Pencil, Search, Trash2, Upload } from "lucide-react";
import { AdminOnly } from "@/components/AdminOnly";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { PracticeCategory } from "@/lib/typing-engine";
import {
  ALL_FILTER,
  CATEGORIES,
  CategoryFilter,
  LibraryPassage,
  STYLES,
  StyleFilter,
  createLibraryPassage,
  extractPassageTitle,
  filterLibraryPassages,
  splitPastedPassages,
  splitTextIntoPassages
} from "@/lib/app-storage";
import {
  addPassages,
  addSupabasePassage,
  deletePassage as deleteStoredPassage,
  deleteSupabasePassage,
  exportPassageLibrary,
  getPassageLibrary,
  getSupabaseAdminPassageLibrary,
  importPassageLibrary,
  importSupabasePassageLibrary,
  updateSupabasePassage,
  updatePassage
} from "@/lib/passageStorage";

type StatusFilter = "All" | "Active" | "Hidden";
type StorageMode = "supabase" | "local";

export default function ManagePassagesPage() {
  return (
    <AppShell>
      <AdminOnly>
        <ManagePassages />
      </AdminOnly>
    </AppShell>
  );
}

function ManagePassages() {
  const { user } = useAuth();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [library, setLibrary] = useState<LibraryPassage[]>([]);
  const [storageMode, setStorageMode] = useState<StorageMode>("local");
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>(ALL_FILTER);
  const [style, setStyle] = useState<StyleFilter>(ALL_FILTER);
  const [status, setStatus] = useState<StatusFilter>("All");
  const [replaceExistingLibrary, setReplaceExistingLibrary] = useState(false);
  const [newPassageTitle, setNewPassageTitle] = useState("");
  const [newPassageCategory, setNewPassageCategory] = useState<PracticeCategory>("Business email");
  const [newPassageStyle, setNewPassageStyle] = useState("Formal");
  const [newPassageContent, setNewPassageContent] = useState("");
  const [editingPassage, setEditingPassage] = useState<LibraryPassage | null>(null);
  const [previewPassage, setPreviewPassage] = useState<LibraryPassage | null>(null);
  const [message, setMessage] = useState("");

  const activeCount = useMemo(() => library.filter((passage) => passage.isActive).length, [library]);
  const hiddenCount = library.length - activeCount;

  const filteredLibrary = useMemo(() => {
    const categoryStyleMatches = filterLibraryPassages(library, category, style);
    return categoryStyleMatches.filter((passage) => {
      const statusMatches =
        status === "All" || (status === "Active" && passage.isActive) || (status === "Hidden" && !passage.isActive);
      const searchMatches = passage.title.toLowerCase().includes(search.trim().toLowerCase());
      return statusMatches && searchMatches;
    });
  }, [category, library, search, status, style]);

  const refreshLibrary = useCallback(async () => {
    setIsLoadingLibrary(true);

    if (user) {
      try {
        const supabaseLibrary = await getSupabaseAdminPassageLibrary();
        setLibrary(supabaseLibrary);
        setStorageMode("supabase");
        setIsLoadingLibrary(false);
        return;
      } catch (error) {
        setStorageMode("local");
        setMessage(
          `Supabase passage load failed. Showing localStorage fallback. ${
            error instanceof Error ? error.message : "Please try again."
          }`
        );
      }
    }

    setLibrary(getPassageLibrary());
    setIsLoadingLibrary(false);
  }, [user]);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  async function deletePassage(id: string) {
    try {
      if (storageMode === "supabase") {
        await deleteSupabasePassage(id);
      } else {
        deleteStoredPassage(id);
      }

      await refreshLibrary();
      setMessage("Passage deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Passage delete failed.");
    }
  }

  async function savePassage(passage: LibraryPassage) {
    try {
      if (storageMode === "supabase") {
        await updateSupabasePassage(passage.id, passage);
      } else {
        updatePassage(passage.id, passage);
      }

      setEditingPassage(null);
      await refreshLibrary();
      setMessage("Passage saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Passage save failed.");
    }
  }

  async function addManualPassages() {
    const passageParts = splitPastedPassages(newPassageContent).filter((part) => part.length >= 20);

    if (passageParts.length === 0) {
      setMessage("Add at least 20 characters of passage content.");
      return;
    }

    const passages = passageParts.map((part, index) => {
      const fallbackTitle =
        newPassageTitle.trim() || (passageParts.length > 1 ? `Admin passage ${index + 1}` : "Admin passage");
      const extracted = extractPassageTitle(part, fallbackTitle);

      return createLibraryPassage({
        title: extracted.title,
        content: extracted.content,
        category: newPassageCategory,
        style: newPassageStyle.trim() || "General",
        source: "pasted"
      });
    });

    try {
      await addPassagesForCurrentStorage(passages);
      setNewPassageTitle("");
      setNewPassageContent("");
      await refreshLibrary();
      setMessage(`Added ${passages.length} passage${passages.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Passage add failed.");
    }
  }

  async function uploadTextPassages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) => file.name.toLowerCase().endsWith(".txt"));

    if (files.length === 0) {
      setMessage("Choose one or more .txt files to upload.");
      return;
    }

    try {
      const uploadedPassages: LibraryPassage[] = [];

      for (const file of files) {
        const text = await file.text();
        const fallbackTitle = file.name.replace(/\.txt$/i, "").trim() || "Uploaded passage";
        const parts = splitTextIntoPassages(text).filter((part) => part.length >= 20);

        parts.forEach((part, index) => {
          const extracted = extractPassageTitle(
            part,
            parts.length > 1 ? `${fallbackTitle} ${index + 1}` : fallbackTitle
          );

          uploadedPassages.push(
            createLibraryPassage({
              title: extracted.title,
              content: extracted.content,
              category: newPassageCategory,
              style: newPassageStyle.trim() || "General",
              source: "uploaded"
            })
          );
        });
      }

      if (uploadedPassages.length === 0) {
        setMessage("No uploadable passages found. Use separators like --- between passages if needed.");
        return;
      }

      await addPassagesForCurrentStorage(uploadedPassages);
      await refreshLibrary();
      setMessage(`Uploaded ${uploadedPassages.length} passage${uploadedPassages.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed. Please try another .txt file.");
    } finally {
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
    }
  }

  async function addPassagesForCurrentStorage(passages: LibraryPassage[]) {
    if (storageMode === "supabase") {
      if (!user) {
        throw new Error("Please sign in before saving passages to Supabase.");
      }

      await Promise.all(passages.map((passage) => addSupabasePassage(passage, user.id)));
      return;
    }

    addPassages(passages);
  }

  function exportLibrary() {
    const exportData =
      storageMode === "supabase"
        ? createPassageExport(library)
        : exportPassageLibrary();
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

      if (storageMode === "supabase") {
        const importedPassages = readPassagesFromImport(parsed);

        if (replaceExistingLibrary) {
          await Promise.all(library.map((passage) => deleteSupabasePassage(passage.id)));
        }

        await importSupabasePassageLibrary(importedPassages, user?.id ?? null);
        await refreshLibrary();
        setMessage(`Imported ${importedPassages.length} passages to Supabase.`);
      } else {
        const summary = importPassageLibrary(parsed, replaceExistingLibrary);
        await refreshLibrary();
        setMessage(
          `Imported ${summary.imported} passages. Skipped ${summary.skippedDuplicates} duplicates. Failed ${summary.failedInvalidItems} invalid items.`
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed. Please choose a valid FormalType JSON export.");
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  return (
    <>
      <section className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase text-brass">Admin</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-paper md:text-4xl">Admin Passage Console</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-paper/55">
              Add, edit, import, export, and remove passages from {storageMode === "supabase" ? "Supabase" : "this browser's localStorage fallback"}.
            </p>
          </div>
          <div className="rounded-md border border-paper/10 bg-ink-950/75 px-4 py-3 text-right shadow-glow">
            <p className="font-mono text-2xl text-paper">{library.length}</p>
            <p className="font-mono text-xs uppercase text-paper/45">passages</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <StatCard label="Total passages" value={library.length} />
          <StatCard label="Active" value={activeCount} />
          <StatCard label="Hidden" value={hiddenCount} />
        </div>

        {message && (
          <div className="mt-5 rounded-md border border-brass/25 bg-brass/10 px-4 py-3 font-mono text-sm text-brass">
            {message}
          </div>
        )}

        <div className="mt-5 rounded-md border border-paper/10 bg-ink-950/75 px-4 py-3 font-mono text-sm text-paper/55">
          Storage: {storageMode === "supabase" ? "Supabase" : "localStorage fallback"}
          {isLoadingLibrary ? " · Loading..." : ""}
        </div>

        <section className="mt-8 rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-paper">Add passages</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-paper/55">
                Create a passage manually or upload one or more .txt files. Separators such as --- split long uploads
                into multiple passages.
              </p>
            </div>
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-md border border-paper/10 bg-ink-900 px-4 py-2 font-mono text-sm text-paper/70 transition hover:border-brass/50 hover:text-paper"
            >
              <Upload className="h-4 w-4" />
              Upload .txt
            </button>
          </div>

          <input
            ref={uploadInputRef}
            type="file"
            accept=".txt,text/plain"
            multiple
            onChange={uploadTextPassages}
            className="sr-only"
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TextInput label="Title" value={newPassageTitle} onChange={setNewPassageTitle} />
            <Select
              label="Category"
              value={newPassageCategory}
              onChange={(value) => setNewPassageCategory(value as PracticeCategory)}
              options={CATEGORIES}
            />
            <TextInput label="Style" value={newPassageStyle} onChange={setNewPassageStyle} />
          </div>

          <label className="mt-4 block">
            <span className="font-mono text-xs uppercase text-paper/45">Content</span>
            <textarea
              value={newPassageContent}
              onChange={(event) => setNewPassageContent(event.target.value)}
              rows={8}
              className="mt-2 w-full resize-y rounded-md border border-paper/10 bg-ink-950 px-4 py-4 font-mono text-sm leading-6 text-paper/80 outline-none transition focus:border-brass"
              placeholder="Paste passage content here"
            />
          </label>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={addManualPassages}
              className="inline-flex items-center gap-2 rounded-md border border-brass/35 bg-brass/10 px-4 py-2 font-mono text-sm text-brass transition hover:bg-brass/15"
            >
              <FilePlus className="h-4 w-4" />
              Add passage
            </button>
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-paper">Library backup</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-paper/55">
                Export this browser&apos;s local passage library, then import it on another preview URL when localStorage
                belongs to a different origin.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportLibrary}
                className="inline-flex items-center gap-2 rounded-md border border-brass/35 bg-brass/10 px-4 py-2 font-mono text-sm text-brass transition hover:bg-brass/15"
              >
                <Download className="h-4 w-4" />
                Export library
              </button>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-md border border-paper/10 bg-ink-900 px-4 py-2 font-mono text-sm text-paper/70 transition hover:border-brass/50 hover:text-paper"
              >
                <Upload className="h-4 w-4" />
                Import library
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              onChange={importLibrary}
              className="sr-only"
            />
            <label className="flex items-center gap-2 font-mono text-sm text-paper/65">
              <input
                type="checkbox"
                checked={replaceExistingLibrary}
                onChange={(event) => setReplaceExistingLibrary(event.target.checked)}
              />
              Replace existing library
            </label>
            <p className="font-mono text-xs text-paper/35">Import accepts FormalType .json exports.</p>
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem_10rem]">
            <label className="block">
              <span className="font-mono text-xs uppercase text-paper/45">Search title</span>
              <div className="mt-2 flex items-center gap-2 rounded-md border border-paper/10 bg-ink-900 px-3 py-2">
                <Search className="h-4 w-4 text-paper/35" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full bg-transparent font-mono text-sm text-paper/80 outline-none"
                  placeholder="Find passage"
                />
              </div>
            </label>
            <Select label="Category" value={category} onChange={(value) => setCategory(value as CategoryFilter)} options={[ALL_FILTER, ...CATEGORIES]} />
            <Select label="Style" value={style} onChange={setStyle} options={[ALL_FILTER, ...STYLES, "General"]} />
            <Select label="Status" value={status} onChange={(value) => setStatus(value as StatusFilter)} options={["All", "Active", "Hidden"]} />
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-paper">Saved passages</h2>
            <p className="font-mono text-sm text-paper/45">
              {filteredLibrary.length} shown / {library.length} saved
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {filteredLibrary.length === 0 && (
              <div className="rounded-md border border-dashed border-paper/10 bg-ink-900/60 p-6 text-center font-mono text-sm text-paper/45">
                No passages match these filters.
              </div>
            )}

            {filteredLibrary.map((passage) => (
              <article key={passage.id} className="rounded-md border border-paper/10 bg-ink-900 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-paper">{passage.title}</h3>
                      <span
                        className={`rounded-sm border px-2 py-0.5 font-mono text-[0.68rem] uppercase ${
                          passage.isActive
                            ? "border-mint/30 bg-mint/10 text-mint"
                            : "border-paper/10 bg-ink-800 text-paper/45"
                        }`}
                      >
                        {passage.isActive ? "Active" : "Hidden"}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-paper/45">
                      {passage.category} · {passage.style} · {passage.source} · {passage.wordCount} words ·{" "}
                      {passage.characterCount} chars
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewPassage(passage)}
                      className="rounded-md border border-paper/10 bg-ink-800 p-2 text-paper/60 transition hover:border-brass/50 hover:text-paper"
                      aria-label={`Preview ${passage.title}`}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPassage(passage)}
                      className="rounded-md border border-paper/10 bg-ink-800 p-2 text-paper/60 transition hover:border-brass/50 hover:text-paper"
                      aria-label={`Edit ${passage.title}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePassage(passage.id)}
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
      </section>

      {editingPassage && (
        <EditPassageModal passage={editingPassage} onCancel={() => setEditingPassage(null)} onSave={savePassage} />
      )}
      {previewPassage && <PreviewModal passage={previewPassage} onClose={() => setPreviewPassage(null)} />}
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-paper/10 bg-ink-950/75 px-4 py-3">
      <p className="font-mono text-2xl text-paper">{value}</p>
      <p className="mt-1 font-mono text-xs uppercase text-paper/45">{label}</p>
    </div>
  );
}

function createPassageExport(passages: LibraryPassage[]) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    passages,
    settings: {
      activePassageId: null,
      selectedCategory: null,
      selectedStyle: null,
      passageSelectionMode: null
    }
  };
}

function readPassagesFromImport(payload: unknown): LibraryPassage[] {
  if (!isRecord(payload) || !Array.isArray(payload.passages)) {
    throw new Error("Import file must contain a passages array.");
  }

  const passages = payload.passages.map(toLibraryPassageFromImport).filter(Boolean) as LibraryPassage[];

  if (passages.length === 0) {
    throw new Error("Import file does not contain valid passages.");
  }

  return passages;
}

function toLibraryPassageFromImport(item: unknown): LibraryPassage | null {
  if (!isRecord(item)) {
    return null;
  }

  const content = typeof item.content === "string" ? item.content : typeof item.text === "string" ? item.text : "";

  if (!content.trim()) {
    return null;
  }

  const title = typeof item.title === "string" ? item.title : "Imported passage";
  const category = typeof item.category === "string" ? toPracticeCategory(item.category) : "Uncategorised";
  const style = typeof item.style === "string" && item.style.trim() ? item.style : "General";
  const source = item.source === "generated" || item.source === "pasted" || item.source === "uploaded" ? item.source : "uploaded";
  const passage = createLibraryPassage({
    title,
    content,
    category,
    style,
    source
  });

  return {
    ...passage,
    isActive: true
  };
}

function toPracticeCategory(category: string): PracticeCategory {
  return CATEGORIES.find((knownCategory) => knownCategory === category) ?? "Uncategorised";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function EditPassageModal({
  passage,
  onCancel,
  onSave
}: {
  passage: LibraryPassage;
  onCancel: () => void;
  onSave: (passage: LibraryPassage) => void;
}) {
  const [draft, setDraft] = useState<LibraryPassage>(passage);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/80 px-4 backdrop-blur">
      <section className="w-full max-w-3xl rounded-lg border border-brass/30 bg-ink-900 p-5 shadow-glow md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-paper/10 pb-4">
          <div>
            <p className="font-mono text-xs uppercase text-brass">Edit</p>
            <h2 className="mt-1 text-2xl font-semibold text-paper">Passage details</h2>
          </div>
          <label className="flex items-center gap-2 font-mono text-sm text-paper/70">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
            />
            Active
          </label>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <TextInput label="Title" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} />
          <Select
            label="Category"
            value={draft.category}
            onChange={(value) => setDraft({ ...draft, category: value as PracticeCategory })}
            options={CATEGORIES}
          />
          <TextInput label="Style" value={draft.style} onChange={(value) => setDraft({ ...draft, style: value })} />
        </div>

        <label className="mt-4 block">
          <span className="font-mono text-xs uppercase text-paper/45">Content</span>
          <textarea
            value={draft.content}
            onChange={(event) => setDraft({ ...draft, content: event.target.value })}
            rows={12}
            className="mt-2 w-full resize-y rounded-md border border-paper/10 bg-ink-950 px-4 py-4 font-mono text-sm leading-6 text-paper/80 outline-none transition focus:border-brass"
          />
        </label>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-paper/10 bg-ink-800 px-4 py-2 font-mono text-sm text-paper/70 transition hover:border-brass/50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="rounded-md border border-brass/35 bg-brass/10 px-4 py-2 font-mono text-sm text-brass transition hover:bg-brass/15"
          >
            Save changes
          </button>
        </div>
      </section>
    </div>
  );
}

function PreviewModal({ passage, onClose }: { passage: LibraryPassage; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/80 px-4 backdrop-blur">
      <section className="w-full max-w-3xl rounded-lg border border-paper/10 bg-ink-900 p-5 shadow-glow md:p-6">
        <p className="font-mono text-xs uppercase text-brass">Preview</p>
        <h2 className="mt-1 text-2xl font-semibold text-paper">{passage.title}</h2>
        <p className="mt-2 font-mono text-xs text-paper/45">
          {passage.category} · {passage.style} · {passage.isActive ? "Active" : "Hidden"}
        </p>
        <div className="mt-5 max-h-[55vh] overflow-y-auto rounded-md border border-paper/10 bg-ink-950 p-4 text-sm leading-7 text-paper/70">
          <p className="whitespace-pre-wrap">{passage.content}</p>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-paper/10 bg-ink-800 px-4 py-2 font-mono text-sm text-paper/70 transition hover:border-brass/50"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="font-mono text-xs uppercase text-paper/45">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-paper/10 bg-ink-950 px-3 py-2 font-mono text-sm text-paper/80 outline-none transition focus:border-brass"
      />
    </label>
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
  options: string[];
}) {
  return (
    <label className="block">
      <span className="font-mono text-xs uppercase text-paper/45">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-paper/10 bg-ink-950 px-3 py-2 font-mono text-sm text-paper/80 outline-none transition focus:border-brass"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
