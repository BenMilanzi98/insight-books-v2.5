'use client';
import { tt } from '@/lib/i18n/runtime';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/currencyUtils';
import { ExternalLink } from 'lucide-react';

/**
 * Ledger-backed report table with mandatory account columns + drill-down.
 */
export default function ReportAccountTable({
  lines = [],
  title = tt('General Ledger — Account Detail'),
  className = '',
  showOpeningClosing = true,
  onDrillDown,
}) {
  const [expandedId, setExpandedId] = useState(null);

  if (!lines?.length) return null;

  const handleDrill = (line) => {
    if (onDrillDown) {
      onDrillDown(line);
      return;
    }
    if (line.sourceHref) {
      window.location.href = line.sourceHref;
      return;
    }
    if (line.accountId) {
      const params = new URLSearchParams({ accountId: line.accountId });
      window.open(`/general-ledger?accountId=${line.accountId}`, '_blank');
    }
  };

  return (
    <div className={`mt-6 rounded-xl border border-slate-200 bg-white overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        <p className="text-xs text-slate-500 mt-0.5">
          Posted journal &amp; transaction lines — Chart of Accounts source of truth
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-medium text-slate-600 uppercase tracking-wide">
              <th className="px-3 py-2">{tt('Code')}</th>
              <th className="px-3 py-2">{tt('Account Name')}</th>
              <th className="px-3 py-2">{tt('Type')}</th>
              {showOpeningClosing && (
                <>
                  <th className="px-3 py-2 text-right">{tt('Opening')}</th>
                  <th className="px-3 py-2 text-right">{tt('Debit')}</th>
                  <th className="px-3 py-2 text-right">{tt('Credit')}</th>
                  <th className="px-3 py-2 text-right">{tt('Net')}</th>
                  <th className="px-3 py-2 text-right">{tt('Closing')}</th>
                </>
              )}
              {!showOpeningClosing && (
                <>
                  <th className="px-3 py-2 text-right">{tt('Debit')}</th>
                  <th className="px-3 py-2 text-right">{tt('Credit')}</th>
                  <th className="px-3 py-2 text-right">{tt('Amount')}</th>
                </>
              )}
              <th className="px-3 py-2 text-center">{tt('Details')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((line) => {
              const key = line.key || line.accountId || line.accountCode;
              const isOpen = expandedId === key;
              return (
                <tr key={key} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2 font-mono text-xs text-slate-700 whitespace-nowrap">
                    {line.accountCode || '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-800">{line.accountName || line.label}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{line.accountType || '—'}</td>
                  {showOpeningClosing ? (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(line.openingBalance ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(line.periodDebit ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(line.periodCredit ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatCurrency(line.netMovement ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {formatCurrency(line.closingBalance ?? line.amount ?? 0)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(line.periodDebit ?? line.debitTotal ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(line.periodCredit ?? line.creditTotal ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {formatCurrency(line.amount ?? line.netMovement ?? 0)}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleDrill(line)}
                      className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium"
                      title={tt('View ledger entries')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      {tt('Trace')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AccountDrillDownModal({ line, period, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!line?.accountId) return;
    const params = new URLSearchParams({ accountId: line.accountId });
    if (period?.startDate) params.set('startDate', period.startDate);
    if (period?.endDate) params.set('endDate', period.endDate);
    setLoading(true);
    fetch(`/api/reports/account-drilldown?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [line?.accountId, period?.startDate, period?.endDate]);

  if (!line) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-slate-900">
              {line.accountCode} — {line.accountName}
            </h3>
            <p className="text-xs text-slate-500">Ledger &amp; journal source trace</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            {tt('Close')}
          </button>
        </div>
        <div className="overflow-auto p-4 flex-1">
          {loading && <p className="text-sm text-slate-500">{tt('Loading…')}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {data?.ledgerLines?.length > 0 && (
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-slate-600 border-b">
                  <th className="py-2 pr-2">{tt('Date')}</th>
                  <th className="py-2 pr-2">{tt('Reference')}</th>
                  <th className="py-2 pr-2">{tt('Source')}</th>
                  <th className="py-2 pr-2">{tt('Description')}</th>
                  <th className="py-2 pr-2 text-right">{tt('Debit')}</th>
                  <th className="py-2 pr-2 text-right">{tt('Credit')}</th>
                  <th className="py-2 text-right">{tt('Balance')}</th>
                </tr>
              </thead>
              <tbody>
                {data.ledgerLines.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-1.5 pr-2 whitespace-nowrap">{row.date?.slice?.(0, 10) || row.date}</td>
                    <td className="py-1.5 pr-2">{row.reference || row.referenceNumber || '—'}</td>
                    <td className="py-1.5 pr-2">{row.sourceType || '—'}</td>
                    <td className="py-1.5 pr-2">{row.description || '—'}</td>
                    <td className="py-1.5 pr-2 text-right">{formatCurrency(row.debitAmount || 0)}</td>
                    <td className="py-1.5 pr-2 text-right">{formatCurrency(row.creditAmount || 0)}</td>
                    <td className="py-1.5 text-right">{formatCurrency(row.runningBalance ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data && !data.ledgerLines?.length && !loading && (
            <p className="text-sm text-slate-500">{tt('No posted ledger lines for this account in the selected period.')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
