import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function ServerErrorPage() {
  return (
    <AppShell sideAd={false} topAd={false}>
      <section className="mx-auto max-w-xl py-12 text-center md:py-20">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember">Server error</p>
        <h1 className="mt-3 text-page font-semibold text-paper">Something went wrong</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-paper/55">
          Your local typing preferences are untouched. Try the page again, or return to practice.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className="rounded-md border border-paper/15 bg-paper/[0.04] px-4 py-2.5 font-mono text-sm text-paper/70 transition hover:border-paper/30 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/70">
            Try again
          </button>
          <Link href="/practice" className="rounded-md border border-brass/35 bg-brass/10 px-4 py-2.5 font-mono text-sm text-brass transition hover:bg-brass/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/70">
            Return to practice
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
