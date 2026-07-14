import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { AppRole, getSupabaseUserRole } from "@/lib/roleStorage";
import { formatPasswordResetError } from "@/lib/authErrors";

type AuthResult = {
  errorMessage?: string;
  needsConfirmation?: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isConfigured: boolean;
  role: AppRole;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isRoleLoading, setIsRoleLoading] = useState(false);
  const [role, setRole] = useState<AppRole>("user");

  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }

    let mounted = true;
    let roleRequestId = 0;

    async function applySession(nextSession: Session | null) {
      if (!mounted) return;
      const requestId = ++roleRequestId;

      setSession(nextSession);
      setIsAuthLoading(false);

      if (!nextSession?.user) {
        setRole("user");
        setIsRoleLoading(false);
        return;
      }

      setIsRoleLoading(true);

      try {
        const nextRole = await getSupabaseUserRole(nextSession.user.id);
        if (mounted && requestId === roleRequestId) setRole(nextRole);
      } catch {
        if (mounted && requestId === roleRequestId) setRole("user");
      } finally {
        if (mounted && requestId === roleRequestId) setIsRoleLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      void applySession(data.session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => {
      const isLoading = isAuthLoading || isRoleLoading;

      return {
        session,
        user: session?.user ?? null,
        isLoading,
        isConfigured: isSupabaseConfigured,
        role,
        // Never carry an already-resolved admin role across an account switch
        // while the next account's trusted role is still being loaded.
        isAdmin: !isLoading && role === "admin",
        async signIn(email, password) {
          if (!supabase) return { errorMessage: "Supabase is not configured yet." };

          const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          return error ? { errorMessage: error.message } : {};
        },
        async signUp(email, password) {
          if (!supabase) return { errorMessage: "Supabase is not configured yet." };

          const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
          return error ? { errorMessage: error.message } : { needsConfirmation: !data.session };
        },
        async sendPasswordReset(email) {
          if (!supabase) return { errorMessage: "Supabase is not configured yet." };
          const redirectTo = typeof window === "undefined"
            ? undefined
            : `${window.location.origin}/profile/account?recovery=1`;
          const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
          return error ? { errorMessage: formatPasswordResetError(error.message) } : {};
        },
        async signOut() {
          if (!supabase) return;
          await supabase.auth.signOut();
          setSession(null);
          setRole("user");
        }
      };
    },
    [isAuthLoading, isRoleLoading, role, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
