'use client';
import { tt } from '@/lib/i18n/runtime';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PosStylePanel from '@/components/shell/PosStylePanel';
import {
  historyRowsFromPayload,
  listReconciliations,
} from '@/components/payments/reconcile/reconApi.js';

export default function ReconciliationHistoryPanel({
  paymentAccountId,
  currentReconciliationId,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await listReconciliations(paymentAccountId);
        if (cancelled) return;
        setRows(historyRowsFromPayload(data));
      } catch (err) {
        if (!cancelled) {
          setRows([]);
          setError(err.message || 'Could not load reconciliation history.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paymentAccountId]);

  return (
    <PosStylePanel className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-gray-900">{tt('Reconciliation history')}</h2>
      <p className="mt-1 text-sm text-gray-500">
        {paymentAccountId
          ? tt('Open and completed reconciliations for this account.')
          : tt('Open and completed reconciliations. View a completed period read-only, or continue a draft.')}
      </p>

      {error ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">{tt('Loading…')}</p>
      ) : rows.length === 0 && !error ? (
        <p className="mt-4 text-sm text-gray-500">{tt('No reconciliations yet.')}</p>
      ) : rows.length ? (
        <div className="mt-4 overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">{tt('Reconciliation history')}</caption>
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">{tt('Period')}</th>
                <th className="px-3 py-2 font-medium text-right">{tt('Closing')}</th>
                <th className="px-3 py-2 font-medium text-right">{tt('Difference')}</th>
                <th className="px-3 py-2 font-medium">{tt('Status')}</th>
                <th className="px-3 py-2 font-medium">{tt('Completed by')}</th>
                <th className="px-3 py-2 font-medium">{tt('Completed at')}</th>
                <th className="px-3 py-2 font-medium">{tt('Action')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const current = currentReconciliationId && row.id === currentReconciliationId;
                return (
                  <tr
                    key={row.id}
                    className={`border-t border-gray-100 ${current ? 'bg-indigo-50/60' : ''}`}
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-gray-800">{row.period}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-900">
                      {row.closing}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-900">
                      {row.difference}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{tt(row.status)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{row.completedBy}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{row.completedAt}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <Link
                        href={row.href}
                        className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
                      >
                        {tt(row.actionLabel)}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </PosStylePanel>
  );
}
