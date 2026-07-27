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

function Tabs({ value, onChange, items }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2 border-b border-[var(--border-default)] pb-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`rounded px-3 py-1.5 text-sm ${
            value === item.id
              ? 'bg-[var(--action-primary)] text-white'
              : 'bg-[var(--surface-muted)] text-[var(--text-secondary)]'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function AdminCreditsRefundsPage() {
  const [tab, setTab] = useState('credits');
  const [credits, setCredits] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cRes, rRes] = await Promise.all([
        fetch('/api/admin/platform-billing/credits', { credentials: 'include' }),
        fetch('/api/admin/platform-billing/refunds', { credentials: 'include' }),
      ]);
      const cBody = await cRes.json().catch(() => ({}));
      const rBody = await rRes.json().catch(() => ({}));
      if (!cRes.ok) throw new Error(cBody.error || 'Failed to load credits');
      if (!rRes.ok) throw new Error(rBody.error || 'Failed to load refunds');
      setCredits(cBody.credits || []);
      setRefunds(rBody.refunds || []);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = tab === 'credits' ? credits : refunds;

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Credits & Refunds"
        description="Platform SaaS credits and refunds. Idempotent — retries do not duplicate financial effects."
        actions={
          <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'credits', label: 'Credits' },
          { id: 'refunds', label: 'Refunds' },
        ]}
      />

      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <AdminEmptyState title={`No ${tab} yet`} description="Create credits or refunds via the platform-billing APIs." />
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.creditNumber || row.refundNumber}
                  </td>
                  <td className="max-w-[12rem] truncate px-4 py-3">{row.tenantId}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.currency} {Number(row.amount).toLocaleString()}
                    {row.remaining != null ? (
                      <span className="block text-xs text-[var(--text-muted)]">
                        remaining {Number(row.remaining).toLocaleString()}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge tone={row.status === 'OPEN' ? 'warning' : 'success'}>
                      {row.status}
                    </AdminStatusBadge>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3">{row.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
