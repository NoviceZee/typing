import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createLibraryPassage, type LibraryPassage } from "./app-storage";
import * as passageStorage from "./passageStorage";
import * as passageTypes from "./supabasePassageTypes";
import { applyPassageReviewUpdate, sanitizePassagePublication } from "./passageReviewPolicy";
import {
  libraryPassageToSupabaseInsert,
  libraryPassageToSupabaseUpdate,
  supabasePassageRowToLibraryPassage
} from "./supabasePassageTypes";

vi.mock("./supabaseClient", () => ({ supabase: null }));

const migrationName = "202608220001_add_passage_review_metadata.sql";
const migrationPath = join(process.cwd(), "supabase", "migrations", migrationName);

describe("passage review metadata", () => {
  it("strips internal review notes from public passage mapping", () => {
    const mapPublic = (passageTypes as unknown as {
      supabasePublicPassageRowToLibraryPassage?: typeof supabasePassageRowToLibraryPassage;
    }).supabasePublicPassageRowToLibraryPassage;
    expect(typeof mapPublic).toBe("function");
    if (!mapPublic) return;

    const row = makeReviewedRow({
      review_notes: "Internal source https://example.invalid/private"
    }) as Parameters<typeof supabasePassageRowToLibraryPassage>[0];
    const passage = mapPublic(row);

    expect(passage.reviewNotes).toBeNull();
    expect(JSON.stringify(passage)).not.toContain("example.invalid/private");
  });

  it("creates new passages as private, inactive, unclassified drafts", () => {
    const passage = createLibraryPassage({
      title: "New passage",
      content: "A newly created passage remains unavailable until it is reviewed.",
      category: "Business communication",
      style: "General",
      source: "pasted"
    });

    expect(passage).toMatchObject({
      riskClassification: null,
      sourceType: "user_submitted",
      fictional: false,
      reviewedAt: null,
      reviewNotes: null,
      reviewStatus: "draft",
      isActive: false,
      isPublic: false
    });
  });

  it("maps database review metadata into the app model", () => {
    const passage = supabasePassageRowToLibraryPassage({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Reviewed passage",
      category: "Articles",
      style: "General",
      language: "english",
      content: "This reviewed passage is ready for public typing practice.",
      is_active: true,
      is_public: true,
      risk_classification: "A",
      source_type: "licensed",
      fictional: true,
      reviewed_at: "2026-08-22T10:00:00.000Z",
      review_notes: "Licence and content checked.",
      review_status: "approved",
      created_at: "2026-08-22T09:00:00.000Z",
      updated_at: "2026-08-22T10:00:00.000Z",
      created_by: "admin-1"
    });

    expect(passage).toMatchObject({
      riskClassification: "A",
      sourceType: "licensed",
      fictional: true,
      reviewedAt: "2026-08-22T10:00:00.000Z",
      reviewNotes: "Licence and content checked.",
      reviewStatus: "approved",
      isActive: true,
      isPublic: true
    });
  });

  it("forces inserts through the draft/private defaults", () => {
    const passage = makeReviewedPassage();

    expect(libraryPassageToSupabaseInsert(passage, "admin-1")).toMatchObject({
      risk_classification: null,
      source_type: "licensed",
      fictional: true,
      reviewed_at: null,
      review_notes: "Licence and content checked.",
      review_status: "draft",
      is_active: false,
      is_public: false,
      created_by: "admin-1"
    });
  });

  it("maps editable metadata without letting an ordinary save publish or approve", () => {
    const payload = libraryPassageToSupabaseUpdate(makeReviewedPassage());

    expect(payload).toMatchObject({
      risk_classification: "A",
      source_type: "licensed",
      fictional: true,
      review_notes: "Licence and content checked."
    });
    expect(payload).not.toHaveProperty("review_status");
    expect(payload).not.toHaveProperty("reviewed_at");
    expect(payload).not.toHaveProperty("is_active");
    expect(payload).not.toHaveProperty("is_public");
  });
});

