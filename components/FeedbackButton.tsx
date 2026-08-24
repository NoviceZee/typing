import React from "react";

const FEEDBACK_EMAIL_URL = "mailto:feedback@typingstation.app";

export function FeedbackButton() {
  return (
    <a
      href={FEEDBACK_EMAIL_URL}
      className="transition hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/70"
    >
      Feedback
    </a>
  );
}
