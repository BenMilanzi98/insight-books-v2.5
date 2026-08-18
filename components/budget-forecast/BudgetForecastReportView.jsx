'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReportStudioShell from '@/components/reports/ReportStudioShell';
import BudgetForecastFilters, {
  reportNeedsBudget,
  reportNeedsForecast,
} from '@/components/budget-forecast/BudgetForecastFilters';
import { StatusBadge } from '@/components/budget-forecast/BfShell';
import { formatCurrency } from '@/lib/currencyUtils';
import { RUNNABLE_REPORT_IDS } from '@/lib/budgetForecast/reportFilterConfig';

function defaultDraft(budgets = [], forecasts = [], seed = {}) {
  return {
    reportId: seed.reportId || 'BVA',
    budgetId: seed.budgetId || budgets[0]?.id || '',
    forecastId: seed.forecastId || forecasts[0]?.id || '',
    periodGranularity: seed.periodGranularity || 'MONTH',
    periodKey: seed.periodKey || 'ALL',
  };
}

function displayLines(report) {
  if (!report) return [];
  if (Array.isArray(report.lines) && report.lines.length) return report.lines;
  const extra = [];
  if (Array.isArray(report.expense)) extra.push(...report.expense);
  if (Array.isArray(report.revenue)) extra.push(...report.revenue);
  return extra;
}

function cashOutlookRows(report) {
  if (!report || report.reportId !== 'CASH_OUTLOOK') return null;
  return [
    { label: 'Opening cash', amount: (report.openingCashMinor || 0) / 100 },
    { label: 'Projected inflows', amount: (report.projectedInflowsMinor || 0) / 100 },
    { label: 'Projected outflows', amount: (report.projectedOutflowsMinor || 0) / 100 },
    { label: 'Closing cash', amount: (report.closingCashMinor || 0) / 100, total: true },
  ];
}

