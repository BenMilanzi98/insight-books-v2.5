'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PermissionGuard from '@/components/PermissionGuard';
import { ArrowRight, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function aggregateByPeriod(rows, periodOrder) {
  const map = Object.fromEntries(periodOrder.map((pk) => [pk, { planned: 0, actual: 0 }]));
  for (const r of rows || []) {
    if (!map[r.period]) continue;
    map[r.period].planned += Number(r.planned) || 0;
    map[r.period].actual += Number(r.actual) || 0;
  }
  return periodOrder.map((pk) => ({
    period: pk,
    planned: map[pk].planned,
    actual: map[pk].actual,
  }));
}

function topAccountsByVolume(rows, limit = 6) {
  const scored = (rows || []).map((r) => ({
    ...r,
    _vol: Math.abs(Number(r.planned) || 0) + Math.abs(Number(r.actual) || 0),
  }));
  scored.sort((a, b) => b._vol - a._vol);
  return scored.slice(0, limit).map(({ _vol, ...rest }) => rest);
}

function chartTooltipFormatter(value) {
  return [formatCurrency(value), ''];
}

function compactAxisTick(v) {
  if (v == null || Number.isNaN(Number(v))) return '0';
  const n = Number(v);
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1000) return `${(n / 1e3).toFixed(0)}k`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function BfReportsPage() {
  const [budgets, setBudgets] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [expenseBudgetId, setExpenseBudgetId] = useState('');
  const [revenueForecastId, setRevenueForecastId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [variance, setVariance] = useState(null);
  const [loadingVariance, setLoadingVariance] = useState(false);
  const [error, setError] = useState(null);
  /** @type {'summary' | 'revenue_by_period' | 'expense_by_period' | 'revenue_accounts' | 'expense_accounts'} */
  const [chartDataset, setChartDataset] = useState('summary');

  useEffect(() => {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    setStart(`${y}-${m}-01`);
    setEnd(`${y}-${m}-${String(t.getDate()).padStart(2, '0')}`);
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const [b, f] = await Promise.all([fetch('/api/bf/expense-budgets'), fetch('/api/bf/revenue-forecasts')]);
      const jb = await b.json();
      const jf = await f.json();
      if (b.ok) setBudgets(jb.data || []);
      if (f.ok) setForecasts(jf.data || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const revenueByPeriod = useMemo(() => {
    if (!variance?.periodKeys?.length) return [];
    return aggregateByPeriod(variance.revenue?.rows, variance.periodKeys);
  }, [variance]);

  const expensesByPeriod = useMemo(() => {
    if (!variance?.periodKeys?.length) return [];
    return aggregateByPeriod(variance.expenses?.rows, variance.periodKeys);
  }, [variance]);

  const summaryBars = useMemo(() => {
    if (!variance) return [];
    return [
      {
        name: 'Revenue',
        planned: Number(variance.revenue?.totals?.planned) || 0,
        actual: Number(variance.revenue?.totals?.actual) || 0,
      },
      {
        name: 'Expenses',
        planned: Number(variance.expenses?.totals?.planned) || 0,
        actual: Number(variance.expenses?.totals?.actual) || 0,
      },
      {
        name: 'Profit',
        planned: Number(variance.profit?.planned) || 0,
        actual: Number(variance.profit?.actual) || 0,
      },
    ];
  }, [variance]);

  const revenueAccountBars = useMemo(() => {
    if (!variance?.revenue?.rows?.length) return [];
    return topAccountsByVolume(variance.revenue.rows, 8).map((r) => ({
      name: `${r.accountCode || ''} ${(r.accountName || '').slice(0, 18)}`.trim() || r.accountId,
      fullLabel: `${r.accountCode || ''} ${r.accountName || ''}`.trim(),
      planned: Number(r.planned) || 0,
      actual: Number(r.actual) || 0,
    }));
  }, [variance]);

  const expenseAccountBars = useMemo(() => {
    if (!variance?.expenses?.rows?.length) return [];
    return topAccountsByVolume(variance.expenses.rows, 8).map((r) => ({
      name: `${r.accountCode || ''} ${(r.accountName || '').slice(0, 18)}`.trim() || r.accountId,
      fullLabel: `${r.accountCode || ''} ${r.accountName || ''}`.trim(),
      planned: Number(r.planned) || 0,
      actual: Number(r.actual) || 0,
    }));
  }, [variance]);

  const runVariance = async () => {
    if (!expenseBudgetId && !revenueForecastId) {
      setError('Pick an expense budget and/or a revenue forecast to run planned vs actual.');
      setVariance(null);
      return;
    }
    setLoadingVariance(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (expenseBudgetId) qs.set('expenseBudgetId', expenseBudgetId);
      if (revenueForecastId) qs.set('revenueForecastId', revenueForecastId);
      qs.set('start', new Date(start).toISOString());
      qs.set('end', new Date(`${end}T23:59:59.999`).toISOString());
      const res = await fetch(`/api/bf/pl-vs-actual?${qs.toString()}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Report failed');
      if (j.data?.mode !== 'variance') throw new Error('Unexpected response');
      setVariance(j.data);
      setChartDataset('summary');
    } catch (e) {
      setError(e.message);
      setVariance(null);
    } finally {
      setLoadingVariance(false);
    }
  };

  const hasRevenuePeriodData = revenueByPeriod.some((d) => d.planned !== 0 || d.actual !== 0);
  const hasExpensePeriodData = expensesByPeriod.some((d) => d.planned !== 0 || d.actual !== 0);

  const chartFilterOptions = useMemo(() => {
    if (!variance) return [];
    const opts = [{ value: 'summary', label: 'Summary (revenue, expenses, profit)' }];
    if (variance.revenue?.rows?.length) {
      opts.push({ value: 'revenue_by_period', label: 'Revenue forecast — by period' });
    }
    if (variance.expenses?.rows?.length) {
      opts.push({ value: 'expense_by_period', label: 'Expense budget — by period' });
    }
    if (revenueAccountBars.length) {
      opts.push({ value: 'revenue_accounts', label: 'Revenue — top accounts (planned vs actual)' });
    }
    if (expenseAccountBars.length) {
      opts.push({ value: 'expense_accounts', label: 'Expenses — top accounts (planned vs actual)' });
    }
    return opts;
  }, [variance, revenueAccountBars.length, expenseAccountBars.length]);

  useEffect(() => {
    if (!chartFilterOptions.length) return;
    if (!chartFilterOptions.some((o) => o.value === chartDataset)) {
      setChartDataset(chartFilterOptions[0].value);
    }
  }, [chartFilterOptions, chartDataset]);

  return (
    <PermissionGuard permission="budgets.view">
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Planned vs actual (variance)</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Select your expense budget and/or revenue forecast, set the date range overlapping those plans, then run the
            report. The chart below uses the same numbers as the tables above; pick what it displays.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Parameters</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-slate-600">
              From
              <input
                type="date"
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              To
              <input
                type="date"
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Expense budget
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm"
                value={expenseBudgetId}
                onChange={(e) => setExpenseBudgetId(e.target.value)}
              >
                <option value="">— None —</option>
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.periodType})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Revenue forecast
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm"
                value={revenueForecastId}
                onChange={(e) => setRevenueForecastId(e.target.value)}
              >
                <option value="">— None —</option>
                {forecasts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.version} ({b.periodType})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            If both plans are selected, they must use the same period type (e.g. both monthly). Dates must overlap each
            plan window.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runVariance}
              disabled={loadingVariance}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {loadingVariance ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Run variance report
            </button>
            <Link
              href="/budget-forecast/budgets"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Manage budgets
            </Link>
            <Link
              href="/budget-forecast/forecasts"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Manage forecasts
            </Link>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
        )}

        {variance && (
          <div className="space-y-8">
            {variance.insights?.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">Insights</p>
                <ul className="mt-2 list-disc pl-5">
                  {variance.insights.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            <section>
              <h3 className="mb-4 text-lg font-bold text-slate-900">Tables</h3>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Summary</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Planned</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Actual</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Variance</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">%</th>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="px-4 py-3 text-slate-800">Revenue</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(variance.revenue.totals.planned)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(variance.revenue.totals.actual)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(variance.revenue.totals.variance)}</td>
                      <td className="px-4 py-3 text-right">
                        {variance.revenue.totals.performancePercent == null
                          ? '—'
                          : `${variance.revenue.totals.performancePercent.toFixed(1)}%`}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="px-4 py-3 text-slate-800">Expenses</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(variance.expenses.totals.planned)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(variance.expenses.totals.actual)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(variance.expenses.totals.variance)}</td>
                      <td className="px-4 py-3 text-right">
                        {variance.expenses.totals.performancePercent == null
                          ? '—'
                          : `${variance.expenses.totals.performancePercent.toFixed(1)}%`}
                      </td>
                    </tr>
                    <tr className="font-semibold">
                      <td className="px-4 py-3 text-slate-900">Profit</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(variance.profit.planned)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(variance.profit.actual)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(variance.profit.variance)}</td>
                      <td className="px-4 py-3 text-right">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {variance.revenue.rows.length > 0 && (
                <div className="mt-6">
                  <h4 className="mb-2 font-bold text-slate-900">Revenue lines</h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Account</th>
                          <th className="px-3 py-2">Period</th>
                          <th className="px-3 py-2 text-right">Planned</th>
                          <th className="px-3 py-2 text-right">Actual</th>
                          <th className="px-3 py-2 text-right">Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variance.revenue.rows.map((r, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-3 py-2">
                              {r.accountCode} {r.accountName}
                            </td>
                            <td className="px-3 py-2">{r.period}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(r.planned)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(r.actual)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(r.variance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {variance.expenses.rows.length > 0 && (
                <div className="mt-6">
                  <h4 className="mb-2 font-bold text-slate-900">Expense lines</h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Account</th>
                          <th className="px-3 py-2">Period</th>
                          <th className="px-3 py-2 text-right">Planned</th>
                          <th className="px-3 py-2 text-right">Actual</th>
                          <th className="px-3 py-2 text-right">Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variance.expenses.rows.map((r, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-3 py-2">
                              {r.accountCode} {r.accountName}
                            </td>
                            <td className="px-3 py-2">{r.period}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(r.planned)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(r.actual)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(r.variance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Chart</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Same planned and actual figures as the tables above. Choose which slice to visualize.
                  </p>
                </div>
                <label className="min-w-[min(100%,280px)] text-xs font-semibold text-slate-600 sm:max-w-sm">
                  Data shown
                  <select
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm"
                    value={chartDataset}
                    onChange={(e) => setChartDataset(e.target.value)}
                  >
                    {chartFilterOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-6 h-[360px] w-full min-w-0">
                {chartDataset === 'summary' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summaryBars} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={compactAxisTick} />
                      <Tooltip formatter={chartTooltipFormatter} />
                      <Legend />
                      <Bar dataKey="planned" name="Planned" fill="#059669" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actual" name="Actual" fill="#64748b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {chartDataset === 'revenue_by_period' &&
                  (hasRevenuePeriodData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueByPeriod} margin={{ top: 8, right: 16, left: 8, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} angle={-22} textAnchor="end" height={52} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={compactAxisTick} />
                        <Tooltip formatter={chartTooltipFormatter} />
                        <Legend />
                        <Bar dataKey="planned" name="Planned" fill="#059669" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="actual" name="Actual" fill="#34d399" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      Planned and actual are both zero for every period in this range.
                    </div>
                  ))}

                {chartDataset === 'expense_by_period' &&
                  (hasExpensePeriodData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={expensesByPeriod} margin={{ top: 8, right: 16, left: 8, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} angle={-22} textAnchor="end" height={52} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={compactAxisTick} />
                        <Tooltip formatter={chartTooltipFormatter} />
                        <Legend />
                        <Bar dataKey="planned" name="Planned" fill="#b45309" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="actual" name="Actual" fill="#d97706" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      Planned and actual are both zero for every period in this range.
                    </div>
                  ))}

                {chartDataset === 'revenue_accounts' && revenueAccountBars.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={revenueAccountBars}
                      margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={compactAxisTick} />
                      <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={chartTooltipFormatter}
                        labelFormatter={(_, p) => p?.[0]?.payload?.fullLabel || ''}
                      />
                      <Legend />
                      <Bar dataKey="planned" name="Planned" fill="#059669" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="actual" name="Actual" fill="#34d399" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {chartDataset === 'expense_accounts' && expenseAccountBars.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={expenseAccountBars}
                      margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={compactAxisTick} />
                      <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={chartTooltipFormatter}
                        labelFormatter={(_, p) => p?.[0]?.payload?.fullLabel || ''}
                      />
                      <Legend />
                      <Bar dataKey="planned" name="Planned" fill="#b45309" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="actual" name="Actual" fill="#ea580c" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
