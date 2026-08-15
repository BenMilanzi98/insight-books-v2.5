'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Phase 12 — Fiscal snapshot & sequence workspace.
 * Read-only evidence view. Does not claim MRA acceptance or generate QR codes.
 */
export default function MraEisFiscalSnapshotsPage() {
  const [snapshots, setSnapshots] = useState([]);
  const [sequences, setSequences] = useState([]);
  const [selected, setSelected] = useState(null);
  const [integrity, setIntegrity] = useState(null);
  const [workerResult, setWorkerResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [snapRes, seqRes] = await Promise.all([
        fetch('/api/mra-eis/fiscal-snapshots'),
        fetch('/api/mra-eis/fiscal-sequences'),
      ]);
      const snapData = await snapRes.json();
      const seqData = await seqRes.json();
      if (!snapRes.ok) throw new Error(snapData.error || 'Failed to load snapshots');
      if (!seqRes.ok) throw new Error(seqData.error || 'Failed to load sequences');
      setSnapshots(snapData.snapshots || []);
      setSequences(seqData.sequences || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openSnapshot(id) {
    setError(null);
    setIntegrity(null);
    const res = await fetch(`/api/mra-eis/fiscal-snapshots?id=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to load snapshot');
      return;
    }
    setSelected(data.snapshot);
  }

  async function verifyIntegrity() {
    if (!selected?.id) return;
    const res = await fetch('/api/mra-eis/fiscal-snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify-integrity', snapshotId: selected.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message || data.error || 'Integrity check failed');
      return;
    }
    setIntegrity(data.integrity);
  }

  async function processOutbox() {
    setError(null);
    const res = await fetch('/api/mra-eis/fiscal-snapshots', {
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
        <Link href="/settings/integrations/mra-eis/sales-bridge">{tt('Sales bridge')}</Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Fiscal snapshots &amp; sequences</h1>
      <p className="mt-2 max-w-2xl text-slate-700">
        Phase 12 immutable local fiscal evidence. Completed snapshots cannot be edited. Fiscal numbers
        (sandbox synthetic only until MRA contract verified) are allocated server-side. No MRA Sales
        submission and no QR code are produced here.
      </p>
      <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
        {tt('Fiscal snapshot created locally. Not yet submitted to MRA.')}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={load}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {tt('Refresh')}
        </button>
        <button
          type="button"
          onClick={processOutbox}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {tt('Process snapshot outbox')}
        </button>
        {selected && (
          <button
            type="button"
            onClick={verifyIntegrity}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {tt('Verify integrity')}
          </button>
        )}
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

      <section className="mt-8" aria-labelledby="snapshots-heading">
        <h2 id="snapshots-heading" className="text-lg font-medium text-slate-900">
          {tt('Recent snapshots')}
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-600">
                <th className="py-2 pr-3">{tt('Status')}</th>
                <th className="py-2 pr-3">{tt('Source')}</th>
                <th className="py-2 pr-3">{tt('Checksum')}</th>
                <th className="py-2 pr-3">{tt('Created')}</th>
                <th className="py-2">{tt('Action')}</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <span aria-label={`Status ${s.status}`}>{s.status}</span>
                  </td>
                  <td className="py-2 pr-3">
                    {s.sourceType} · {s.localDocumentNumber || s.sourceId}
                  </td>
                  <td className="max-w-[10rem] truncate py-2 pr-3 font-mono text-xs" title={s.snapshotChecksum}>
                    {s.snapshotChecksum}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      className="text-blue-700 underline"
                      onClick={() => openSnapshot(s.id)}
                    >
                      {tt('Open')}
                    </button>
                  </td>
                </tr>
              ))}
              {!snapshots.length && !loading && (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">
                    {tt('No fiscal snapshots yet. Process Phase 11 READY bridges via outbox.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <section className="mt-8 rounded border border-slate-200 p-4" aria-labelledby="detail-heading">
          <h2 id="detail-heading" className="text-lg font-medium">
            {tt('Snapshot detail')}
          </h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{tt('Status')}</dt>
              <dd>{selected.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Environment')}</dt>
              <dd>{selected.environment}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Gross')}</dt>
              <dd>{String(selected.invoiceTotal)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Tax')}</dt>
              <dd>{String(selected.taxTotal)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">{tt('Checksum')}</dt>
              <dd className="break-all font-mono text-xs">{selected.snapshotChecksum}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">{tt('Buyer')}</dt>
              <dd>
                {selected.buyerName || 'Anonymous / B2C'}
                {selected.buyerTin ? ` · TIN ${selected.buyerTin}` : ''}
              </dd>
            </div>
          </dl>
          {integrity && (
            <p className="mt-3 text-sm" role="status">
              {tt('Integrity:')} <strong>{integrity.status}</strong>
              {integrity.checksum ? ` · ${integrity.checksum}` : ''}
            </p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Lines: {selected.lines?.length ?? 0} · Payments: {selected.payments?.length ?? 0} ·
            Completed snapshots are immutable.
          </p>
        </section>
      )}

      <section className="mt-8" aria-labelledby="sequences-heading">
        <h2 id="sequences-heading" className="text-lg font-medium text-slate-900">
          {tt('Fiscal sequences')}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {tt('Direct editing of nextValue is prohibited. Gaps are preserved. Offline allocation remains disabled.')}
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {sequences.map((seq) => (
            <li key={seq.id} className="rounded border border-slate-200 px-3 py-2">
              <div className="font-medium">{seq.scopeKey}</div>
              <div className="text-slate-600">
                {seq.environment} · {seq.status} · next={seq.nextValue} · lastReserved=
                {seq.lastReservedValue ?? '—'} · lastAssigned={seq.lastAssignedValue ?? '—'}
              </div>
            </li>
          ))}
          {!sequences.length && !loading && (
            <li className="text-slate-500">{tt('No sequence scopes initialized yet.')}</li>
          )}
        </ul>
      </section>
    </main>
  );
}
