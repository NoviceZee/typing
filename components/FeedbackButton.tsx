import { MessageSquareText } from "lucide-react";

export function FeedbackButton() {
  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL;
  const href = feedbackUrl || "mailto:feedback@formaltype.app?subject=FormalType%20beta%20feedback";
  return <a href={href} target={feedbackUrl ? "_blank" : undefined} rel={feedbackUrl ? "noreferrer" : undefined} className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-paper/15 bg-ink-900/95 px-4 py-2.5 font-mono text-xs text-paper/65 shadow-xl backdrop-blur transition hover:-translate-y-0.5 hover:border-brass/45 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60"><MessageSquareText className="h-4 w-4 text-brass" /><span className="hidden sm:inline">Beta feedback</span></a>;
}
