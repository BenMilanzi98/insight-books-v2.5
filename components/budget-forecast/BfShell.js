'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/budget-forecast/budgets', label: 'Budgets' },
  { href: '/budget-forecast/forecasts', label: 'Forecasts' },
  { href: '/budget-forecast/reports', label: 'Reports' },
];

export default function BfShell({ title, subtitle, actions, children }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Budget &amp; Forecast</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
          <nav className="mt-5 flex gap-1 overflow-x-auto" aria-label="Budget and Forecast sections">
            {TABS.map((tab) => {
              const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${
                    active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const s = String(status || '').toUpperCase();
  const tone =
    s.includes('ACTIVE') || s.includes('APPROVED')
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
      : s.includes('LOCK')
        ? 'bg-amber-50 text-amber-900 ring-amber-200'
        : s.includes('REVIEW')
          ? 'bg-sky-50 text-sky-900 ring-sky-200'
          : 'bg-slate-100 text-slate-700 ring-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}>
      {s || 'UNKNOWN'}
    </span>
  );
}

export function SummaryCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