describe("passage review actions", () => {
  it("submits the complete edited draft for review while forcing it private", async () => {
    const submit = (passageStorage as unknown as {
      submitSupabasePassageForReview?: (
        id: string,
        passage: LibraryPassage,
        client: unknown
      ) => Promise<LibraryPassage>;
    }).submitSupabasePassageForReview;
    expect(typeof submit).toBe("function");
    if (!submit) return;
    expect(submit.length).toBe(2);
    if (submit.length < 2) return;

    const { client, update } = makeUpdateClient(makeReviewedRow({
      review_status: "pending_review",
      reviewed_at: null,
      is_active: false,
      is_public: false
    }));
    const passage = { ...makeReviewedPassage(), title: "Edited before submit", reviewNotes: "Ready for review." };
    await submit("passage-1", passage, client);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      title: "Edited before submit",
      content: passage.content,
      risk_classification: "A",
      source_type: "licensed",
      fictional: true,
      review_notes: "Ready for review.",
      review_status: "pending_review",
      reviewed_at: null,
      is_active: false,
      is_public: false
    }));
  });

  it("approves risk A in one atomic update and rejects any other classification", async () => {
    const approve = (passageStorage as unknown as {
      approveSupabasePassage?: (id: string, passage: LibraryPassage, client: unknown) => Promise<LibraryPassage>;
    }).approveSupabasePassage;
    expect(typeof approve).toBe("function");
    if (!approve) return;

    const passage = makeReviewedPassage();
    const { client, update } = makeUpdateClient(makeReviewedRow());
    await approve("passage-1", passage, client);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      title: passage.title,
      content: passage.content,
      risk_classification: "A",
      source_type: "licensed",
      fictional: true,
      review_notes: "Licence and content checked.",
      review_status: "approved",
      reviewed_at: expect.any(String),
      is_active: true,
      is_public: true
    }));

    await expect(approve("passage-1", { ...passage, riskClassification: "B" }, client)).rejects.toThrow(
      "Risk classification A"
    );
  });

  it("rejects the complete edited draft while forcing it private", async () => {
    const reject = (passageStorage as unknown as {
      rejectSupabasePassage?: (
        id: string,
        passage: LibraryPassage,
        client: unknown
      ) => Promise<LibraryPassage>;
    }).rejectSupabasePassage;
    expect(typeof reject).toBe("function");
    if (!reject) return;
    expect(reject.length).toBe(2);
    if (reject.length < 2) return;

    const { client, update } = makeUpdateClient(makeReviewedRow({
      review_status: "rejected",
      reviewed_at: null,
      is_active: false,
      is_public: false
    }));
    const passage = { ...makeReviewedPassage(), title: "Edited before reject", reviewNotes: "Reject reason." };
    await reject("passage-1", passage, client);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      title: "Edited before reject",
      content: passage.content,
      risk_classification: "A",
      source_type: "licensed",
      fictional: true,
      review_notes: "Reject reason.",
      review_status: "rejected",
      reviewed_at: null,
      is_active: false,
      is_public: false
    }));
  });

  it.each(["B", "C", null] as const)(
    "turns an approved risk-A Supabase row into pending review when risk changes to %s",
    async (riskClassification) => {
      const passage = { ...makeReviewedPassage(), riskClassification };
      const { client, update } = makeUpdateClient(makeReviewedRow({
        risk_classification: riskClassification,
        review_status: "pending_review",
        reviewed_at: null,
        is_active: false,
        is_public: false
      }));

      await passageStorage.updateSupabasePassage("passage-1", passage, client);

      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        risk_classification: riskClassification,
        review_status: "pending_review",
        reviewed_at: null,
        is_active: false,
        is_public: false
      }));
    }
  );
});

