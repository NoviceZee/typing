import { MessageSquareText } from "lucide-react";

export function FeedbackButton() {
  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL;
  const href = feedbackUrl || "mailto:feedback@formaltype.app?subject=FormalType%20beta%20feedback";
  // Keep this in normal document flow. A viewport-fixed control covered the
  // result panel and footer on short screens (especially after time-up), and
  // it also made the control overlap the on-screen keyboard on mobile.
  return <a href={href} target={feedbackUrl ? "_blank" : undefined} rel={feedbackUrl ? "noreferrer" : undefined} className="mx-5 mb-[calc(1rem+env(safe-area-inset-bottom))] ml-auto mt-2 flex w-fit items-center gap-2 rounded-full border border-paper/15 bg-ink-900/95 px-4 py-2.5 font-mono text-xs text-paper/65 shadow-xl backdrop-blur transition hover:border-brass/45 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60 hover:-translate-y-0.5"><MessageSquareText className="h-4 w-4 text-brass" /><span>Beta feedback</span></a>;
}
