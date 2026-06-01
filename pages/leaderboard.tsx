import { AppShell } from "@/components/AppShell";

export default function LeaderboardPage() {
  return (
    <AppShell>
      <section className="mx-auto max-w-3xl rounded-lg border border-paper/10 bg-ink-950/75 p-6 shadow-glow">
        <p className="font-mono text-xs uppercase text-brass">Leaderboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-paper md:text-4xl">Rankings</h1>
        <p className="mt-5 font-mono text-sm leading-6 text-paper/55">
          Leaderboards will appear here once authentication and saved results are added.
        </p>
      </section>
    </AppShell>
  );
}
