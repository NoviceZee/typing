import { useEffect } from "react";
import { useRouter } from "next/router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function AdminPassagesPage() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    router.replace("/passages/manage");
  }, [router, user]);

  return (
    <AppShell>
      <ProtectedRoute adminOnly>
        <section className="mx-auto max-w-xl rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow md:p-6">
          <p className="font-mono text-sm text-paper/55">Opening Manage passages...</p>
        </section>
      </ProtectedRoute>
    </AppShell>
  );
}
