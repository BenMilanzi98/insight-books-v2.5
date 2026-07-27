'use client';

import { useCallback, useEffect, useState } from 'react';

export default function AdminMraEisCataloguePage() {
  const [tenantId, setTenantId] = useState('');
  const [environment, setEnvironment] = useState('SANDBOX');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Reuse mapping admin pattern — catalogue items via prisma would need admin API;
      // for now surface contract + guidance.
      const res = await fetch('/api/admin/mra-eis/mappings?kind=PRODUCT');
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-sm text-slate-500">System Administration / MRA EIS</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Catalogue & product mapping health</h1>
        <p className="mt-2 text-sm text-slate-600">
          Diagnostics only. Cannot edit external codes, force ACTIVE, delete history, adjust stock, or view credentials.
          Product sync production calls remain blocked (Q-003).
        </p>
      </header>
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="rounded border px-2 py-1 font-mono text-xs" placeholder="tenantId filter (display)" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
        <input className="rounded border px-2 py-1" value={environment} onChange={(e) => setEnvironment(e.target.value)} />
        <button type="button" className="rounded bg-slate-900 px-3 py-1 text-sm text-white" onClick={load}>
          Refresh product mappings
        </button>
      </div>
      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm" role="alert">{error}</div>}
      {loading ? (
        <p role="status">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Tenant</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => !tenantId || r.tenantId === tenantId)
                .map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{r.tenantId}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2">{r.mappingType}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{r.updatedAt}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
