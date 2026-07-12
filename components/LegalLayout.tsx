import Head from "next/head";
import Link from "next/link";
import React from "react";

export function LegalLayout({ title, summary, children }: React.PropsWithChildren<{ title: string; summary: string }>) {
  return <>
    <Head><title>{title} — FormalType</title><meta name="description" content={summary} /></Head>
    <main className="min-h-screen bg-ink-950 px-5 py-6 text-paper md:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between border-b border-paper/10 pb-5"><Link href="/" className="font-mono text-lg font-semibold tracking-[0.18em]">FormalType</Link><Link href="/practice" className="font-mono text-xs text-paper/45 transition hover:text-brass">Return to practice</Link></header>
        <article className="legal-document py-12 md:py-16"><p className="font-mono text-xs uppercase tracking-[0.22em] text-brass">Legal & trust</p><h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1><p className="mt-5 max-w-2xl text-base leading-7 text-paper/55">{summary}</p><p className="mt-3 font-mono text-xs text-paper/30">Effective 12 July 2026 · Beta version</p><div className="mt-12 space-y-10">{children}</div></article>
        <footer className="flex flex-wrap gap-5 border-t border-paper/10 py-6 font-mono text-xs text-paper/35"><Link href="/terms" className="hover:text-paper">Terms</Link><Link href="/privacy" className="hover:text-paper">Privacy</Link><Link href="/security" className="hover:text-paper">Security</Link></footer>
      </div>
    </main>
  </>;
}

export function LegalSection({ title, children }: React.PropsWithChildren<{ title: string }>) { return <section><h2 className="font-mono text-sm uppercase tracking-wide text-brass">{title}</h2><div className="mt-3 space-y-3 text-sm leading-7 text-paper/58">{children}</div></section>; }
