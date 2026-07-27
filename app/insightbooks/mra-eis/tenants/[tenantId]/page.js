'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function AdminMraEisTenantDetailPage() {
  const params = useParams();
  const tenantId = params.tenantId;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/mra-eis/entitlements/${tenantId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load');
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(action) {
    setError('');
    setMessage('');
    if (!reason.trim() && action !== 'upgrade') {
      setError('Reason is required.');
      return;
    }
    const res = await fetch(`/api/admin/mra-eis/entitlements/${tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({
        action,
        reason: reason.trim() || 'Upgrade to production entitlement',
        expectedVersion: data?.entitlement?.version,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message || 'Action failed');
      return;
    }
    setMessage(`Action ${action} completed. History preserved.`);
    setReason('');
    load();
  }

  if (loading) {
    return <div className="p-8 text-slate-600">Loading tenant EIS controls…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/insightbooks/mra-eis" className="text-sm text-indigo-700 underline">
          ← Back to EIS entitlements
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">{data?.tenant?.name || tenantId}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Entitlement detail. No credentials are shown. Fiscalization remains blocked until later phases.
        </p>

        {error && (
          <div role="alert" className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        )}

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Current entitlement</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium">{data?.entitlement?.status || 'NOT_ENTITLED'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Production allowed</dt>
              <dd className="font-medium">{data?.entitlement?.productionAllowed ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Effective from</dt>
              <dd>{data?.entitlement?.effectiveFrom || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Effective until</dt>
              <dd>{data?.entitlement?.effectiveUntil || 'No expiry'}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Readiness / blockers</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {(data?.capability?.blockers || []).map((b) => (
              <li key={b.code}>
                <strong>{b.code}</strong> — {b.message}
                {b.action ? ` (${b.action})` : ''}
              </li>
            ))}
            {(data?.capability?.blockers || []).length === 0 && <li>No blockers for VIEW_EIS.</li>}
          </ul>
        </section>

        <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold text-amber-950">Control actions</h2>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium">Reason</span>
            <textarea
              className="w-full rounded border border-amber-300 bg-white px-3 py-2"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded bg-indigo-700 px-3 py-2 text-sm text-white" onClick={() => runAction('upgrade')}>
              Upgrade to production
            </button>
            <button type="button" className="rounded bg-amber-700 px-3 py-2 text-sm text-white" onClick={() => runAction('suspend')}>
              Suspend
            </button>
            <button type="button" className="rounded bg-slate-800 px-3 py-2 text-sm text-white" onClick={() => runAction('resume')}>
              Resume
            </button>
            <button type="button" className="rounded bg-red-700 px-3 py-2 text-sm text-white" onClick={() => runAction('revoke')}>
              Revoke
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Audit history</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(data?.audit || []).map((a) => (
              <li key={a.id} className="rounded border border-slate-100 px-3 py-2">
                <div className="font-medium">{a.action}</div>
                <div className="text-xs text-slate-500">
                  {a.previousStatus || '—'} → {a.newStatus || '—'} · {a.createdAt}
                </div>
                {a.reason && <div className="text-xs text-slate-600">{a.reason}</div>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
