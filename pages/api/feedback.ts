import type { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";
import {
  buildFeedbackEmail,
  createBestEffortInMemoryRateLimiter,
  type FeedbackEmailPayload,
  type FeedbackRateLimiter,
  validateFeedbackSubmission
} from "@/lib/feedbackSubmission";

type FeedbackApiResponse = { ok: true } | { error: string };
type SendEmail = (payload: FeedbackEmailPayload) => Promise<void>;

interface FeedbackHandlerDependencies {
  sendEmail?: SendEmail;
  limiter?: FeedbackRateLimiter;
  now?: () => Date;
}

const RATE_LIMIT_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000;

class MissingResendConfigurationError extends Error {}

async function sendEmailWithResend(payload: FeedbackEmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new MissingResendConfigurationError("Feedback email is not configured.");

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send(payload);
  if (error) throw new Error("Feedback email delivery failed.");
}

export function createFeedbackHandler({
  sendEmail = sendEmailWithResend,
  limiter = createBestEffortInMemoryRateLimiter({
    maxAttempts: RATE_LIMIT_ATTEMPTS,
    windowMs: RATE_LIMIT_WINDOW_MS
  }),
  now = () => new Date()
}: FeedbackHandlerDependencies = {}) {
  return async function feedbackHandler(
    request: NextApiRequest,
    response: NextApiResponse<FeedbackApiResponse>
  ) {
    response.setHeader("Cache-Control", "no-store");

    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      return response.status(405).json({ error: "Method not allowed." });
    }

    const contentType = getHeaderValue(request.headers["content-type"]);
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return response.status(415).json({ error: "Feedback must be submitted as JSON." });
    }

    const validation = validateFeedbackSubmission(request.body);
    if (!validation.ok) {
      return response.status(400).json({ error: getValidationMessage(validation.reason) });
    }

    const submittedAt = now();
    const rateLimit = limiter.attempt(getRequestIdentifier(request), submittedAt.getTime());
    if (!rateLimit.allowed) {
      response.setHeader("Retry-After", rateLimit.retryAfterSeconds);
      return response.status(429).json({
        error: "Too many feedback submissions. Please wait before trying again."
      });
    }

    try {
      await sendEmail(buildFeedbackEmail(validation.submission, submittedAt));
      return response.status(200).json({ ok: true });
    } catch (error) {
      if (error instanceof MissingResendConfigurationError) {
        return response.status(503).json({
          error: "Feedback is temporarily unavailable. Please use the email address below."
        });
      }
      return response.status(502).json({
        error: "Feedback could not be sent. Please try again or use the email address below."
      });
    }
  };
}

function getValidationMessage(reason: string): string {
  if (reason === "message") return "Please enter a message of 5,000 characters or fewer.";
  if (reason === "replyEmail") return "Enter a valid reply email address or leave it blank.";
  if (reason === "category") return "Choose a valid feedback category.";
  return "The feedback submission could not be accepted.";
}

function getRequestIdentifier(request: NextApiRequest): string {
  return getHeaderValue(request.headers["x-forwarded-for"])
    .split(",", 1)[0]
    .trim() || request.socket.remoteAddress || "unknown";
}

function getHeaderValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export const config = {
  api: {
    bodyParser: { sizeLimit: "10kb" }
  }
};

export default createFeedbackHandler();
