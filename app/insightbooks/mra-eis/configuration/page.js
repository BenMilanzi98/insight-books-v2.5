'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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

export default function SystemMraEisConfigurationPage() {
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
      const res = await fetch(`/api/admin/mra-eis/configuration?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load');
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
        <span className="font-mono text-xs">{r.tenantId}</span>
      ),
    },
    { key: 'terminalLabel', header: 'Terminal' },
    { key: 'environment', header: 'Env' },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <AdminStatusBadge>{r.status}</AdminStatusBadge>,
    },
    {
      key: 'freshnessStatus',
      header: 'Freshness',
      render: (r) => (
        <span className="font-medium text-[var(--admin-text)]">{r.freshnessStatus || '—'}</span>
      ),
    },
    {
      key: 'processingPaused',
      header: 'Paused',
      render: (r) => (r.processingPaused ? 'Yes' : 'No'),
    },
    {
      key: 'lastConfigurationSyncAt',
      header: 'Last sync',
      render: (r) => (
        <span className="text-xs text-[var(--admin-text-muted)]">
          {r.lastConfigurationSyncAt || '—'}
        </span>
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
            Configuration
          </>
        }
        title="MRA EIS configuration"
        description="Cross-tenant configuration freshness. No raw credential or sensitive response content."
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
        </select>
        <button type="button" className={btnPrimary} onClick={load}>
          Apply
        </button>
      </div>

      {loading ? <AdminLoadingState label="Loading configuration" /> : null}
      {!loading && error ? (
        <AdminErrorState title="Configuration unavailable" message={error} onRetry={load} />
      ) : null}
      {!loading && !error ? (
        <AdminDataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.terminalId || r.id}
          emptyTitle="No terminals found"
        />
      ) : null}
    </AdminPageContainer>
  );
}
