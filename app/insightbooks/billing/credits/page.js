'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminEmptyState,
  AdminStatusBadge,
  AdminDataTable,
} from '@/components/admin';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]';

function Tabs({ value, onChange, items }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2 border-b border-[var(--admin-border)] pb-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`rounded-[var(--admin-radius)] px-3 py-1.5 text-sm ${
            value === item.id
              ? 'bg-[var(--action-primary)] text-white'
              : 'bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function AdminCreditsRefundsPage() {
  const { t } = useI18n();
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
        adminFetch('/api/admin/platform-billing/credits', { credentials: 'include' }),
        adminFetch('/api/admin/platform-billing/refunds', { credentials: 'include' }),
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

  const columns = useMemo(
    () => [
      {
        key: 'number',
        header: 'Number',
        render: (row) => (
          <span className="font-mono text-xs text-[var(--admin-text)]">
            {row.creditNumber || row.refundNumber}
          </span>
        ),
      },
      {
        key: 'tenantId',
        header: 'Tenant',
        render: (row) => (
          <span className="max-w-[12rem] truncate text-[var(--admin-text)]">{row.tenantId}</span>
        ),
      },
      {
        key: 'amount',
        header: 'Amount',
        cellClassName: 'tabular-nums',
        render: (row) => (
          <div>
            {row.currency} {Number(row.amount).toLocaleString()}
            {row.remaining != null ? (
              <span className="block text-xs text-[var(--admin-text-muted)]">
                remaining {Number(row.remaining).toLocaleString()}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <AdminStatusBadge tone={row.status === 'OPEN' ? 'warning' : 'success'}>
            {row.status}
          </AdminStatusBadge>
        ),
      },
      {
        key: 'reason',
        header: 'Reason',
        render: (row) => (
          <span className="max-w-xs truncate text-[var(--admin-text-muted)]">
            {row.reason || '—'}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.billing.credits.title')}
        description="Platform SaaS credits and refunds. Idempotent — retries do not duplicate financial effects."
        actions={
          <button type="button" onClick={load} className={btnGhost}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
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
        <AdminEmptyState
          title={`No ${tab} yet`}
          description="Create credits or refunds via the platform-billing APIs."
        />
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <AdminDataTable columns={columns} rows={rows} rowKey="id" />
      ) : null}
    </AdminPageContainer>
  );
}
