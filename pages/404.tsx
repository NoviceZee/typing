import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function NotFoundPage() {
  return (
    <AppShell sideAd={false} topAd={false}>
      <section className="mx-auto max-w-xl py-12 text-center md:py-20">
        <p className="font-mono text-utility uppercase tracking-[0.2em] text-brass">404</p>
        <h1 className="mt-3 text-page font-semibold text-paper">Page not found</h1>
        <p className="mx-auto mt-4 max-w-md text-body leading-6 text-paper/55">
          The address may have changed, or the page may no longer exist.
        </p>
        <Link href="/practice" className="mt-7 inline-flex rounded-md border border-brass/35 bg-brass/10 px-4 py-2.5 font-mono text-control text-brass transition hover:bg-brass/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/70">
          Return to practice
        </Link>
      </section>
    </AppShell>
  );
}
