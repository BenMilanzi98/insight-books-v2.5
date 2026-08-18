'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReportStudioShell from '@/components/reports/ReportStudioShell';
import ReportStudioFilters from '@/components/reports/ReportStudioFilters';
import StatementLinesTable from '@/components/reports/StatementLinesTable';
import { filterConfigForReportType, rangeFromPreset, defaultFilterDraft } from '@/lib/reports/reportDatePresets';

function defaultDraft(type) {
  return defaultFilterDraft(type);
}

function OperationalInsights({ ctx }) {
  if (!ctx) return null;
  return (
    <div className="mt-6 space-y-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
      {ctx.topCustomers?.length ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600">{tt('Top customers')}</p>
          <ul>
            {ctx.topCustomers.map((c) => (
              <li key={c.name} className="flex justify-between py-0.5">
                <span>{c.name}</span>
                <span className="tabular-nums">{Number(c.amount || 0).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {ctx.topProducts?.length ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600">{tt('Top products')}</p>
          <ul>
            {ctx.topProducts.map((p) => (
              <li key={p.name} className="flex justify-between py-0.5">
                <span>{p.name}</span>
                <span className="tabular-nums">{Number(p.amount || 0).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {ctx.byCategory?.length ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600">{tt('By category')}</p>
          <ul>
            {ctx.byCategory.slice(0, 8).map((c) => (
              <li key={c.category} className="flex justify-between py-0.5">
                <span>{c.category}</span>
                <span className="tabular-nums">{Number(c.amount || 0).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {ctx.items ? (
        <p>{ctx.summary?.totalCount ?? ctx.items.length} inventory loss movement(s).</p>
      ) : null}
      {ctx.productMovements ? (
        <p>{ctx.productMovements.length} product(s) with stock movement in this period.</p>
      ) : null}
      {ctx.latest?.totalSales != null ? (
        <p>
          POS daily sales: {Number(ctx.latest.totalSales).toLocaleString()} · {ctx.latest.transactionCount || 0}{' '}
          transactions.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Generic FreshBooks-style report view for every /reports-v2 type except the
 * dedicated Profit & Loss experience (which keeps period columns + CIT).
 */
export default function StudioReportView({
  reportType,
  title,
  onDrill,
  reportTypeCategories,
  onReportTypeChange,
  reportTitle,
  showPageHeader,
}) {
  const config = useMemo(() => filterConfigForReportType(reportType), [reportType]);
  const [draft, setDraft] = useState(() => defaultDraft(reportType));
  const [applied, setApplied] = useState(() => defaultDraft(reportType));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      type: reportType,
      toDate: applied.toDate,
      asOfDate: applied.toDate,
    });
    if (!config.asOf) params.set('fromDate', applied.fromDate);
    if (config.groupBy && applied.groupBy) params.set('groupBy', applied.groupBy);
    if (config.basis && applied.reportBasis) params.set('reportBasis', applied.reportBasis);
    if (config.breakdown && applied.breakdown) params.set('breakdown', applied.breakdown);
    if (applied.currency) params.set('currency', applied.currency);
    if (config.includeZero && applied.includeZero) params.set('includeZeroBalances', '1');
    return params.toString();
  }, [applied, config, reportType]);

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
    const d = defaultDraft(reportType);
    setDraft(d);
    setApplied(d);
  };

  const exportUrl = (format) => `/api/accounting-v2/reports/export?${queryString}&format=${format}`;

  return (
    <ReportStudioShell
      showPageHeader={showPageHeader}
      reportTitle={reportTitle ?? title}
      loading={loading}
      loadingLabel={tt('Generating {{report}}…', { report: tt(title) })}
      error={error}
      exportUrl={exportUrl}
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
          config={config}
        />
      }
    >
      {report ? (
        <>
          <StatementLinesTable report={report} onDrill={(line) => onDrill?.(line, applied)} />
          <OperationalInsights ctx={report.operationalContext} />
        </>
      ) : !loading ? (
        <p className="py-8 text-sm text-slate-500">{tt('No report data.')}</p>
      ) : null}
    </ReportStudioShell>
  );
}
