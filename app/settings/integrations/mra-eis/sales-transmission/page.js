'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Phase 13 — Sales transmission workspace.
 * Does not render QR images or final fiscal receipts.
 */
export default function MraEisSalesTransmissionPage() {
  const [transmissions, setTransmissions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [contract, setContract] = useState(null);
  const [workerResult, setWorkerResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mra-eis/sales-transmission');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load transmissions');
      setTransmissions(data.transmissions || []);
      setContract(data.contractDecision || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openTransmission(id) {
    setError(null);
    const res = await fetch(`/api/mra-eis/sales-transmission?id=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to load transmission');
      return;
    }
    setSelected(data);
  }

  async function processOutbox() {
    setError(null);
    const res = await fetch('/api/mra-eis/sales-transmission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'process-outbox', limit: 10 }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message || data.error || 'Worker failed');
      return;
    }
    setWorkerResult(data);
    await load();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-sm text-slate-600">
        <Link href="/settings/integrations/mra-eis">← MRA EIS settings</Link>
        {' · '}
        <Link href="/settings/integrations/mra-eis/fiscal-snapshots">{tt('Fiscal snapshots')}</Link>
        {' · '}
        <Link href="/settings/integrations/mra-eis/fiscal-receipts">{tt('Fiscal receipts')}</Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">{tt('Sales transmission')}</h1>
      <p className="mt-2 max-w-2xl text-slate-700">
        Phase 13 maps immutable fiscal snapshots to the MRA Sales request and submits securely (mock /
        provisional). HTTP 200 alone is not acceptance. No QR image and no final fiscal receipt are
        generated here.
      </p>

      {contract && (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          Contract decision: {contract.decision}. Live sandbox/production transmission:{' '}
          {contract.liveSandboxTransmission}/{contract.productionTransmission}.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={load} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
          {tt('Refresh')}
        </button>
        <button
          type="button"
          onClick={processOutbox}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {tt('Process sales outbox')}
        </button>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="mt-4 text-sm text-slate-600">{tt('Loading…')}</p>}

      {workerResult && (
        <pre className="mt-4 overflow-auto rounded border bg-slate-50 p-3 text-xs">
          {JSON.stringify(workerResult, null, 2)}
        </pre>
      )}

      <section className="mt-8" aria-labelledby="tx-heading">
        <h2 id="tx-heading" className="text-lg font-medium">
          {tt('Recent transmissions')}
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-600">
                <th className="py-2 pr-3">{tt('Status')}</th>
                <th className="py-2 pr-3">{tt('Environment')}</th>
                <th className="py-2 pr-3">{tt('App status')}</th>
                <th className="py-2 pr-3">{tt('Attempts')}</th>
                <th className="py-2">{tt('Action')}</th>
              </tr>
            </thead>
            <tbody>
              {transmissions.map((t) => (
                <tr key={t.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <span aria-label={`Status ${t.status}`}>{t.status}</span>
                  </td>
                  <td className="py-2 pr-3">{t.environment}</td>
                  <td className="py-2 pr-3">{t.mraApplicationStatus || '—'}</td>
                  <td className="py-2 pr-3">{t.attemptCount}</td>
                  <td className="py-2">
                    <button type="button" className="text-blue-700 underline" onClick={() => openTransmission(t.id)}>
                      {tt('Open')}
                    </button>
                  </td>
                </tr>
              ))}
              {!transmissions.length && !loading && (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">
                    {tt('No transmissions yet. Process Phase 12 sales-payload outbox events.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected?.transmission && (
        <section className="mt-8 rounded border border-slate-200 p-4" aria-labelledby="detail-heading">
          <h2 id="detail-heading" className="text-lg font-medium">
            {tt('Transmission detail')}
          </h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{tt('Status')}</dt>
              <dd>{selected.transmission.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('MRA application status')}</dt>
              <dd>{selected.transmission.mraApplicationStatus || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Validation URL')}</dt>
              <dd className="break-all text-xs">{selected.transmission.validationUrl || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Config refresh / Terminal block')}</dt>
              <dd>
                {selected.transmission.shouldRefreshConfiguration ? tt('Refresh required') : tt('No refresh')}
                {' · '}
                {selected.transmission.shouldBlockTerminal ? tt('Terminal blocked') : tt('Terminal OK')}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-sm" role="status">
            {selected.transmission.status === 'ACCEPTED_ONLINE'
              ? 'Accepted by MRA. Fiscal receipt generation is pending (Phase 14).'
              : selected.transmission.status === 'UNKNOWN_OUTCOME'
                ? 'Submission result is currently unknown and requires reconciliation (Phase 15).'
                : selected.transmission.status === 'REJECTED'
                  ? 'Rejected by MRA. Snapshot and fiscal number retained.'
                  : `Status: ${selected.transmission.status}`}
          </p>
          {selected.attempts?.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium">{tt('Attempts')}</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {selected.attempts.map((a) => (
                  <li key={a.id}>
                    #{a.attemptNumber} · {a.outcome} · HTTP {a.httpStatus ?? '—'} · checksum{' '}
                    <span className="font-mono text-xs">{a.requestChecksum?.slice(0, 12)}…</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {selected.response && (
            <div className="mt-4">
              <h3 className="font-medium">{tt('Response evidence')}</h3>
              <p className="mt-1 text-sm text-slate-700">
                Category: {selected.response.responseCategory} · checksum{' '}
                <span className="break-all font-mono text-xs">{selected.response.sourceChecksum}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">{tt('QR data is not rendered in Phase 13.')}</p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