export default function BudgetForecastReportView() {
  const searchParams = useSearchParams();
  const [definitions, setDefinitions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [draft, setDraft] = useState(() => defaultDraft());
  const [applied, setApplied] = useState(() => defaultDraft());
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [d, b, f] = await Promise.all([
          fetch('/api/budget-forecast/reports').then((r) => r.json()),
          fetch('/api/budget-forecast/budgets').then((r) => r.json()),
          fetch('/api/budget-forecast/forecasts').then((r) => r.json()),
        ]);
        const defs = (d.data || []).filter((x) => RUNNABLE_REPORT_IDS.has(x.id));
        const order = ['BUDGET', 'BVA', 'UTILIZATION', 'COMPLETION', 'BVF', 'FVA', 'CASH_OUTLOOK'];
        defs.sort((a, b) => {
          const ai = order.indexOf(a.id);
          const bi = order.indexOf(b.id);
          return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
        });
        const budgetRows = b.data || [];
        const forecastRows = f.data || [];
        setDefinitions(defs);
        setBudgets(budgetRows);
        setForecasts(forecastRows);
        const seed = {
          reportId: searchParams?.get('reportId') || undefined,
          budgetId: searchParams?.get('budgetId') || undefined,
          forecastId: searchParams?.get('forecastId') || undefined,
        };
        if (seed.reportId) seed.reportId = String(seed.reportId).toUpperCase();
        if (seed.reportId && !RUNNABLE_REPORT_IDS.has(seed.reportId)) seed.reportId = 'BVA';
        const next = defaultDraft(budgetRows, forecastRows, seed);
        if (!defs.find((x) => x.id === next.reportId) && defs[0]?.id) next.reportId = defs[0].id;
        setDraft(next);
        setApplied(next);
      } catch (e) {
        setError(e.message || 'Failed to load report options');
      } finally {
        setReady(true);
      }
    })();
  }, [searchParams]);

  const run = useCallback(
    async (format, scope = applied) => {
      setLoading(true);
      setError('');
      try {
        if (format === 'xlsx' || format === 'pdf') {
          const res = await fetch('/api/budget-forecast/reports/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reportId: scope.reportId,
              budgetId: scope.budgetId || undefined,
              forecastId: scope.forecastId || undefined,
              periodGranularity: scope.periodGranularity || undefined,
              periodKey: scope.periodKey || undefined,
              format,
            }),
          });
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error || 'Export failed');
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${String(scope.reportId).toLowerCase()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
          a.click();
          URL.revokeObjectURL(url);
          return;
        }

        const res = await fetch('/api/budget-forecast/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportId: scope.reportId,
            budgetId: scope.budgetId || undefined,
            forecastId: scope.forecastId || undefined,
            periodGranularity: scope.periodGranularity || undefined,
            periodKey: scope.periodKey || undefined,
            format,
          }),
        });
        if (format === 'csv') {
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error || 'Export failed');
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${String(scope.reportId).toLowerCase()}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          return;
        }
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Report failed');
        setReport(json.data);
      } catch (e) {
        setError(e.message);
        if (format !== 'csv') setReport(null);
      } finally {
        setLoading(false);
      }
    },
    [applied]
  );

  useEffect(() => {
    if (!ready) return;
    const needsBudget = reportNeedsBudget(applied.reportId);
    const needsForecast = reportNeedsForecast(applied.reportId);
    if (needsBudget && !applied.budgetId) return;
    if (needsForecast && !applied.forecastId) return;
    run();
  }, [applied, ready, run]);

  const applyDraft = () => setApplied({ ...draft });
  const resetAll = () => {
    const next = defaultDraft(budgets, forecasts);
    if (definitions[0]?.id) next.reportId = definitions[0].id;
    setDraft(next);
    setApplied(next);
  };

  const title = report?.name || definitions.find((d) => d.id === applied.reportId)?.name || 'Budget reports';
  const lines = displayLines(report);
  const pnlRows = report?.pnlGrouped?.rows || [];
  const usePnlLayout =
    (applied.reportId === 'BVA' || applied.reportId === 'BUDGET') && pnlRows.length > 0;
  const pnlPlanOnly = usePnlLayout && (report?.reportId === 'BUDGET' || applied.reportId === 'BUDGET');
  const cashRows = cashOutlookRows(report);
  const isPlanOnly = report?.reportId === 'BUDGET' || applied.reportId === 'BUDGET';
  const isCompletion = report?.reportId === 'COMPLETION' || applied.reportId === 'COMPLETION';
  const showVariance = !isPlanOnly && !isCompletion && !cashRows;

  return (
    <ReportStudioShell
      showPageHeader
      reportTitle={title}
      loading={loading}
      loadingLabel={`Generating ${title}…`}
      error={error || null}
      exportFormats={['csv', 'xlsx', 'pdf']}
      onExport={(format) => run(format)}
      filtersOpen={filtersOpen}
      onToggleFilters={(next) => setFiltersOpen(typeof next === 'boolean' ? next : (v) => !v)}
      filters={
        <BudgetForecastFilters
          draft={draft}
          onChange={setDraft}
          onApply={applyDraft}
          onReset={resetAll}
          onClose={() => setFiltersOpen(false)}
          definitions={definitions}
          budgets={budgets}
          forecasts={forecasts}
          applying={loading}
        />
      }
    >
      {isCompletion && report?.completion ? (
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {tt('Completion score:')} <strong>{report.completion.percent}%</strong>
          {(report.completion.remaining || []).length ? (
            <span className="ml-2 text-blue-800">
              Remaining: {(report.completion.remaining || []).join(' · ')}
            </span>
          ) : (
            <span className="ml-2">{tt('Budget checklist is complete.')}</span>
          )}
        </div>
      ) : null}

      {!report && !loading ? (
        <p className="py-8 text-sm text-slate-500">{tt('Choose a report and click Apply.')}</p>
      ) : null}

      {report?.insight && (showVariance || isPlanOnly) ? (
        <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          {report.insight}
        </div>
      ) : null}

      {report?.totals && isPlanOnly && report.totals.netProfit != null ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{tt('Planned revenue')}</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(report.totals.revenue || 0)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{tt('Gross profit')}</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(report.totals.grossProfit || 0)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{tt('Net profit')}</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(report.totals.netProfit || 0)}</p>
          </div>
        </div>
      ) : null}

      {report?.totals && showVariance ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{tt('Budget total')}</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(report.totals.budget || 0)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{tt('Actual / Forecast')}</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(report.totals.actual || 0)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{tt('Variance')}</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(report.totals.rawVariance || 0)}</p>
          </div>
        </div>
      ) : null}

      {cashRows ? (
        <div className="space-y-6">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b-2 border-blue-600 text-left text-xs uppercase tracking-wide text-blue-600">
                  <th className="py-3 pr-4 font-semibold"> </th>
                  <th className="px-3 py-3 text-right font-semibold">{tt('Total')}</th>
                </tr>
              </thead>
              <tbody>
                {cashRows.map((row, i) => (
                  <tr key={row.label} className={`border-b border-slate-100 ${i % 2 ? 'bg-slate-50/70' : ''}`}>
                    <td className={`py-2.5 pr-4 ${row.total ? tt('font-bold text-slate-900') : tt('font-semibold text-blue-600')}`}>
                      {row.label}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${row.total ? 'font-bold' : 'text-slate-700'}`}>
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {Array.isArray(report?.months) && report.months.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-blue-600 text-left text-xs uppercase tracking-wide text-blue-600">
                    <th className="py-3 pr-4 font-semibold">{tt('Month')}</th>
                    <th className="px-3 py-3 text-right font-semibold">{tt('Opening')}</th>
                    <th className="px-3 py-3 text-right font-semibold">{tt('Receipts')}</th>
                    <th className="px-3 py-3 text-right font-semibold">{tt('Payments')}</th>
                    <th className="px-3 py-3 text-right font-semibold">{tt('Closing')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.months.map((m, i) => (
                    <tr key={m.key || i} className={`border-b border-slate-100 ${i % 2 ? 'bg-slate-50/70' : ''}`}>
                      <td className="py-2.5 pr-4 font-semibold text-blue-600">{m.key}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(m.openingCash || 0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(m.expectedReceipts || 0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(m.expectedPayments || 0)}</td>
                      <td
                        className={`px-3 py-2.5 text-right tabular-nums font-medium ${
                          Number(m.closingCash) < 0 ? 'text-red-700' : 'text-slate-900'
                        }`}
                      >
                        {formatCurrency(m.closingCash || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {usePnlLayout ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b-2 border-blue-600 text-left text-xs uppercase tracking-wide text-blue-600">
                <th className="py-3 pr-4 font-semibold">{tt('Account / Section')}</th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                  {pnlPlanOnly ? tt('Planned') : tt('Budget')}
                </th>
                {!pnlPlanOnly ? (
                  <>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">{tt('Actual')}</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">{tt('Variance')}</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {pnlRows.map((row, i) => {
                const colSpan = pnlPlanOnly ? 2 : 4;
                if (row.rowType === 'SECTION') {
                  return (
                    <tr key={`${row.lineId}-${i}`} className="border-t-2 border-slate-200 bg-slate-100/80">
                      <td colSpan={colSpan} className="py-2.5 pl-3 text-xs font-bold uppercase tracking-wide text-slate-700">
                        {row.label}
                      </td>
                    </tr>
                  );
                }
                const favourable = row.isFavourable !== false && Number(row.variance) >= 0;
                const isCalc = row.rowType === 'CALCULATED';
                const planned = row.budget ?? row.total ?? 0;
                return (
                  <tr
                    key={row.accountId || row.lineId || i}
                    className={`border-b border-slate-100 ${isCalc ? 'bg-indigo-50/50 font-semibold' : i % 2 ? 'bg-slate-50/70' : ''}`}
                  >
                    <td className={`py-2.5 pr-4 ${isCalc ? '' : 'pl-6'}`}>
                      {row.accountCode ? (
                        <>
                          <span className="font-semibold text-blue-600">{row.accountCode}</span>
                          <span className="ml-2 text-slate-700">{row.accountName}</span>
                        </>
                      ) : (
                        row.label
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {formatCurrency(planned)}
                    </td>
                    {!pnlPlanOnly ? (
                      <>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                          {formatCurrency(row.actual || 0)}
                        </td>
                        <td
                          className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${
                            favourable ? 'font-medium text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(row.variance || 0)}
                        </td>
                      </>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {!usePnlLayout && lines.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b-2 border-blue-600 text-left text-xs uppercase tracking-wide text-blue-600">
                <th className="py-3 pr-4 font-semibold">{tt('Account')}</th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">{tt('Budget')}</th>
                {showVariance ? (
                  <>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">{tt('Actual')}</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">{tt('Variance')}</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">%</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">{tt('Status')}</th>
                    <th className="min-w-[14rem] px-3 py-3 font-semibold">{tt('What it means')}</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const pct = line.variancePercent;
                const favourable = Number(line.favourableVarianceMinor || 0) >= 0;
                return (
                  <tr
                    key={line.accountId || `${line.accountCode}-${i}`}
                    className={`border-b border-slate-100 ${i % 2 ? 'bg-slate-50/70' : ''}`}
                  >
                    <td className="py-2.5 pr-4">
                      <span className="font-semibold text-blue-600">{line.accountCode}</span>
                      <span className="ml-2 text-slate-700">{line.accountName}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-700">
                      {formatCurrency(line.budget || 0)}
                    </td>
                    {showVariance ? (
                      <>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-700">
                          {formatCurrency(line.actual ?? line.forecast ?? 0)}
                        </td>
                        <td
                          className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${
                            favourable ? 'font-medium text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {formatCurrency((line.favourableVarianceMinor || 0) / 100)}
                        </td>
                        <td
                          className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${
                            favourable ? 'font-medium text-emerald-600' : 'text-slate-600'
                          }`}
                        >
                          {pct == null ? line.percentState || '—' : `${Number(pct).toFixed(1)}%`}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right">
                          <StatusBadge status={line.status} />
                        </td>
                        <td className="max-w-xs px-3 py-2.5 text-xs text-slate-600">{line.message || '—'}</td>
                      </>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </ReportStudioShell>
  );
}
