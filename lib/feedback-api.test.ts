import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const validBody = {
  category: "Bug",
  message: "The timer stopped after switching passages.",
  replyEmail: "typist@example.com",
  website: ""
};

async function loadSubmissionModule() {
  const moduleUrl = new URL("./feedbackSubmission.ts", import.meta.url).href;
  return import(/* @vite-ignore */ moduleUrl);
}

async function loadApiModule() {
  const moduleUrl = new URL("../pages/api/feedback.ts", import.meta.url).href;
  return import(/* @vite-ignore */ moduleUrl);
}

function createResponse() {
  const result: {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
  } = { statusCode: 200, body: null, headers: {} };

  const response = {
    status(code: number) {
      result.statusCode = code;
      return response;
    },
    json(body: unknown) {
      result.body = body;
      return response;
    },
    setHeader(name: string, value: string | number) {
      result.headers[name] = String(value);
      return response;
    }
  };

  return { response, result };
}

function createRequest(body: unknown = validBody, ip = "203.0.113.10") {
  return {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip
    },
    socket: { remoteAddress: ip }
  };
}

describe("feedback submission validation", () => {
  it("rejects a missing or blank message", async () => {
    const { validateFeedbackSubmission } = await loadSubmissionModule();

    expect(validateFeedbackSubmission({ ...validBody, message: "  " })).toEqual({
      ok: false,
      reason: "message"
    });
  });

  it("rejects an invalid optional reply email", async () => {
    const { validateFeedbackSubmission } = await loadSubmissionModule();

    expect(validateFeedbackSubmission({ ...validBody, replyEmail: "not-an-email" })).toEqual({
      ok: false,
      reason: "replyEmail"
    });
  });

  it("rejects a populated honeypot", async () => {
    const { validateFeedbackSubmission } = await loadSubmissionModule();

    expect(validateFeedbackSubmission({ ...validBody, website: "https://spam.example" })).toEqual({
      ok: false,
      reason: "honeypot"
    });
  });
});

describe("best-effort feedback rate limiter", () => {
  it("allows five attempts in ten minutes, then resets without persistence", async () => {
    const { createBestEffortInMemoryRateLimiter } = await loadSubmissionModule();
    const limiter = createBestEffortInMemoryRateLimiter({ maxAttempts: 5, windowMs: 600_000 });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(limiter.attempt("203.0.113.10", 1_000)).toEqual({ allowed: true });
    }
    expect(limiter.attempt("203.0.113.10", 1_000)).toEqual({
      allowed: false,
      retryAfterSeconds: 600
    });
    expect(limiter.attempt("203.0.113.10", 601_000)).toEqual({ allowed: true });

    const separateProcessState = createBestEffortInMemoryRateLimiter({ maxAttempts: 5, windowMs: 600_000 });
    expect(separateProcessState.attempt("203.0.113.10", 1_000)).toEqual({ allowed: true });
  });
});

describe("feedback API", () => {
  it("delivers a valid submission with the expected plain-text fields and Reply-To", async () => {
    const { createFeedbackHandler } = await loadApiModule();
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const handler = createFeedbackHandler({
      sendEmail,
      now: () => new Date("2026-08-24T14:30:00.000Z")
    });
    const { response, result } = createResponse();

    await handler(createRequest() as never, response as never);

    expect(result).toEqual({ statusCode: 200, body: { ok: true }, headers: { "Cache-Control": "no-store" } });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const payload = sendEmail.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({
      from: "Typing Station <noreply@typingstation.app>",
      to: ["feedback@typingstation.app"],
      subject: "[Typing Station feedback] Bug",
      replyTo: "typist@example.com"
    }));
    expect(payload.text).toContain("Category: Bug");
    expect(payload.text).toContain("Submitted at: 2026-08-24T14:30:00.000Z");
    expect(payload.text).toContain("Reply email: typist@example.com");
    expect(payload.text).toContain(validBody.message);
    expect(payload.text).not.toContain("203.0.113.10");
    expect(payload).not.toHaveProperty("ip");
    expect(payload).not.toHaveProperty("userAgent");
  });

  it("omits Reply-To when no reply email is supplied", async () => {
    const { createFeedbackHandler } = await loadApiModule();
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const handler = createFeedbackHandler({ sendEmail });
    const { response } = createResponse();

    await handler(createRequest({ ...validBody, replyEmail: "" }) as never, response as never);

    expect(sendEmail.mock.calls[0][0]).not.toHaveProperty("replyTo");
    expect(sendEmail.mock.calls[0][0].text).toContain("Reply email: Not provided");
  });

  it("rejects invalid input and honeypots without sending email", async () => {
    const { createFeedbackHandler } = await loadApiModule();
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const handler = createFeedbackHandler({ sendEmail });

    for (const body of [
      { ...validBody, message: "" },
      { ...validBody, replyEmail: "bad-address" },
      { ...validBody, website: "spam" }
    ]) {
      const { response, result } = createResponse();
      await handler(createRequest(body) as never, response as never);
      expect(result.statusCode).toBe(400);
    }

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rate limits the sixth valid attempt without sending it", async () => {
    const { createFeedbackHandler } = await loadApiModule();
    const { createBestEffortInMemoryRateLimiter } = await loadSubmissionModule();
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const handler = createFeedbackHandler({
      sendEmail,
      limiter: createBestEffortInMemoryRateLimiter({ maxAttempts: 5, windowMs: 600_000 }),
      now: () => new Date("2026-08-24T14:30:00.000Z")
    });

    let finalResult: ReturnType<typeof createResponse>["result"] | null = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { response, result } = createResponse();
      await handler(createRequest() as never, response as never);
      finalResult = result;
    }

    expect(sendEmail).toHaveBeenCalledTimes(5);
    expect(finalResult).toEqual({
      statusCode: 429,
      body: { error: "Too many feedback submissions. Please wait before trying again." },
      headers: { "Cache-Control": "no-store", "Retry-After": "600" }
    });
  });

  it("returns a generic failure when Resend delivery fails", async () => {
    const { createFeedbackHandler } = await loadApiModule();
    const handler = createFeedbackHandler({
      sendEmail: vi.fn().mockRejectedValue(new Error("Resend unavailable"))
    });
    const { response, result } = createResponse();

    await handler(createRequest() as never, response as never);

    expect(result).toEqual({
      statusCode: 502,
      body: { error: "Feedback could not be sent. Please try again or use the email address below." },
      headers: { "Cache-Control": "no-store" }
    });
  });

  it("keeps the Resend API key in server-only configuration", () => {
    const root = path.resolve(__dirname, "..");
    const pageSource = fs.readFileSync(path.join(root, "pages", "feedback.tsx"), "utf8");
    const apiSource = fs.readFileSync(path.join(root, "pages", "api", "feedback.ts"), "utf8");
    const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");

    expect(pageSource).not.toContain("RESEND_API_KEY");
    expect(pageSource).not.toContain("NEXT_PUBLIC_RESEND");
    expect(apiSource).toContain("process.env.RESEND_API_KEY");
    expect(envExample).toContain("RESEND_API_KEY=");
    expect(envExample).not.toContain("NEXT_PUBLIC_RESEND");
  });
});
