'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function TerminalConfigurationPage() {
  const params = useParams();
  const id = params?.id;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const res = await fetch(`/api/mra-eis/terminals/${id}/configuration`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load configuration');
      setData(json.data);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function syncNow() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/mra-eis/terminals/${id}/configuration/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ reason: 'Manual sync from configuration UI' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Sync failed');
      setMessage(`Sync ${json.data.status}. Local tax rates were not modified. Offline remains disabled.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const health = data?.health;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-medium text-slate-500">{tt('MRA EIS · Phase 8')}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{tt('Configuration health')}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {tt('Immutable versioned snapshots. Credentials never displayed. MRA tax definitions do not change local Chart of Accounts tax rates.')}
        </p>
      </header>

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>}
      {message && (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div>
      )}

      {health && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{tt('Freshness')}</dt>
              <dd className="font-medium">{health.freshnessStatus}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Processing paused')}</dt>
              <dd className="font-medium">{health.processingPaused ? tt('Yes') : tt('No')}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Global version')}</dt>
              <dd className="font-medium">{health.activeGlobalVersion || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Terminal version')}</dt>
              <dd className="font-medium">{health.activeTerminalVersion || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Taxpayer version')}</dt>
              <dd className="font-medium">{health.activeTaxpayerVersion || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Offline (MRA flag)</dt>
              <dd className="font-medium">
                {health.offlineAllowedByMra ? tt('Allowed by MRA') : tt('Not allowed')} · local offline disabled
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Last sync')}</dt>
              <dd className="font-medium">{health.lastSuccessfulSyncAt || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Next required')}</dt>
              <dd className="font-medium">{health.nextRequiredSyncAt || '—'}</dd>
            </div>
          </dl>
          {(health.blockers || []).length > 0 && (
            <ul className="mt-4 list-disc pl-5 text-sm text-red-900">
              {health.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={busy}
            className="mt-4 rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            onClick={syncNow}
          >
            {busy ? tt('Synchronizing…') : tt('Request manual sync')}
          </button>
        </section>
      )}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{tt('Snapshot history')}</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(data?.snapshots || []).map((s) => (
            <li key={s.id} className="rounded border border-slate-100 px-3 py-2">
              <div className="font-medium">
                {s.configurationType} · {s.mraVersion} · {s.status}
              </div>
              <div className="text-xs text-slate-500">
                checksum {String(s.sourceChecksum || '').slice(0, 12)}… · received {s.receivedAt}
              </div>
            </li>
          ))}
          {(data?.snapshots || []).length === 0 && <li className="text-slate-500">{tt('No snapshots yet.')}</li>}
        </ul>
      </section>

      <p className="text-sm">
        <Link href={`/settings/integrations/mra-eis/terminals/${id}`} className="text-slate-600 underline">
          ← Terminal health
        </Link>
      </p>
    </div>
  );
}
