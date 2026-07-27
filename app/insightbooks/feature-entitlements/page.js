'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminEmptyState,
  AdminStatusBadge,
} from '@/components/admin';

export default function FeatureEntitlementsPage() {
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
        fetch('/api/admin/tenants', { credentials: 'include' }),
        fetch('/api/admin/feature-entitlements', { credentials: 'include' }),
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
      const res = await fetch('/api/admin/feature-entitlements', {
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

  const tenantName = (id) => tenants.find((t) => t.id === id)?.name || id;

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Feature Entitlements"
        description="Grant or disable tenant feature overrides. Disabling a feature never deletes tenant historical data."
        actions={
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
        }
      />

      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? (
        <AdminErrorState title="Entitlements unavailable" message={error} onRetry={load} />
      ) : null}

      {!loading ? (
        <>
          <form
            onSubmit={save}
            className="mb-6 grid grid-cols-1 gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-primary)] p-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <label className="text-sm">
              <span className="mb-1 block font-medium">Tenant</span>
              <select
                required
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2"
                value={form.tenantId}
                onChange={(e) => setForm((p) => ({ ...p, tenantId: e.target.value }))}
              >
                <option value="">Select tenant</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Feature code</span>
              <input
                required
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2"
                value={form.featureCode}
                onChange={(e) => setForm((p) => ({ ...p, featureCode: e.target.value }))}
                placeholder="e.g. mra_eis, budgeting"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Display name</span>
              <input
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2"
                value={form.featureName}
                onChange={(e) => setForm((p) => ({ ...p, featureName: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Status</span>
              <select
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2"
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
              <span className="mb-1 block font-medium">Reason</span>
              <input
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2"
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--action-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                <Plus className="h-4 w-4" aria-hidden />
                {saving ? 'Saving…' : 'Save entitlement'}
              </button>
            </div>
          </form>

          {entitlements.length === 0 ? (
            <AdminEmptyState
              title="No tenant overrides yet"
              description="Plan features apply by default. Create a tenant override to enable or disable a feature."
            />
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-primary)]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">Feature</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {entitlements.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--border-default)]">
                      <td className="px-4 py-3 font-medium">{tenantName(row.tenantId)}</td>
                      <td className="px-4 py-3">
                        <div>{row.featureName || row.featureCode}</div>
                        <div className="text-xs text-[var(--text-muted)]">{row.featureCode}</div>
                      </td>
                      <td className="px-4 py-3">{row.source}</td>
                      <td className="px-4 py-3">
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
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-[var(--text-secondary)]">
                        {row.reason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </AdminPageContainer>
  );
}
