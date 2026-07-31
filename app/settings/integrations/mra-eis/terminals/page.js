'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

function envBadge(env) {
  if (env === 'PRODUCTION') return 'bg-red-100 text-red-900 border-red-200';
  if (env === 'SANDBOX') return 'bg-amber-100 text-amber-950 border-amber-200';
  return 'bg-slate-100 text-slate-800 border-slate-200';
}

export default function MraEisTerminalsPage() {
  const [terminals, setTerminals] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mra-eis/terminals');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load terminals');
      setTerminals(json.data || []);
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
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">MRA EIS</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Terminals</h1>
          <p className="mt-2 text-sm text-slate-600">
            Onboarding and activation status. Credentials are never displayed.
          </p>
        </div>
        <Link
          href="/settings/integrations/mra-eis/terminals/onboarding"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Start onboarding
        </Link>
      </header>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      )}

      {loading ? (
        <p className="text-slate-600">Loading terminals…</p>
      ) : terminals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-600">
          No terminals yet.{' '}
          <Link className="font-medium text-slate-900 underline" href="/settings/integrations/mra-eis/terminals/onboarding">
            Create a draft
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {terminals.map((t) => (
            <li key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-900">{t.terminalLabel}</div>
                  <div className="mt-1 text-xs text-slate-500">ID: {t.id}</div>
                  {t.mraTerminalId && (
                    <div className="text-xs text-slate-500">MRA terminal: {t.mraTerminalId}</div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded border px-2 py-0.5 text-xs font-medium ${envBadge(t.environment)}`}>
                    {t.environment}
                  </span>
                  <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium">
                    {t.status}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link className="font-medium text-indigo-700 underline" href={`/settings/integrations/mra-eis/terminals/${t.id}`}>
                  View health
                </Link>
                {!['ACTIVE', 'REVOKED'].includes(t.status) && (
                  <Link
                    className="font-medium text-slate-800 underline"
                    href={`/settings/integrations/mra-eis/terminals/onboarding?terminalId=${t.id}`}
                  >
                    Resume onboarding
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-sm">
        <Link href="/settings/integrations/mra-eis" className="text-slate-600 underline">
          ← Back to EIS availability
        </Link>
      </p>
    </div>
  );
}
