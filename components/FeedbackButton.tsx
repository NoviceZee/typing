import Link from "next/link";
import React from "react";

export function FeedbackButton() {
  return (
    <Link
      href="/feedback"
      className="transition hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/70"
    >
      Feedback
    </Link>
  );
}
