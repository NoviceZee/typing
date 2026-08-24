import type { LibraryPassage, PassageReviewStatus, PassageRiskClassification } from "./app-storage";

export type PassageApprovalState = {
  riskClassification: PassageRiskClassification;
  reviewStatus: PassageReviewStatus;
  reviewedAt: string | null;
};

export function isPassageApprovalValid(value: PassageApprovalState): boolean {
  const reviewedAt = value.reviewedAt;
  return (
    value.riskClassification === "A" &&
    value.reviewStatus === "approved" &&
    typeof reviewedAt === "string" &&
    reviewedAt.trim().length > 0 &&
    Number.isFinite(Date.parse(reviewedAt))
  );
}

export function sanitizePassagePublication<T extends PassageApprovalState & { isActive: boolean; isPublic: boolean }>(
  passage: T
): T {
  if ((passage.isActive || passage.isPublic) && !isPassageApprovalValid(passage)) {
    return { ...passage, isActive: false, isPublic: false };
  }
  if (passage.isPublic && !passage.isActive) {
    return { ...passage, isPublic: false };
  }
  return passage;
}

export function applyPassageReviewUpdate(current: LibraryPassage, requested: LibraryPassage): LibraryPassage {
  const materialEdit =
    requested.title !== current.title ||
    requested.content !== current.content ||
    requested.language !== current.language ||
    requested.category !== current.category ||
    requested.style !== current.style ||
    requested.sourceType !== current.sourceType;
  const riskAInvalidated =
    current.reviewStatus === "approved" &&
    current.riskClassification === "A" &&
    requested.riskClassification !== "A";
  const explicitApproval =
    isPassageApprovalValid(requested) &&
    requested.reviewedAt !== current.reviewedAt &&
    requested.isActive &&
    requested.isPublic;
  const explicitRejection =
    requested.reviewStatus === "rejected" &&
    requested.reviewedAt === null &&
    !requested.isActive &&
    !requested.isPublic;

  let next = requested;
  if (
    current.reviewStatus === "approved" &&
    (materialEdit || riskAInvalidated) &&
    !explicitApproval &&
    !explicitRejection
  ) {
    next = {
      ...next,
      reviewStatus: "pending_review",
      reviewedAt: null,
      isActive: false,
      isPublic: false
    };
  }

  if (next.reviewStatus === "approved" && !isPassageApprovalValid(next)) {
    next = {
      ...next,
      reviewStatus: "pending_review",
      reviewedAt: null,
      isActive: false,
      isPublic: false
    };
  }

  return sanitizePassagePublication(next);
}
