import React from "react";

const FALLBACK_FEEDBACK_URL = "https://github.com/NoviceZee/typing/issues/new";

export function FeedbackButton() {
  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL?.trim();
  const href = feedbackUrl || FALLBACK_FEEDBACK_URL;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="transition hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/70"
    >
      Feedback
    </a>
  );
}
