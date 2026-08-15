'use client';
import { tt } from '@/lib/i18n/runtime';

import { adminFetch } from '@/lib/admin/adminApi';
import { useI18n } from '@/components/i18n/I18nProvider';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminSummaryCard,
  AdminDataTable,
  AdminStatusBadge,
} from '@/components/admin';

const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white disabled:opacity-50';
const inputCls =
  'rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-text)]';

export default function AdminMraEisMappingsPage() {
  const { t } = useI18n();
  const [kind, setKind] = useState('SITE');
  const [environment, setEnvironment] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ kind });
      if (environment) qs.set('environment', environment);
      if (tenantId) qs.set('tenantId', tenantId);
      const res = await adminFetch(`/api/admin/mra-eis/mappings?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load mapping health');
      setData(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [kind, environment, tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      key: 'tenantId',
      header: 'Tenant',
      render: (r) => <span className="font-mono text-xs">{r.tenantId}</span>,
    },
    {
      key: 'businessId',
      header: 'Business',
      render: (r) => <span className="font-mono text-xs">{r.businessId}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <AdminStatusBadge>{r.status}</AdminStatusBadge>,
    },
    {
      key: 'environment',
      header: 'Environment',
      render: (r) => r.environment || '—',
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      render: (r) => (
        <span className="text-xs text-[var(--admin-text-muted)]">{r.updatedAt}</span>
      ),
    },
  ];

  return (
    <AdminPageContainer>
      <AdminPageHeader
        breadcrumb={
          <>
            <Link href="/insightbooks/mra-eis" className="underline">
              {tt('MRA EIS')}
            </Link>
            {' / '}
            Mappings
          </>
        }
        title={t('admin-pages.mraEis.mappings.title')}
        description={t('admin-pages.mraEis.mappings.description')}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-[var(--admin-text)]">
          <span className="mb-1 block font-medium">{tt('Kind')}</span>
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}>
            {['SITE', 'TAX', 'LEVY', 'PAYMENT'].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-[var(--admin-text)]">
          <span className="mb-1 block font-medium">{tt('Environment')}</span>
          <input
            className={inputCls}
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            placeholder={tt('SANDBOX / PRODUCTION')}
          />
        </label>
        <label className="text-sm text-[var(--admin-text)]">
          <span className="mb-1 block font-medium">{tt('Tenant')}</span>
          <input
            className={`${inputCls} font-mono text-xs`}
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder={tt('tenantId')}
          />
        </label>
        <button type="button" className={btnPrimary} onClick={load}>
          {tt('Refresh')}
        </button>
      </div>

      {loading ? <AdminLoadingState label="Loading mapping health" /> : null}
      {!loading && error ? (
        <AdminErrorState title="Mapping health unavailable" message={error} onRetry={load} />
      ) : null}

      {!loading && !error ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(data?.health || {}).map(([k, v]) => (
              <AdminSummaryCard key={k} label={k} value={v} />
            ))}
          </div>
          <AdminDataTable
            columns={columns}
            rows={data?.rows || []}
            rowKey="id"
            emptyTitle="No mapping rows"
            emptyDescription="No mappings match the current filters."
          />
        </>
      ) : null}
    </AdminPageContainer>
  );
}
