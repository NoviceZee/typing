import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { IconButton } from "@/components/Controls";
import type { LibraryPassage, PassageLanguage } from "@/lib/app-storage";

export type PassagePickerProps = {
  open: boolean;
  passages: LibraryPassage[];
  language: PassageLanguage;
  selectedPassageId: string | null;
  libraryHref: string;
  onClose: () => void;
  onSelect: (passageId: string) => void;
};

export function PassagePicker({
  open,
  passages,
  language,
  selectedPassageId,
  libraryHref,
  onClose,
  onSelect
}: PassagePickerProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const filteredPassages = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return passages.filter((passage) => {
      if ((passage.language ?? "english") !== language) return false;
      if (!normalizedQuery) return true;

      return `${passage.title} ${passage.category}`.toLocaleLowerCase().includes(normalizedQuery);
    });
  }, [language, passages, query]);
  const activePassage = filteredPassages[activeIndex] ?? null;

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const selectedIndex = passages
      .filter((passage) => (passage.language ?? "english") === language)
      .findIndex((passage) => passage.id === selectedPassageId);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [language, open, passages, selectedPassageId]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, filteredPassages.length - 1)));
  }, [filteredPassages.length]);

  useEffect(() => {
    if (!open || !activePassage) return;
    optionRefs.current.get(activePassage.id)?.scrollIntoView({ block: "nearest" });
  }, [activePassage, open]);

  if (!open) return null;

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (filteredPassages.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % filteredPassages.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + filteredPassages.length) % filteredPassages.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(filteredPassages.length - 1);
    } else if (event.key === "Enter" && activePassage) {
      event.preventDefault();
      onSelect(activePassage.id);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-[var(--ui-surface-overlay)] px-3 py-6 sm:items-center sm:px-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
          return;
        }

        if (event.key === "Tab") {
          const focusableElements = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), a[href]'
            ) ?? []
          );
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
          } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="passage-picker-title"
        className="flex max-h-[min(42rem,calc(100dvh-3rem))] w-full max-w-xl flex-col overflow-hidden rounded-[var(--ui-radius-overlay)] border border-[color:var(--ui-border-strong)] bg-[var(--ui-surface-canvas)] shadow-[var(--ui-shadow-overlay)]"
      >
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
          <div className="min-w-0">
            <h2
              id="passage-picker-title"
              className="text-[length:var(--ui-type-section-title-size)] font-semibold leading-[var(--ui-type-section-title-leading)] text-[color:var(--ui-text-primary)]"
            >
              Choose a passage
            </h2>
            <p className="mt-1 font-mono text-[length:var(--ui-type-caption-size)] leading-[var(--ui-type-caption-leading)] text-[color:var(--ui-text-secondary)]">
              {language === "chinese" ? "Chinese" : "English"} passages
            </p>
          </div>
          <IconButton icon={X} label="Close passage picker" onClick={onClose} />
        </div>

        <div className="px-4 pb-3 sm:px-5">
          <label className="flex min-h-11 items-center gap-2 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-border-control)] bg-[var(--ui-surface-subtle)] px-3 focus-within:ring-2 focus-within:ring-[color:var(--ui-focus-ring)] focus-within:ring-offset-2 focus-within:ring-offset-[color:var(--ui-surface-canvas)]">
            <Search className="icon-control shrink-0 text-[color:var(--ui-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
            <span className="sr-only">Search passages</span>
            <input
              type="search"
              autoFocus
              role="searchbox"
              aria-label="Search passages"
              aria-controls="passage-picker-options"
              aria-activedescendant={activePassage ? getOptionId(activePassage.id) : undefined}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search by title or category"
              className="min-w-0 flex-1 bg-transparent font-mono text-[length:var(--ui-type-control-size)] leading-[var(--ui-type-control-leading)] text-[color:var(--ui-text-primary)] outline-none placeholder:text-[color:var(--ui-text-muted)]"
            />
          </label>
        </div>

        <div
          id="passage-picker-options"
          role="listbox"
          aria-label="Passages"
          className="min-h-0 flex-1 overflow-y-auto border-y border-[color:var(--ui-border-subtle)]"
        >
          {filteredPassages.length === 0 ? (
            <p className="px-4 py-10 text-center font-mono text-[length:var(--ui-type-body-size)] text-[color:var(--ui-text-secondary)]">
              No passages found.
            </p>
          ) : (
            <div className="divide-y divide-[color:var(--ui-border-subtle)]">
              {filteredPassages.map((passage, index) => {
                const isSelected = passage.id === selectedPassageId;
                const isActive = index === activeIndex;
                const readableStyle = getReadableStyle(passage.style);

                return (
                  <button
                    key={passage.id}
                    ref={(node) => {
                      if (node) optionRefs.current.set(passage.id, node);
                      else optionRefs.current.delete(passage.id);
                    }}
                    id={getOptionId(passage.id)}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={isSelected}
                    data-active-option={isActive ? "true" : undefined}
                    data-focus-ring="standard"
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => onSelect(passage.id)}
                    className={`ui-focus-ring ui-target-default flex w-full min-w-0 items-center justify-between gap-3 border-l-2 px-4 py-3 text-left transition-colors duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)] sm:px-5 ${
                      isSelected
                        ? "border-l-[color:var(--ui-border-selected)] bg-[var(--ui-surface-selected)]"
                        : isActive
                          ? "border-l-transparent bg-[var(--ui-surface-hover)]"
                          : "border-l-transparent bg-transparent hover:bg-[var(--ui-surface-hover)]"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block break-words text-[length:var(--ui-type-control-size)] font-semibold leading-[var(--ui-type-control-leading)] text-[color:var(--ui-text-primary)]">
                        {passage.title}
                      </span>
                      <span className="mt-1 block break-words font-mono text-[length:var(--ui-type-caption-size)] leading-[var(--ui-type-caption-leading)] text-[color:var(--ui-text-secondary)]">
                        {passage.category}{readableStyle ? ` · ${readableStyle}` : ""}
                      </span>
                    </span>
                    {isSelected && (
                      <span className="flex shrink-0 items-center gap-1 font-mono text-[length:var(--ui-type-caption-size)] font-semibold uppercase text-[color:var(--ui-text-accent)]">
                        <Check className="icon-inline" strokeWidth={2} aria-hidden="true" />
                        Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-4 py-3 sm:px-5">
          <Link
            href={libraryHref}
            className="ui-focus-ring rounded-[var(--ui-radius-control)] px-2 py-2 font-mono text-[length:var(--ui-type-control-size)] text-[color:var(--ui-text-secondary)] hover:bg-[var(--ui-surface-hover)] hover:text-[color:var(--ui-text-primary)]"
          >
            Browse Library
          </Link>
        </div>
      </section>
    </div>
  );
}

function getOptionId(passageId: string) {
  return `passage-picker-option-${passageId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function getReadableStyle(style: string) {
  const normalized = style.trim();
  if (!normalized || normalized === "General" || normalized === "English longform v1" || normalized === "Modern essay") {
    return "";
  }
  return normalized;
}
