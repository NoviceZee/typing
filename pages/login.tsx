import React from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { LogIn, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { getSupabaseProfile } from "@/lib/profileStorage";
import Link from "next/link";

type AuthMode = "login" | "signup" | "recovery";

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading, isConfigured, signIn, signUp, sendPasswordReset } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"status" | "error">("status");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const redirectTo = useMemo(() => {
    const rawRedirect = Array.isArray(router.query.redirectTo) ? router.query.redirectTo[0] : router.query.redirectTo;
    return rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/practice";
  }, [router.query.redirectTo]);

  useEffect(() => {
    const requestedMode = Array.isArray(router.query.mode) ? router.query.mode[0] : router.query.mode;
    const passwordReset = Array.isArray(router.query.passwordReset) ? router.query.passwordReset[0] : router.query.passwordReset;
    if (requestedMode === "recovery") setAuthMode("recovery");
    if (passwordReset === "1") {
      setMessageKind("status");
      setMessage("Password updated. Log in with your new password.");
    }
  }, [router.query.mode, router.query.passwordReset]);

  useEffect(() => {
    let isMounted = true;

    if (isLoading || !user) {
      return;
    }

    getSupabaseProfile(user.id)
      .then((profile) => {
        if (!isMounted) return;
        const nextRoute = profile?.handle
          ? redirectTo
          : `/onboarding/handle?redirectTo=${encodeURIComponent(redirectTo)}`;
        router.replace(nextRoute);
      })
      .catch(() => {
        if (!isMounted) return;
        router.replace(`/onboarding/handle?redirectTo=${encodeURIComponent(redirectTo)}`);
      });

    return () => {
      isMounted = false;
    };
  }, [isLoading, redirectTo, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setMessageKind("status");

    try {
      const result = authMode === "login"
        ? await signIn(email, password)
        : authMode === "signup"
          ? await signUp(email, password)
          : await sendPasswordReset(email);

      if (result.errorMessage) {
        setMessageKind("error");
        setMessage(result.errorMessage);
        return;
      }

      if (authMode === "signup" && result.needsConfirmation) {
        setMessageKind("status");
        setMessage("Account created. Check your email if Supabase requires confirmation, then log in.");
        return;
      }

      if (authMode === "recovery") {
        setMessageKind("status");
        setMessage("If an account exists for that email, a password reset link has been sent.");
        return;
      }

      await router.push(redirectTo);
    } catch {
      setMessageKind("error");
      setMessage("The request could not be completed. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell sideAd={false}>
      <section className="mx-auto max-w-xl rounded-lg border border-paper/10 bg-ink-950/75 p-5 shadow-glow md:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-brass/25 bg-brass/10 p-2 text-brass">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-xs uppercase text-brass">Typing Station login</p>
            <h1 className="mt-2 text-page font-semibold text-paper">
              {authMode === "login" ? "Log in" : authMode === "signup" ? "Create account" : "Reset password"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-paper/60">
              {authMode === "recovery"
                ? "Enter your account email and we will send a secure recovery link."
                : "Practice stays public. Sign in to sync results and profile progress across devices."}
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

          {authMode !== "recovery" && <label className="block">
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
          </label>}

          {message && (
            <div role={messageKind === "error" ? "alert" : "status"} className={`rounded-md border px-4 py-3 font-mono text-sm ${messageKind === "error" ? "border-ember/25 bg-ember/10 text-ember" : "border-brass/25 bg-brass/10 text-brass"}`}>
              {message}
            </div>
          )}

          {authMode === "signup" && <label className="flex items-start gap-3 rounded-md border border-paper/10 bg-paper/[0.025] px-3 py-3 text-sm leading-6 text-paper/55"><input type="checkbox" checked={acceptedLegal} onChange={(event) => setAcceptedLegal(event.target.checked)} required className="mt-1 accent-brass" /><span>I agree to the <Link href="/terms" className="text-brass hover:underline">Terms of Use</Link> and acknowledge the <Link href="/privacy" className="text-brass hover:underline">Privacy Policy</Link>.</span></label>}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!isConfigured || isSubmitting || (authMode === "signup" && !acceptedLegal)}
              className="inline-flex items-center gap-2 rounded-md bg-brass px-4 py-2.5 font-mono text-sm font-semibold text-ink-950 transition hover:bg-brass/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              {isSubmitting ? "Working..." : authMode === "login" ? "Log in" : authMode === "signup" ? "Sign up" : "Send reset link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === "login" ? "signup" : "login");
                setMessage("");
                setMessageKind("status");
              }}
              className="rounded-md border border-paper/10 bg-ink-900 px-4 py-2.5 font-mono text-sm text-paper/70 transition hover:border-paper/25 hover:text-paper"
            >
              {authMode === "login" ? "Create account" : "Use existing account"}
            </button>
            {authMode === "login" && (
              <button
                type="button"
                onClick={() => {
                  setAuthMode("recovery");
                  setMessage("");
                  setMessageKind("status");
                }}
                className="px-2 py-2.5 font-mono text-sm text-paper/55 transition hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/70"
              >
                Forgot password?
              </button>
            )}
          </div>
        </form>
      </section>
    </AppShell>
  );
}
