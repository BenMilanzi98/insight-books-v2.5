'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminEmptyState,
  AdminStatusBadge,
} from '@/components/admin';

function money(n) {
  return `MWK ${Number(n || 0).toLocaleString()}`;
}

export default function AffiliatePayoutsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/affiliate/payouts', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to load payouts');
      setRows(body.payouts || []);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Affiliate payouts"
        description="One payout per affiliate + period. Idempotent — safe to replay without double payment."
        actions={
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <AdminEmptyState
          title="No payouts yet"
          description="Approved period payouts will appear here with period keys and references."
        />
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Affiliate</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.affiliate?.name || '—'}</div>
                    <div className="text-xs text-[var(--text-muted)]">{r.affiliate?.email}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.periodKey || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{money(r.amount)}</td>
                  <td className="px-4 py-3">{r.paymentMethod || '—'}</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge
                      tone={r.status === 'paid' ? 'success' : r.status === 'approved' ? 'info' : 'neutral'}
                    >
                      {r.status}
                    </AdminStatusBadge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
