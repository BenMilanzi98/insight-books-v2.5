'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

function StatusBadge({ status }) {
  const tone =
    status === 'ENABLED' || status === 'ENTITLED_PRODUCTION' || status === 'ENTITLED_SANDBOX_ONLY'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'EMERGENCY_PAUSED' || status === 'SUSPENDED' || status === 'REVOKED'
        ? 'bg-red-100 text-red-800'
        : status === 'MAINTENANCE' || status === 'ENTITLEMENT_PENDING'
          ? 'bg-amber-100 text-amber-900'
          : 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${tone}`}>
      {status || 'UNKNOWN'}
    </span>
  );
}

export default function AdminMraEisPage() {
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
        fetch('/api/admin/mra-eis/platform'),
        fetch(`/api/admin/mra-eis/entitlements?${qs.toString()}`),
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
    const res = await fetch('/api/admin/mra-eis/platform', {
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
    const res = await fetch('/api/admin/mra-eis/entitlements', {
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-8">
          <p className="text-sm font-medium text-slate-500">System Administration</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">MRA EIS entitlement</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Platform and tenant control plane. Terminal activation is available under Terminals (metadata
            only — credentials are never displayed). This screen does not submit fiscal transactions.
          </p>
          <p className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/insightbooks/mra-eis/centre"
              className="inline-block rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              EIS Administration Centre
            </Link>
            <Link
              href="/insightbooks/mra-eis/terminals"
              className="inline-block rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
            >
              View EIS terminals
            </Link>
            <Link
              href="/insightbooks/mra-eis/configuration"
              className="inline-block rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
            >
              Configuration freshness
            </Link>
          </p>
        </header>

        {error && (
          <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        )}

        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="platform-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="platform-heading" className="text-lg font-semibold">
              Platform status
            </h2>
            {platform && <StatusBadge status={platform.status} />}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Status</span>
              <select
                className="w-full rounded border border-slate-300 px-3 py-2"
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
              <span className="mb-1 block font-medium">Reason (required for pause/disable)</span>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={platformForm.reason}
                onChange={(e) => setPlatformForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={savePlatform}
            className="mt-4 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Update platform status
          </button>
        </section>

        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="grant-heading">
          <h2 id="grant-heading" className="text-lg font-semibold">
            Grant tenant entitlement
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Tenants cannot self-entitle. Production does not imply certification or operational readiness.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Tenant ID</span>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={grant.tenantId}
                onChange={(e) => setGrant((g) => ({ ...g, tenantId: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Reason</span>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={grant.reason}
                onChange={(e) => setGrant((g) => ({ ...g, reason: e.target.value }))}
              />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={grant.production}
              onChange={(e) => setGrant((g) => ({ ...g, production: e.target.checked }))}
            />
            Grant production entitlement (visually distinct — still requires certification)
          </label>
          <button
            type="button"
            onClick={grantEntitlement}
            className="mt-4 rounded bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
          >
            Grant entitlement
          </button>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="list-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="list-heading" className="text-lg font-semibold">
              Tenant entitlements
            </h2>
            <div className="flex flex-wrap gap-2">
              <input
                aria-label="Search tenants"
                placeholder="Search name or ID"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Filter status"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
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
              <button type="button" onClick={load} className="rounded border border-slate-300 px-3 py-2 text-sm">
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-2 py-2 font-medium">Tenant</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Environment</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-2 py-6 text-slate-500">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-6 text-slate-500">
                      No entitlement records yet. Ordinary tenants default to not entitled.
                    </td>
                  </tr>
                )}
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-2 py-3">
                      <div className="font-medium">{row.tenant?.name || row.tenantId}</div>
                      <div className="text-xs text-slate-500">{row.tenant?.subdomain || row.tenantId}</div>
                    </td>
                    <td className="px-2 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-2 py-3 text-xs">
                      {row.productionAllowed ? 'Production allowed' : 'Sandbox only'}
                    </td>
                    <td className="px-2 py-3">
                      <Link
                        className="text-indigo-700 underline"
                        href={`/insightbooks/mra-eis/tenants/${row.tenantId}`}
                      >
                        Open detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
