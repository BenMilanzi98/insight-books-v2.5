'use client';
import { tt } from '@/lib/i18n/runtime';

import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import { isGlBackedReport } from '@/lib/reportReconciliationUi';

export function ReportReconciliationBadge({ reconciliationMeta, className = '' }) {
  const [expanded, setExpanded] = useState(false);

  if (!reconciliationMeta) return null;

  const { reconciliation, ledgerSource, fromGeneralLedger } = reconciliationMeta;
  if (!reconciliation) return null;
  const items = reconciliation?.items ?? [];
  const allReconciled = reconciliation?.allReconciled ?? (items.length === 0);
  const glBacked = isGlBackedReport(reconciliationMeta);
  const unreconciledCount =
    reconciliation?.unreconciledCount ??
    items.filter((i) => !i.reconciled).length;

  if (!glBacked && items.length === 0) return null;

  const statusColor = allReconciled
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : 'border-amber-200 bg-amber-50 text-amber-950';

  const StatusIcon = allReconciled ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`rounded-xl border px-4 py-3 ${statusColor} ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <StatusIcon size={18} className="shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {allReconciled ? 'Reconciled with General Ledger' : 'GL reconciliation variance detected'}
            </p>
            <p className="text-xs opacity-80 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {glBacked && (
                <span className="inline-flex items-center gap-1">
                  <BookOpen size={12} />
                  {tt('Ledger-backed')}
                </span>
              )}
              {ledgerSource && <span>Source: {ledgerSource.replace(/_/g, ' ')}</span>}
              {!allReconciled && unreconciledCount > 0 && (
                <span>{unreconciledCount} line{unreconciledCount !== 1 ? 's' : ''} with variance</span>
              )}
            </p>
          </div>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg hover:bg-white/60 transition-colors shrink-0"
          >
            {expanded ? 'Hide detail' : 'View detail'}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>
      {expanded && items.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left opacity-70">
                <th className="pb-1 pr-3 font-medium">{tt('Line')}</th>
                <th className="pb-1 pr-3 font-medium text-right">{tt('GL')}</th>
                <th className="pb-1 pr-3 font-medium text-right">{tt('Operational')}</th>
                <th className="pb-1 pr-3 font-medium text-right">{tt('Variance')}</th>
                <th className="pb-1 font-medium">{tt('Status')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.label} className="border-t border-current/10">
                  <td className="py-1.5 pr-3">{item.label}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{formatCurrency(item.glAmount)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {formatCurrency(item.operationalAmount)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{formatCurrency(item.variance)}</td>
                  <td className="py-1.5">{item.reconciled ? 'OK' : 'Review'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export { extractReportReconciliationMeta, isGlBackedReport } from '@/lib/reportReconciliationUi';