describe("passage review truth table", () => {
  it("treats every risk/status/timestamp combination as a total boolean", () => {
    const isValid = (passageStorage as unknown as {
      isPassageApprovalValid?: (value: {
        riskClassification: "A" | "B" | "C" | null;
        reviewStatus: "draft" | "pending_review" | "approved" | "rejected";
        reviewedAt: string | null;
      }) => boolean;
    }).isPassageApprovalValid;
    expect(typeof isValid).toBe("function");
    if (!isValid) return;

    const risks = ["A", "B", "C", null] as const;
    const statuses = ["draft", "pending_review", "approved", "rejected"] as const;
    const timestamps = ["2026-08-22T10:00:00.000Z", null] as const;

    for (const riskClassification of risks) {
      for (const reviewStatus of statuses) {
        for (const reviewedAt of timestamps) {
          const result = isValid({ riskClassification, reviewStatus, reviewedAt });
          expect(typeof result).toBe("boolean");
          expect(result).toBe(
            riskClassification === "A" && reviewStatus === "approved" && reviewedAt !== null
          );
        }
      }
    }
  });

  it.each(["", "   ", "not-a-timestamp", "2026-99-99T25:61:00Z"])(
    "rejects an unparseable approval timestamp %j",
    (reviewedAt) => {
      expect(passageStorage.isPassageApprovalValid({
        riskClassification: "A",
        reviewStatus: "approved",
        reviewedAt
      })).toBe(false);
    }
  );

  it("forces every invalid active/public combination private", () => {
    const risks = ["A", "B", "C", null] as const;
    const statuses = ["draft", "pending_review", "approved", "rejected"] as const;
    const timestamps = ["2026-08-22T10:00:00.000Z", null] as const;
    const flags = [false, true] as const;

    for (const riskClassification of risks) {
      for (const reviewStatus of statuses) {
        for (const reviewedAt of timestamps) {
          for (const isActive of flags) {
            for (const isPublic of flags) {
              const result = sanitizePassagePublication({
                riskClassification,
                reviewStatus,
                reviewedAt,
                isActive,
                isPublic
              });
              const approvalIsValid =
                riskClassification === "A" && reviewStatus === "approved" && reviewedAt !== null;

              expect(result).toMatchObject(
                !approvalIsValid && (isActive || isPublic)
                  ? { isActive: false, isPublic: false }
                  : approvalIsValid && isPublic && !isActive
                    ? { isActive: false, isPublic: false }
                    : { isActive, isPublic }
              );
            }
          }
        }
      }
    }
  });

  it("resets an ordinary approved material edit but permits one atomic edit-and-approve", () => {
    const current = makeReviewedPassage();
    const ordinaryEdit = applyPassageReviewUpdate(current, {
      ...current,
      title: "Materially edited title"
    });

    expect(ordinaryEdit).toMatchObject({
      title: "Materially edited title",
      reviewStatus: "pending_review",
      reviewedAt: null,
      isActive: false,
      isPublic: false
    });

    const atomicApproval = applyPassageReviewUpdate(current, {
      ...current,
      title: "Atomically approved edited title",
      reviewedAt: "2026-08-22T11:00:00.000Z",
      reviewStatus: "approved",
      isActive: true,
      isPublic: true
    });

    expect(atomicApproval).toMatchObject({
      title: "Atomically approved edited title",
      riskClassification: "A",
      reviewStatus: "approved",
      reviewedAt: "2026-08-22T11:00:00.000Z",
      isActive: true,
      isPublic: true
    });
  });
});

