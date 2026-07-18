"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { AtSign } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { getSupabaseProfile, setSupabaseProfileHandle, validateHandle } from "@/lib/profileStorage";

export default function HandleOnboardingPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, isConfigured } = useAuth();
  const [handle, setHandle] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const redirectTo = useMemo(() => {
    const rawRedirect = Array.isArray(router.query.redirectTo) ? router.query.redirectTo[0] : router.query.redirectTo;
    return rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/practice";
  }, [router.query.redirectTo]);

  useEffect(() => {
    if (isAuthLoading || user) {
      return;
    }

    router.replace(`/login?redirectTo=${encodeURIComponent("/onboarding/handle")}`);
  }, [isAuthLoading, router, user]);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      return;
    }

    getSupabaseProfile(user.id)
      .then((profile) => {
        if (!isMounted) return;

        if (profile?.handle) {
          router.replace(redirectTo);
        }
      })
      .catch((error) => {
        if (!isMounted) return;
        setMessage(error instanceof Error ? error.message : "Profile could not be loaded.");
      });

    return () => {
      isMounted = false;
    };
  }, [redirectTo, router, user]);

  async function saveHandle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setMessage("Log in to set your handle.");
      return;
    }

    const validation = validateHandle(handle);
    if (!validation.isValid) {
      setMessage(validation.message);
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      await setSupabaseProfileHandle(user.id, validation.handle);
      router.replace(redirectTo);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Handle could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell sideAd={false}>
      <section className="mx-auto max-w-xl rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow md:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-brass/25 bg-brass/10 p-2 text-brass">
            <AtSign className="icon-prominent" />
          </div>
          <div>
            <p className="font-mono text-utility uppercase text-brass">Public handle</p>
            <h1 className="mt-2 text-page font-semibold text-paper">Choose your handle</h1>
            <p className="mt-3 text-body leading-6 text-paper/60">
              Your handle is your public identity for leaderboards, future friends, and profile URLs.
            </p>
          </div>
        </div>

        <form onSubmit={saveHandle} className="mt-6 grid gap-4">
          <label className="block" htmlFor="handle">
            <span className="font-mono text-utility uppercase text-paper/45">Handle</span>
            <div className="mt-2 flex rounded-md border border-paper/10 bg-ink-900 focus-within:border-brass/60">
              <span className="grid place-items-center border-r border-paper/10 px-3 font-mono text-body text-paper/35">@</span>
              <input
                id="handle"
                aria-label="Handle"
                value={handle}
                onChange={(event) => setHandle(event.target.value.toLowerCase())}
                minLength={3}
                maxLength={20}
                pattern="[a-z0-9_]+"
                required
                disabled={!isConfigured}
                className="w-full bg-transparent px-3 py-3 font-mono text-control text-paper outline-none disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="formal_typist"
              />
            </div>
          </label>

          <p className="font-mono text-utility text-paper/40">3-20 characters. Lowercase letters, numbers, and underscores only.</p>

          {message && (
            <div className="rounded-md border border-brass/25 bg-brass/10 px-4 py-3 font-mono text-body text-brass">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={!isConfigured || isSaving}
            className="inline-flex w-fit items-center gap-2 rounded-md bg-brass px-4 py-2.5 font-mono text-control font-semibold text-ink-950 transition hover:bg-brass/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save handle"}
          </button>
        </form>
      </section>
    </AppShell>
  );
}
