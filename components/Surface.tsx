import React, { HTMLAttributes } from "react";

export type SectionStackProps = HTMLAttributes<HTMLDivElement> & {
  spacing?: "page" | "subsection";
};

export function SectionStack({ spacing = "page", className = "", ...props }: SectionStackProps) {
  return (
    <div
      className={`${spacing === "page" ? "space-y-6 md:space-y-8" : "space-y-6"} ${className}`}
      {...props}
    />
  );
}

export type PageSectionProps = HTMLAttributes<HTMLElement>;

export function PageSection({ className = "", ...props }: PageSectionProps) {
  return <section className={className} {...props} />;
}

export type DataSurfaceProps = HTMLAttributes<HTMLElement>;

export function DataSurface({ className = "", ...props }: DataSurfaceProps) {
  return (
    <section
      className={`overflow-hidden rounded-[var(--ui-radius-surface)] border border-[color:var(--ui-border-subtle)] bg-transparent ${className}`}
      {...props}
    />
  );
}

export type StatusMessageTone = "info" | "success" | "warning" | "danger";

const STATUS_TONES: Record<StatusMessageTone, string> = {
  info: "border-[color:var(--ui-border-control)] bg-[var(--ui-surface-subtle)] text-[color:var(--ui-text-secondary)]",
  success: "border-[color:var(--ui-text-success)] bg-[var(--ui-surface-success)] text-[color:var(--ui-text-success)]",
  warning: "border-[color:var(--ui-text-warning)] bg-[var(--ui-surface-warning)] text-[color:var(--ui-text-warning)]",
  danger: "border-[color:var(--ui-border-danger)] bg-[var(--ui-surface-danger)] text-[color:var(--ui-text-danger)]"
};

export type StatusMessageProps = Omit<HTMLAttributes<HTMLDivElement>, "role"> & {
  tone?: StatusMessageTone;
};

export function StatusMessage({ tone = "info", className = "", ...props }: StatusMessageProps) {
  const isDanger = tone === "danger";

  return (
    <div
      role={isDanger ? "alert" : "status"}
      aria-live={isDanger ? "assertive" : "polite"}
      className={`rounded-[var(--ui-radius-control)] border px-4 py-3 font-mono text-[length:var(--ui-type-body-size)] leading-[var(--ui-type-body-leading)] ${STATUS_TONES[tone]} ${className}`}
      {...props}
    />
  );
}

export type EmptyStateProps = Omit<HTMLAttributes<HTMLDivElement>, "role"> & {
  label?: string;
};

export function EmptyState({ label = "Empty state", className = "", ...props }: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`px-4 py-10 text-center font-mono text-[length:var(--ui-type-body-size)] leading-[var(--ui-type-body-leading)] text-[color:var(--ui-text-secondary)] ${className}`}
      {...props}
    />
  );
}
