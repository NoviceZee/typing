import React from "react";

const FEEDBACK_EMAIL_URL = "mailto:feedback@typingstation.app";

function openFeedbackEmail(event: React.MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  window.open(FEEDBACK_EMAIL_URL, "_blank", "noopener,noreferrer");
}

export function FeedbackButton() {
  return (
    <a
      href={FEEDBACK_EMAIL_URL}
      target="_blank"
      rel="noreferrer"
      onClick={openFeedbackEmail}
      className="transition hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/70"
    >
      Feedback
    </a>
  );
}
