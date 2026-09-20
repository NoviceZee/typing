import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Controls";
import { ResultDashboard } from "../practice";
import {
  RESULT_PAGE_UPDATED_EVENT,
  appendResultReturnQuery,
  readResultPageSnapshot,
  writeResultReturnAction,
  type ResultPageSnapshot,
  type ResultReturnAction
} from "@/lib/resultPageStorage";

export default function ResultPage() {
  const router = useRouter();
  const attemptId = getAttemptId(router.query.attemptId);
  const [snapshot, setSnapshot] = useState<ResultPageSnapshot | null>(() =>
    router.isReady && attemptId ? readResultPageSnapshot(attemptId) : null
  );
  const [hasLoaded, setHasLoaded] = useState(router.isReady);

  useEffect(() => {
    if (!router.isReady) return;
    setSnapshot(attemptId ? readResultPageSnapshot(attemptId) : null);
    setHasLoaded(true);
  }, [attemptId, router.isReady]);

  useEffect(() => {
    if (!attemptId) return;
    const handleUpdate = (event: Event) => {
      if (event instanceof CustomEvent && event.detail !== attemptId) return;
      setSnapshot(readResultPageSnapshot(attemptId));
    };
    window.addEventListener(RESULT_PAGE_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(RESULT_PAGE_UPDATED_EVENT, handleUpdate);
  }, [attemptId]);

  if (!hasLoaded) {
    return (
      <AppShell topAd={false} sideAd={false}>
        <p role="status" className="mx-auto max-w-6xl font-mono text-body text-paper/50">Loading result…</p>
      </AppShell>
    );
  }

  if (!snapshot) {
    return (
      <AppShell topAd={false} sideAd={false}>
        <section className="mx-auto max-w-3xl py-12 text-center">
          <p className="font-mono text-utility uppercase text-brass">Result</p>
          <h1 className="mt-2 text-page font-semibold text-paper">Result unavailable</h1>
          <p className="mt-3 text-body text-paper/55">
            This result is no longer available in this browser tab. Complete another typing session to create a new result.
          </p>
          <Link href="/practice" className="mt-6 inline-flex min-h-11 items-center rounded-md border border-paper/15 px-4 font-mono text-control text-paper/75 transition hover:bg-paper/[0.05] hover:text-paper">
            Back to Practice
          </Link>
        </section>
      </AppShell>
    );
  }

  const continueFlow = (action: ResultReturnAction["action"]) => {
    writeResultReturnAction({ attemptId: snapshot.attemptId, action });
    void router.push(appendResultReturnQuery(snapshot.originHref, snapshot.attemptId, action));
  };

  return (
    <AppShell topAd={false} sideAd={false}>
      <ResultDashboard
        result={snapshot.result}
        passage={snapshot.passage}
        onRestart={() => continueFlow("restart")}
        onNextPassage={() => continueFlow("next")}
        previousResult={snapshot.previousResult}
        recentResults={snapshot.recentResults}
        progressMilestones={snapshot.progressMilestones}
        attemptTimeline={snapshot.attemptTimeline}
        errorEvents={snapshot.errorEvents}
        modeLabel={snapshot.modeLabel}
        isSuspicious={snapshot.isSuspicious}
        cloudSaveState={snapshot.cloudSaveState}
      />
    </AppShell>
  );
}

function getAttemptId(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}
