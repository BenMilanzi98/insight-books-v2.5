'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white disabled:opacity-50';
const inputCls =
  'w-full rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-text)]';
const sectionCls =
  'mb-6 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-5';

function statusTone(status) {
  if (
    status === 'ENABLED' ||
    status === 'ENTITLED_PRODUCTION' ||
    status === 'ENTITLED_SANDBOX_ONLY'
  ) {
    return 'success';
  }
  if (status === 'EMERGENCY_PAUSED' || status === 'SUSPENDED' || status === 'REVOKED') {
    return 'danger';
  }
  if (status === 'MAINTENANCE' || status === 'ENTITLEMENT_PENDING') return 'warning';
  return 'neutral';
}

export default function AdminMraEisPage() {
  const { t } = useI18n();
  const [platform, setPlatform] = useState(null);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [grant, setGrant] = useState({
    tenantId: '',
    production: false,
    reason: '',
  });
  const [platformForm, setPlatformForm] = useState({
    status: 'DISABLED',
    reason: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (statusFilter) qs.set('status', statusFilter);
      const [pRes, eRes] = await Promise.all([
        adminFetch('/api/admin/mra-eis/platform'),
        adminFetch(`/api/admin/mra-eis/entitlements?${qs.toString()}`),
      ]);
      const pJson = await pRes.json();
      const eJson = await eRes.json();
      if (!pRes.ok) throw new Error(pJson?.error?.message || 'Failed to load platform');
      if (!eRes.ok) throw new Error(eJson?.error?.message || 'Failed to load entitlements');
      setPlatform(pJson.platform);
      setPlatformForm((f) => ({ ...f, status: pJson.platform?.status || 'DISABLED' }));
      setItems(eJson.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function savePlatform() {
    setMessage('');
    setError('');
    const res = await adminFetch('/api/admin/mra-eis/platform', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({
        status: platformForm.status,
        reason: platformForm.reason,
        expectedVersion: platform?.version,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message || 'Platform update failed');
      return;
    }
    setMessage('Platform EIS status updated.');
    setPlatform(json.platform);
    setPlatformForm((f) => ({ ...f, reason: '' }));
  }

  async function grantEntitlement() {
    setMessage('');
    setError('');
    if (!grant.tenantId || !grant.reason.trim()) {
      setError('Tenant ID and reason are required.');
      return;
    }
    const res = await adminFetch('/api/admin/mra-eis/entitlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({
        tenantId: grant.tenantId.trim(),
        production: grant.production,
        reason: grant.reason.trim(),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message || 'Grant failed');
      return;
    }
    setMessage(
      grant.production
        ? 'Production entitlement granted (certification and setup still required).'
        : 'Sandbox entitlement granted.'
    );
    setGrant({ tenantId: '', production: false, reason: '' });
    load();
  }

  const columns = [
    {
      key: 'tenant',
      header: 'Tenant',
      render: (row) => (
        <div>
          <div className="font-medium text-[var(--admin-text)]">
            {row.tenant?.name || row.tenantId}
          </div>
          <div className="text-xs text-[var(--admin-text-muted)]">
            {row.tenant?.subdomain || row.tenantId}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <AdminStatusBadge tone={statusTone(row.status)}>{row.status || 'UNKNOWN'}</AdminStatusBadge>
      ),
    },
    {
      key: 'environment',
      header: 'Environment',
      render: (row) => (
        <span className="text-xs text-[var(--admin-text)]">
          {row.productionAllowed ? 'Production allowed' : 'Sandbox only'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Link
          className="text-sm text-[var(--action-primary)] underline"
          href={`/insightbooks/mra-eis/tenants/${row.tenantId}`}
        >
          Open detail
        </Link>
      ),
    },
  ];

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.mraEis.title')}
        description="Platform and tenant control plane. Terminal activation is under Terminals (metadata only — credentials are never displayed). This screen does not submit fiscal transactions."
        actions={
          <button type="button" onClick={load} className={btnGhost} disabled={loading}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
          </button>
        }
      />

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-[var(--admin-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <div
          role="status"
          className="mb-4 rounded-[var(--admin-radius)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {message}
        </div>
      ) : null}

      <section className={sectionCls} aria-labelledby="platform-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="platform-heading" className="text-base font-semibold text-[var(--admin-text)]">
            Platform status
          </h2>
          {platform ? (
            <AdminStatusBadge tone={statusTone(platform.status)}>
              {platform.status}
            </AdminStatusBadge>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-text)]">Status</span>
            <select
              className={inputCls}
              value={platformForm.status}
              onChange={(e) => setPlatformForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="DISABLED">Disabled</option>
              <option value="ENABLED">Enabled</option>
              <option value="EMERGENCY_PAUSED">Emergency paused</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="RETIRED">Retired</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-text)]">
              Reason (required for pause/disable)
            </span>
            <input
              className={inputCls}
              value={platformForm.reason}
              onChange={(e) => setPlatformForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </label>
        </div>
        <button type="button" onClick={savePlatform} className={`${btnPrimary} mt-4`}>
          Update platform status
        </button>
      </section>

      <section className={sectionCls} aria-labelledby="grant-heading">
        <h2 id="grant-heading" className="text-base font-semibold text-[var(--admin-text)]">
          Grant tenant entitlement
        </h2>
        <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
          Tenants cannot self-entitle. Production does not imply certification or operational readiness.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-text)]">Tenant ID</span>
            <input
              className={inputCls}
              value={grant.tenantId}
              onChange={(e) => setGrant((g) => ({ ...g, tenantId: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-text)]">Reason</span>
            <input
              className={inputCls}
              value={grant.reason}
              onChange={(e) => setGrant((g) => ({ ...g, reason: e.target.value }))}
            />
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-[var(--admin-text)]">
          <input
            type="checkbox"
            checked={grant.production}
            onChange={(e) => setGrant((g) => ({ ...g, production: e.target.checked }))}
          />
          Grant production entitlement (still requires certification)
        </label>
        <button type="button" onClick={grantEntitlement} className={`${btnPrimary} mt-4`}>
          Grant entitlement
        </button>
      </section>

      <section
        className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-5"
        aria-labelledby="list-heading"
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 id="list-heading" className="text-base font-semibold text-[var(--admin-text)]">
            Tenant entitlements
          </h2>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Search tenants"
              placeholder="Search name or ID"
              className={`${inputCls} w-auto min-w-[10rem]`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Filter status"
              className={`${inputCls} w-auto`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="ENTITLED_SANDBOX_ONLY">Sandbox</option>
              <option value="ENTITLED_PRODUCTION">Production</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="REVOKED">Revoked</option>
              <option value="EXPIRED">Expired</option>
            </select>
            <button type="button" onClick={load} className={btnGhost}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <AdminLoadingState label="Loading entitlements" />
        ) : error && items.length === 0 ? (
          <AdminErrorState title="Entitlements unavailable" message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <AdminEmptyState
            title="No entitlement records yet"
            description="Ordinary tenants default to not entitled."
          />
        ) : (
          <AdminDataTable
            columns={columns}
            rows={items}
            rowKey="id"
            emptyTitle="No entitlement records yet"
          />
        )}
      </section>
    </AdminPageContainer>
  );
}
