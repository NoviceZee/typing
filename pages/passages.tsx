"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Check, Languages, Search, Tags } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button, SegmentedControl } from "@/components/Controls";
import { PageContainer, PageHeader } from "@/components/PageLayout";
import { DataSurface, EmptyState, PageSection, SectionStack, StatusMessage } from "@/components/Surface";
import {
  ALL_FILTER,
  CategoryFilter,
  LibraryPassage,
  PassageLanguage,
  filterLibraryPassages,
  filterLibraryPassagesByLanguage,
  formatPassageLength,
  toStoredPassage,
  withBuiltInSamplePassages,
  writeStoredPassage
} from "@/lib/app-storage";
import {
  getActivePassageId,
  getActivePassageLibrary,
  getSelectedCategory,
  getSelectedLanguage,
  getSupabasePassageLibrary,
  setPassageSelectionMode,
  setSelectedCategory,
  setSelectedLanguage,
  setActivePassageId as setStoredActivePassageId
} from "@/lib/passageStorage";
import { normalizeCategoryFilter } from "@/lib/passageCategories";

export default function PassagesPage() {
  const router = useRouter();
  const [library, setLibrary] = useState<LibraryPassage[]>([]);
  const [activePassageId, setActivePassageId] = useState<string | null>(null);
  const [language, setLanguage] = useState<PassageLanguage>("english");
  const [category, setCategory] = useState<CategoryFilter>(ALL_FILTER);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [hasLoadedLibrary, setHasLoadedLibrary] = useState(false);
  const [hasRefreshError, setHasRefreshError] = useState(false);

  const activeLibrary = useMemo(() => library.filter((passage) => passage.isActive), [library]);
  const activePassage = useMemo(
    () => activeLibrary.find((passage) => passage.id === activePassageId) ?? null,
    [activeLibrary, activePassageId]
  );
  const languageLibrary = useMemo(() => filterLibraryPassagesByLanguage(activeLibrary, language), [activeLibrary, language]);
  const categoryLibrary = useMemo(
    () => filterLibraryPassages(languageLibrary, category, ALL_FILTER),
    [category, languageLibrary]
  );
  const filteredLibrary = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    if (!normalizedSearch) return categoryLibrary;

    return categoryLibrary.filter((passage) =>
      `${passage.title} ${passage.category}`.toLocaleLowerCase().includes(normalizedSearch)
    );
  }, [categoryLibrary, search]);

  const refreshLibrary = useCallback(async () => {
    try {
      const remoteLibrary = await getSupabasePassageLibrary();
      setLibrary(remoteLibrary.length > 0 ? withBuiltInSamplePassages(remoteLibrary) : getActivePassageLibrary());
      setHasRefreshError(false);
    } catch {
      setLibrary(getActivePassageLibrary());
      setHasRefreshError(true);
    }

    setActivePassageId(getActivePassageId());
    const queryLanguage = router.query.language === "chinese" ? "chinese" : router.query.language === "english" ? "english" : null;
    const nextLanguage = queryLanguage ?? getSelectedLanguage();
    setLanguage(nextLanguage);
    setSelectedLanguage(nextLanguage);
    setCategory(normalizeCategoryFilter(getSelectedCategory()) as CategoryFilter);
    setHasLoadedLibrary(true);
  }, [router.query.language]);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  function selectPracticePassage(
    passage: LibraryPassage,
    sourceLibrary = categoryLibrary.length > 0 ? categoryLibrary : languageLibrary
  ) {
    setPassageSelectionMode("specific");
    setSelectedLanguage(passage.language ?? "english");
    setStoredActivePassageId(passage.id);
    writeStoredPassage(toStoredPassage(passage, 60, sourceLibrary));
    setActivePassageId(passage.id);
    setMessage(`"${passage.title}" is selected for practice.`);
  }

  function startPractice(passage: LibraryPassage) {
    selectPracticePassage(passage);
    router.push("/practice");
  }

  function updateCategory(value: string) {
    const nextCategory = normalizeCategoryFilter(value) as CategoryFilter;
    setCategory(nextCategory);
    setSelectedCategory(nextCategory);
  }

  function updateLanguage(value: PassageLanguage) {
    setLanguage(value);
    setSelectedLanguage(value);
    setCategory(ALL_FILTER);
    setSelectedCategory(ALL_FILTER);
    setSearch("");
  }

  return (
    <AppShell sideAd={false}>
      <PageContainer>
        <PageHeader eyebrow="Library" title="Passage library" />

        <SectionStack>
          {message && <StatusMessage tone="success">{message}</StatusMessage>}

          {hasRefreshError && (
            <StatusMessage tone="warning" aria-label="Library refresh warning">
              The library could not be refreshed. Showing available fallback passages.
            </StatusMessage>
          )}

          <PageSection aria-label="Library setup">
            <div className="space-y-3">
              <label className="flex min-h-11 w-full max-w-xl items-center gap-2 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-border-control)] bg-[var(--ui-surface-subtle)] px-3 focus-within:ring-2 focus-within:ring-[color:var(--ui-focus-ring)] focus-within:ring-offset-2 focus-within:ring-offset-[color:var(--ui-surface-canvas)]">
                <Search className="icon-control shrink-0 text-[color:var(--ui-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
                <span className="sr-only">Search passages</span>
                <input
                  type="search"
                  role="searchbox"
                  aria-label="Search passages"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title or category"
                  className="min-w-0 flex-1 bg-transparent font-mono text-[length:var(--ui-type-control-size)] leading-[var(--ui-type-control-leading)] text-[color:var(--ui-text-primary)] outline-none placeholder:text-[color:var(--ui-text-muted)]"
                />
              </label>
              <div className="grid min-w-0 gap-2 md:flex md:flex-wrap md:items-start md:gap-x-4 md:gap-y-2">
                <SegmentedControl
                  label="Language"
                  icon={Languages}
                  value={language}
                  onChange={updateLanguage}
                  options={[
                    { value: "english", label: "English", ariaLabel: "English language" },
                    { value: "chinese", label: "Chinese", ariaLabel: "Chinese language" }
                  ]}
                />
                <SegmentedControl
                  label="Category"
                  icon={Tags}
                  value={category}
                  onChange={updateCategory}
                  options={[ALL_FILTER, ...getAvailableCategories(languageLibrary)].map((option) => ({
                    value: option,
                    label: option,
                    ariaLabel: `${option} category`
                  }))}
                />
              </div>
            </div>
          </PageSection>

          <PageSection aria-label="Available passages" className="min-w-0">
            <div className="mb-3">
              <h2 className="text-[length:var(--ui-type-section-title-size)] font-semibold leading-[var(--ui-type-section-title-leading)] text-[color:var(--ui-text-primary)]">
                Available passages
              </h2>
              <p className="mt-1 font-mono text-[length:var(--ui-type-caption-size)] leading-[var(--ui-type-caption-leading)] text-[color:var(--ui-text-secondary)]">
                {filteredLibrary.length} shown / {languageLibrary.length} in {language === "chinese" ? "Chinese" : "English"}
                {activePassage ? ` · Selected: ${activePassage.title}` : ""}
              </p>
            </div>

            <DataSurface aria-label="Passage results">
              {!hasLoadedLibrary && (
                <StatusMessage
                  aria-label="Loading passage library"
                  className="rounded-none border-0 bg-transparent px-4 py-10 text-center"
                >
                  Loading passages...
                </StatusMessage>
              )}

              {hasLoadedLibrary && activeLibrary.length === 0 && (
                <EmptyState label="No passages available">No passages are available yet.</EmptyState>
              )}

              {hasLoadedLibrary && activeLibrary.length > 0 && filteredLibrary.length === 0 && (
                <EmptyState label="No matching passages">
                  No passages match the current filters or search.
                </EmptyState>
              )}

              {filteredLibrary.length > 0 && (
                <div className="divide-y divide-[color:var(--ui-border-subtle)]">
                  {filteredLibrary.map((passage) => {
                    const isSelected = passage.id === activePassageId;
                    const readableStyle = getReadableStyle(passage.style);

                    return (
                      <article
                        key={passage.id}
                        aria-label={passage.title}
                        aria-current={isSelected ? "true" : undefined}
                        className={`min-w-0 border-l-2 px-4 py-4 transition-colors duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)] md:px-5 ${
                          isSelected
                            ? "border-l-[color:var(--ui-border-selected)] bg-[var(--ui-surface-selected)]"
                            : "border-l-transparent hover:bg-[var(--ui-surface-hover)]"
                        }`}
                      >
                        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                              <h3 className="break-words text-[length:var(--ui-type-subsection-title-size)] font-semibold leading-[var(--ui-type-subsection-title-leading)] text-[color:var(--ui-text-primary)]">
                                {passage.title}
                              </h3>
                              {isSelected && (
                                <span
                                  data-testid="selected-passage-cue"
                                  className="inline-flex shrink-0 items-center gap-1 font-mono text-[length:var(--ui-type-caption-size)] font-semibold uppercase text-[color:var(--ui-text-accent)]"
                                >
                                  <Check className="icon-compact" strokeWidth={2} aria-hidden="true" />
                                  Selected
                                </span>
                              )}
                            </div>
                            <p className="mt-2 break-words font-mono text-[length:var(--ui-type-caption-size)] leading-[var(--ui-type-caption-leading)] text-[color:var(--ui-text-secondary)]">
                              {passage.category}{readableStyle ? ` · ${readableStyle}` : ""} · {formatPassageLength(passage)}
                            </p>
                            <p className="mt-3 line-clamp-2 break-words text-[length:var(--ui-type-body-size)] leading-[var(--ui-type-body-leading)] text-[color:var(--ui-text-secondary)]">
                              {passage.content}
                            </p>
                          </div>

                          <Button
                            variant="primary"
                            onClick={() => startPractice(passage)}
                            className="shrink-0 self-start sm:self-center"
                          >
                            Practice this passage
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </DataSurface>
          </PageSection>
        </SectionStack>
      </PageContainer>
    </AppShell>
  );
}

function getAvailableCategories(library: LibraryPassage[]) {
  return Array.from(new Set(library.map((passage) => passage.category))).sort();
}

function getReadableStyle(style: string) {
  const normalized = style.trim();
  if (!normalized || normalized === "General" || normalized === "English longform v1" || normalized === "Modern essay") {
    return "";
  }
  return normalized;
}
