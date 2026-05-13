'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, ClipboardList, LineChart, PieChart } from 'lucide-react';

const tabs = [
  { href: '/budget-forecast/reports', label: 'Variance reports', icon: PieChart },
  { href: '/budget-forecast/budgets', label: 'Expense budgets', icon: ClipboardList },
  { href: '/budget-forecast/forecasts', label: 'Revenue forecasts', icon: LineChart },
];

export default function BfShell({ children }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full max-w-none px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
        <header className="mb-8 border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Planning</p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                <BarChart3 className="h-8 w-8 text-emerald-600" aria-hidden />
                Budget &amp; Forecast
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Plan expenses and revenue by chart of accounts. Actuals come from posted transactions and journals —
                nothing is double-stored in budget tables.
              </p>
            </div>
          </div>
          <nav className="mt-6 flex flex-wrap gap-2">
            {tabs.map(({ href, label, icon: Icon }) => {
              const active =
                href === '/budget-forecast/reports'
                  ? pathname === '/budget-forecast/reports' || pathname === '/budget-forecast'
                  : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ring-1 transition ${
                    active
                      ? 'bg-emerald-600 text-white ring-emerald-600'
                      : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}
