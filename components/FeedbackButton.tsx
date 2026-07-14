import React from "react";

export function FeedbackButton() {
  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL?.trim();
  const href = feedbackUrl || "mailto:feedback@formaltype.app?subject=FormalType%20beta%20feedback";
  return (
    <a
      href={href}
      target={feedbackUrl ? "_blank" : undefined}
      rel={feedbackUrl ? "noreferrer" : undefined}
      className="transition hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/70"
    >
      Feedback
    </a>
  );
}
