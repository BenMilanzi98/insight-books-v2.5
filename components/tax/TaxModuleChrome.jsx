"use client";

import { cn } from "@/lib/utils";
import PosStylePageHeader, { PosStyleHeaderButton } from "@/components/shell/PosStylePageHeader";
import PosStylePanel from "@/components/shell/PosStylePanel";

export { PosStyleHeaderButton };

/** Standard tax module page frame — matches Capital / Bank Reconciliation shell. */
export function TaxModulePage({ title, description, actions, children, className }) {
  return (
    <div className={cn("w-full", className)}>
      <PosStylePageHeader title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}

export function TaxPanel({ children, className, accent = "default", as }) {
  return (
    <PosStylePanel accent={accent} as={as} className={cn("p-4 sm:p-6", className)}>
      {children}
    </PosStylePanel>
  );
}

export function TaxPrimaryButton({ className, children, type = "button", ...props }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TaxSecondaryButton({ className, children, ...props }) {
  return (
    <PosStyleHeaderButton className={className} {...props}>
      {children}
    </PosStyleHeaderButton>
  );
}

export function TaxAlert({ tone = "amber", children, className }) {
  const tones = {
    amber:
      "border-[color-mix(in_srgb,var(--status-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-warning)_12%,white)] text-[var(--text-primary)]",
    rose:
      "border-[color-mix(in_srgb,var(--status-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-danger)_12%,white)] text-[var(--text-primary)]",
    emerald:
      "border-[color-mix(in_srgb,var(--status-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-success)_12%,white)] text-[var(--text-primary)]",
    sky: "border-[var(--border-default)] bg-[var(--surface-muted)] text-[var(--text-primary)]",
  };
  return (
    <div className={cn("mb-4 rounded-lg border px-4 py-3 text-sm", tones[tone] || tones.amber, className)}>
      {children}
    </div>
  );
}

export function TaxField({ className, ...props }) {
  return (
    <input
      className={cn(
        "rounded-lg border border-[var(--border-default)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)]",
        className
      )}
      {...props}
    />
  );
}

export function TaxSelect({ className, children, ...props }) {
  return (
    <select
      className={cn(
        "rounded-lg border border-[var(--border-default)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)]",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function TaxTabs({ tabs, activeId, onChange, className }) {
  return (
    <div
      className={cn(
        "mb-6 flex gap-1 overflow-x-auto border-b border-[var(--border-default)]",
        className
      )}
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const selected = activeId === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange?.(id)}
            className={cn(
              "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              selected
                ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]"
            )}
          >
            {Icon ? <Icon size={16} aria-hidden="true" /> : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}
