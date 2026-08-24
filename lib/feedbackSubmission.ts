export const FEEDBACK_CATEGORIES = ["Bug", "Suggestion", "Content", "Other"] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export interface FeedbackSubmission {
  category: FeedbackCategory;
  message: string;
  replyEmail: string | null;
}

type ValidationFailureReason = "body" | "category" | "message" | "replyEmail" | "honeypot";

export type FeedbackValidationResult =
  | { ok: true; submission: FeedbackSubmission }
  | { ok: false; reason: ValidationFailureReason };

export interface FeedbackEmailPayload {
  from: string;
  to: string[];
  subject: string;
  text: string;
  replyTo?: string;
}

export interface FeedbackRateLimiter {
  attempt(identifier: string, nowMs: number):
    | { allowed: true }
    | { allowed: false; retryAfterSeconds: number };
}

const MESSAGE_MAX_LENGTH = 5_000;
const EMAIL_MAX_LENGTH = 254;
const REPLY_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateFeedbackSubmission(body: unknown): FeedbackValidationResult {
  if (!isRecord(body)) return { ok: false, reason: "body" };

  if (typeof body.website !== "string" || body.website.trim()) {
    return { ok: false, reason: "honeypot" };
  }

  if (typeof body.category !== "string" || !isFeedbackCategory(body.category)) {
    return { ok: false, reason: "category" };
  }

  if (typeof body.message !== "string") return { ok: false, reason: "message" };
  const message = body.message.trim();
  if (!message || message.length > MESSAGE_MAX_LENGTH) {
    return { ok: false, reason: "message" };
  }

  if (typeof body.replyEmail !== "string") return { ok: false, reason: "replyEmail" };
  const replyEmail = body.replyEmail.trim();
  if (replyEmail && (replyEmail.length > EMAIL_MAX_LENGTH || !REPLY_EMAIL_PATTERN.test(replyEmail))) {
    return { ok: false, reason: "replyEmail" };
  }

  return {
    ok: true,
    submission: {
      category: body.category,
      message,
      replyEmail: replyEmail || null
    }
  };
}

export function buildFeedbackEmail(
  submission: FeedbackSubmission,
  submittedAt: Date
): FeedbackEmailPayload {
  const replyEmail = submission.replyEmail ?? "Not provided";
  const payload: FeedbackEmailPayload = {
    from: "Typing Station <noreply@typingstation.app>",
    to: ["feedback@typingstation.app"],
    subject: `[Typing Station feedback] ${submission.category}`,
    text: [
      `Category: ${submission.category}`,
      `Submitted at: ${submittedAt.toISOString()}`,
      `Reply email: ${replyEmail}`,
      "",
      "Message:",
      submission.message
    ].join("\n")
  };

  if (submission.replyEmail) payload.replyTo = submission.replyEmail;
  return payload;
}

export function createBestEffortInMemoryRateLimiter({
  maxAttempts,
  windowMs
}: {
  maxAttempts: number;
  windowMs: number;
}): FeedbackRateLimiter {
  // Process-local by design: this is best-effort abuse friction for a
  // serverless function, not persistent or globally coordinated state.
  const buckets = new Map<string, { attempts: number; resetAt: number }>();

  return {
    attempt(identifier, nowMs) {
      const current = buckets.get(identifier);
      if (!current || nowMs >= current.resetAt) {
        buckets.set(identifier, { attempts: 1, resetAt: nowMs + windowMs });
        return { allowed: true };
      }

      if (current.attempts >= maxAttempts) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - nowMs) / 1_000))
        };
      }

      current.attempts += 1;
      return { allowed: true };
    }
  };
}

function isFeedbackCategory(value: string): value is FeedbackCategory {
  return FEEDBACK_CATEGORIES.some((category) => category === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
