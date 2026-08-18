'use client';
import { tt } from '@/lib/i18n/runtime';

import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminStatusBadge,
  AdminDataTable,
} from '@/components/admin';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white disabled:opacity-50';
const inputCls =
  'w-full rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-text)]';

export default function FeatureEntitlementsPage() {
  const { t } = useI18n();
  const [tenants, setTenants] = useState([]);
  const [entitlements, setEntitlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tenantId: '',
    featureCode: '',
    featureName: '',
    status: 'ACTIVE',
    reason: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tRes, eRes] = await Promise.all([
        adminFetch('/api/admin/tenants', { credentials: 'include' }),
        adminFetch('/api/admin/feature-entitlements', { credentials: 'include' }),
      ]);
      const tBody = await tRes.json().catch(() => ({}));
      const eBody = await eRes.json().catch(() => ({}));
      if (!tRes.ok) throw new Error(tBody.error || 'Failed to load tenants');
      if (!eRes.ok) throw new Error(eBody.error || 'Failed to load entitlements');
      setTenants(tBody.tenants || []);
      setEntitlements(eBody.entitlements || []);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/feature-entitlements', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Save failed');
      setForm((prev) => ({ ...prev, featureCode: '', featureName: '', reason: '' }));
      await load();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const tenantName = useCallback(
    (id) => tenants.find((t) => t.id === id)?.name || id,
    [tenants]
  );

  const columns = useMemo(
    () => [
      {
        key: 'tenant',
        header: 'Tenant',
        render: (row) => (
          <span className="font-medium text-[var(--admin-text)]">{tenantName(row.tenantId)}</span>
        ),
      },
      {
        key: 'feature',
        header: 'Feature',
        render: (row) => (
          <div>
            <div className="text-[var(--admin-text)]">{row.featureName || row.featureCode}</div>
            <div className="text-xs text-[var(--admin-text-muted)]">{row.featureCode}</div>
          </div>
        ),
      },
      { key: 'source', header: 'Source' },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <AdminStatusBadge
            tone={
              row.status === 'ACTIVE'
                ? 'success'
                : row.status === 'DISABLED'
                  ? 'danger'
                  : 'warning'
            }
          >
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
    [tenantName]
  );

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.features.title')}
        description="Grant or disable tenant feature overrides. Disabling a feature never deletes tenant historical data."
        actions={
          <button type="button" onClick={load} className={btnGhost}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            {tt('Refresh')}
          </button>
        }
      />

      {loading ? <AdminLoadingState label="Loading entitlements" /> : null}
      {!loading && error && entitlements.length === 0 && tenants.length === 0 ? (
        <AdminErrorState title={tt('Entitlements unavailable')} message={error} onRetry={load} />
      ) : null}

      {!loading && !(error && entitlements.length === 0 && tenants.length === 0) ? (
        <>
          {error ? (
            <div
              role="alert"
              className="mb-4 rounded-[var(--admin-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </div>
          ) : null}

          <form
            onSubmit={save}
            className="mb-6 grid grid-cols-1 gap-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <label className="text-sm">
              <span className="mb-1 block font-medium text-[var(--admin-text)]">{tt('Tenant')}</span>
              <select
                required
                className={inputCls}
                value={form.tenantId}
                onChange={(e) => setForm((p) => ({ ...p, tenantId: e.target.value }))}
              >
                <option value="">{tt('Select tenant')}</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-[var(--admin-text)]">{tt('Feature code')}</span>
              <input
                required
                className={inputCls}
                value={form.featureCode}
                onChange={(e) => setForm((p) => ({ ...p, featureCode: e.target.value }))}
                placeholder={tt('e.g. mra_eis, budgeting')}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-[var(--admin-text)]">{tt('Display name')}</span>
              <input
                className={inputCls}
                value={form.featureName}
                onChange={(e) => setForm((p) => ({ ...p, featureName: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-[var(--admin-text)]">{tt('Status')}</span>
              <select
                className={inputCls}
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="DISABLED">DISABLED</option>
                <option value="PENDING">PENDING</option>
                <option value="EXPIRED">EXPIRED</option>
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-[var(--admin-text)]">{tt('Reason')}</span>
              <input
                className={inputCls}
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              />
            </label>
            <div className="flex items-end">
              <button type="submit" disabled={saving} className={btnPrimary}>
                <Plus className="h-4 w-4" aria-hidden />
                {saving ? tt('Saving…') : tt('Save entitlement')}
              </button>
            </div>
          </form>

          <AdminDataTable
            columns={columns}
            rows={entitlements}
            rowKey="id"
            emptyTitle="No tenant overrides yet"
            emptyDescription="Plan features apply by default. Create a tenant override to enable or disable a feature."
          />
        </>
      ) : null}
    </AdminPageContainer>
  );
}
