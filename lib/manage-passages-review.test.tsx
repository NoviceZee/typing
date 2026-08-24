/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import * as ManagePassagesModule from "../pages/passages/manage";
import type { LibraryPassage } from "./app-storage";

describe("Manage passages review modal", () => {
  it.each([
    ["Submit for review", "submit"],
    ["Reject", "reject"]
  ] as const)("persists the complete edited draft when choosing %s", async (buttonName, action) => {
    const EditPassageModal = (ManagePassagesModule as unknown as {
      EditPassageModal?: React.ComponentType<{
        passage: LibraryPassage;
        onCancel: () => void;
        onSave: (passage: LibraryPassage) => Promise<void>;
        onReview: (passage: LibraryPassage, action: "submit" | "approve" | "reject") => Promise<void>;
      }>;
    }).EditPassageModal;
    expect(typeof EditPassageModal).toBe("function");
    if (!EditPassageModal) return;

    vi.stubGlobal("React", React);
    const onReview = vi.fn().mockResolvedValue(undefined);
    render(
      <EditPassageModal
        passage={makePassage()}
        onCancel={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onReview={onReview}
      />
    );

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Edited workflow title" } });
    fireEvent.change(screen.getByLabelText("Style"), { target: { value: "Edited style" } });
    fireEvent.change(screen.getByLabelText("Risk classification"), { target: { value: "B" } });
    fireEvent.change(screen.getByLabelText("Source type"), { target: { value: "public_domain" } });
    fireEvent.click(screen.getByLabelText("Fictional"));
    fireEvent.change(screen.getByLabelText("Content"), {
      target: { value: "Edited workflow content that must be saved atomically." }
    });
    fireEvent.change(screen.getByLabelText("Review notes"), { target: { value: "Edited reviewer notes." } });
    fireEvent.click(screen.getByRole("button", { name: buttonName }));

    await waitFor(() => {
      expect(onReview).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Edited workflow title",
          style: "Edited style",
          riskClassification: "B",
          sourceType: "public_domain",
          fictional: true,
          content: "Edited workflow content that must be saved atomically.",
          reviewNotes: "Edited reviewer notes."
        }),
        action
      );
    });
  });
});

function makePassage(): LibraryPassage {
  return {
    id: "passage-1",
    title: "Review passage",
    category: "Articles",
    style: "General",
    language: "english",
    content: "Original review passage content.",
    source: "uploaded",
    createdAt: "2026-08-22T09:00:00.000Z",
    updatedAt: "2026-08-22T10:00:00.000Z",
    wordCount: 4,
    characterCount: 32,
    riskClassification: "A",
    sourceType: "licensed",
    fictional: false,
    reviewedAt: "2026-08-22T10:00:00.000Z",
    reviewNotes: "Original notes.",
    reviewStatus: "approved",
    isActive: true,
    isPublic: true
  };
}
