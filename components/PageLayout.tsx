import React, { HTMLAttributes, ReactNode } from "react";

export function PageContainer({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`mx-auto w-full max-w-6xl ${className}`} {...props} />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  aside,
  className = ""
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`mb-6 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="font-mono text-utility uppercase text-brass">{eyebrow}</p>
          <h1 className="mt-2 text-page font-semibold text-paper">{title}</h1>
          {description && <div className="mt-2 max-w-2xl text-body leading-6 text-paper/55">{description}</div>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
    </header>
  );
}
