"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { SupabaseProfile, getSupabaseProfile, upsertSupabaseProfile } from "@/lib/profileStorage";

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, isConfigured } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [profileMessage, setProfileMessage] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (isAuthLoading || user) {
      return;
    }

    router.push("/login?redirectTo=/profile/account");
  }, [isAuthLoading, router, user]);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setDisplayName("");
      setProfile(null);
      return;
    }

    getSupabaseProfile(user.id)
      .then((profile) => {
        if (!isMounted) return;
        setProfile(profile);
        setDisplayName(profile?.display_name ?? "");
      })
      .catch((error) => {
        if (!isMounted) return;
        setProfileMessage(error instanceof Error ? error.message : "Display name could not be loaded.");
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  async function saveDisplayName() {
    if (!user) {
      setProfileMessage("Log in to set a leaderboard name.");
      return;
    }

    setIsSavingProfile(true);
    setProfileMessage("");

    try {
      const profile = await upsertSupabaseProfile(user.id, displayName);
      setProfile(profile);
      setDisplayName(profile.display_name);
      setProfileMessage("Display name saved.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Display name could not be saved.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <AppShell sideAd={false}>
      <section className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase text-brass">Account</p>
        <h1 className="mt-2 text-3xl font-semibold text-paper md:text-4xl">Account settings</h1>

        {user && (
          <div className="mt-6 space-y-6">
            <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
              <h2 className="font-mono text-sm uppercase text-brass">Profile Settings</h2>
              <p className="mt-2 text-sm leading-6 text-paper/55">
                This public name appears on leaderboard rows. Your email stays private.
              </p>

              {isConfigured ? (
                <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="block">
                    <span className="font-mono text-xs uppercase text-paper/45">Display name</span>
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      maxLength={40}
                      className="mt-2 w-full rounded-md border border-paper/10 bg-ink-900 px-3 py-3 font-mono text-sm text-paper outline-none transition focus:border-brass/60"
                      placeholder="Your leaderboard name"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={saveDisplayName}
                      disabled={isSavingProfile}
                      className="rounded-md border border-brass/35 bg-brass/10 px-4 py-3 font-mono text-sm text-brass transition hover:bg-brass/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingProfile ? "Saving..." : "Save name"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-md border border-paper/10 bg-ink-900 px-4 py-3 font-mono text-sm text-paper/55">
                  Supabase is not configured yet.
                </div>
              )}

              {profileMessage && (
                <div className="mt-4 rounded-md border border-brass/25 bg-brass/10 px-4 py-3 font-mono text-sm text-brass">
                  {profileMessage}
                </div>
              )}

              <div className="mt-5 rounded-md border border-paper/10 bg-ink-900/80 px-4 py-4">
                <p className="font-mono text-xs uppercase text-paper/40">Email</p>
                <p className="mt-2 font-mono text-sm text-paper">{user.email}</p>
              </div>

              <div className="mt-4 rounded-md border border-paper/10 bg-ink-900/80 px-4 py-4">
                <p className="font-mono text-xs uppercase text-paper/40">Handle</p>
                <p className="mt-2 font-mono text-sm text-paper">{profile?.handle ? `@${profile.handle}` : "Not set"}</p>
                <p className="mt-2 text-sm leading-6 text-paper/55">
                  Handles are locked for now. Handle editing will be added later.
                </p>
              </div>
            </section>
          </div>
        )}
      </section>
    </AppShell>
  );
}
