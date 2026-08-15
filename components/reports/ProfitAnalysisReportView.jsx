'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Expand, Loader2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ReportStudioShell from '@/components/reports/ReportStudioShell';
import ReportsProfitTrendChart from '@/components/reports/ReportsProfitTrendChart';
import { formatCurrency } from '@/lib/currencyUtils';
import { DATE_PRESETS, rangeFromPreset } from '@/lib/reports/reportDatePresets';

const PIE_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#f43f5e', '#6366f1', '#64748b', '#14b8a6', '#a855f7'];
const EXPENSE_BAR = '#6366f1';

const FOCUS_METRICS = [
  {
    id: 'profit',
    label: 'Net profit',
    shortLabel: 'Profit',
    chartSeries: 'profit',
    tableColumn: 'profit',
    chip: 'bg-sky-600 text-white',
    cardFocus: 'bg-sky-50 border-sky-400 ring-2 ring-sky-400/60 shadow-md',
    colHead: 'bg-sky-100 text-sky-800',
    colCell: 'bg-sky-50/90 text-sky-900 font-semibold',
    colFoot: 'bg-sky-100 text-sky-900',
    strip: 'border-sky-300 bg-sky-50',
    amount: 'text-sky-800',
  },
  {
    id: 'revenue',
    label: 'Total revenue',
    shortLabel: 'Revenue',
    chartSeries: 'income',
    tableColumn: 'revenue',
    chip: 'bg-emerald-600 text-white',
    cardFocus: 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/60 shadow-md',
    colHead: 'bg-emerald-100 text-emerald-800',
    colCell: 'bg-emerald-50/90 text-emerald-900 font-semibold',
    colFoot: 'bg-emerald-100 text-emerald-900',
    strip: 'border-emerald-300 bg-emerald-50',
    amount: 'text-emerald-800',
  },
  {
    id: 'operatingExpenses',
    label: 'Operating expenses',
    shortLabel: 'Operating expenses',
    chartSeries: 'expenses',
    tableColumn: 'opex',
    chip: 'bg-amber-600 text-white',
    cardFocus: 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/60 shadow-md',
    colHead: 'bg-amber-100 text-amber-800',
    colCell: 'bg-amber-50/90 text-amber-900 font-semibold',
    colFoot: 'bg-amber-100 text-amber-900',
    strip: 'border-amber-300 bg-amber-50',
    amount: 'text-amber-800',
  },
  {
    id: 'cogs',
    label: 'Cost of goods sold',
    shortLabel: 'COGS',
    chartSeries: 'expenses',
    tableColumn: 'cogs',
    chip: 'bg-rose-600 text-white',
    cardFocus: 'bg-rose-50 border-rose-400 ring-2 ring-rose-400/60 shadow-md',
    colHead: 'bg-rose-100 text-rose-800',
    colCell: 'bg-rose-50/90 text-rose-900 font-semibold',
    colFoot: 'bg-rose-100 text-rose-900',
    strip: 'border-rose-300 bg-rose-50',
    amount: 'text-rose-800',
  },
  {
    id: 'avgRevenue',
    label: 'Avg revenue / period',
    shortLabel: 'Average revenue',
    chartSeries: 'income',
    tableColumn: 'avgSell',
    chip: 'bg-indigo-600 text-white',
    cardFocus: 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-400/60 shadow-md',
    colHead: 'bg-indigo-100 text-indigo-800',
    colCell: 'bg-indigo-50/90 text-indigo-900 font-semibold',
    colFoot: 'bg-indigo-100 text-indigo-900',
    strip: 'border-indigo-300 bg-indigo-50',
    amount: 'text-indigo-800',
  },
];

function focusMeta(metricId) {
  return FOCUS_METRICS.find((m) => m.id === metricId) || FOCUS_METRICS[0];
}

