import React from "react";
import { AppShell } from "@/components/AppShell";

export default function FriendsPage() {
  return (
    <AppShell sideAd={false}>
      <section className="mx-auto max-w-3xl rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
        <p className="font-mono text-xs uppercase text-brass">Profile</p>
        <h1 className="mt-2 text-3xl font-semibold text-paper">Friends</h1>
        <p className="mt-4 text-sm leading-6 text-paper/55">Friends leaderboard will be available later.</p>
      </section>
    </AppShell>
  );
}
