import { ReactNode, useEffect } from "react";
import { useRouter } from "next/router";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export function ProtectedRoute({ children, adminOnly = true }: { children: ReactNode; adminOnly?: boolean }) {
  const router = useRouter();
  const { isLoading, user, isAdmin } = useAuth();

  useEffect(() => {
    if (isLoading || user) return;

    const redirectTo = encodeURIComponent(router.asPath || "/practice");
    router.replace(`/login?redirectTo=${redirectTo}`);
  }, [isLoading, router, user]);

  if (isLoading || !user) {
    return (
      <AuthStatePanel>
        <p className="font-mono text-sm text-paper/55">Checking login...</p>
      </AuthStatePanel>
    );
  }

  if (adminOnly && !isAdmin) {
    return (
      <AuthStatePanel>
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-ember/25 bg-ember/10 p-2 text-ember">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-xs uppercase text-ember">Access denied</p>
            <h1 className="mt-2 text-3xl font-semibold text-paper">Admin access required</h1>
            <p className="mt-3 text-sm leading-6 text-paper/60">
              This placeholder is ready for future role checks. For now, any signed-in user is treated as an admin.
            </p>
          </div>
        </div>
      </AuthStatePanel>
    );
  }

  return <>{children}</>;
}

function AuthStatePanel({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto max-w-xl rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow md:p-6">
      {children}
    </section>
  );
}
