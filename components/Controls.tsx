import React, { ButtonHTMLAttributes, forwardRef } from "react";
import { type LucideIcon } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "compact" | "default";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border-[color:var(--ui-border-selected)] bg-[var(--ui-surface-selected)] text-[color:var(--ui-text-accent)] hover:bg-[var(--ui-surface-hover)]",
  secondary:
    "border-[color:var(--ui-border-control)] bg-transparent text-[color:var(--ui-text-primary)] hover:border-[color:var(--ui-border-strong)] hover:bg-[var(--ui-surface-hover)]",
  ghost:
    "border-transparent bg-transparent text-[color:var(--ui-text-secondary)] hover:bg-[var(--ui-surface-hover)] hover:text-[color:var(--ui-text-primary)]",
  danger:
    "border-[color:var(--ui-border-danger)] bg-[var(--ui-surface-danger)] text-[color:var(--ui-text-danger)] hover:bg-[var(--ui-surface-hover)]"
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  compact: "ui-target-compact px-2.5",
  default: "ui-target-default px-3"
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "default",
    icon: Icon,
    type = "button",
    className = "",
    children,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      data-focus-ring="standard"
      data-touch-target="44"
      className={`ui-focus-ring inline-flex items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border font-mono text-[length:var(--ui-type-control-size)] font-medium leading-[var(--ui-type-control-leading)] transition-colors duration-[var(--ui-motion-standard)] ease-[var(--ui-ease-standard)] disabled:cursor-not-allowed disabled:opacity-45 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="icon-control" strokeWidth={1.75} aria-hidden="true" />}
      {children}
    </button>
  );
});

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & {
  icon: LucideIcon;
  label: string;
  variant?: "ghost" | "secondary" | "danger";
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, variant = "ghost", type = "button", className = "", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      data-focus-ring="standard"
      data-touch-target="44"
      className={`ui-focus-ring ui-target-square grid shrink-0 place-items-center rounded-[var(--ui-radius-control)] border transition-colors duration-[var(--ui-motion-standard)] ease-[var(--ui-ease-standard)] disabled:cursor-not-allowed disabled:opacity-45 ${
        variant === "danger"
          ? "border-[color:var(--ui-border-danger)] text-[color:var(--ui-text-danger)] hover:bg-[var(--ui-surface-danger)]"
          : variant === "secondary"
            ? "border-[color:var(--ui-border-control)] text-[color:var(--ui-text-secondary)] hover:bg-[var(--ui-surface-hover)] hover:text-[color:var(--ui-text-primary)]"
            : "border-transparent text-[color:var(--ui-text-secondary)] hover:bg-[var(--ui-surface-hover)] hover:text-[color:var(--ui-text-primary)]"
      } ${className}`}
      {...props}
    >
      <Icon className="icon-control" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
});

export type SegmentedControlOption<Value extends string> = {
  label: string;
  value: Value;
  ariaLabel?: string;
  disabled?: boolean;
};

export type SegmentedControlProps<Value extends string> = {
  label: string;
  value: Value;
  options: Array<SegmentedControlOption<Value>>;
  onChange: (value: Value) => void;
  icon?: LucideIcon;
  className?: string;
};

export function SegmentedControl<Value extends string>({
  label,
  value,
  options,
  onChange,
  icon: Icon,
  className = ""
}: SegmentedControlProps<Value>) {
  return (
    <fieldset className={`min-w-0 ${className}`}>
      <legend className="sr-only">{label}</legend>
      <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
        {Icon && (
          <span className="ui-target-icon-slot mr-1 grid w-7 shrink-0 place-items-center text-[color:var(--ui-text-muted)]">
            <Icon className="icon-control" strokeWidth={1.75} aria-hidden="true" />
          </span>
        )}
        {options.map((option) => {
          const isSelected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              aria-label={option.ariaLabel}
              aria-pressed={isSelected}
              data-focus-ring="standard"
              data-touch-target="44"
              data-selected-indicator={isSelected ? "underline" : undefined}
              disabled={option.disabled}
              onClick={() => onChange(option.value)}
              className={`ui-focus-ring ui-target-segment relative inline-flex items-center justify-center rounded-[var(--ui-radius-control)] px-2.5 font-mono text-[length:var(--ui-type-control-size)] leading-[var(--ui-type-control-leading)] transition-colors duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)] after:absolute after:inset-x-2 after:bottom-1 after:h-0.5 after:rounded-full after:transition-colors disabled:cursor-not-allowed disabled:opacity-45 md:px-2 ${
                isSelected
                  ? "font-semibold text-[color:var(--ui-text-accent)] after:bg-[var(--ui-text-accent)]"
                  : "text-[color:var(--ui-text-secondary)] after:bg-transparent hover:bg-[var(--ui-surface-hover)] hover:text-[color:var(--ui-text-primary)]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
