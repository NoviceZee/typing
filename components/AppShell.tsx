import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode } from "react";
import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const NAV_ITEMS = [
  { href: "/practice", label: "Practice" },
  { href: "/analytics", label: "Analytics", requiresAuth: true },
  { href: "/passages", label: "Passages" },
  { href: "/passages/manage", label: "Manage passages", requiresAuth: true },
  { href: "/settings", label: "Settings" },
  { href: "/leaderboard", label: "Leaderboard" }
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
    await signOut();
    router.push("/practice");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="max-w-[14rem] truncate font-mono text-xs text-mint">{user.email}</span>
      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex items-center gap-2 rounded-md border border-paper/10 bg-ink-900 px-3 py-2 font-mono text-xs text-paper/70 transition hover:border-mint/30 hover:text-paper"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </div>
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
