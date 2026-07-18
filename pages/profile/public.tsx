import React from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function PublicProfilePage() {
  return (
    <AppShell sideAd={false}>
      <section className="mx-auto max-w-3xl rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
        <p className="font-mono text-utility uppercase text-brass">Profile</p>
        <h1 className="mt-2 text-page font-semibold text-paper">Public profile moved</h1>
        <p className="mt-4 text-body leading-6 text-paper/55">
          Public profile controls now live in the Profile Identity card on your main profile page.
        </p>
        <Link
          href="/profile"
          className="mt-5 inline-flex items-center rounded-md border border-brass/40 bg-brass/10 px-4 py-2 font-mono text-control text-brass transition hover:border-brass hover:bg-brass/15"
        >
          Go to Profile Identity
        </Link>
      </section>
    </AppShell>
  );
}
