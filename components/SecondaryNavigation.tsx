import Link from "next/link";
import { useRouter } from "next/router";
import React, { ButtonHTMLAttributes, HTMLAttributes, ReactNode, forwardRef } from "react";
import { type LucideIcon } from "lucide-react";

export function SecondaryToolbar({
  children,
  className = "",
  label,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  label?: string;
}) {
  return (
    <div
      aria-label={label}
      className={`flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 font-mono text-control ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function ToolbarGroup({
  label,
  icon: Icon,
  children,
  className = ""
}: {
  label: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <Icon className="icon-control text-paper/30" strokeWidth={1.75} aria-hidden="true" />
      {children}
    </div>
  );
}

export function ToolbarSeparator() {
  return <span aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-paper/12" />;
}

export function FilterControl({
  selected = false,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`inline-flex min-h-8 items-center px-1.5 py-1 font-mono text-control outline-none transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:text-brass focus-visible:ring-1 focus-visible:ring-brass/60 ${
        selected ? "text-brass" : "text-paper/45 hover:text-paper/75"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SectionTabs({
  label,
  items,
  className = ""
}: {
  label: string;
  items: Array<{ href: string; label: string; icon: LucideIcon }>;
  className?: string;
}) {
  const router = useRouter();

  return (
    <nav aria-label={label} className={`max-w-full overflow-x-auto ${className}`}>
      <SecondaryToolbar className="min-w-max">
        {items.map((item, index) => {
          const active = router.pathname === item.href;
          const Icon = item.icon;
          return (
            <React.Fragment key={item.href}>
              {index > 0 && <ToolbarSeparator />}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-8 items-center gap-1.5 px-1.5 py-1 font-mono text-control outline-none transition focus-visible:text-brass focus-visible:ring-1 focus-visible:ring-brass/60 ${
                  active ? "text-brass" : "text-paper/45 hover:text-paper/75"
                }`}
              >
                <Icon className="icon-control" strokeWidth={1.75} aria-hidden="true" />
                {item.label}
              </Link>
            </React.Fragment>
          );
        })}
      </SecondaryToolbar>
    </nav>
  );
}

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  function IconButton({ label, className = "", children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-md text-paper/55 outline-none transition hover:bg-paper/[0.06] hover:text-paper focus-visible:ring-2 focus-visible:ring-brass/60 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
