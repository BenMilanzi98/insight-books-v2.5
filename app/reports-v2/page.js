'use client';

/**
 * Financial Reports (Phase 7) — canonical reporting UI (R3-C sole hub).
 *
 * Every figure on this page comes from /api/accounting-v2/reports/* — the same
 * Financial Reporting Engine that powers exports and the reconciliation
 * service. Report lines expand to their source accounts (code + name) and
 * drill down to General Ledger journal lines. Integrity status and unresolved
 * historical exceptions are always displayed — never hidden. Read-only.
 * Legacy /reports redirects here.
 */

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { REPORT_TYPES } from '@/lib/accountingV2/reporting/reportTypes';
import ReportLayout from '@/components/patterns/ReportLayout';


const firstDayOfYear = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

const CATEGORIES = [
  {
    name: 'Core Accounting',
    reports: [
      { type: 'TRIAL_BALANCE', name: 'Trial Balance', description: 'Opening, movement and closing balances per account from posted journal lines.' },
      { type: 'INCOME_STATEMENT', name: 'Income Statement', description: 'Period revenue, cost of sales, expenses, EBITDA and net profit.' },
      { type: 'PROFIT_ANALYSIS', name: 'Profit Analysis', description: 'Same P&L engine totals with gross and net margin ratios.' },
      { type: 'BALANCE_SHEET', name: 'Statement of Financial Position', description: 'Cumulative assets, liabilities and equity as of a date.' },
      { type: 'CASH_FLOW', name: 'Cash Flow Statement', description: 'Operating, investing and financing cash movements (indirect method).' },
      { type: 'EQUITY_STATEMENT', name: 'Statement of Changes in Equity', description: 'Opening equity, movements and closing equity.' },
    ],
  },
  {
    name: 'Receivables and Payables',
    reports: [
      { type: 'RECEIVABLES', name: 'Receivables Aging', description: 'Aging buckets reconciled to the AR control account.' },
      { type: 'PAYABLES', name: 'Payables Aging', description: 'Aging buckets reconciled to the AP control account.' },
    ],
  },
  {
    name: 'Sales and Operations (JE money)',
    reports: [
      { type: 'SALES', name: 'Sales Report', description: 'JE revenue, COGS and sales tax with invoice document context.' },
      { type: 'EXPENSES', name: 'Expense Report', description: 'JE expense movements with expense document context.' },
      { type: 'DAILY_POS', name: 'Daily POS Report', description: 'JE sales totals with POS receipt/shift context notes.' },
      { type: 'STOCK_MOVEMENTS', name: 'Stock Movement Report', description: 'Inventory JE debits/credits; quantities stay in stock domain.' },
      { type: 'INVENTORY_LOSS', name: 'Inventory Loss Report', description: 'JE loss and write-off expense accounts.' },
    ],
  },
  {
    name: 'Operations and Controls',
    reports: [
      { type: 'INVENTORY', name: 'Inventory Valuation', description: 'Inventory GL accounts with control reconciliation.' },
      { type: 'FIXED_ASSETS', name: 'Fixed Asset Register', description: 'Asset, accumulated depreciation and NBV accounts.' },
      { type: 'PAYROLL', name: 'Payroll Summary', description: 'Salaries (Account 5200) and payroll liabilities.' },
      { type: 'LOANS', name: 'Loan Summary', description: 'Loan liabilities and finance costs.' },
      { type: 'TAXES', name: 'Tax Reports', description: 'VAT, PAYE and tax accounts.' },
      { type: 'EQUITY', name: 'Equity Reports', description: 'Capital, drawings and reserves.' },
    ],
  },
  {
    name: 'Management',
    reports: [
      { type: 'BUDGET_VS_ACTUAL', name: 'Budget versus Actual', description: 'GL actuals against budget models.' },
    ],
  },
];

