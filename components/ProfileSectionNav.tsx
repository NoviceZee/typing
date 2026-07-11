import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";

const PROFILE_SECTIONS = [
  { href: "/profile", label: "Stats" },
  { href: "/profile/friends", label: "Friends" },
  { href: "/profile/account", label: "Account" }
];

export function ProfileSectionNav() {
  const router = useRouter();

  return (
    <nav aria-label="Profile sections" className="mt-5 flex max-w-full gap-1 overflow-x-auto border-b border-paper/10 pb-px font-mono text-xs">
      {PROFILE_SECTIONS.map((section) => {
        const isActive = router.pathname === section.href;
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={isActive ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3 py-2 transition ${
              isActive
                ? "border-brass text-brass"
                : "border-transparent text-paper/45 hover:border-paper/20 hover:text-paper/75"
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
