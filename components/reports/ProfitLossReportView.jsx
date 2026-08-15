'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Expand } from 'lucide-react';
import ProfitLossFilters from '@/components/reports/ProfitLossFilters';
import ProfitLossTable from '@/components/reports/ProfitLossTable';
import ReportStudioShell from '@/components/reports/ReportStudioShell';
import { REPORTING_CURRENCY_OPTIONS } from '@/lib/businessScopeStorage';
import { rangeFromPreset, defaultFilterDraft } from '@/lib/reports/reportDatePresets';

function defaultDraft() {
  return defaultFilterDraft('INCOME_STATEMENT');
}

/**
 * FreshBooks-style P&L experience embedded in reports-v2.
 * Report type switching lives in ReportStudioShell (dropdown, no left bar).
 */
export default function ProfitLossReportView({
  onDrill,
  reportTypeCategories,
  reportType = 'INCOME_STATEMENT',
  onReportTypeChange,
  reportTitle,
  showPageHeader,
}) {
  const [draft, setDraft] = useState(defaultDraft);
  const [applied, setApplied] = useState(defaultDraft);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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

  const periodLabel = `For ${applied.fromDate} — ${applied.toDate}`;

  return (
    <ReportStudioShell
      showPageHeader={showPageHeader}
      reportTitle={reportTitle ?? 'Profit & Loss'}
      loading={loading}
      loadingLabel="Generating Profit & Loss…"
      error={error}
      exportUrl={exportUrl}
      reportTypeCategories={reportTypeCategories}
      reportType={reportType}
      onReportTypeChange={onReportTypeChange}
      filtersOpen={filtersOpen}
      onToggleFilters={(next) => setFiltersOpen(typeof next === 'boolean' ? next : (v) => !v)}
      filters={
        <ProfitLossFilters
          draft={draft}
          onChange={setDraft}
          onApply={applyDraft}
          onReset={resetAll}
          onClose={() => setFiltersOpen(false)}
          currencyOptions={REPORTING_CURRENCY_OPTIONS}
          applying={loading}
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

      {report ? (
        <ProfitLossTable report={report} onDrill={(line) => onDrill?.(line, applied)} />
      ) : !loading ? (
        <p className="py-8 text-sm text-slate-500">No report data.</p>
      ) : null}
    </ReportStudioShell>
  );
}