function Badge({ tone = 'muted', children }) {
  const cls =
    tone === 'ok'
      ? 'bg-green-100 text-green-800'
      : tone === 'warn'
        ? 'bg-amber-100 text-amber-800'
        : tone === 'bad'
          ? 'bg-red-100 text-red-800'
          : 'bg-slate-100 text-slate-700';
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

const integrityTone = (s) =>
  s === 'VERIFIED' || s === 'BALANCED' ? 'ok' : s === 'VERIFIED_WITH_WARNINGS' || s === 'BALANCED_WITH_WARNINGS' ? 'warn' : 'bad';

const fmt = (a) => {
  if (a == null) return '—';
  const n = Number(a.decimal ?? a);
  return n < 0 ? `(${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2 })})` : n.toLocaleString(undefined, { minimumFractionDigits: 2 });
};

function DrillDownModal({ drill, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Drill-down — {drill.lineLabel}</h2>
            <p className="text-sm text-slate-500">
              Line {fmt(drill.lineAmount)} · Ledger {fmt(drill.ledgerTotal)}{' '}
              {drill.reconciles ? <Badge tone="ok">reconciles</Badge> : <Badge tone="bad">REP-025 difference</Badge>}
            </p>
          </div>
          <button className="text-slate-500 hover:text-slate-800" onClick={onClose}>✕</button>
        </div>
        {drill.accounts.map((a) => (
          <div key={a.accountId} className="mb-4">
            <h3 className="mb-1 font-semibold">
              {a.accountCode} — {a.accountName}
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-1 pr-2">Date</th>
                  <th className="py-1 pr-2">Journal</th>
                  <th className="py-1 pr-2">Description</th>
                  <th className="py-1 pr-2 text-right">Debit</th>
                  <th className="py-1 pr-2 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {a.lines.map((l) => (
                  <tr key={l.lineId ?? `${l.journalId}-${l.lineNumber}`} className="border-b border-slate-100">
                    <td className="py-1 pr-2">{String(l.date ?? l.postingDate ?? '').slice(0, 10)}</td>
                    <td className="py-1 pr-2">{l.journalNumber ?? l.transactionId ?? l.journalEntryId ?? '—'}</td>
                    <td className="py-1 pr-2">{l.description ?? '—'}</td>
                    <td className="py-1 pr-2 text-right">{l.debit}</td>
                    <td className="py-1 pr-2 text-right">{l.credit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function findReportByType(type) {
  if (!type) return null;
  const upper = String(type).toUpperCase();
  for (const cat of CATEGORIES) {
    const match = cat.reports.find((r) => r.type === upper);
    if (match) return match;
  }
  return Object.values(REPORT_TYPES).includes(upper)
    ? { type: upper, name: upper.replaceAll('_', ' '), description: '' }
    : null;
}

function ReportsV2PageInner() {
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
    load();
  }, [load]);

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

  const warnings = useMemo(
    () => [...(report?.integrityWarnings ?? []), ...(report?.unresolvedExceptions ?? []).map((e) => ({
      code: e.findingCode ?? e.anomalyType,
      message: `Open historical exception (${e.severity ?? 'unknown severity'})`,
    }))],
    [report]
  );

  return (
    <ReportLayout
      title="Reports"
      description="All figures derive from canonical posted journal lines through the Financial Reporting Engine. Exports use the same calculation service as this screen. This is the sole financial reporting hub."
      period={
        <p className="text-sm font-medium text-[var(--text-primary)]" aria-live="polite">
          Current report: {selected.name}
        </p>
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row">

        <aside className="w-full shrink-0 lg:w-64" aria-label="Report selector">
          {CATEGORIES.map((cat) => (
            <div key={cat.name} className="mb-4">
              <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{cat.name}</h2>
              {cat.reports.map((r) => (
                <button
                  key={r.type}
                  type="button"
                  onClick={() => selectReport(r)}
                  title={r.description}
                  aria-current={selected.type === r.type ? 'true' : undefined}
                  className={`mb-1 block w-full rounded px-3 py-2 text-left text-sm ${
                    selected.type === r.type ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg bg-white p-3 shadow-sm">
            {!isAsOf && (
              <label className="text-sm">
                From
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="ml-2 rounded border px-2 py-1" />
              </label>
            )}
            <label className="text-sm">
              {isAsOf ? 'As of' : 'To'}
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="ml-2 rounded border px-2 py-1" />
            </label>
            {isTrialBalance && (
              <label className="text-sm">
                <input type="checkbox" checked={includeZero} onChange={(e) => setIncludeZero(e.target.checked)} className="mr-1" />
                Include zero balances
              </label>
            )}
            <button onClick={load} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
              Generate
            </button>
            <div className="ml-auto flex gap-2">
              {['csv', 'xlsx', 'pdf'].map((f) => (
                <a key={f} href={exportUrl(f)} className="rounded border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                  {f.toUpperCase()}
                </a>
              ))}
              <button onClick={() => window.print()} className="rounded border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                Print
              </button>
            </div>
          </div>

          {loading && <p className="p-4 text-slate-500">Generating from canonical journal lines…</p>}
          {error && <p className="rounded bg-red-50 p-3 text-red-700">{error}</p>}

          {report && (
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-bold">{report.reportName}</h2>
                {statusBadge}
                <span className="text-xs text-slate-500">
                  Definition v{report.definitionVersion} · generated {String(report.generatedAt).slice(0, 19).replace('T', ' ')}
                </span>
              </div>

              {warnings.length > 0 && (
                <div className="mb-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  <strong>{warnings.length} integrity disclosure(s):</strong>
                  <ul className="ml-4 list-disc">
                    {warnings.slice(0, 8).map((w, i) => (
                      <li key={i}>{w.code}: {w.message}</li>
                    ))}
                    {warnings.length > 8 && <li>… and {warnings.length - 8} more</li>}
                  </ul>
                </div>
              )}

              {isTrialBalance ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-1 pr-2">Code</th>
                      <th className="py-1 pr-2">Account</th>
                      <th className="py-1 pr-2 text-right">Opening Dr</th>
                      <th className="py-1 pr-2 text-right">Opening Cr</th>
                      <th className="py-1 pr-2 text-right">Period Dr</th>
                      <th className="py-1 pr-2 text-right">Period Cr</th>
                      <th className="py-1 pr-2 text-right">Closing Dr</th>
                      <th className="py-1 pr-2 text-right">Closing Cr</th>
                      <th className="py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {report.lines.map((r) => (
                      <tr key={r.accountId} className="border-b border-slate-100">
                        <td className="py-1 pr-2">{r.accountCode}</td>
                        <td className="py-1 pr-2">
                          {r.accountName} {r.warningStatus && <Badge tone="warn">{r.warningStatus}</Badge>}
                        </td>
                        <td className="py-1 pr-2 text-right">{fmt(r.openingDebit)}</td>
                        <td className="py-1 pr-2 text-right">{fmt(r.openingCredit)}</td>
                        <td className="py-1 pr-2 text-right">{fmt(r.periodDebit)}</td>
                        <td className="py-1 pr-2 text-right">{fmt(r.periodCredit)}</td>
                        <td className="py-1 pr-2 text-right">{fmt(r.closingDebit)}</td>
                        <td className="py-1 pr-2 text-right">{fmt(r.closingCredit)}</td>
                        <td className="py-1 text-right">
                          <a
                            className="text-blue-600 hover:underline"
                            href={`/general-ledger-v2?accountId=${r.accountId}`}
                          >
                            View
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td className="py-1 pr-2" colSpan={2}>TOTALS {report.totals.difference.minor !== 0 && <Badge tone="bad">Difference {fmt(report.totals.difference)}</Badge>}</td>
                      <td className="py-1 pr-2 text-right">{fmt(report.totals.openingDebit)}</td>
                      <td className="py-1 pr-2 text-right">{fmt(report.totals.openingCredit)}</td>
                      <td className="py-1 pr-2 text-right">{fmt(report.totals.periodDebit)}</td>
                      <td className="py-1 pr-2 text-right">{fmt(report.totals.periodCredit)}</td>
                      <td className="py-1 pr-2 text-right">{fmt(report.totals.closingDebit)}</td>
                      <td className="py-1 pr-2 text-right">{fmt(report.totals.closingCredit)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-1 pr-2">Line</th>
                      <th className="py-1 pr-2 text-right">Amount</th>
                      {report.lines.some((l) => l.comparativeAmount) && <th className="py-1 pr-2 text-right">Comparative</th>}
                      <th className="py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {report.lines.map((l) => (
                      <Fragment key={l.lineId}>
                        <tr className={`border-b border-slate-100 ${['GRAND_TOTAL', 'SUBTOTAL', 'CALCULATED_TOTAL'].includes(l.lineType) ? 'font-semibold' : ''} ${l.lineType === 'SECTION' ? 'bg-slate-50 font-bold uppercase' : ''}`}>
                          <td className="py-1.5 pr-2">
                            {l.label}
                            {l.warningStatus && <Badge tone="warn">{l.warningStatus}</Badge>}
                          </td>
                          <td className="py-1.5 pr-2 text-right">{l.lineType === 'SECTION' ? '' : fmt(l.currentAmount)}</td>
                          {report.lines.some((x) => x.comparativeAmount) && (
                            <td className="py-1.5 pr-2 text-right">{l.comparativeAmount ? fmt(l.comparativeAmount) : ''}</td>
                          )}
                          <td className="py-1.5 text-right text-xs">
                            {(l.accounts?.length ?? 0) > 0 && (
                              <>
                                <button className="mr-2 text-blue-600 hover:underline" onClick={() => toggleExpand(l.lineId)}>
                                  {expandedLines.has(l.lineId) ? 'Hide accounts' : `Accounts (${l.accounts.length})`}
                                </button>
                                <button className="text-blue-600 hover:underline" onClick={() => drillInto(l.lineId)}>
                                  Drill down
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                        {expandedLines.has(l.lineId) &&
                          l.accounts.map((a) => (
                            <tr key={`${l.lineId}-${a.accountId}`} className="border-b border-slate-50 bg-slate-50/50 text-xs">
                              <td className="py-1 pl-6 pr-2 text-slate-600">
                                {a.accountCode} — {a.accountName}
                              </td>
                              <td className="py-1 pr-2 text-right text-slate-600">{fmt(a.amount)}</td>
                              {report.lines.some((x) => x.comparativeAmount) && <td />}
                              <td className="py-1 text-right">
                                <a className="text-blue-600 hover:underline" href={`/general-ledger-v2?accountId=${a.accountId}`}>
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
          )}
        </main>
      </div>

      {drill && <DrillDownModal drill={drill} onClose={() => setDrill(null)} />}
    </ReportLayout>
  );
}

export default function ReportsV2Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl p-4 text-sm text-slate-500">Loading financial reports…</div>
      }
    >
      <ReportsV2PageInner />
    </Suspense>
  );
}
