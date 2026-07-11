"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AppShell } from "@/components/AppShell";
import { ProfileSectionNav } from "@/components/ProfileSectionNav";
import { useAuth } from "@/components/AuthProvider";
import { SupabaseProfile, getSupabaseProfile } from "@/lib/profileStorage";

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [profileMessage, setProfileMessage] = useState("");

  useEffect(() => {
    if (isAuthLoading || user) {
      return;
    }

    router.push("/login?redirectTo=/profile/account");
  }, [isAuthLoading, router, user]);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setProfile(null);
      return;
    }

    getSupabaseProfile(user.id)
      .then((profile) => {
        if (!isMounted) return;
        setProfile(profile);
      })
      .catch((error) => {
        if (!isMounted) return;
        setProfileMessage(error instanceof Error ? error.message : "Profile could not be loaded.");
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  return (
    <AppShell sideAd={false}>
      <section className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase text-brass">Account</p>
        <h1 className="mt-2 text-3xl font-semibold text-paper md:text-4xl">Account settings</h1>
        <ProfileSectionNav />

        {user && (
          <div className="mt-6 space-y-6">
            <section className="rounded-lg border border-paper/10 bg-ink-950/75 p-4 shadow-glow md:p-5">
              <h2 className="font-mono text-sm uppercase text-brass">Profile Settings</h2>
              <p className="mt-2 text-sm leading-6 text-paper/55">Your handle is your public identity.</p>

              {profileMessage && (
                <div role="alert" className="mt-4 rounded-md border border-brass/25 bg-brass/10 px-4 py-3 font-mono text-sm text-brass">
                  {profileMessage}
                </div>
              )}

              <div className="mt-5 rounded-md border border-paper/10 bg-ink-900/80 px-4 py-4">
                <p className="font-mono text-xs uppercase text-paper/40">Handle</p>
                <p className="mt-2 font-mono text-sm text-paper">{profile?.handle ? `@${profile.handle}` : "Not set"}</p>
                <p className="mt-2 text-sm leading-6 text-paper/55">
                  Handles are locked for now. Handle editing will be added later.
                </p>
              </div>

              <div className="mt-4 rounded-md border border-paper/10 bg-ink-900/80 px-4 py-4">
                <p className="font-mono text-xs uppercase text-paper/40">Email</p>
                <p className="mt-2 font-mono text-sm text-paper">{user.email}</p>
              </div>
            </section>
          </div>
        )}
      </section>
    </AppShell>
  );
}
