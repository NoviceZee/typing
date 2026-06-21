import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Copy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { SupabaseProfile, getSupabaseProfile } from "@/lib/profileStorage";

export default function PublicProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setProfile(null);
      return;
    }

    setIsLoading(true);
    getSupabaseProfile(user.id)
      .then((nextProfile) => {
        if (!isMounted) return;
        setProfile(nextProfile);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  async function handleCopyUrl() {
    if (!profile?.handle || typeof window === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(`${window.location.origin}/u/${profile.handle}`);
    setCopyMessage("Copied");
  }

  return (
    <AppShell sideAd={false}>
      <section className="mx-auto max-w-3xl rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow">
        <p className="font-mono text-xs uppercase text-brass">Profile</p>
        <h1 className="mt-2 text-3xl font-semibold text-paper">Public profile</h1>
        {isLoading && <p className="mt-4 font-mono text-sm text-paper/45">Loading public profile...</p>}
        {!isLoading && profile?.handle && (
          <>
            <p className="mt-4 text-sm leading-6 text-paper/55">
              This is the public-safe view other people can visit for your FormalType progress.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={`/u/${profile.handle}`}
                className="inline-flex items-center rounded-md border border-brass/40 bg-brass/10 px-4 py-2 font-mono text-sm text-brass transition hover:border-brass hover:bg-brass/15"
              >
                View @{profile.handle}
              </Link>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-2 rounded-md border border-paper/10 bg-ink-900 px-4 py-2 font-mono text-sm text-paper/65 transition hover:border-brass/40 hover:text-paper"
              >
                <Copy className="h-4 w-4" />
                {copyMessage || "Copy URL"}
              </button>
            </div>
          </>
        )}
        {!isLoading && !profile?.handle && (
          <p className="mt-4 text-sm leading-6 text-paper/55">Set a handle to make your public profile available.</p>
        )}
      </section>
    </AppShell>
  );
}
