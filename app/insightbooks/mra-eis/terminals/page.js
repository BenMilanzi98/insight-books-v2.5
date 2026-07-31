'use client';

import { adminFetch } from '@/lib/admin/adminApi';
import { useI18n } from '@/components/i18n/I18nProvider';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminDataTable,
  AdminStatusBadge,
} from '@/components/admin';

const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white disabled:opacity-50';
const inputCls =
  'rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-text)]';

function statusTone(status) {
  if (status === 'ACTIVE') return 'success';
  if (status === 'REVOKED' || status === 'TOKEN_EXPIRED') return 'danger';
  if (status === 'MANUAL_REVIEW' || status === 'UNKNOWN_ACTIVATION_OUTCOME') return 'warning';
  return 'neutral';
}

export default function SystemMraEisTerminalsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ environment: '', status: '', tenantId: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (filters.environment) qs.set('environment', filters.environment);
      if (filters.status) qs.set('status', filters.status);
      if (filters.tenantId) qs.set('tenantId', filters.tenantId);
      const res = await adminFetch(`/api/admin/mra-eis/terminals?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load terminals');
      setRows(json.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      key: 'tenantId',
      header: 'Tenant',
      render: (r) => (
        <span className="font-mono text-xs text-[var(--admin-text)]">{r.tenantId}</span>
      ),
    },
    { key: 'terminalLabel', header: 'Label' },
    { key: 'environment', header: 'Env' },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <AdminStatusBadge tone={statusTone(r.status)}>{r.status}</AdminStatusBadge>
      ),
    },
    {
      key: 'mraTerminalId',
      header: 'MRA ID',
      render: (r) => (
        <span className="font-mono text-xs">{r.mraTerminalId || '—'}</span>
      ),
    },
    {
      key: 'tokenExpiresAt',
      header: 'Token expiry',
      render: (r) => (
        <span className="text-xs text-[var(--admin-text-muted)]">{r.tokenExpiresAt || '—'}</span>
      ),
    },
  ];

  return (
    <AdminPageContainer>
      <AdminPageHeader
        breadcrumb={
          <>
            <Link href="/insightbooks/mra-eis" className="underline">
              MRA EIS
            </Link>
            {' / '}
            Terminals
          </>
        }
        title={t('admin-pages.mraEis.terminals.title')}
        description={t('admin-pages.mraEis.terminals.description')}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className={inputCls}
          placeholder="Tenant ID"
          value={filters.tenantId}
          onChange={(e) => setFilters((f) => ({ ...f, tenantId: e.target.value }))}
        />
        <select
          className={inputCls}
          value={filters.environment}
          onChange={(e) => setFilters((f) => ({ ...f, environment: e.target.value }))}
        >
          <option value="">All environments</option>
          <option value="SANDBOX">Sandbox</option>
          <option value="PRODUCTION">Production</option>
          <option value="MOCK">Mock</option>
        </select>
        <select
          className={inputCls}
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="CONFIRMATION_PENDING">CONFIRMATION_PENDING</option>
          <option value="UNKNOWN_ACTIVATION_OUTCOME">UNKNOWN_ACTIVATION_OUTCOME</option>
          <option value="MANUAL_REVIEW">MANUAL_REVIEW</option>
          <option value="TOKEN_EXPIRED">TOKEN_EXPIRED</option>
          <option value="REVOKED">REVOKED</option>
        </select>
        <button type="button" className={btnPrimary} onClick={load}>
          Apply
        </button>
      </div>

      {loading ? <AdminLoadingState label="Loading terminals" /> : null}
      {!loading && error ? (
        <AdminErrorState title="Terminals unavailable" message={error} onRetry={load} />
      ) : null}
      {!loading && !error ? (
        <AdminDataTable
          columns={columns}
          rows={rows}
          rowKey="id"
          emptyTitle="No terminals match filters"
          emptyDescription="Adjust filters or wait for tenant terminal activation."
        />
      ) : null}
    </AdminPageContainer>
  );
}
