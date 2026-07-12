import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/router";
import React, { ReactNode, useEffect, useRef, useState } from "react";
import { ChevronDown, LogIn, LogOut, Menu, UserCircle, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { SupabaseProfile, getProfileDisplayLabel, getSupabaseProfile } from "@/lib/profileStorage";
import { NotificationCenter } from "@/components/NotificationCenter";

const NAV_ITEMS = [
  { href: "/practice", label: "Practice" },
  { href: "/training", label: "Training" },
  { href: "/passages", label: "Library" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/settings", label: "Settings" }
];

export function AppShell({
  children,
  sideAd = true,
  topAd = true,
  focusMode = false
}: {
  children: ReactNode;
  sideAd?: boolean;
  topAd?: boolean;
  focusMode?: boolean;
}) {
  const router = useRouter();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const mobileNavButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [router.asPath]);

  useEffect(() => {
    if (!isMobileNavOpen) return;

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsMobileNavOpen(false);
      mobileNavButtonRef.current?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileNavOpen]);

  return (
    <main className="min-h-screen px-5 py-5 text-paper md:px-8">
      {process.env.NEXT_PUBLIC_ADSENSE_CLIENT && <Script async strategy="afterInteractive" crossOrigin="anonymous" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`} />}
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-md bg-paper px-3 py-2 font-mono text-sm text-ink-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      <div className="mx-auto max-w-7xl">
        <header className={focusMode ? "invisible border-b border-paper/10 pb-4" : "border-b border-paper/10 pb-4"}>
          <div className="flex items-center justify-between gap-3">
            <Link href="/practice" className="shrink-0 font-mono text-lg font-semibold tracking-[0.18em] text-paper">
              FormalType
            </Link>
            <div className="flex min-w-0 items-center gap-2 md:gap-3">
              <nav aria-label="Primary navigation" className="hidden gap-1 font-mono text-sm text-paper/60 md:flex lg:gap-2">
                {NAV_ITEMS.map((item) => (
                  <NavLink key={item.href} href={item.href} label={item.label} />
                ))}
              </nav>
              <NotificationCenter />
              <HeaderAuthAction />
              <button
                ref={mobileNavButtonRef}
                type="button"
                aria-label={isMobileNavOpen ? "Close navigation" : "Open navigation"}
                aria-expanded={isMobileNavOpen}
                aria-controls="mobile-navigation"
                onClick={() => setIsMobileNavOpen((current) => !current)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-paper/10 bg-ink-900 text-paper/70 transition hover:border-brass/40 hover:text-paper md:hidden"
              >
                {isMobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {isMobileNavOpen && (
            <nav
              id="mobile-navigation"
              aria-label="Mobile navigation"
              className="mt-3 grid grid-cols-2 gap-2 border-t border-paper/10 pt-3 font-mono text-sm sm:grid-cols-3 md:hidden"
            >
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} onClick={() => setIsMobileNavOpen(false)} />
              ))}
            </nav>
          )}
        </header>

        {topAd && (
          <div className="mt-5">
            <AdPlaceholder variant="banner" />
          </div>
        )}

        <div className={sideAd ? "mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]" : "mt-6"}>
          <div id="main-content" tabIndex={-1} className="min-w-0 outline-none">{children}</div>
          {sideAd && (
            <aside className="hidden xl:block">
              <AdPlaceholder variant="sidebar" />
            </aside>
          )}
        </div>

        {sideAd && (
          <div className="mt-6 xl:hidden">
            <AdPlaceholder variant="mobile" />
          </div>
        )}
      </div>
    </main>
  );
}

function HeaderAuthAction() {
  const router = useRouter();
  const { user, isLoading, isAdmin, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [isProfileLabelResolved, setIsProfileLabelResolved] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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
        menuButtonRef.current?.focus();
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
    return <span role="status" aria-label="Checking login" className="block h-9 w-9 animate-pulse rounded-md border border-paper/10 bg-paper/[0.06] sm:w-36" />;
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
    setIsSigningOut(true);
    try {
      await signOut();
      await router.push("/practice");
    } finally {
      setIsSigningOut(false);
    }
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    if (items.length === 0) return;
    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (currentIndex + 1 + items.length) % items.length
          : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  const accountLabel = isProfileLabelResolved ? getProfileDisplayLabel(profile) : "Account";

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={menuButtonRef}
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-9 w-9 items-center justify-center gap-2 rounded-md border border-paper/10 bg-ink-900 px-2 font-mono text-xs text-paper/75 transition hover:border-brass/40 hover:text-paper sm:w-36 sm:px-3"
      >
        <UserCircle className="h-4 w-4 text-brass" />
        <span className="hidden min-w-0 flex-1 truncate text-left sm:inline">{accountLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div
          role="menu"
          aria-label="Account"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-md border border-paper/10 bg-ink-950 shadow-glow"
        >
          <AccountMenuLink href="/profile" label="Profile & stats" onClick={() => setIsOpen(false)} />
          <AccountMenuLink href="/profile/friends" label="Friends" onClick={() => setIsOpen(false)} />
          <AccountMenuLink
            href={profile?.handle ? `/u/${profile.handle}` : "/profile"}
            label="Public profile"
            onClick={() => setIsOpen(false)}
          />
          <AccountMenuLink href="/profile/account" label="Account settings" onClick={() => setIsOpen(false)} />
          {isAdmin && <AccountMenuLink href="/passages/manage" label="Manage library" onClick={() => setIsOpen(false)} />}
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={isSigningOut}
            className="flex w-full items-center gap-2 border-t border-paper/10 px-3 py-2.5 text-left font-mono text-xs text-paper/65 transition hover:bg-paper/10 hover:text-paper"
          >
            <LogOut className="h-4 w-4" />
            {isSigningOut ? "Signing out..." : "Sign out"}
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
  const adClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const slot = variant === "sidebar" ? process.env.NEXT_PUBLIC_ADSENSE_SIDEBAR_SLOT : process.env.NEXT_PUBLIC_ADSENSE_BANNER_SLOT;

  useEffect(() => {
    if (!adClient || !slot) return;
    try {
      const adsWindow = window as typeof window & { adsbygoogle?: Record<string, unknown>[] };
      (adsWindow.adsbygoogle = adsWindow.adsbygoogle || []).push({});
    } catch {
      // Ad blockers and unfilled beta inventory should never interrupt practice.
    }
  }, [adClient, slot]);
  const className =
    variant === "sidebar"
      ? "h-[250px] w-[300px]"
      : variant === "banner"
        ? "mx-auto hidden h-[90px] w-full max-w-[728px] md:grid"
        : "grid h-[90px] w-full";

  if (!adClient || !slot) return null;
  return (
    <div
      className={`${className} overflow-hidden`}
    >
      <ins className="adsbygoogle block h-full w-full" data-ad-client={adClient} data-ad-slot={slot} data-ad-format={variant === "sidebar" ? "rectangle" : "horizontal"} data-full-width-responsive="true" />
    </div>
  );
}

function NavLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  const router = useRouter();
  const active =
    router.pathname === href ||
    (href === "/practice" && router.pathname === "/") ||
    (href === "/passages/manage" &&
      (router.pathname.startsWith("/passages/manage") || router.pathname.startsWith("/admin/passages")));

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`flex min-h-10 items-center rounded-md px-3 py-2 outline-none transition focus-visible:ring-2 focus-visible:ring-brass/60 ${
        active ? "bg-paper text-ink-950" : "text-paper/60 hover:bg-paper/10 hover:text-paper"
      }`}
    >
      {label}
    </Link>
  );
}
