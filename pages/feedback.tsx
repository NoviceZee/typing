import { Copy } from "lucide-react";
import React, { useState } from "react";
import { PublicSiteHeader, ReturnToPracticeLink, SITE_FRAME_CLASS, SiteFooter } from "@/components/SiteChrome";

const FEEDBACK_EMAIL = "feedback@typingstation.app";

type CopyStatus = "idle" | "success" | "error";

export default function FeedbackPage() {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

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

        <section aria-labelledby="feedback-heading" className="mx-auto flex min-h-[70vh] max-w-4xl items-center py-14 md:py-20">
          <div className="w-full">
            <p className="font-mono text-utility uppercase tracking-[0.24em] text-brass">Feedback</p>
            <h1 id="feedback-heading" className="mt-5 text-5xl font-semibold leading-[0.95] tracking-[-0.045em] md:text-7xl">
              Send us feedback.
            </h1>
            <p className="mt-7 max-w-2xl text-body leading-7 text-paper/55">
              A built-in feedback form is coming later. For now, copy the address below and email us from your preferred app.
            </p>

            <div className="mt-10 border border-brass/20 bg-brass/[0.045] p-5 md:flex md:items-center md:justify-between md:gap-6 md:p-7">
              <div>
                <p className="font-mono text-utility uppercase tracking-[0.18em] text-paper/35">Feedback email</p>
                <p className="mt-2 select-all break-all font-mono text-body text-paper">{FEEDBACK_EMAIL}</p>
              </div>
              <button
                type="button"
                onClick={copyEmailAddress}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-brass px-4 py-3 font-mono text-control font-semibold uppercase tracking-wide text-ink-950 transition hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/70 md:mt-0"
              >
                <Copy className="icon-control" aria-hidden="true" />
                Copy email address
              </button>
            </div>

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
          </div>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
