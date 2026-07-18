import { useEffect } from "react";
import { useRouter } from "next/router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";

export default function LogoutPage() {
  const router = useRouter();
  const { signOut } = useAuth();

  useEffect(() => {
    signOut().finally(() => {
      router.replace("/practice");
    });
  }, [router, signOut]);

  return (
    <AppShell sideAd={false}>
      <section className="mx-auto max-w-xl rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow md:p-6">
        <p className="font-mono text-body text-paper/55">Logging out...</p>
      </section>
    </AppShell>
  );
}
