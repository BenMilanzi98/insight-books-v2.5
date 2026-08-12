'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function MraEisTerminalDetailPage() {
  const params = useParams();
  const id = params?.id;
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/mra-eis/terminals/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load terminal');
      setHealth(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function requestAction(path) {
    setError('');
    setMessage('');
    if (!reason.trim() || reason.trim().length < 5) {
      setError('A reason of at least 5 characters is required.');
      return;
    }
    const res = await fetch(`/api/mra-eis/terminals/${id}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message || 'Request failed');
      return;
    }
    setMessage(`${path} submitted. Historical evidence is preserved.`);
    setReason('');
    load();
  }

  if (loading) {
    return <div className="p-8 text-slate-600">Loading terminal health…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-medium text-slate-500">MRA EIS terminal</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Health & lifecycle</h1>
        <p className="mt-2 text-sm text-slate-600">
          Credential values are never returned. JWT / terminal secret status is metadata only.
        </p>
      </header>

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>}
      {message && <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div>}

      {health && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Terminal ID</dt>
              <dd className="font-mono text-xs">{health.terminalId}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium">{health.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Environment</dt>
              <dd className="font-medium">{health.environment}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Activation confirmed</dt>
              <dd className="font-medium">{health.activationConfirmed ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">JWT status</dt>
              <dd className="font-medium">{health.jwtStatus}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Terminal secret status</dt>
              <dd className="font-medium">{health.terminalSecretStatus}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Configuration</dt>
              <dd className="font-medium">{health.configurationStatus}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Token expiring</dt>
              <dd className="font-medium">{health.tokenExpiring ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
          {(health.blockers || []).length > 0 && (
            <ul className="mt-4 list-disc pl-5 text-sm text-red-900">
              {health.blockers.map((b) => (
                <li key={b.code || b}>{typeof b === 'string' ? b : `${b.code}: ${b.message}`}</li>
              ))}
            </ul>
          )}
          {(health.recommendedActions || []).length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-sm text-slate-700">
              {health.recommendedActions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Lifecycle requests</h2>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium">Reason</span>
          <textarea
            className="w-full rounded border border-slate-300 px-3 py-2"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="rounded bg-amber-800 px-3 py-2 text-sm text-white" onClick={() => requestAction('reactivate')}>
            Request reactivation
          </button>
          <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => requestAction('replace')}>
            Request replacement
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Production actions may require approval. Historical activation evidence is never deleted.
        </p>
      </section>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link className="font-medium text-blue-700 underline underline-offset-2" href={`/settings/integrations/mra-eis/terminals/${id}/configuration`}>
          Configuration health & sync
        </Link>
        {!['ACTIVE', 'REVOKED'].includes(health?.status) && (
          <Link className="font-medium text-blue-700 underline underline-offset-2" href={`/settings/integrations/mra-eis/terminals/onboarding?terminalId=${id}`}>
            Resume onboarding
          </Link>
        )}
        <Link className="text-slate-600 underline" href="/settings/integrations/mra-eis/terminals">
          ← Terminal list
        </Link>
      </div>
    </div>
  );
}
