import { Copy, Send } from "lucide-react";
import React, { FormEvent, useRef, useState } from "react";
import { PublicSiteHeader, ReturnToPracticeLink, SITE_FRAME_CLASS, SiteFooter } from "@/components/SiteChrome";

const FEEDBACK_EMAIL = "feedback@typingstation.app";
const FEEDBACK_CATEGORIES = ["Bug", "Suggestion", "Content", "Other"] as const;

type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
type CopyStatus = "idle" | "success" | "error";
type SubmitStatus = { kind: "success" | "error"; message: string } | null;

export default function FeedbackPage() {
  const [category, setCategory] = useState<FeedbackCategory>("Bug");
  const [message, setMessage] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const submissionPendingRef = useRef(false);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionPendingRef.current) return;

    submissionPendingRef.current = true;
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message, replyEmail, website })
      });
      const responseBody = await readResponseBody(response);

      if (!response.ok) {
        throw new Error(responseBody.error || "Feedback could not be sent. Please try again or use the email address below.");
      }

      setCategory("Bug");
      setMessage("");
      setReplyEmail("");
      setWebsite("");
      setSubmitStatus({
        kind: "success",
        message: "Feedback sent. Thank you for helping improve Typing Station."
      });
    } catch (error) {
      setSubmitStatus({
        kind: "error",
        message: error instanceof Error
          ? error.message
          : "Feedback could not be sent. Please try again or use the email address below."
      });
    } finally {
      submissionPendingRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function copyEmailAddress() {
    setCopyStatus("idle");

    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(FEEDBACK_EMAIL);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-ink-950 px-5 py-5 text-paper md:px-8">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute -right-40 -top-52 h-[34rem] w-[34rem] rounded-full border border-brass/10 bg-brass/[0.025]" />
        <div className="absolute -bottom-64 -left-48 h-[38rem] w-[38rem] rounded-full border border-paper/[0.04]" />
      </div>

      <div className={`relative ${SITE_FRAME_CLASS}`}>
        <PublicSiteHeader><ReturnToPracticeLink /></PublicSiteHeader>

        <section aria-labelledby="feedback-heading" className="mx-auto max-w-4xl py-14 md:py-20">
          <p className="font-mono text-utility uppercase tracking-[0.24em] text-brass">Feedback</p>
          <h1 id="feedback-heading" className="mt-5 text-5xl font-semibold leading-[0.95] tracking-[-0.045em] md:text-7xl">
            Send us feedback.
          </h1>
          <p className="mt-7 max-w-2xl text-body leading-7 text-paper/55">
            Report a problem, suggest an improvement, or tell us about typing content that needs attention.
          </p>

          <form onSubmit={submitFeedback} className="mt-10 border border-brass/20 bg-brass/[0.045] p-5 shadow-glow md:p-7">
            <div className="grid gap-6 md:grid-cols-2">
              <label className="block">
                <span className="font-mono text-utility uppercase tracking-[0.16em] text-paper/45">Category</span>
                <select
                  name="category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
                  className="mt-2 w-full rounded-md border border-paper/12 bg-ink-900 px-3 py-3 font-mono text-control text-paper outline-none transition focus:border-brass/60"
                >
                  {FEEDBACK_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="font-mono text-utility uppercase tracking-[0.16em] text-paper/45">Reply email (optional)</span>
                <input
                  type="email"
                  name="replyEmail"
                  value={replyEmail}
                  onChange={(event) => setReplyEmail(event.target.value)}
                  maxLength={254}
                  autoComplete="email"
                  className="mt-2 w-full rounded-md border border-paper/12 bg-ink-900 px-3 py-3 font-mono text-control text-paper outline-none transition placeholder:text-paper/20 focus:border-brass/60"
                  placeholder="you@example.com"
                />
              </label>
            </div>

            <label className="mt-6 block">
              <span className="font-mono text-utility uppercase tracking-[0.16em] text-paper/45">Message</span>
              <textarea
                name="message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                required
                maxLength={5_000}
                rows={8}
                className="mt-2 w-full resize-y rounded-md border border-paper/12 bg-ink-900 px-3 py-3 text-body leading-7 text-paper outline-none transition placeholder:text-paper/20 focus:border-brass/60"
                placeholder="What happened, what did you expect, or what would you like to see?"
              />
            </label>

            <label aria-hidden="true" className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
              Website
              <input
                type="text"
                name="website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                autoComplete="off"
                tabIndex={-1}
              />
            </label>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-brass px-4 py-3 font-mono text-control font-semibold uppercase tracking-wide text-ink-950 transition hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/70 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Send className="icon-control" aria-hidden="true" />
                {isSubmitting ? "Sending…" : "Send feedback"}
              </button>
              <p className="text-body text-paper/40">Your reply email is used only to respond to this message.</p>
            </div>

            {submitStatus?.kind === "success" && (
              <p role="status" aria-live="polite" className="mt-5 rounded-md border border-brass/25 bg-brass/10 px-4 py-3 font-mono text-body text-brass">
                {submitStatus.message}
              </p>
            )}
            {submitStatus?.kind === "error" && (
              <p role="alert" aria-live="assertive" className="mt-5 rounded-md border border-ember/25 bg-ember/10 px-4 py-3 font-mono text-body text-ember">
                {submitStatus.message}
              </p>
            )}
          </form>

          <section aria-labelledby="feedback-fallback-heading" className="mt-8 border border-paper/10 bg-paper/[0.025] p-5 md:flex md:items-center md:justify-between md:gap-6 md:p-7">
            <div>
              <h2 id="feedback-fallback-heading" className="font-mono text-utility uppercase tracking-[0.18em] text-paper/35">Prefer email?</h2>
              <p className="mt-2 select-all break-all font-mono text-body text-paper">{FEEDBACK_EMAIL}</p>
            </div>
            <button
              type="button"
              onClick={copyEmailAddress}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-md border border-brass/35 px-4 py-3 font-mono text-control font-semibold uppercase tracking-wide text-brass transition hover:bg-brass/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/70 md:mt-0"
            >
              <Copy className="icon-control" aria-hidden="true" />
              Copy email address
            </button>
          </section>

          {copyStatus === "success" && (
            <p role="status" aria-live="polite" className="mt-4 font-mono text-body text-brass">
              Email address copied.
            </p>
          )}
          {copyStatus === "error" && (
            <p role="alert" aria-live="assertive" className="mt-4 font-mono text-body text-ember">
              Could not copy the email address. Select and copy it manually.
            </p>
          )}
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}

async function readResponseBody(response: Response): Promise<{ error?: string }> {
  try {
    return await response.json() as { error?: string };
  } catch {
    return {};
  }
}
