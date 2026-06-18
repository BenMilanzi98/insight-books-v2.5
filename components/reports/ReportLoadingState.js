"use client";

import React from "react";
import { Loader2 } from "lucide-react";

/**
 * Centered spinner for report data fetches.
 */
export function ReportLoadingState({
  message = "Loading report data…",
  size = 36,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 sm:py-16 text-center ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 size={size} className="animate-spin text-emerald-600 mb-3" aria-hidden="true" />
      <p className="text-slate-500 text-sm">{message}</p>
    </div>
  );
}

/**
 * Skeleton placeholder while the reports hub summary loads.
 */
export function ReportHubSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8 animate-pulse" aria-hidden="true">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-10 bg-slate-200 rounded-xl w-full sm:w-2/3" />
        <div className="h-5 bg-slate-200 rounded w-40" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <div className="h-4 bg-slate-200 rounded w-1/2 mb-4" />
            <div className="h-8 bg-slate-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-slate-200 rounded w-1/3" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
        <div className="h-5 bg-slate-200 rounded w-48 mb-4" />
        <div className="h-64 bg-slate-200 rounded-xl" />
      </div>
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
        <div className="h-5 bg-slate-200 rounded w-40 mb-4" />
        <div className="h-48 bg-slate-200 rounded-xl" />
      </div>
    </div>
  );
}

/**
 * Inline skeleton for the accounting period selector while periods load.
 */
export function AccountingPeriodSelectorSkeleton() {
  return (
    <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[200px] animate-pulse" aria-hidden="true">
      <div className="h-10 bg-slate-200 rounded-xl w-full" />
    </div>
  );
}

/**
 * Consistent empty state for reports hub and analytics panels.
 */
export function ReportEmptyState({
  icon: Icon,
  title,
  description,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-10 sm:py-12 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 ${className}`}
    >
      {Icon ? <Icon size={40} className="text-slate-300 mb-3" aria-hidden="true" /> : null}
      <h3 className="text-sm font-medium text-slate-700 mb-1">{title}</h3>
      {description ? <p className="text-sm text-slate-500 max-w-md">{description}</p> : null}
    </div>
  );
}
