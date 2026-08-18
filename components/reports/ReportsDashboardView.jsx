'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  FileText,
  Landmark,
  PiggyBank,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import ReportStudioShell from '@/components/reports/ReportStudioShell';
import ReportStudioFilters from '@/components/reports/ReportStudioFilters';
import ReportsDonutChart from '@/components/reports/ReportsDonutChart';
import ReportsProfitTrendChart from '@/components/reports/ReportsProfitTrendChart';
import {
  defaultFilterDraft,
  filterConfigForReportType,
  normalizePreset,
  rangeFromPreset,
} from '@/lib/reports/reportDatePresets';
import { formatCurrency } from '@/lib/currencyUtils';

const EXPENSE_COLORS = ['#f43f5e', '#f97316', '#eab308', '#6366f1', '#14b8a6', '#64748b', '#a855f7', '#0ea5e9'];

function ChangeBadge({ value }) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  const up = n >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
        up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
      }`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(n).toFixed(1)}%
    </span>
  );
}

function KpiTile({ label, value, change, icon: Icon, accent, hint }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
      <div className="flex items-start justify-between gap-2 pt-1">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-slate-500">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {change != null ? (
        <div className="mt-2 flex items-center gap-2">
          <ChangeBadge value={change} />
          <span className="text-xs text-slate-400">{tt('vs prior period')}</span>
        </div>
      ) : null}
    </div>
  );
}

function PositionPanel({ summary }) {
  if (!summary) return null;
  const rows = [
    { label: 'Cash & bank (GL)', value: summary.totalAccountBalances, icon: Wallet },
    { label: 'Receivables', value: summary.totalReceivables, icon: Receipt },
    { label: 'Payables', value: summary.totalPayables, icon: Landmark },
    { label: 'Net working capital', value: summary.netPosition, icon: PiggyBank },
  ];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-slate-900">{tt('Financial position')}</h3>
      <ul className="space-y-2">
        {rows.map(({ label, value, icon: Icon }) => (
          <li key={label} className="flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2">
            <span className="flex items-center gap-2 text-sm text-slate-700">
              <Icon className="h-4 w-4 text-blue-600" />
              {label}
            </span>
            <span className="text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(value || 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Reports hub dashboard — summary KPIs, trends, and charts.
 */
export default function ReportsDashboardView({
  reportTypeCategories,
  reportType,
  onReportTypeChange,
  reportTitle,
  showPageHeader,
}) {
  const [draft, setDraft] = useState(() => defaultFilterDraft('REPORTS_DASHBOARD'));
  const [applied, setApplied] = useState(() => defaultFilterDraft('REPORTS_DASHBOARD'));
  const [metrics, setMetrics] = useState(null);
  const [position, setPosition] = useState(null);
  const [trend, setTrend] = useState(null);
  const [expenseBreakdown, setExpenseBreakdown] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rangeKey = normalizePreset(applied.preset);
      const params = new URLSearchParams({ dateRange: rangeKey });
      if (applied.preset === 'custom') {
        params.set('startDate', applied.fromDate);
        params.set('endDate', applied.toDate);
      }
      const fpParams = new URLSearchParams(params);
      if (applied.preset === 'custom') {
        fpParams.set('dateRange', 'custom');
      }
      const [mRes, pRes, tRes, eRes] = await Promise.all([
        fetch(`/api/dashboard/metrics?${params}`),
        fetch(`/api/dashboard/financial-position?${fpParams}`),
        fetch(`/api/dashboard/income-expenses?${params}`),
        fetch(`/api/dashboard/expenses-breakdown?${params}`),
      ]);
      const [mJson, pJson, tJson, eJson] = await Promise.all([
        mRes.json(),
        pRes.json(),
        tRes.json(),
        eRes.json(),
      ]);
      if (!mRes.ok) throw new Error(mJson.error || 'Failed to load metrics');
      if (!pRes.ok) throw new Error(pJson.error || 'Failed to load position');
      if (!tRes.ok) throw new Error(tJson.error || 'Failed to load trends');
      if (!eRes.ok) throw new Error(eJson.error || 'Failed to load expense breakdown');
      setMetrics(mJson.financialSummary);
      setPosition(pJson.financialPosition?.summary);
      setTrend(tJson.incomeExpenses);
      setExpenseBreakdown(eJson.expensesBreakdown || []);
    } catch (e) {
      setError(e.message);
      setMetrics(null);
      setPosition(null);
      setTrend(null);
      setExpenseBreakdown([]);
    } finally {
      setLoading(false);
    }
  }, [applied]);

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
    const d = defaultFilterDraft('REPORTS_DASHBOARD');
    setDraft(d);
    setApplied(d);
  };

  const fs = metrics || {};
  const profitMargin =
    fs.revenue?.current > 0 ? ((fs.profit?.current / fs.revenue.current) * 100).toFixed(1) : null;

  const revenueSplit = useMemo(() => {
    const revenue = Math.max(0, fs.revenue?.current || 0);
    const expenses = Math.max(0, fs.expenses?.current || 0);
    const profit = Math.max(0, fs.profit?.current || 0);
    if (revenue <= 0) return [];
    return [
      { name: 'Expenses', value: Math.min(expenses, revenue), color: '#f43f5e' },
      { name: 'Net profit', value: profit, color: '#0ea5e9' },
    ].filter((d) => d.value > 0);
  }, [fs]);

  const expensePie = useMemo(
    () =>
      expenseBreakdown.slice(0, 8).map((row, i) => ({
        name: row.category,
        value: row.amount,
        color: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
      })),
    [expenseBreakdown]
  );

  const positionPie = useMemo(() => {
    if (!position) return [];
    return [
      { name: 'Cash & bank', value: position.totalAccountBalances, color: '#10b981' },
      { name: 'Receivables', value: position.totalReceivables, color: '#0ea5e9' },
      { name: 'Payables', value: position.totalPayables, color: '#f43f5e' },
    ].filter((d) => (d.value || 0) > 0);
  }, [position]);

  return (
    <ReportStudioShell
      showPageHeader={showPageHeader}
      reportTitle={reportTitle ?? 'Dashboard'}
      loading={loading}
      loadingLabel={tt('Loading financial summary…')}
      error={error}
      exportFormats={[]}
      reportTypeCategories={reportTypeCategories}
      reportType={reportType}
      onReportTypeChange={onReportTypeChange}
      filtersOpen={filtersOpen}
      onToggleFilters={(next) => setFiltersOpen(typeof next === 'boolean' ? next : (v) => !v)}
      filters={
        <ReportStudioFilters
          draft={draft}
          onChange={setDraft}
          onApply={applyDraft}
          onReset={resetAll}
          onClose={() => setFiltersOpen(false)}
          applying={loading}
          config={filterConfigForReportType('REPORTS_DASHBOARD')}
        />
      }
    >
      {!loading && metrics ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile
              label="Revenue"
              value={formatCurrency(fs.revenue?.current || 0)}
              change={fs.revenue?.change}
              icon={TrendingUp}
              accent="from-emerald-400 via-green-500 to-teal-500"
            />
            <KpiTile
              label="Expenses"
              value={formatCurrency(fs.expenses?.current || 0)}
              change={fs.expenses?.change}
              icon={TrendingDown}
              accent="from-rose-400 via-rose-500 to-orange-500"
            />
            <KpiTile
              label="Net profit"
              value={formatCurrency(fs.profit?.current || 0)}
              change={fs.profit?.change}
              icon={BarChart3}
              accent="from-blue-500 via-sky-500 to-indigo-500"
              hint={profitMargin != null ? `${profitMargin}% margin` : undefined}
            />
            <KpiTile
              label="Net cash flow"
              value={formatCurrency(fs.cashFlow?.current?.netFlow || 0)}
              change={fs.cashFlow?.change}
              icon={Banknote}
              accent="from-violet-400 via-purple-500 to-indigo-500"
              hint={`In ${formatCurrency(fs.cashFlow?.current?.cashIn || 0)} · Out ${formatCurrency(fs.cashFlow?.current?.cashOut || 0)}`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ReportsProfitTrendChart
                months={trend?.months}
                income={trend?.income}
                expenses={trend?.expenses}
              />
            </div>
            <PositionPanel summary={position} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50/80 to-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-blue-800">
                <FileText className="h-5 w-5" />
                <h3 className="text-sm font-bold">{tt('Outstanding invoices')}</h3>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                {formatCurrency(fs.outstandingInvoices?.current || 0)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {fs.outstandingInvoices?.count || 0} open invoice(s)
                {fs.outstandingInvoices?.change != null ? (
                  <>
                    {' '}
                    · <ChangeBadge value={fs.outstandingInvoices.change} />
                  </>
                ) : null}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">{tt('Period at a glance')}</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-600">{tt('Gross activity')}</dt>
                  <dd className="font-medium tabular-nums text-slate-900">
                    {formatCurrency((fs.revenue?.current || 0) + (fs.expenses?.current || 0))}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">{tt('Profit margin')}</dt>
                  <dd className="font-medium text-emerald-700">{profitMargin != null ? `${profitMargin}%` : '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">{tt('Cash on hand (GL)')}</dt>
                  <dd className="font-medium tabular-nums text-slate-900">
                    {formatCurrency(position?.totalAccountBalances || 0)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ReportsDonutChart
              title={tt('Revenue allocation')}
              data={revenueSplit}
              centerLabel="Revenue"
              centerValue={formatCurrency(fs.revenue?.current || 0)}
              emptyLabel="No revenue in this period"
            />
            <ReportsDonutChart
              title={tt('Expense breakdown')}
              data={expensePie}
              centerLabel="Total"
              centerValue={formatCurrency(fs.expenses?.current || 0)}
              emptyLabel="No expenses in this period"
            />
            <ReportsDonutChart
              title={tt('Balance sheet mix')}
              data={positionPie}
              centerLabel="Exposure"
              emptyLabel="No position data"
            />
          </div>
        </div>
      ) : !loading ? (
        <p className="py-8 text-sm text-slate-500">{tt('No summary data for this period.')}</p>
      ) : null}
    </ReportStudioShell>
  );
}
