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

function money(n) {
  return `MWK ${Number(n || 0).toLocaleString()}`;
}

const btnGhost = 'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

export default function AffiliateCommissionsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/affiliate/commissions', { credentials: 'include' });
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

  const columns = useMemo(() => [
    {
      key: 'affiliate',
      header: 'Affiliate',
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-[var(--admin-text)]">{r.affiliate?.name || '—'}</div>
          <div className="truncate text-xs text-[var(--admin-text-muted)]">{r.affiliate?.email}</div>
        </div>
      ),
    },
    {
      key: 'tenant',
      header: 'Tenant',
      render: (r) => (
        <span className="text-[var(--admin-text)]">{r.tenant?.name || r.tenantId || '—'}</span>
      ),
    },
    {
      key: 'payment',
      header: 'Payment',
      hideOnMobile: true,
      render: (r) => (
        <span className="font-mono text-xs text-[var(--admin-text-muted)]">{r.paymentId || '—'}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (r) => (
        <span className="whitespace-nowrap tabular-nums">{money(r.commissionAmount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <AdminStatusBadge
          tone={r.status === 'completed' ? 'success' : r.status === 'reversed' ? 'danger' : 'neutral'}
        >
          {r.status}
        </AdminStatusBadge>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      hideOnMobile: true,
      render: (r) => (
        <span className="whitespace-nowrap text-sm text-[var(--admin-text-muted)]">
          {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
        </span>
      ),
    },
  ], []);

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.affiliate.commissions.title')}
        description="One eligible conversion → one commission. Replays use idempotency keys — no double-pay."
        actions={
          <button type="button" onClick={load} className={btnGhost}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
          </button>
        }
      />

      {loading ? <AdminLoadingState label="Loading commissions" /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <AdminEmptyState
          title="No commissions yet"
          description="Commissions appear when a verified platform payment is attributed to an affiliate."
        />
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <AdminDataTable columns={columns} rows={rows} rowKey="id" />
      ) : null}
    </AdminPageContainer>
  );
}
