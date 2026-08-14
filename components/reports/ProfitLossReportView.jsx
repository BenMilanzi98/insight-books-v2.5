'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  Download,
  Expand,
  Loader2,
  Printer,
  Send,
} from 'lucide-react';
import ProfitLossFilters from '@/components/reports/ProfitLossFilters';
import ProfitLossTable from '@/components/reports/ProfitLossTable';
import { REPORTING_CURRENCY_OPTIONS } from '@/lib/businessScopeStorage';

function isoDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rangeFromPreset(preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (preset === 'last_year') {
    return { fromDate: `${y - 1}-01-01`, toDate: `${y - 1}-12-31` };
  }
  if (preset === 'this_quarter') {
    const q = Math.floor(m / 3);
    const from = new Date(y, q * 3, 1);
    const to = new Date(y, q * 3 + 3, 0);
    return { fromDate: isoDate(from), toDate: isoDate(to) };
  }
  if (preset === 'last_quarter') {
    const q = Math.floor(m / 3) - 1;
    const yy = q < 0 ? y - 1 : y;
    const qq = q < 0 ? 3 : q;
    const from = new Date(yy, qq * 3, 1);
    const to = new Date(yy, qq * 3 + 3, 0);
    return { fromDate: isoDate(from), toDate: isoDate(to) };
  }
  // this_year + default
  return { fromDate: `${y}-01-01`, toDate: isoDate(now) };
}

function defaultDraft() {
  const range = rangeFromPreset('this_year');
  return {
    preset: 'this_year',
    ...range,
    groupBy: 'MONTH',
    reportBasis: 'ACCRUAL',
    breakdown: 'ACCOUNT',
    currency: null,
  };
}

/**
 * FreshBooks-style P&L experience embedded in reports-v2.
 */
export default function ProfitLossReportView({ tenantName = 'Your business', onDrill }) {
  const [draft, setDraft] = useState(defaultDraft);
  const [applied, setApplied] = useState(defaultDraft);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      type: 'INCOME_STATEMENT',
      fromDate: applied.fromDate,
      toDate: applied.toDate,
      asOfDate: applied.toDate,
      groupBy: applied.groupBy,
      reportBasis: applied.reportBasis,
      breakdown: applied.breakdown,
      applyCitProvision: 'true',
    });
    if (applied.currency) params.set('currency', applied.currency);
    return params.toString();
  }, [applied]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting-v2/reports/generate?${queryString}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}`);
      setReport(json);
    } catch (e) {
      setError(e.message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    load();
  }, [load]);

  const applyDraft = () => {
    let next = { ...draft };
    if (draft.preset !== 'custom') {
      next = { ...next, ...rangeFromPreset(draft.preset) };
    }
    setApplied(next);
    setDraft(next);
  };

  const resetAll = () => {
    const d = defaultDraft();
    setDraft(d);
    setApplied(d);
  };

  const exportUrl = (format) => `/api/accounting-v2/reports/export?${queryString}&format=${format}`;

  const methodLabel =
    report?.meta?.methodLabel ||
    (applied.reportBasis === 'CASH' ? 'Income Collected' : 'Income Billed');

  const periodLabel = `For ${applied.fromDate} — ${applied.toDate}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Profit and Loss</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              More Actions
              <ChevronDown className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {['csv', 'xlsx', 'pdf'].map((f) => (
                  <a
                    key={f}
                    href={exportUrl(f)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export {f.toUpperCase()}
                  </a>
                ))}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setMenuOpen(false);
                    window.print();
                  }}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            disabled
            title="Email send is not configured for financial reports"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            Send…
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 lg:hidden"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            Filters
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col lg:flex-row">
          <div className="min-w-0 flex-1 p-4 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-bold text-blue-600">Profit and Loss</h3>
                <p className="mt-1 text-sm text-slate-600">{tenantName}</p>
                <p className="text-sm text-slate-500">{methodLabel}</p>
                <p className="text-sm text-slate-500">{periodLabel}</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                title="Expand"
                onClick={() => setFiltersOpen(false)}
              >
                <Expand className="h-4 w-4" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 py-12 text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                Generating Profit &amp; Loss…
              </div>
            ) : report ? (
              <ProfitLossTable report={report} onDrill={onDrill} />
            ) : (
              <p className="py-8 text-sm text-slate-500">No report data.</p>
            )}

            <p className="mt-6 text-xs leading-relaxed text-slate-400">
              Accrual (Billed) uses posted period journal activity on income and expense accounts. Cash
              (Collected) includes only journals that settled through cash/bank accounts in the period;
              non-cash journals (for example depreciation-only) are excluded. Figures come from Accounting
              V2 posted lines.
            </p>
          </div>

          {filtersOpen ? (
            <div className="lg:block">
              <ProfitLossFilters
                draft={draft}
                onChange={setDraft}
                onApply={applyDraft}
                onReset={resetAll}
                onClose={() => setFiltersOpen(false)}
                currencyOptions={REPORTING_CURRENCY_OPTIONS}
                applying={loading}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
