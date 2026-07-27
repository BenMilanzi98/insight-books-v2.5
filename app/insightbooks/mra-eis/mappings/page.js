'use client';

import { useCallback, useEffect, useState } from 'react';

export default function AdminMraEisMappingsPage() {
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
      const res = await fetch(`/api/admin/mra-eis/mappings?${qs}`);
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-sm text-slate-500">System Administration / MRA EIS</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Mapping health</h1>
        <p className="mt-2 text-sm text-slate-600">
          Cross-tenant diagnostics. Cannot force ACTIVE, delete history, edit external IDs, or view credentials.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <label className="text-sm">
          Kind
          <select className="ml-2 rounded border px-2 py-1" value={kind} onChange={(e) => setKind(e.target.value)}>
            {['SITE', 'TAX', 'LEVY', 'PAYMENT'].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Environment
          <input
            className="ml-2 rounded border px-2 py-1"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            placeholder="SANDBOX / PRODUCTION"
          />
        </label>
        <label className="text-sm">
          Tenant
          <input
            className="ml-2 rounded border px-2 py-1 font-mono text-xs"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="tenantId"
          />
        </label>
        <button type="button" className="rounded bg-slate-900 px-3 py-1 text-sm text-white" onClick={load}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p role="status">Loading…</p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            {Object.entries(data?.health || {}).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase text-slate-500">{k}</div>
                <div className="text-xl font-semibold">{v}</div>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2">Business</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Environment</th>
                  <th className="px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows || []).map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{r.tenantId}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.businessId}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2">{r.environment || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{r.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
