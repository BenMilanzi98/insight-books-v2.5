'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

export default function SystemMraEisTerminalsPage() {
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
      const res = await fetch(`/api/admin/mra-eis/terminals?${qs.toString()}`);
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-medium text-slate-500">System Administration</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">MRA EIS terminals</h1>
        <p className="mt-2 text-sm text-slate-600">
          Cross-tenant visibility. Credential plaintext is never returned. Support actions are audited.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Tenant ID"
          value={filters.tenantId}
          onChange={(e) => setFilters((f) => ({ ...f, tenantId: e.target.value }))}
        />
        <select
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          value={filters.environment}
          onChange={(e) => setFilters((f) => ({ ...f, environment: e.target.value }))}
        >
          <option value="">All environments</option>
          <option value="SANDBOX">Sandbox</option>
          <option value="PRODUCTION">Production</option>
          <option value="MOCK">Mock</option>
        </select>
        <select
          className="rounded border border-slate-300 px-3 py-2 text-sm"
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
        <button type="button" className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={load}>
          Apply
        </button>
      </div>

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>}

      {loading ? (
        <p className="text-slate-600">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Tenant</th>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Env</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">MRA ID</th>
                <th className="px-3 py-2">Token expiry</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{r.tenantId}</td>
                  <td className="px-3 py-2">{r.terminalLabel}</td>
                  <td className="px-3 py-2">{r.environment}</td>
                  <td className="px-3 py-2 font-medium">{r.status}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.mraTerminalId || '—'}</td>
                  <td className="px-3 py-2 text-xs">{r.tokenExpiresAt || '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    No terminals match filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-sm">
        <Link href="/insightbooks/mra-eis" className="text-slate-600 underline">
          ← EIS control plane
        </Link>
      </p>
    </div>
  );
}
