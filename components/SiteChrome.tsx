import Link from "next/link";
import React, { ReactNode } from "react";
import { FeedbackButton } from "@/components/FeedbackButton";

export const SITE_FRAME_CLASS = "mx-auto w-full max-w-7xl";
export const SITE_PAGE_GUTTERS_CLASS = "px-5 md:px-8";

export function SiteBrand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link
      href={href}
      className={`${compact ? "text-wordmark-compact tracking-[0.16em]" : "text-wordmark tracking-[0.18em]"} shrink-0 font-mono font-semibold text-paper`}
    >
      Typing Station
    </Link>
  );
}

export function PublicSiteHeader({ children }: { children: ReactNode }) {
  return <header className="border-b border-paper/10 pb-4"><div className="flex h-10 items-center justify-between gap-3"><SiteBrand />{children}</div></header>;
}

export function ReturnToPracticeLink() {
  return <Link href="/practice" className="font-mono text-xs text-paper/45 transition hover:text-brass">Return to practice</Link>;
}

export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`flex flex-wrap items-center justify-between gap-4 border-t border-paper/10 py-6 font-mono text-secondary text-paper/30 ${className}`.trim()}>
      <span>© {new Date().getFullYear()} Typing Station</span>
      <div aria-label="Footer links" className="flex flex-wrap gap-5">
        <Link href="/terms" className="transition hover:text-paper">Terms</Link>
        <Link href="/faq" className="transition hover:text-paper">FAQ</Link>
        <FeedbackButton />
        <Link href="/privacy" className="transition hover:text-paper">Privacy</Link>
        <Link href="/security" className="transition hover:text-paper">Security</Link>
      </div>
    </footer>
  );
}
