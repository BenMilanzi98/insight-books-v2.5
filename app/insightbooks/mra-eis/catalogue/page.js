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
  AdminDataTable,
  AdminStatusBadge,
} from '@/components/admin';

const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white disabled:opacity-50';
const inputCls =
  'rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-text)]';

export default function AdminMraEisCataloguePage() {
  const { t } = useI18n();
  const [tenantId, setTenantId] = useState('');
  const [environment, setEnvironment] = useState('SANDBOX');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/mra-eis/mappings?kind=PRODUCT');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load');
      setRows(json.data?.rows || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => !tenantId || r.tenantId === tenantId);

  const columns = [
    {
      key: 'tenantId',
      header: 'Tenant',
      render: (r) => <span className="font-mono text-xs">{r.tenantId}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <AdminStatusBadge>{r.status}</AdminStatusBadge>,
    },
    { key: 'mappingType', header: 'Type' },
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
            Catalogue
          </>
        }
        title={t('admin-pages.mraEis.catalogue.title')}
        description={t('admin-pages.mraEis.catalogue.description')}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className={`${inputCls} font-mono text-xs`}
          placeholder="tenantId filter (display)"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
        />
        <input
          className={inputCls}
          value={environment}
          onChange={(e) => setEnvironment(e.target.value)}
          aria-label={tt('Environment display filter')}
        />
        <button type="button" className={btnPrimary} onClick={load}>
          {tt('Refresh product mappings')}
        </button>
      </div>

      {loading ? <AdminLoadingState label="Loading catalogue mappings" /> : null}
      {!loading && error ? (
        <AdminErrorState title={tt('Catalogue unavailable')} message={error} onRetry={load} />
      ) : null}
      {!loading && !error ? (
        <AdminDataTable
          columns={columns}
          rows={filtered}
          rowKey="id"
          emptyTitle="No product mappings"
          emptyDescription="No PRODUCT mapping rows returned for this filter."
        />
      ) : null}
    </AdminPageContainer>
  );
}