function productFocusAmount(focusId, summary, analyticsTotals) {
  if (!summary) return { label: '', value: 0, note: '' };
  switch (focusId) {
    case 'revenue':
      return {
        label: 'Line sales revenue',
        value: summary.productSalesRevenue || 0,
        note: 'Sum of invoice + POS line revenue in this table',
      };
    case 'cogs':
      return {
        label: 'Product COGS',
        value: summary.productCostTotal || 0,
        note: 'Sum of line cost in this table',
      };
    case 'profit':
      return {
        label: 'Gross profit (lines)',
        value: summary.productGrossProfit || 0,
        note: 'Line revenue − product COGS',
      };
    case 'operatingExpenses':
      return {
        label: 'Operating expenses',
        value: summary.operatingExpensesApproved || 0,
        note: 'Approved expense register, same period',
      };
    case 'avgRevenue':
      return {
        label: 'Avg revenue / period',
        value: analyticsTotals?.avgRevenue || 0,
        note: 'From analytics totals for the selected grouping',
      };
    default:
      return { label: '', value: 0, note: '' };
  }
}

function formatCompact(value) {
  return Number(value || 0).toLocaleString(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
}

function defaultDraft() {
  const range = rangeFromPreset('thisMonth');
  return {
    preset: 'thisMonth',
    ...range,
    groupBy: 'month',
    categoryId: '',
  };
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {label ? <div className="mb-1 font-semibold text-slate-900">{label}</div> : null}
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className="tabular-nums text-slate-600">
          <span style={{ color: p.color || p.fill }}>{p.name}:</span> {formatCurrency(p.value)}
        </div>
      ))}
    </div>
  );
}

function DonutTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const value = Number(item.value) || 0;
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-slate-900">{item.name}</div>
      <div className="mt-1 tabular-nums text-slate-600">
        {formatCurrency(value)} · {pct.toFixed(1)}%
      </div>
    </div>
  );
}