describe("passage review database gate", () => {
  it("adds safe defaults, review checks, and a publication gate without rewriting legacy rows", () => {
    expect(existsSync(migrationPath), `${migrationName} must exist`).toBe(true);
    const sql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

    expect(sql).toContain("add column if not exists risk_classification text");
    expect(sql).toContain("add column if not exists source_type text not null default 'original'");
    expect(sql).toContain("add column if not exists fictional boolean not null default false");
    expect(sql).toContain("add column if not exists reviewed_at timestamptz");
    expect(sql).toContain("add column if not exists review_notes text");
    expect(sql).toContain("add column if not exists review_status text not null default 'draft'");
    expect(sql).toContain("alter column is_active set default false");
    expect(sql).toContain("alter column is_public set default false");
    expect(sql).toContain("passages_publication_requires_approval");
    expect(sql).toContain("not valid");
    expect(sql).not.toContain("update public.passages set is_active = false");
  });

  it("resets approved material edits unless the same update explicitly re-approves", () => {
    const sql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

    expect(sql).toContain("old.review_status = 'approved'");
    expect(sql).toContain("new.title is distinct from old.title");
    expect(sql).toContain("new.content is distinct from old.content");
    expect(sql).toContain("new.language is distinct from old.language");
    expect(sql).toContain("new.category is distinct from old.category");
    expect(sql).toContain("new.style is distinct from old.style");
    expect(sql).toContain("new.source_type is distinct from old.source_type");
    expect(sql).toContain("new.review_status := 'pending_review'");
    expect(sql).toContain("new.reviewed_at := null");
    expect(sql).toContain("new.is_active := false");
    expect(sql).toContain("new.is_public := false");
    expect(sql).toContain("new.review_status = 'approved'");
    expect(sql).toContain("coalesce(new.risk_classification = 'A', false)");
    expect(sql).toContain("new.reviewed_at is not null");
    expect(sql).toContain("explicit_approval is not true");
    expect(sql).toContain("explicit_rejection is not true");
    expect(sql).toContain("new.risk_classification is distinct from 'A'");
  });

  it("makes nullable approval and publication constraints reject SQL unknown", () => {
    const sql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

    expect(sql).toContain("coalesce(risk_classification = 'A', false)");
    expect(sql).toContain("coalesce(new.risk_classification = 'A', false)");
    expect(sql).not.toMatch(/or \(risk_classification = 'A'/);
    expect(sql).not.toMatch(/not \(\s*new\.risk_classification = 'A'/);
  });
});

describe("passage review admin controls", () => {
  it("exposes lightweight review fields and explicit workflow actions", () => {
    const source = readFileSync(join(process.cwd(), "pages", "passages", "manage.tsx"), "utf8");

    for (const label of [
      "Risk classification",
      "Source type",
      "Fictional",
      "Review notes",
      "Review status",
      "Submit for review",
      "Approve",
      "Reject"
    ]) {
      expect(source).toContain(label);
    }
    expect(source).toContain("submitSupabasePassageForReview");
    expect(source).toContain("approveSupabasePassage");
    expect(source).toContain("rejectSupabasePassage");
  });

  it("keeps the live Supabase verification script aligned with the review gate", () => {
    const source = readFileSync(join(process.cwd(), "scripts", "testSupabasePassages.ts"), "utf8");

    expect(source).toContain('import type { SupabasePassageInsert, SupabasePassageRow, SupabasePassageUpdate }');
    expect(source).toContain("Invalid activation with null risk was accepted");
    expect(source).toContain("review_status: \"approved\"");
    expect(source).toContain("risk_classification: \"A\"");
    expect(source).toContain("Material edit did not reset approval");
    expect(source).toContain("Risk downgrade did not reset approval");
    expect(source).toContain("Submitted draft fields were not persisted");
    expect(source).toContain("Rejected approved draft fields were not persisted");
    expect(source).toContain("review_notes was directly selectable");
    expect(source).toContain('rpc("get_admin_passages")');
  });
});

function makeReviewedPassage(): LibraryPassage {
  return {
    id: "passage-1",
    title: "Reviewed passage",
    category: "Articles",
    style: "General",
    language: "english",
    content: "This reviewed passage is ready for public typing practice.",
    source: "uploaded",
    createdAt: "2026-08-22T09:00:00.000Z",
    updatedAt: "2026-08-22T10:00:00.000Z",
    wordCount: 9,
    characterCount: 57,
    riskClassification: "A",
    sourceType: "licensed",
    fictional: true,
    reviewedAt: "2026-08-22T10:00:00.000Z",
    reviewNotes: "Licence and content checked.",
    reviewStatus: "approved",
    isActive: true,
    isPublic: true
  };
}

function makeReviewedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "passage-1",
    title: "Reviewed passage",
    category: "Articles",
    style: "General",
    language: "english",
    content: "This reviewed passage is ready for public typing practice.",
    is_active: true,
    is_public: true,
    risk_classification: "A",
    source_type: "licensed",
    fictional: true,
    reviewed_at: "2026-08-22T10:00:00.000Z",
    review_notes: "Licence and content checked.",
    review_status: "approved",
    created_at: "2026-08-22T09:00:00.000Z",
    updated_at: "2026-08-22T10:00:00.000Z",
    created_by: "admin-1",
    ...overrides
  };
}

function makeUpdateClient(row: ReturnType<typeof makeReviewedRow>) {
  const single = vi.fn().mockResolvedValue({ data: { id: row.id }, error: null });
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const rpc = vi.fn(() => ({ maybeSingle }));
  return { client: { from: vi.fn(() => ({ update })), rpc }, update };
}
