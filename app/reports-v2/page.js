'use client';

/**
 * Financial Reports — canonical reporting UI (R3-C sole hub).
 *
 * Every figure on this page comes from /api/accounting-v2/reports/* — the same
 * Financial Reporting Engine that powers exports and the reconciliation
 * service. Report lines expand to their source accounts (code + name) and
 * drill down to General Ledger journal lines. Integrity status and unresolved
 * historical exceptions are always displayed — never hidden. Read-only.
 * Legacy /reports redirects here (/reports-v2).
 */

import { Fragment, Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart3,
  Calendar,
  Download,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { REPORT_TYPES } from '@/lib/accountingV2/reporting/reportTypes';
import ProfitLossReportView from '@/components/reports/ProfitLossReportView';

const firstDayOfYear = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

const CATEGORIES = [
  {
    name: 'Core Accounting',
    reports: [
      { type: 'INCOME_STATEMENT', name: 'Profit & Loss', description: 'Revenue, COGS, operating expenses, tax and net profit.' },
      { type: 'PROFIT_ANALYSIS', name: 'Profit Analysis', description: 'Full P&L drill-down with gross and net margin ratios.' },
      { type: 'BALANCE_SHEET', name: 'Statement of Financial Position', description: 'Cumulative assets, liabilities and equity as of a date.' },
      { type: 'CASH_FLOW', name: 'Cash Flow Statement', description: 'Operating, investing and financing cash movements (indirect method).' },
    ],
  },
  {
    name: 'Sales and Operations (JE money)',
    reports: [
      { type: 'SALES', name: 'Sales Report', description: 'JE revenue/COGS with POS and invoice insights (top customers, products, trend).' },
      { type: 'EXPENSES', name: 'Expense Report', description: 'JE expense totals with category, trend and largest-expense insights.' },
      { type: 'DAILY_POS', name: 'Daily Sales (POS)', description: 'Same data as POS Daily Sales — completed till sales for the day.' },
      { type: 'STOCK_MOVEMENTS', name: 'Stock Movement Report', description: 'Quantity movement from Inventory Management; JE inventory valuation alongside.' },
      { type: 'INVENTORY_LOSS', name: 'Inventory Loss Report', description: 'Stock-out / write-off movements from inventory records, reconciled to JE.' },
    ],
  },
  {
    name: 'Operations and Controls',
    reports: [
      { type: 'INVENTORY', name: 'Inventory Valuation', description: 'Inventory GL accounts with control reconciliation.' },
      { type: 'PAYROLL', name: 'Payroll Summary', description: 'Salaries (Account 5200) and payroll liabilities.' },
      { type: 'LOANS', name: 'Loan Summary', description: 'Loan liabilities and finance costs.' },
      { type: 'TAXES', name: 'Tax Reports', description: 'VAT, PAYE and tax accounts.' },
    ],
  },
];

/** Report types removed from this hub (still available elsewhere / via API if needed). */
const HIDDEN_REPORT_TYPES = new Set([
  'TRIAL_BALANCE',
  'RECEIVABLES',
  'PAYABLES',
  'EQUITY_STATEMENT',
  'EQUITY',
  'BUDGET_VS_ACTUAL',
  'FIXED_ASSETS',
]);

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

const integrityTone = (s) =>
  s === 'VERIFIED' || s === 'BALANCED' ? 'ok' : s === 'VERIFIED_WITH_WARNINGS' || s === 'BALANCED_WITH_WARNINGS' ? 'warn' : 'bad';

const fmt = (a) => {
  if (a == null) return '—';
  const n = Number(a.decimal ?? a);
  return n < 0 ? `(${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2 })})` : n.toLocaleString(undefined, { minimumFractionDigits: 2 });
};

/** Strip accidental "V2" / "Reports-v2" branding from API report names for display. */
function displayReportName(name) {
  if (!name) return 'Report';
  return String(name)
    .replace(/\bReports[\s_-]?[Vv]2\b/g, 'Reports')
    .replace(/\b[Vv]2\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function DrillDownModal({ drill, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-2xl border border-gray-100 bg-white/95 p-6 shadow-xl backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Drill-down — {drill.lineLabel}</h2>
            <p className="text-sm text-gray-500">
              Line {fmt(drill.lineAmount)} · Ledger {fmt(drill.ledgerTotal)}{' '}
              {drill.reconciles ? <Badge tone="ok">reconciles</Badge> : <Badge tone="bad">REP-025 difference</Badge>}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {drill.accounts.map((a) => (
          <div key={a.accountId} className="mb-4">
            <h3 className="mb-1 font-semibold text-gray-900">
              {a.accountCode} — {a.accountName}
            </h3>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr className="text-left text-gray-500">
                    <th className="px-3 py-2 pr-2 font-semibold">Date</th>
                    <th className="px-3 py-2 pr-2 font-semibold">Journal</th>
                    <th className="px-3 py-2 pr-2 font-semibold">Description</th>
                    <th className="px-3 py-2 pr-2 text-right font-semibold">Debit</th>
                    <th className="px-3 py-2 pr-2 text-right font-semibold">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {a.lines.map((l) => (
                    <tr key={l.lineId ?? `${l.journalId}-${l.lineNumber}`} className="border-t border-gray-100">
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

function findReportByType(type) {
  if (!type) return null;
  const upper = String(type).toUpperCase();
  if (HIDDEN_REPORT_TYPES.has(upper)) return null;
  for (const cat of CATEGORIES) {
    const match = cat.reports.find((r) => r.type === upper);
    if (match) return match;
  }
  return Object.values(REPORT_TYPES).includes(upper) && !HIDDEN_REPORT_TYPES.has(upper)
    ? { type: upper, name: upper.replaceAll('_', ' '), description: '' }
    : null;
}

function ReportsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const typeFromUrl = searchParams?.get('type');

  const [selected, setSelected] = useState(
    () => findReportByType(typeFromUrl) || CATEGORIES[0].reports[0]
  );
  const [fromDate, setFromDate] = useState(firstDayOfYear());
  const [toDate, setToDate] = useState(today());
  const [includeZero, setIncludeZero] = useState(false);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [drill, setDrill] = useState(null);
  const [expandedLines, setExpandedLines] = useState(() => new Set());

  useEffect(() => {
    const fromUrl = findReportByType(typeFromUrl);
    if (fromUrl && fromUrl.type !== selected.type) {
      setSelected(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync URL → selection only
  }, [typeFromUrl]);

  const selectReport = (r) => {
    setSelected(r);
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('type', r.type);
    router.replace(`/reports-v2?${params.toString()}`, { scroll: false });
  };

  const isAsOf = ['BALANCE_SHEET', 'RECEIVABLES', 'PAYABLES'].includes(selected.type);
  const isTrialBalance = selected.type === 'TRIAL_BALANCE';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const params = new URLSearchParams({ type: selected.type });
      if (!isAsOf) params.set('fromDate', fromDate);
      params.set('toDate', toDate);
      params.set('asOfDate', toDate);
      if (includeZero) params.set('includeZeroBalances', '1');
      const res = await fetch(`/api/accounting-v2/reports/generate?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}`);
      setReport(json);
      setExpandedLines(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selected, fromDate, toDate, includeZero, isAsOf]);

  useEffect(() => {
    if (selected.type === 'INCOME_STATEMENT') return;
    load();
  }, [load, selected.type]);

  const exportUrl = (format) => {
    const params = new URLSearchParams({ type: selected.type, format });
    if (!isAsOf) params.set('fromDate', fromDate);
    params.set('toDate', toDate);
    params.set('asOfDate', toDate);
    return `/api/accounting-v2/reports/export?${params}`;
  };

  const drillInto = async (lineId) => {
    try {
      const res = await fetch('/api/accounting-v2/reports/drill-down', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: selected.type,
          params: { fromDate: isAsOf ? undefined : fromDate, toDate, asOfDate: toDate, includeZeroBalances: includeZero },
          lineId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setDrill(json);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleExpand = (lineId) =>
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });

  const statusBadge = report && (
    <Badge tone={integrityTone(report.trialBalanceStatus ?? report.integrityStatus)}>
      {report.trialBalanceStatus ?? report.integrityStatus}
    </Badge>
  );

  return (
    <div className="w-full">
      {/* Header — POS-style */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:mb-8 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              Reports
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/60 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-800 shadow-sm backdrop-blur-sm">
              <BarChart3 className="h-3.5 w-3.5" aria-hidden />
              Financial
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Canonical figures from posted journal lines · current report:{' '}
            <span className="font-semibold text-gray-800">{selected.name}</span>
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center rounded-lg border border-gray-300 bg-white/80 px-4 py-2.5 backdrop-blur-sm transition-all hover:bg-white hover:shadow-md disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            <span className="text-sm font-medium">Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 border-l-4 border-l-red-500 bg-white/80 p-4 text-red-800 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Report selector */}
        <aside
          className="relative w-full shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-xl backdrop-blur-sm lg:w-72"
          aria-label="Report selector"
        >
          <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-sky-500 to-indigo-500" />
          <div className="mb-4 flex items-center gap-2 pt-1">
            <div className="rounded-lg bg-blue-100 p-2">
              <FileText className="h-4 w-4 text-blue-700" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">Report types</h2>
          </div>
          <div className="max-h-[min(70vh,720px)] space-y-4 overflow-y-auto pr-1">
            {CATEGORIES.map((cat) => (
              <div key={cat.name}>
                <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  {cat.name}
                </h3>
                <div className="space-y-1">
                  {cat.reports.map((r) => {
                    const active = selected.type === r.type;
                    return (
                      <button
                        key={r.type}
                        type="button"
                        onClick={() => selectReport(r)}
                        title={r.description}
                        aria-current={active ? 'true' : undefined}
                        className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
                          active
                            ? 'bg-blue-600 font-semibold text-white shadow-md'
                            : 'bg-white/60 text-gray-700 hover:bg-blue-50 hover:text-blue-800'
                        }`}
                      >
                        {r.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Main report panel */}
        <main className="min-w-0 flex-1 space-y-4">
          {selected.type === 'INCOME_STATEMENT' ? (
            <ProfitLossReportView
              onDrill={(line) => {
                if (line?.lineId) drillInto(line.lineId.split('::')[0]);
              }}
            />
          ) : (
            <>
          <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-xl backdrop-blur-sm sm:p-5">
            <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500" />
            <div className="mb-3 flex flex-wrap items-center gap-2 pt-1">
              <Calendar className="h-4 w-4 text-emerald-700" />
              <h2 className="text-sm font-bold text-gray-900">Period &amp; export</h2>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              {!isAsOf && (
                <label className="text-sm font-medium text-gray-700">
                  From
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="mt-1 block rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </label>
              )}
              <label className="text-sm font-medium text-gray-700">
                {isAsOf ? 'As of' : 'To'}
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="mt-1 block rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </label>
              {isTrialBalance && (
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeZero}
                    onChange={(e) => setIncludeZero(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Include zero balances
                </label>
              )}
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="rounded-lg bg-gradient-to-r from-green-600 to-green-700 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-60"
              >
                {loading ? 'Generating…' : 'Generate'}
              </button>
              <div className="ml-auto flex flex-wrap gap-2">
                {['csv', 'xlsx', 'pdf'].map((f) => (
                  <a
                    key={f}
                    href={exportUrl(f)}
                    className="inline-flex items-center rounded-lg border border-gray-300 bg-white/80 px-3 py-2 text-sm font-medium text-gray-700 backdrop-blur-sm transition-all hover:bg-white hover:shadow-md"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {f.toUpperCase()}
                  </a>
                ))}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center rounded-lg border border-gray-300 bg-white/80 px-3 py-2 text-sm font-medium text-gray-700 backdrop-blur-sm transition-all hover:bg-white hover:shadow-md"
                >
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  Print
                </button>
              </div>
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white/80 p-6 text-gray-600 shadow-xl backdrop-blur-sm">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Generating from canonical journal lines…</p>
            </div>
          )}

          {report && (
            <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-xl backdrop-blur-sm sm:p-6">
              <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-sky-500 to-indigo-500" />
              <div className="mb-4 flex flex-wrap items-center gap-3 pt-1">
                <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
                  {displayReportName(report.reportName)}
                </h2>
                {statusBadge}
                <span className="text-xs text-gray-500">
                  Definition v{report.definitionVersion} · generated{' '}
                  {String(report.generatedAt).slice(0, 19).replace('T', ' ')}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-100">
                {isTrialBalance ? (
                  <table className="w-full text-xs">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <tr className="text-left text-gray-500">
                        <th className="px-3 py-2.5 font-semibold">Code</th>
                        <th className="px-3 py-2.5 font-semibold">Account</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Opening Dr</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Opening Cr</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Period Dr</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Period Cr</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Closing Dr</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Closing Cr</th>
                        <th className="px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {report.lines.map((r) => (
                        <tr key={r.accountId} className="border-t border-gray-100 hover:bg-blue-50/40">
                          <td className="px-3 py-2 font-mono text-gray-700">{r.accountCode}</td>
                          <td className="px-3 py-2">
                            {r.accountName} {r.warningStatus && <Badge tone="warn">{r.warningStatus}</Badge>}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(r.openingDebit)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(r.openingCredit)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(r.periodDebit)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(r.periodCredit)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(r.closingDebit)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(r.closingCredit)}</td>
                          <td className="px-3 py-2 text-right">
                            <a
                              className="font-medium text-blue-600 hover:underline"
                              href={`/general-ledger-v2?accountId=${r.accountId}`}
                            >
                              View
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50/80 font-bold">
                        <td className="px-3 py-2" colSpan={2}>
                          TOTALS{' '}
                          {report.totals.difference.minor !== 0 && (
                            <Badge tone="bad">Difference {fmt(report.totals.difference)}</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(report.totals.openingDebit)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(report.totals.openingCredit)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(report.totals.periodDebit)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(report.totals.periodCredit)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(report.totals.closingDebit)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(report.totals.closingCredit)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <tr className="text-left text-gray-500">
                        <th className="px-3 py-2.5 font-semibold">Line</th>
                        {report.lines.some((l) => l.budgetAmount) ? (
                          <>
                            <th className="px-3 py-2.5 text-right font-semibold">Budget</th>
                            <th className="px-3 py-2.5 text-right font-semibold">Actual</th>
                            <th className="px-3 py-2.5 text-right font-semibold">Variance</th>
                            <th className="px-3 py-2.5 text-right font-semibold">%</th>
                          </>
                        ) : (
                          <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                        )}
                        {report.lines.some((l) => l.comparativeAmount) && (
                          <th className="px-3 py-2.5 text-right font-semibold">Comparative</th>
                        )}
                        <th className="px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {report.lines.map((l) => (
                        <Fragment key={l.lineId}>
                          <tr
                            className={`border-t border-gray-100 ${
                              ['GRAND_TOTAL', 'SUBTOTAL', 'CALCULATED_TOTAL'].includes(l.lineType)
                                ? 'font-semibold'
                                : ''
                            } ${l.lineType === 'SECTION' ? 'bg-slate-50/80 font-bold uppercase' : 'hover:bg-blue-50/40'}`}
                          >
                            <td className="px-3 py-2.5">
                              {l.label}
                              {l.warningStatus && <Badge tone="warn">{l.warningStatus}</Badge>}
                            </td>
                            {report.lines.some((x) => x.budgetAmount) ? (
                              <>
                                <td className="px-3 py-2.5 text-right tabular-nums">{l.budgetAmount ? fmt(l.budgetAmount) : '—'}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums">
                                  {l.lineType === 'SECTION' ? '' : fmt(l.currentAmount)}
                                </td>
                                <td className={`px-3 py-2.5 text-right tabular-nums ${l.metadata?.isFavourable === false ? 'text-red-600' : 'text-emerald-700'}`}>
                                  {l.budgetVariance ? fmt(l.budgetVariance) : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-xs text-gray-600">
                                  {l.variancePercentage != null ? `${Number(l.variancePercentage).toFixed(1)}%` : '—'}
                                </td>
                              </>
                            ) : (
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {l.lineType === 'SECTION' ? '' : fmt(l.currentAmount)}
                              </td>
                            )}
                            {report.lines.some((x) => x.comparativeAmount) && (
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {l.comparativeAmount ? fmt(l.comparativeAmount) : ''}
                              </td>
                            )}
                            <td className="px-3 py-2.5 text-right text-xs">
                              {(l.accounts?.length ?? 0) > 0 && (
                                <>
                                  <button
                                    type="button"
                                    className="mr-2 font-medium text-blue-600 hover:underline"
                                    onClick={() => toggleExpand(l.lineId)}
                                  >
                                    {expandedLines.has(l.lineId)
                                      ? 'Hide accounts'
                                      : `Accounts (${l.accounts.length})`}
                                  </button>
                                  <button
                                    type="button"
                                    className="font-medium text-blue-600 hover:underline"
                                    onClick={() => drillInto(l.lineId)}
                                  >
                                    Drill down
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                          {expandedLines.has(l.lineId) &&
                            l.accounts.map((a) => (
                              <tr
                                key={`${l.lineId}-${a.accountId}`}
                                className="border-t border-gray-50 bg-slate-50/50 text-xs"
                              >
                                <td className="px-3 py-1.5 pl-8 text-gray-600">
                                  {a.accountCode} — {a.accountName}
                                </td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">
                                  {fmt(a.amount)}
                                </td>
                                {report.lines.some((x) => x.comparativeAmount) && <td />}
                                <td className="px-3 py-1.5 text-right">
                                  <a
                                    className="font-medium text-blue-600 hover:underline"
                                    href={`/general-ledger-v2?accountId=${a.accountId}`}
                                  >
                                    View GL
                                  </a>
                                </td>
                              </tr>
                            ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {report.operationalContext && (
                <div className="mt-6 space-y-4 rounded-xl border border-sky-100 bg-sky-50/50 p-4">
                  <h3 className="text-sm font-bold text-sky-900">Operational insights</h3>
                  {report.operationalContext.topCustomers && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-sky-800">Top customers</p>
                      <ul className="text-sm text-gray-700">
                        {report.operationalContext.topCustomers.map((c) => (
                          <li key={c.name} className="flex justify-between">
                            <span>{c.name}</span>
                            <span className="tabular-nums">{Number(c.amount || 0).toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {report.operationalContext.topProducts && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-sky-800">Top products</p>
                      <ul className="text-sm text-gray-700">
                        {report.operationalContext.topProducts.map((p) => (
                          <li key={p.name} className="flex justify-between">
                            <span>{p.name}</span>
                            <span className="tabular-nums">{Number(p.amount || 0).toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {report.operationalContext.byCategory && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-sky-800">By category</p>
                      <ul className="text-sm text-gray-700">
                        {report.operationalContext.byCategory.slice(0, 8).map((c) => (
                          <li key={c.category} className="flex justify-between">
                            <span>{c.category}</span>
                            <span className="tabular-nums">{Number(c.amount || 0).toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {report.operationalContext.items && (
                    <p className="text-sm text-gray-700">
                      {report.operationalContext.summary?.totalCount ?? report.operationalContext.items.length} inventory loss movement(s).
                    </p>
                  )}
                  {report.operationalContext.productMovements && (
                    <p className="text-sm text-gray-700">
                      {report.operationalContext.productMovements.length} product(s) with stock movement in this period.
                    </p>
                  )}
                  {report.operationalContext.latest?.totalSales != null && (
                    <p className="text-sm text-gray-700">
                      POS daily sales: {Number(report.operationalContext.latest.totalSales).toLocaleString()} ·{' '}
                      {report.operationalContext.latest.transactionCount || 0} transactions.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
            </>
          )}
        </main>
      </div>

      {drill && <DrillDownModal drill={drill} onClose={() => setDrill(null)} />}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white/80 px-6 py-4 text-sm text-gray-600 shadow-xl backdrop-blur-sm">
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