function ProfitAnalysisFilters({
  draft,
  onChange,
  onApply,
  onReset,
  onClose,
  applying,
  categories,
  focusMetric,
  onFocusMetricChange,
}) {
  const set = (patch) => onChange({ ...draft, ...patch });

  return (
    <aside className="w-full border-t border-slate-200 bg-white lg:w-80 lg:shrink-0 lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-900">Filters</h2>
        <button type="button" onClick={onReset} className="text-sm font-medium text-blue-600 hover:text-blue-800">
          Reset all
        </button>
      </div>

      <div className="space-y-5 px-4 py-4">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Date range</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={draft.preset}
            onChange={(e) => {
              const preset = e.target.value;
              if (preset === 'custom') set({ preset });
              else set({ preset, ...rangeFromPreset(preset) });
            }}
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </label>

        {draft.preset === 'custom' ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-600">
              From
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                value={draft.fromDate}
                onChange={(e) => set({ fromDate: e.target.value })}
              />
            </label>
            <label className="text-xs text-slate-600">
              To
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                value={draft.toDate}
                onChange={(e) => set({ toDate: e.target.value })}
              />
            </label>
          </div>
        ) : null}

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Chart grouping</legend>
          <div className="mt-2 space-y-2">
            {[
              { id: 'day', label: 'Daily' },
              { id: 'week', label: 'Weekly' },
              { id: 'month', label: 'Monthly' },
            ].map((g) => (
              <label key={g.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="pa-groupby"
                  checked={draft.groupBy === g.id}
                  onChange={() => set({ groupBy: g.id })}
                />
                {g.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Focus metric</legend>
          <div className="mt-2 space-y-1.5">
            {FOCUS_METRICS.map((m) => {
              const selected = focusMetric === m.id;
              return (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition ${
                    selected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="pa-metric"
                    className="sr-only"
                    checked={selected}
                    onChange={() => onFocusMetricChange(m.id)}
                  />
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${selected ? 'bg-white' : 'bg-slate-300'}`}
                    aria-hidden
                  />
                  {m.shortLabel}
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className="block text-sm">
          <span className="font-medium text-slate-700">Inventory category</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={draft.categoryId}
            onChange={(e) => set({ categoryId: e.target.value })}
          >
            <option value="">All categories</option>
            {categories.map((cat, idx) => (
              <option key={`${cat.id || cat.name}-${idx}`} value={cat.id || ''}>
                {cat.name || 'Uncategorized'}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Close
            </button>
          ) : null}
          <button
            type="button"
            disabled={applying}
            onClick={onApply}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {applying ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </aside>
  );
}

function SectionCard({ title, hint, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * Profit Analysis: KPI cards, product-line table, trend & category variance.
 * Uses /api/reports/financial-analytics + /api/reports/product-profit-detail.
 */
export default function ProfitAnalysisReportView({
  reportTypeCategories,
  reportType = 'PROFIT_ANALYSIS',
  onReportTypeChange,
  reportTitle,
  showPageHeader,
}) {
  const [draft, setDraft] = useState(defaultDraft);
  const [applied, setApplied] = useState(defaultDraft);
  const [focusMetric, setFocusMetric] = useState('profit');
  const [analytics, setAnalytics] = useState(null);
  const [productProfit, setProductProfit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [error, setError] = useState(null);
  const [productError, setProductError] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setProductLoading(true);
    setError(null);
    setProductError(null);
    const params = new URLSearchParams({
      startDate: applied.fromDate,
      endDate: applied.toDate,
      groupBy: applied.groupBy || 'month',
    });
    if (applied.categoryId) params.set('categoryId', applied.categoryId);

    const productParams = new URLSearchParams({
      startDate: applied.fromDate,
      endDate: applied.toDate,
    });
    if (applied.categoryId) productParams.set('categoryId', applied.categoryId);

    try {
      const [aRes, pRes] = await Promise.all([
        fetch(`/api/reports/financial-analytics?${params}`),
        fetch(`/api/reports/product-profit-detail?${productParams}`),
      ]);
      const aJson = await aRes.json();
      if (!aRes.ok) throw new Error(aJson.error || `Analytics HTTP ${aRes.status}`);
      setAnalytics(aJson);

      const pJson = await pRes.json();
      if (!pRes.ok) {
        setProductError(pJson.error || `Product profit HTTP ${pRes.status}`);
        setProductProfit(null);
      } else {
        setProductProfit(pJson);
      }
    } catch (e) {
      setError(e.message);
      setAnalytics(null);
    } finally {
      setLoading(false);
      setProductLoading(false);
    }
  }, [applied.fromDate, applied.toDate, applied.groupBy, applied.categoryId]);

  useEffect(() => {
    load();
  }, [load]);

  const categories = analytics?.categoryForecasting?.categories || [];

  const metricCards = useMemo(() => {
    const totals = analytics?.totals || {};
    const operating =
      totals.operatingExpenses ??
      Math.max(0, (Number(totals.expenses) || 0) - (Number(totals.cogs) || 0));
    return [
      {
        id: 'revenue',
        label: 'Total revenue',
        accent: 'border-l-emerald-500',
        valueClass: 'text-emerald-700',
        value: totals.revenue || 0,
      },
      {
        id: 'operatingExpenses',
        label: 'Operating expenses',
        accent: 'border-l-amber-500',
        valueClass: 'text-amber-700',
        value: operating,
      },
      {
        id: 'cogs',
        label: 'Cost of goods sold',
        accent: 'border-l-rose-500',
        valueClass: 'text-rose-700',
        value: totals.cogs || 0,
      },
      {
        id: 'profit',
        label: 'Net profit',
        subtitle: 'Revenue − operating − COGS',
        accent: 'border-l-sky-500',
        valueClass: (totals.profit || 0) >= 0 ? 'text-sky-700' : 'text-rose-700',
        value: totals.profit || 0,
      },
      {
        id: 'avgRevenue',
        label: 'Avg revenue / period',
        accent: 'border-l-indigo-500',
        valueClass: 'text-indigo-700',
        value: totals.avgRevenue || 0,
      },
    ];
  }, [analytics]);

  const trend = analytics?.trend || [];
  const expenseBreakdown = useMemo(() => {
    const rows = [...(analytics?.expenseBreakdown || [])]
      .map((r) => ({
        name: r.name || r.accountName || 'Other',
        value: Number(r.value ?? r.amount ?? 0) || 0,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
    return rows.slice(0, 12);
  }, [analytics]);

  const revenueSources = useMemo(() => {
    return (analytics?.revenueBySource || [])
      .map((d, i) => ({
        name: d.name || 'Other',
        value: Math.max(0, Number(d.value ?? d.amount ?? 0) || 0),
        color: PIE_COLORS[i % PIE_COLORS.length],
      }))
      .filter((d) => d.value > 0);
  }, [analytics]);

  const revenueSourceTotal = useMemo(
    () => revenueSources.reduce((s, d) => s + d.value, 0),
    [revenueSources]
  );

  const topCustomers = analytics?.topCustomers || [];
  const revenueCategoryForecast = analytics?.categoryForecasting?.revenue || [];
  const expenseCategoryForecast = analytics?.categoryForecasting?.expenses || [];

  const applyDraft = () => {
    let next = { ...draft };
    if (draft.preset !== 'custom') next = { ...next, ...rangeFromPreset(draft.preset) };
    setApplied(next);
    setDraft(next);
  };

  const resetAll = () => {
    const d = defaultDraft();
    setDraft(d);
    setApplied(d);
    setFocusMetric('profit');
  };

  const periodLabel = `For ${applied.fromDate} — ${applied.toDate}`;
  const groupLabel = applied.groupBy === 'day' ? 'day' : applied.groupBy === 'week' ? 'week' : 'month';
  const activeFocus = focusMeta(focusMetric);
  const productFocus = productFocusAmount(focusMetric, productProfit?.summary, analytics?.totals);
  const focusCol = activeFocus.tableColumn;

  const thFocus = (col) =>
    focusCol === col ? `px-2 py-2.5 text-right font-semibold ${activeFocus.colHead}` : 'px-2 py-2.5 text-right font-semibold';
  const tdFocus = (col, extra = '') =>
    focusCol === col
      ? `px-2 py-2 text-right tabular-nums ${activeFocus.colCell} ${extra}`
      : `px-2 py-2 text-right tabular-nums text-slate-700 ${extra}`;
  const tfFocus = (col, extra = '') =>
    focusCol === col
      ? `px-2 py-2.5 text-right tabular-nums ${activeFocus.colFoot} ${extra}`
      : `px-2 py-2.5 text-right tabular-nums ${extra}`;

  return (
    <ReportStudioShell
      showPageHeader={showPageHeader}
      reportTitle={reportTitle ?? 'Profit Analysis'}
      loading={loading && !analytics}
      loadingLabel="Generating Profit Analysis…"
      error={error}
      reportTypeCategories={reportTypeCategories}
      reportType={reportType}
      onReportTypeChange={onReportTypeChange}
      filtersOpen={filtersOpen}
      onToggleFilters={(next) => setFiltersOpen(typeof next === 'boolean' ? next : (v) => !v)}
      filters={
        <ProfitAnalysisFilters
          draft={draft}
          onChange={setDraft}
          onApply={applyDraft}
          onReset={resetAll}
          onClose={() => setFiltersOpen(false)}
          applying={loading}
          categories={categories}
          focusMetric={focusMetric}
          onFocusMetricChange={setFocusMetric}
        />
      }
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500">{periodLabel}</p>
        <button
          type="button"
          className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          title="Expand"
          onClick={() => setFiltersOpen(false)}
        >
          <Expand className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {metricCards.map((metric) => {
          const meta = focusMeta(metric.id);
          const focused = focusMetric === metric.id;
          return (
            <button
              key={metric.id}
              type="button"
              aria-pressed={focused}
              onClick={() => setFocusMetric(metric.id)}
              className={`relative rounded-2xl border border-l-4 p-4 text-left transition ${metric.accent} ${
                focused
                  ? meta.cardFocus
                  : 'border-slate-200 bg-white shadow-sm opacity-80 hover:border-slate-300 hover:opacity-100'
              }`}
            >
              {focused ? (
                <span
                  className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.chip}`}
                >
                  Focus
                </span>
              ) : null}
              <p className="mb-1 pr-14 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {metric.label}
              </p>
              {metric.subtitle ? <p className="mb-1 text-[11px] text-slate-400">{metric.subtitle}</p> : null}
              <p className={`text-xl font-bold tabular-nums ${metric.valueClass}`}>
                {formatCurrency(metric.value)}
              </p>
            </button>
          );
        })}
      </div>

      <SectionCard
        title="Product and line sales"
        hint="Invoice + POS lines in this period"
        className="mb-6"
      >
        <p className="mb-4 max-w-3xl text-xs text-slate-500">
          Revenue uses line amounts; cost uses product cost, then average cost when unset. Respects the
          inventory category filter when set.
        </p>

        {productLoading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin text-emerald-600" />
            Loading product-level sales…
          </div>
        ) : productError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {productError}
          </div>
        ) : productProfit?.summary ? (
          <>
            <div
              className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${activeFocus.strip}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${activeFocus.chip}`}
                  >
                    Focus
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{productFocus.label}</span>
                </div>
                {productFocus.note ? (
                  <p className="mt-0.5 text-[11px] text-slate-500">{productFocus.note}</p>
                ) : null}
              </div>
              <p className={`text-xl font-bold tabular-nums ${activeFocus.amount}`}>
                {formatCurrency(productFocus.value)}
              </p>
            </div>

            <div
              className={`max-h-[min(70vh,520px)] overflow-auto rounded-xl border ${
                focusCol === 'opex' ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
              }`}
            >
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                  <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5 font-semibold">Product / line</th>
                    <th className="px-2 py-2.5 font-semibold">SKU</th>
                    <th className="px-2 py-2.5 font-semibold">Category</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Qty</th>
                    <th className={thFocus('avgSell')}>Avg sell</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Avg cost</th>
                    <th className={thFocus('revenue')}>Revenue</th>
                    <th className={thFocus('cogs')}>COGS</th>
                    <th className={thFocus('profit')}>Profit</th>
                    <th className="py-2.5 pl-2 pr-3 text-right font-semibold">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {(productProfit.rows || []).length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-500">
                        No invoice or POS lines in this period for the current filters.
                      </td>
                    </tr>
                  ) : (
                    (productProfit.rows || []).map((row, idx) => (
                      <tr
                        key={`${row.productId || row.name}-${idx}`}
                        className="border-b border-slate-100 hover:bg-slate-50/80"
                      >
                        <td
                          className="max-w-[220px] truncate px-3 py-2 font-medium text-slate-800"
                          title={row.name}
                        >
                          {row.name}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-600">{row.sku || '—'}</td>
                        <td
                          className="max-w-[140px] truncate px-2 py-2 text-slate-600"
                          title={row.categoryName}
                        >
                          {row.categoryName || '—'}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-slate-700">
                          {Number(row.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </td>
                        <td className={tdFocus('avgSell')}>{formatCurrency(row.avgSellingPrice)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-slate-700">
                          {formatCurrency(row.avgCostPrice)}
                        </td>
                        <td className={tdFocus('revenue', 'text-slate-800')}>{formatCurrency(row.revenue)}</td>
                        <td className={tdFocus('cogs', 'text-slate-800')}>{formatCurrency(row.cost)}</td>
                        <td
                          className={tdFocus(
                            'profit',
                            focusCol === 'profit'
                              ? ''
                              : (row.profit || 0) >= 0
                                ? 'text-emerald-700 font-medium'
                                : 'text-rose-600 font-medium'
                          )}
                        >
                          {formatCurrency(row.profit)}
                        </td>
                        <td className="py-2 pl-2 pr-3 text-right tabular-nums text-slate-700">
                          {row.marginPercent != null && Number.isFinite(row.marginPercent)
                            ? `${Number(row.marginPercent).toFixed(1)}%`
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {(productProfit.rows || []).length > 0 ? (
                  <tfoot className="sticky bottom-0 border-t border-slate-200 bg-slate-50 font-semibold text-slate-800">
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wide text-slate-500"
                      >
                        Totals
                      </td>
                      <td className={tfFocus('revenue')}>
                        {formatCurrency(productProfit.summary.productSalesRevenue)}
                      </td>
                      <td className={tfFocus('cogs')}>
                        {formatCurrency(productProfit.summary.productCostTotal)}
                      </td>
                      <td className={tfFocus('profit', focusCol === 'profit' ? '' : 'text-emerald-800')}>
                        {formatCurrency(productProfit.summary.productGrossProfit)}
                      </td>
                      <td className="py-2.5 pl-2 pr-3 text-right text-xs font-medium text-slate-600">
                        {productProfit.summary.productSalesRevenue > 0
                          ? `${(
                              (productProfit.summary.productGrossProfit /
                                productProfit.summary.productSalesRevenue) *
                              100
                            ).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              {productProfit.summary.lineCountInvoices} invoice lines · {productProfit.summary.lineCountPos}{' '}
              POS lines · {productProfit.summary.skuCount} grouped rows
            </p>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">No product sales data.</p>
        )}
      </SectionCard>

      <div className="space-y-6">
        {trend.length > 0 ? (
          <ReportsProfitTrendChart
            title={`Profit trend · by ${groupLabel}`}
            months={trend.map((row) => row.label)}
            income={trend.map((row) => Number(row.revenue) || 0)}
            expenses={trend.map((row) => Number(row.expenses) || 0)}
          />
        ) : (
          <SectionCard title="Profit trend" hint={`Grouped by ${groupLabel}`}>
            <EmptyChart height="h-56" label="Not enough data for this period." />
          </SectionCard>
        )}

        <SectionCard title="Expense breakdown" hint={`${expenseBreakdown.length} top accounts`}>
          {expenseBreakdown.length > 0 ? (
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={expenseBreakdown}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatCompact}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Amount" fill={EXPENSE_BAR} radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart height="h-[200px]" label="No expense data." />
          )}
        </SectionCard>

        <CategoryForecastTable
          title="Revenue vs budget by inventory category"
          hint="Actual, forecast, and budget variance"
          rows={revenueCategoryForecast}
          expenseStyle={false}
        />
        <CategoryForecastTable
          title="Expenditure vs budget by inventory category"
          hint="Actual, forecast, and budget variance"
          rows={expenseCategoryForecast}
          expenseStyle
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <SectionCard title="Revenue by source" className="xl:col-span-1">
            {revenueSources.length > 0 ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center xl:flex-col">
                <div className="relative mx-auto h-48 w-48 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueSources}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={revenueSources.length > 1 ? 2 : 0}
                        stroke="#fff"
                        strokeWidth={2}
                      >
                        {revenueSources.map((entry, i) => (
                          <Cell key={entry.name || i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<DonutTooltip total={revenueSourceTotal} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-lg font-bold tabular-nums text-slate-900">
                        {formatCurrency(revenueSourceTotal)}
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Total
                      </div>
                    </div>
                  </div>
                </div>
                <ul className="min-w-0 flex-1 space-y-2">
                  {revenueSources.map((row) => {
                    const pct = revenueSourceTotal > 0 ? (row.value / revenueSourceTotal) * 100 : 0;
                    return (
                      <li key={row.name} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2 text-slate-700">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: row.color }}
                          />
                          <span className="truncate">{row.name}</span>
                        </span>
                        <span className="shrink-0 tabular-nums font-medium text-slate-900">
                          {formatCurrency(row.value)}
                          <span className="ml-1 text-xs text-slate-400">({pct.toFixed(0)}%)</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <EmptyChart height="h-[180px]" label="No source data." />
            )}
          </SectionCard>

          <SectionCard title="Top customers" className="xl:col-span-2">
            {topCustomers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="py-2.5 font-semibold">#</th>
                      <th className="py-2.5 font-semibold">Customer</th>
                      <th className="py-2.5 text-right font-semibold">Revenue</th>
                      <th className="hidden py-2.5 text-right font-semibold sm:table-cell">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const total = topCustomers.reduce(
                        (s, c) => s + (Number(c.value ?? c.amount ?? 0) || 0),
                        0
                      );
                      return topCustomers.map((c, i) => {
                        const value = Number(c.value ?? c.amount ?? 0) || 0;
                        const pct = total > 0 ? (value / total) * 100 : 0;
                        return (
                          <tr key={`${c.name}-${i}`} className="border-b border-slate-100 last:border-0">
                            <td className="py-2.5 tabular-nums text-slate-400">{i + 1}</td>
                            <td className="py-2.5 font-medium text-slate-800">{c.name}</td>
                            <td className="py-2.5 text-right tabular-nums text-slate-900">
                              {formatCurrency(value)}
                            </td>
                            <td className="hidden py-2.5 text-right sm:table-cell">
                              <div className="ml-auto flex max-w-[140px] items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full bg-sky-500"
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                                <span className="w-10 text-right text-xs tabular-nums text-slate-500">
                                  {pct.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyChart height="h-[180px]" label="No customer revenue in this period." />
            )}
          </SectionCard>
        </div>
      </div>
    </ReportStudioShell>
  );
}

function EmptyChart({ height = 'h-[200px]', label }) {
  return (
    <div className={`flex ${height} items-center justify-center text-sm text-slate-500`}>{label}</div>
  );
}

function CategoryForecastTable({ title, hint, rows, expenseStyle }) {
  return (
    <SectionCard title={title} hint={hint}>
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2.5 pr-2 font-semibold">Category</th>
                <th className="px-2 py-2.5 text-right font-semibold">Actual</th>
                <th className="px-2 py-2.5 text-right font-semibold">Forecast</th>
                <th className="px-2 py-2.5 text-right font-semibold">Budget</th>
                <th className="px-2 py-2.5 text-right font-semibold">Actual variance</th>
                <th className="py-2.5 pl-2 text-right font-semibold">Forecast variance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const actualOk = expenseStyle
                  ? (row.varianceToBudget || 0) <= 0
                  : (row.varianceToBudget || 0) >= 0;
                const forecastOk = expenseStyle
                  ? (row.forecastVarianceToBudget || 0) <= 0
                  : (row.forecastVarianceToBudget || 0) >= 0;
                return (
                  <tr
                    key={`${row.categoryId || row.categoryName}-${idx}`}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className="py-2.5 pr-2 font-medium text-slate-800">
                      {row.categoryName || 'Uncategorized'}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {formatCurrency(row.actualAmount || 0)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {formatCurrency(row.forecastAmount || 0)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {formatCurrency(row.budgetAmount || 0)}
                    </td>
                    <td
                      className={`px-2 py-2.5 text-right font-medium tabular-nums ${
                        actualOk ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {formatCurrency(row.varianceToBudget || 0)}
                    </td>
                    <td
                      className={`py-2.5 pl-2 text-right font-medium tabular-nums ${
                        forecastOk ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {formatCurrency(row.forecastVarianceToBudget || 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyChart height="h-[120px]" label="No category forecast data for this period." />
      )}
    </SectionCard>
  );
}
