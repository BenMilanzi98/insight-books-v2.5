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

export default function AffiliateCommissionsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/affiliate/commissions', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to load commissions');
      setRows(body.commissions || []);
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
        title="Affiliate commissions"
        description="One eligible conversion → one commission. Replays use idempotency keys — no double-pay."
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
          title="No commissions yet"
          description="Commissions appear when a verified platform payment is attributed to an affiliate."
        />
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Affiliate</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Amount</th>
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
                  <td className="px-4 py-3">{r.tenant?.name || r.tenantId}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.paymentId || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{money(r.commissionAmount)}</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge
                      tone={r.status === 'completed' ? 'success' : r.status === 'reversed' ? 'danger' : 'neutral'}
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
