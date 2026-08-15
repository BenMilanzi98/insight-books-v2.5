'use client';

/**
 * Financial Reports — canonical reporting UI (R3-C sole hub).
 *
 * Report type selection is a header dropdown (no left sidebar). Every figure
 * comes from /api/accounting-v2/reports/* — the Accounting V2 JE-only engine.
 * Legacy /reports redirects here (/reports-v2).
 */

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import ProfitLossReportView from '@/components/reports/ProfitLossReportView';
import ProfitAnalysisReportView from '@/components/reports/ProfitAnalysisReportView';
import StudioReportView from '@/components/reports/StudioReportView';
import ReportsDashboardView from '@/components/reports/ReportsDashboardView';
import {
  REPORT_CATEGORIES,
  REPORTS_DASHBOARD_TYPE,
  defaultReportSelection,
  findReportByType,
} from '@/lib/reports/reportCatalog';

function Badge({ tone = 'muted', children }) {
  const cls =
    tone === 'ok'
      ? 'bg-green-100 text-green-800'
      : tone === 'warn'
        ? 'bg-amber-100 text-amber-800'
        : tone === 'bad'
          ? 'bg-red-100 text-red-800'
          : 'bg-slate-100 text-slate-700';
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

const fmt = (a) => {
  if (a == null) return '—';
  const n = Number(a.decimal ?? a);
  return n < 0
    ? `(${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2 })})`
    : n.toLocaleString(undefined, { minimumFractionDigits: 2 });
};

function DrillDownModal({ drill, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Drill-down — {drill.lineLabel}</h2>
            <p className="text-sm text-slate-500">
              Line {fmt(drill.lineAmount)} · Ledger {fmt(drill.ledgerTotal)}{' '}
              {drill.reconciles ? <Badge tone="ok">reconciles</Badge> : <Badge tone="bad">REP-025 difference</Badge>}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {drill.accounts.map((a) => (
          <div key={a.accountId} className="mb-4">
            <h3 className="mb-1 font-semibold text-slate-900">
              {a.accountCode} — {a.accountName}
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-blue-600 text-left text-blue-600">
                    <th className="px-3 py-2 pr-2 font-semibold">Date</th>
                    <th className="px-3 py-2 pr-2 font-semibold">Journal</th>
                    <th className="px-3 py-2 pr-2 font-semibold">Description</th>
                    <th className="px-3 py-2 pr-2 text-right font-semibold">Debit</th>
                    <th className="px-3 py-2 pr-2 text-right font-semibold">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {a.lines.map((l) => (
                    <tr key={l.lineId ?? `${l.journalId}-${l.lineNumber}`} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 pr-2">{String(l.date ?? l.postingDate ?? '').slice(0, 10)}</td>
                      <td className="px-3 py-1.5 pr-2">{l.journalNumber ?? l.transactionId ?? l.journalEntryId ?? '—'}</td>
                      <td className="px-3 py-1.5 pr-2">{l.description ?? '—'}</td>
                      <td className="px-3 py-1.5 pr-2 text-right tabular-nums">{l.debit}</td>
                      <td className="px-3 py-1.5 pr-2 text-right tabular-nums">{l.credit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const typeFromUrl = searchParams?.get('type');

  const [selected, setSelected] = useState(
    () => findReportByType(typeFromUrl) || defaultReportSelection()
  );
  const [error, setError] = useState(null);
  const [drill, setDrill] = useState(null);

  const typeFromUrlResolved = findReportByType(typeFromUrl);
  const active = typeFromUrlResolved || selected;

  const selectReportType = (type) => {
    const r = findReportByType(type);
    if (!r) return;
    setSelected(r);
    setError(null);
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('type', r.type);
    router.replace(`/reports-v2?${params.toString()}`, { scroll: false });
  };

  const drillInto = async (lineId, scope = {}) => {
    if (!lineId) return;
    try {
      const params = {
        fromDate: scope.fromDate,
        toDate: scope.toDate,
        asOfDate: scope.toDate || scope.asOfDate,
      };
      if (scope.groupBy) params.groupBy = scope.groupBy;
      if (scope.reportBasis) params.reportBasis = scope.reportBasis;
      if (scope.breakdown) params.breakdown = scope.breakdown;
      if (scope.currency) params.currency = scope.currency;
      const res = await fetch('/api/accounting-v2/reports/drill-down', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: active.type,
          params,
          lineId: String(lineId).split('::')[0],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setDrill(json);
    } catch (err) {
      setError(err.message);
    }
  };

  const reportPickerProps = {
    reportTypeCategories: REPORT_CATEGORIES,
    reportType: active.type,
    onReportTypeChange: selectReportType,
    reportTitle: active.name,
    showPageHeader: true,
  };

  return (
    <div className="w-full">
      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <main className="min-w-0">
        {active.type === REPORTS_DASHBOARD_TYPE ? (
          <ReportsDashboardView {...reportPickerProps} />
        ) : active.type === 'INCOME_STATEMENT' ? (
          <ProfitLossReportView
            {...reportPickerProps}
            onDrill={(line, scope) => {
              if (line?.lineId) drillInto(line.lineId, scope);
            }}
          />
        ) : active.type === 'PROFIT_ANALYSIS' ? (
          <ProfitAnalysisReportView {...reportPickerProps} />
        ) : (
          <StudioReportView
            key={active.type}
            {...reportPickerProps}
            reportType={active.type}
            title={active.name}
            onDrill={(line, scope) => {
              if (line?.lineId) drillInto(line.lineId, scope);
            }}
          />
        )}
      </main>

      {drill ? <DrillDownModal drill={drill} onClose={() => setDrill(null)} /> : null}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            Loading reports…
          </div>
        </div>
      }
    >
      <ReportsPageInner />
    </Suspense>
  );
}
