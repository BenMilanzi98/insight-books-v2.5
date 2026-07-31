'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Phase 15 — Reconciliation & safe retry workspace.
 * Default: reconcile first — do not retry unknown outcomes.
 */
export default function MraEisReconciliationPage() {
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [contract, setContract] = useState(null);
  const [workerResult, setWorkerResult] = useState(null);
  const [sequence, setSequence] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transmissionId, setTransmissionId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mra-eis/reconciliation');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setCases(data.cases || []);
      setContract(data.lastTransactionContract || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openCase(id) {
    setError(null);
    const res = await fetch(`/api/mra-eis/reconciliation?id=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to load case');
      return;
    }
    setSelected(data);
  }

  async function processOutbox() {
    setError(null);
    const res = await fetch('/api/mra-eis/reconciliation', {
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

  async function processRetries() {
    setError(null);
    const res = await fetch('/api/mra-eis/reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'process-retries', limit: 10 }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message || data.error || 'Retry scheduler failed');
      return;
    }
    setWorkerResult(data);
    await load();
  }

  async function reconcileTransmission() {
    setError(null);
    if (!transmissionId.trim()) {
      setError('Enter a transmission ID');
      return;
    }
    const res = await fetch('/api/mra-eis/reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reconcile', transmissionId: transmissionId.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message || data.error || 'Reconcile failed');
      return;
    }
    await load();
    if (data.case?.id) await openCase(data.case.id);
  }

  async function recoverReceipts() {
    setError(null);
    const res = await fetch('/api/mra-eis/reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'recover-receipts' }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message || data.error || 'Recovery failed');
      return;
    }
    setWorkerResult(data);
  }

  async function runSequence() {
    setError(null);
    const res = await fetch('/api/mra-eis/reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sequence-reconcile' }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message || data.error || 'Sequence reconcile failed');
      return;
    }
    setSequence(data);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-sm text-slate-600">
        <Link href="/settings/integrations/mra-eis">← MRA EIS settings</Link>
        {' · '}
        <Link href="/settings/integrations/mra-eis/sales-transmission">Sales transmission</Link>
        {' · '}
        <Link href="/settings/integrations/mra-eis/fiscal-receipts">Fiscal receipts</Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Reconciliation &amp; recovery</h1>
      <p className="mt-2 max-w-2xl text-slate-700" role="status">
        Phase 15 resolves uncertain MRA outcomes with evidence. Default rule:{' '}
        <strong>reconcile first — do not retry</strong> unknown outcomes. Absence from a Last Online
        “latest” response is not conclusive. Safe retries reuse the same fiscal snapshot and number.
        Production Last Online/Offline queries remain blocked.
      </p>

      {contract && (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Last Online mock={contract.lastOnlineMock}; live sandbox={contract.lastOnlineLiveSandbox};
          production={contract.lastOnlineProduction}; offline={contract.lastOffline}.
          absenceIsConclusive={String(contract.absenceIsConclusive)}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={processOutbox} className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
          Process recon outbox
        </button>
        <button type="button" onClick={processRetries} className="rounded bg-indigo-800 px-4 py-2 text-sm text-white">
          Process authorized retries
        </button>
        <button type="button" onClick={recoverReceipts} className="rounded border px-4 py-2 text-sm">
          Recover missing receipts
        </button>
        <button type="button" onClick={runSequence} className="rounded border px-4 py-2 text-sm">
          Sequence reconcile
        </button>
        <button type="button" onClick={load} className="rounded border px-4 py-2 text-sm">
          Refresh
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="block text-sm">
          Transmission ID
          <input
            className="mt-1 block w-80 rounded border border-slate-300 px-2 py-1"
            value={transmissionId}
            onChange={(e) => setTransmissionId(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={reconcileTransmission}
          className="rounded bg-emerald-700 px-4 py-2 text-sm text-white"
        >
          Reconcile
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {typeof error === 'string' ? error : JSON.stringify(error)}
        </p>
      )}

      {workerResult && (
        <pre className="mt-4 overflow-auto rounded bg-slate-100 p-3 text-xs">
          {JSON.stringify(workerResult, null, 2)}
        </pre>
      )}

      {sequence && (
        <section className="mt-4 rounded border p-3 text-sm" aria-label="Sequence reconciliation">
          <h2 className="font-semibold">Sequence reconciliation</h2>
          <p>Classification: {sequence.classification}</p>
          <p>Never moves backwards: {String(sequence.neverMovesBackwards)}</p>
          <p>Explained gaps: {(sequence.explainedGaps || []).length}</p>
          <p>Unexplained gaps: {(sequence.unexplainedGaps || []).length}</p>
        </section>
      )}

      {loading ? (
        <p className="mt-6 text-slate-600">Loading…</p>
      ) : (
        <ul className="mt-6 divide-y rounded border border-slate-200">
          {cases.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start gap-1 px-3 py-3 text-left hover:bg-slate-50"
                onClick={() => openCase(c.id)}
              >
                <span className="font-medium">{c.fiscalNumber || c.transmissionId}</span>
                <span className="text-sm text-slate-600">
                  {c.state} · {c.matchOutcome || '—'} · {c.dispatchCertainty || '—'}
                </span>
              </button>
            </li>
          ))}
          {!cases.length && (
            <li className="px-3 py-4 text-sm text-slate-600">
              No reconciliation cases yet. Unknown-outcome transmissions emit Phase 15 outbox events
              after Sales transmission.
            </li>
          )}
        </ul>
      )}

      {selected?.case && (
        <section className="mt-8 rounded border border-slate-200 p-4" aria-label="Case detail">
          <h2 className="text-lg font-semibold">Case detail</h2>
          <p className="mt-2 text-sm">
            State: <strong>{selected.case.state}</strong>
          </p>
          <p className="text-sm">Outcome: {selected.case.matchOutcome || '—'}</p>
          <p className="text-sm">Confidence: {selected.case.matchConfidence || '—'}</p>
          <p className="text-sm">Dispatch certainty: {selected.case.dispatchCertainty || '—'}</p>
          <p className="text-sm">{selected.case.safeStatusSummary}</p>

          <h3 className="mt-4 text-sm font-semibold">Retry authorizations</h3>
          <ul className="mt-2 text-sm">
            {(selected.retryAuthorizations || []).map((a) => (
              <li key={a.id}>
                #{a.proposedAttemptNumber} · {a.authorizationState} · earliest{' '}
                {a.earliestRetryAt ? new Date(a.earliestRetryAt).toLocaleString() : '—'} · fiscal{' '}
                {a.sameFiscalNumber}
              </li>
            ))}
            {!selected.retryAuthorizations?.length && <li>None (unknown outcomes cannot auto-retry)</li>}
          </ul>

          <h3 className="mt-4 text-sm font-semibold">MRA query attempts</h3>
          <ul className="mt-2 text-sm">
            {(selected.queryAttempts || []).map((q) => (
              <li key={q.id}>
                #{q.queryAttemptNumber} · {q.state} · HTTP {q.httpStatus ?? '—'} · {q.outcome || '—'}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
