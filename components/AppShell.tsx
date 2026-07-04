import Link from "next/link";
import { useRouter } from "next/router";
import React, { ReactNode, useEffect, useRef, useState } from "react";
import { ChevronDown, LogIn, LogOut, UserCircle } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { SupabaseProfile, getProfileDisplayLabel, getSupabaseProfile } from "@/lib/profileStorage";

const NAV_ITEMS = [
  { href: "/practice", label: "Practice" },
  { href: "/training", label: "Training" },
  { href: "/passages", label: "Passages" },
  { href: "/passages/manage", label: "Manage passages", requiresAuth: true },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/settings", label: "Settings" }
];

export function AppShell({ children, sideAd = true }: { children: ReactNode; sideAd?: boolean }) {
  const { user } = useAuth();
  const navItems = user ? NAV_ITEMS : NAV_ITEMS.filter((item) => !item.requiresAuth);

  return (
    <main className="min-h-screen px-5 py-5 text-paper md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-paper/10 pb-4">
          <Link href="/practice" className="font-mono text-lg font-semibold tracking-[0.18em] text-paper">
            FormalType
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex flex-wrap gap-2 font-mono text-sm text-paper/60">
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
            </nav>
            <HeaderAuthAction />
          </div>
        </header>

        <div className="mt-5">
          <AdPlaceholder variant="banner" />
        </div>

        <div className={sideAd ? "mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]" : "mt-6"}>
          <div>{children}</div>
          {sideAd && (
            <aside className="hidden xl:block">
              <AdPlaceholder variant="sidebar" />
            </aside>
          )}
        </div>

        <div className="mt-6 xl:hidden">
          <AdPlaceholder variant="mobile" />
        </div>
      </div>
    </main>
  );
}

function HeaderAuthAction() {
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [isProfileLabelResolved, setIsProfileLabelResolved] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setProfile(null);
      setIsProfileLabelResolved(false);
      setIsOpen(false);
      return;
    }

    setIsProfileLabelResolved(false);
    getSupabaseProfile(user.id)
      .then((nextProfile) => {
        if (!isMounted) return;
        setProfile(nextProfile);
        setIsProfileLabelResolved(true);
      })
      .catch(() => {
        if (!isMounted) return;
        setProfile(null);
        setIsProfileLabelResolved(true);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !isProfileLabelResolved || profile?.handle) {
      return;
    }

    if (router.pathname === "/onboarding/handle" || router.pathname === "/logout") {
      return;
    }

    const redirectTo = router.asPath && router.asPath !== "/onboarding/handle" ? router.asPath : "/practice";
    router.replace(`/onboarding/handle?redirectTo=${encodeURIComponent(redirectTo)}`);
  }, [isProfileLabelResolved, profile?.handle, router, user]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (isLoading) {
    return <span className="font-mono text-xs text-paper/35">Checking login...</span>;
  }

  if (!user) {
    const redirectTo = router.asPath && router.asPath !== "/login" ? `?redirectTo=${encodeURIComponent(router.asPath)}` : "";
    return (
      <Link
        href={`/login${redirectTo}`}
        className="inline-flex items-center gap-2 rounded-md border border-paper/10 bg-ink-900 px-3 py-2 font-mono text-xs text-paper/70 transition hover:border-brass/40 hover:text-paper"
      >
        <LogIn className="h-4 w-4" />
        Login
      </Link>
    );
  }

  async function handleLogout() {
    setIsOpen(false);
    await signOut();
    router.push("/practice");
  }

  const accountLabel = isProfileLabelResolved ? getProfileDisplayLabel(profile) : "Account";

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex max-w-[15rem] items-center gap-2 rounded-md border border-paper/10 bg-ink-900 px-3 py-2 font-mono text-xs text-paper/75 transition hover:border-brass/40 hover:text-paper"
      >
        <UserCircle className="h-4 w-4 text-brass" />
        <span className="truncate">{accountLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-md border border-paper/10 bg-ink-950 shadow-glow"
        >
          <AccountMenuLink href="/profile" label="User stats" onClick={() => setIsOpen(false)} />
          <AccountMenuLink href="/profile/friends" label="Friends" onClick={() => setIsOpen(false)} />
          <AccountMenuLink
            href={profile?.handle ? `/u/${profile.handle}` : "/profile"}
            label="Public profile"
            onClick={() => setIsOpen(false)}
          />
          <AccountMenuLink href="/profile/account" label="Account settings" onClick={() => setIsOpen(false)} />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 border-t border-paper/10 px-3 py-2.5 text-left font-mono text-xs text-paper/65 transition hover:bg-paper/10 hover:text-paper"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function AccountMenuLink({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="block px-3 py-2.5 font-mono text-xs text-paper/65 transition hover:bg-paper/10 hover:text-paper"
    >
      {label}
    </Link>
  );
}

export function AdPlaceholder({ variant }: { variant: "banner" | "sidebar" | "mobile" }) {
  const className =
    variant === "sidebar"
      ? "h-[250px] w-[300px]"
      : variant === "banner"
        ? "mx-auto hidden h-[90px] w-full max-w-[728px] md:grid"
        : "grid h-[90px] w-full";

  return (
    <div
      className={`${className} place-items-center rounded-md border border-dashed border-paper/15 bg-ink-900/45 font-mono text-xs uppercase text-paper/30`}
    >
      Ad space
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  const active =
    router.pathname === href ||
    (href === "/practice" && router.pathname === "/") ||
    (href === "/passages/manage" &&
      (router.pathname.startsWith("/passages/manage") || router.pathname.startsWith("/admin/passages")));

  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 transition ${
        active ? "bg-paper text-ink-950" : "text-paper/60 hover:bg-paper/10 hover:text-paper"
      }`}
    >
      {label}
    </Link>
  );
}
