import Head from "next/head";
import React from "react";
import { PublicSiteHeader, ReturnToPracticeLink, SITE_FRAME_CLASS, SiteFooter } from "@/components/SiteChrome";

export function LegalLayout({ title, summary, children }: React.PropsWithChildren<{ title: string; summary: string }>) {
  return <>
    <Head><title>{`${title} — Typing Station`}</title><meta name="description" content={summary} /></Head>
    <main className="min-h-screen bg-ink-950 px-5 py-5 text-paper md:px-8">
      <div className={SITE_FRAME_CLASS}>
        <PublicSiteHeader><ReturnToPracticeLink /></PublicSiteHeader>
        <article className="legal-document mx-auto max-w-4xl py-12 md:py-16"><p className="font-mono text-xs uppercase tracking-[0.22em] text-brass">Legal & trust</p><h1 className="mt-4 text-page font-semibold tracking-tight">{title}</h1><p className="mt-5 max-w-2xl text-base leading-7 text-paper/55">{summary}</p><p className="mt-3 font-mono text-xs text-paper/30">Effective 12 July 2026 · Beta version</p><div className="mt-12 space-y-10">{children}</div></article>
        <SiteFooter />
      </div>
    </main>
  </>;
}

export function LegalSection({ title, children }: React.PropsWithChildren<{ title: string }>) { return <section><h2 className="font-mono text-section uppercase tracking-wide text-brass">{title}</h2><div className="mt-3 space-y-3 text-sm leading-7 text-paper/58">{children}</div></section>; }
