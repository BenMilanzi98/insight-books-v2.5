"use client";

import { Loader2 } from "lucide-react";

export const inputCls =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";
export const labelCls = "block text-xs font-semibold text-slate-600";
export const selectCls = inputCls;

export function WizardField({ label, children, hint }) {
  return (
    <div>
      {label ? <label className={labelCls}>{label}</label> : null}
      {children}
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function WizardFormError({ message }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>
  );
}

export function WizardSubmitButton({ saving, disabled, children, className = "" }) {
  return (
    <button
      type="submit"
      disabled={saving || disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50 ${className}`}
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function WizardExistingList({ title, items, emptyText, renderItem }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
      {items?.length ? (
        <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto text-sm text-slate-700">
          {items.map((item, i) => (
            <li key={item.id ?? i} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100">
              {renderItem(item)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{emptyText}</p>
      )}
    </div>
  );
}

export function WizardStepLoading() {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
      Loading…
    </div>
  );
}
