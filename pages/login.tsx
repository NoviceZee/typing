import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { LogIn, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";

type AuthMode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading, isConfigured, signIn, signUp } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = useMemo(() => {
    const rawRedirect = Array.isArray(router.query.redirectTo) ? router.query.redirectTo[0] : router.query.redirectTo;
    return rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/practice";
  }, [router.query.redirectTo]);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(redirectTo);
    }
  }, [isLoading, redirectTo, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const result = authMode === "login" ? await signIn(email, password) : await signUp(email, password);

    if (result.errorMessage) {
      setMessage(result.errorMessage);
      setIsSubmitting(false);
      return;
    }

    if (authMode === "signup" && result.needsConfirmation) {
      setMessage("Account created. Check your email if Supabase requires confirmation, then log in.");
      setIsSubmitting(false);
      return;
    }

    router.push(redirectTo);
  }

  return (
    <AppShell sideAd={false}>
      <section className="mx-auto max-w-xl rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow md:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-brass/25 bg-brass/10 p-2 text-brass">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-xs uppercase text-brass">FormalType login</p>
            <h1 className="mt-2 text-3xl font-semibold text-paper">
              {authMode === "login" ? "Log in" : "Create account"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-paper/60">
              Practice stays public. Login is only required for Manage passages, and passage data still remains in
              localStorage for now.
            </p>
          </div>
        </div>

        {!isConfigured && (
          <div className="mt-5 rounded-md border border-ember/25 bg-ember/10 px-4 py-3 text-sm leading-6 text-ember">
            Supabase is not configured yet. Add <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> and{" "}
            <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span> to{" "}
            <span className="font-mono">.env.local</span>, then restart the app.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <label className="block">
            <span className="font-mono text-xs uppercase text-paper/45">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-2 w-full rounded-md border border-paper/10 bg-ink-900 px-3 py-3 font-mono text-sm text-paper outline-none transition focus:border-brass/60"
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="font-mono text-xs uppercase text-paper/45">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="mt-2 w-full rounded-md border border-paper/10 bg-ink-900 px-3 py-3 font-mono text-sm text-paper outline-none transition focus:border-brass/60"
              placeholder="At least 6 characters"
            />
          </label>

          {message && (
            <div className="rounded-md border border-brass/25 bg-brass/10 px-4 py-3 font-mono text-sm text-brass">
              {message}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!isConfigured || isSubmitting}
              className="inline-flex items-center gap-2 rounded-md bg-brass px-4 py-2.5 font-mono text-sm font-semibold text-ink-950 transition hover:bg-brass/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              {isSubmitting ? "Working..." : authMode === "login" ? "Log in" : "Sign up"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === "login" ? "signup" : "login");
                setMessage("");
              }}
              className="rounded-md border border-paper/10 bg-ink-900 px-4 py-2.5 font-mono text-sm text-paper/70 transition hover:border-paper/25 hover:text-paper"
            >
              {authMode === "login" ? "Create account" : "Use existing account"}
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
