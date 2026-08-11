import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { FinancialReport } from './FinancialReportComponents';
import { extractReportReconciliationMeta } from '@/components/ReportReconciliationBadge';
import { formatCurrency } from '@/lib/currencyUtils';
import { formatPeriodRange } from '@/lib/dateUtils';

export const InventoryLossReport = ({
  data,
  loading,
  error,
  timeframe,
  onTimeframeChange,
  onRefresh,
  onExport,
  eventTypeFilter = 'all',
  onEventTypeFilterChange,
}) => {
  const [expandedRowId, setExpandedRowId] = useState(null);

  const periodLabel = useMemo(() => {
    if (!data?.period) return 'Inventory loss report';
    return formatPeriodRange(data.period.startDate, data.period.endDate);
  }, [data?.period]);

  const items = data?.items || [];
  const summary = data?.summary || {};
  const byMonth = data?.byMonth || [];

  if (!data && !loading && !error) {
    return (
      <div className="text-center p-8 sm:p-10 bg-gradient-to-br from-slate-50 to-orange-50/40 rounded-2xl border border-slate-200">
        <AlertTriangle size={48} className="mx-auto text-orange-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-800">No data available</h3>
        <p className="text-slate-500 mt-2 text-sm">Select a time period and generate the report.</p>
      </div>
    );
  }

  return (
    <FinancialReport
      title="Inventory Loss Report (Write-off & Stock-out)"
      subtitle={periodLabel}
      timeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      onRefresh={onRefresh}
      onExport={onExport}
      loading={loading}
      error={error}
      reconciliationMeta={extractReportReconciliationMeta(data)}
    >
      {data && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Event type</label>
            <select
              value={eventTypeFilter}
              onChange={(e) => onEventTypeFilterChange?.(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="all">All events</option>
              <option value="write_off">Write-offs only</option>
              <option value="stock_out">Stock-outs only</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-orange-700">Total loss</p>
              <p className="mt-1 min-w-0 break-words text-xl font-semibold leading-tight tabular-nums text-slate-800 sm:text-2xl">{formatCurrency(summary.totalAmount || 0)}</p>
              <p className="text-xs text-slate-500 mt-1">{summary.totalCount || 0} events</p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-rose-700">Write-offs</p>
              <p className="mt-1 min-w-0 break-words text-xl font-semibold leading-tight tabular-nums text-slate-800 sm:text-2xl">{formatCurrency(summary.writeOffAmount || 0)}</p>
              <p className="text-xs text-slate-500 mt-1">{summary.writeOffCount || 0} events</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Stock-outs</p>
              <p className="mt-1 min-w-0 break-words text-xl font-semibold leading-tight tabular-nums text-slate-800 sm:text-2xl">{formatCurrency(summary.stockOutAmount || 0)}</p>
              <p className="text-xs text-slate-500 mt-1">{summary.stockOutCount || 0} events</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Average loss/event</p>
              <p className="mt-1 min-w-0 break-words text-xl font-semibold leading-tight tabular-nums text-slate-800 sm:text-2xl">
                {formatCurrency((summary.totalCount || 0) > 0 ? (summary.totalAmount || 0) / summary.totalCount : 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">For selected filter</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Description</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                      No write-off or stock-out events found for this period.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <React.Fragment key={item.id}>
                      <tr
                        className="hover:bg-slate-50/70 cursor-pointer"
                        onClick={() => setExpandedRowId(expandedRowId === item.id ? null : item.id)}
                      >
                        <td className="px-4 py-2.5 text-sm text-slate-800">{new Date(item.date).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-700">
                          {item.eventType === 'write_off' ? 'Write-off' : 'Stock-out'}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-800">{item.description || 'Inventory adjustment loss'}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-medium text-slate-800">{formatCurrency(item.amount || 0)}</td>
                      </tr>
                      {expandedRowId === item.id && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={5} className="px-4 py-3 text-xs text-slate-600">
                            Reference: {item.reference || 'N/A'} | Source: {item.sourceLabel || item.sourceId || 'N/A'} | Submitted by:{' '}
                            {item.submittedBy || 'Unknown'} | Notes: {item.notes || 'N/A'}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Month</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Write-offs</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Stock-outs</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Total</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Events</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {byMonth.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                      No monthly totals in this period.
                    </td>
                  </tr>
                ) : (
                  byMonth.map((row) => (
                    <tr key={row.month}>
                      <td className="px-4 py-2.5 text-sm text-slate-800">{row.month}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-slate-800">{formatCurrency(row.writeOffAmount || 0)}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-slate-800">{formatCurrency(row.stockOutAmount || 0)}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-medium text-slate-800">{formatCurrency(row.totalAmount || 0)}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-slate-700">{row.count || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FinancialReport>
  );
};

