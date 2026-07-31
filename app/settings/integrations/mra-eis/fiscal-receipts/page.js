'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Phase 14 — Fiscal receipts workspace.
 * QR and receipts come only from accepted MRA evidence.
 */
export default function MraEisFiscalReceiptsPage() {
  const [receipts, setReceipts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [contract, setContract] = useState(null);
  const [qrContract, setQrContract] = useState(null);
  const [workerResult, setWorkerResult] = useState(null);
  const [integrity, setIntegrity] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transmissionId, setTransmissionId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mra-eis/fiscal-receipts');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load receipts');
      setReceipts(data.receipts || []);
      setContract(data.contractDecision || null);
      setQrContract(data.qrContractDecision || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openReceipt(id) {
    setError(null);
    setIntegrity(null);
    const res = await fetch(`/api/mra-eis/fiscal-receipts?id=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to load receipt');
      return;
    }
    setSelected(data);
  }

  async function processOutbox() {
    setError(null);
    const res = await fetch('/api/mra-eis/fiscal-receipts', {
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

  async function generateFromTransmission() {
    setError(null);
    if (!transmissionId.trim()) {
      setError('Enter an accepted transmission ID');
      return;
    }
    const res = await fetch('/api/mra-eis/fiscal-receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate', transmissionId: transmissionId.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message || data.error || 'Generation failed');
      return;
    }
    await load();
    if (data.receipt?.id) await openReceipt(data.receipt.id);
  }

  async function verifySelected() {
    if (!selected?.receipt?.id) return;
    const res = await fetch('/api/mra-eis/fiscal-receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', fiscalReceiptId: selected.receipt.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message || data.error || 'Verify failed');
      return;
    }
    setIntegrity(data.integrity);
  }

  async function reprintSelected() {
    if (!selected?.receipt?.id) return;
    const res = await fetch('/api/mra-eis/fiscal-receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reprint',
        fiscalReceiptId: selected.receipt.id,
        reasonCode: 'CUSTOMER_REQUEST',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message || data.error || 'Reprint failed');
      return;
    }
    await openReceipt(selected.receipt.id);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-sm text-slate-600">
        <Link href="/settings/integrations/mra-eis">← MRA EIS settings</Link>
        {' · '}
        <Link href="/settings/integrations/mra-eis/sales-transmission">Sales transmission</Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Fiscal receipts</h1>
      <p className="mt-2 max-w-2xl text-slate-700">
        Phase 14 creates immutable fiscal receipts and validation QR codes only after conclusive MRA
        acceptance. HTTP 200 alone is not acceptance. Sandbox receipts are clearly marked TEST.
        Production receipt generation remains blocked until QR/receipt contracts are verified.
      </p>

      {contract && (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          Receipt contract: mock={contract.mockGeneration}; production={contract.productionGeneration};
          58mm={contract.pos58mm}
        </p>
      )}
      {qrContract && (
        <p className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800" role="status">
          QR contract: mock={qrContract.mock}; production={qrContract.production}. Invented payloads
          forbidden.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={processOutbox}
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
        >
          Process accepted-receipt outbox
        </button>
        <button
          type="button"
          onClick={load}
          className="rounded border border-slate-300 px-4 py-2 text-sm"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="block text-sm">
          Accepted transmission ID
          <input
            className="mt-1 block w-80 rounded border border-slate-300 px-2 py-1"
            value={transmissionId}
            onChange={(e) => setTransmissionId(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={generateFromTransmission}
          className="rounded bg-emerald-700 px-4 py-2 text-sm text-white"
        >
          Generate receipt
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

      {loading ? (
        <p className="mt-6 text-slate-600">Loading…</p>
      ) : (
        <ul className="mt-6 divide-y rounded border border-slate-200">
          {receipts.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start gap-1 px-3 py-3 text-left hover:bg-slate-50"
                onClick={() => openReceipt(r.id)}
              >
                <span className="font-medium">{r.fiscalNumber}</span>
                <span className="text-sm text-slate-600">
                  {r.state} · MRA {r.mraTransactionId} · {r.environment}
                </span>
              </button>
            </li>
          ))}
          {!receipts.length && (
            <li className="px-3 py-4 text-sm text-slate-600">
              No fiscal receipts yet. Accept a mock Sale (Phase 13), then process the Phase 14 outbox.
            </li>
          )}
        </ul>
      )}

      {selected?.receipt && (
        <section className="mt-8 rounded border border-slate-200 p-4" aria-label="Receipt detail">
          <h2 className="text-lg font-semibold">Receipt detail</h2>
          <p className="mt-2 text-sm">
            Status: <strong>{selected.receipt.state}</strong>
          </p>
          <p className="text-sm">Fiscal number: {selected.receipt.fiscalNumber}</p>
          <p className="text-sm">MRA transaction: {selected.receipt.mraTransactionId}</p>
          <p className="text-sm break-all">
            Validation URL:{' '}
            {selected.receipt.validationUrl ? (
              <a
                href={selected.receipt.validationUrl}
                rel="noopener noreferrer"
                target="_blank"
                className="text-blue-700 underline"
              >
                {selected.receipt.validationUrl}
              </a>
            ) : (
              '—'
            )}
          </p>
          <p className="mt-2 text-sm text-slate-700" role="status">
            {selected.receiptData?.mraValidation?.acceptedWording || 'Accepted by MRA'}
            {selected.receiptData?.sandbox ? ' — SANDBOX / TEST' : ''}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded border px-3 py-1 text-sm" onClick={verifySelected}>
              Verify integrity
            </button>
            <button type="button" className="rounded border px-3 py-1 text-sm" onClick={reprintSelected}>
              Request reprint
            </button>
            {(selected.artifacts || []).map((a) => (
              <a
                key={a.id}
                className="rounded bg-slate-900 px-3 py-1 text-sm text-white"
                href={`/api/mra-eis/fiscal-receipts?downloadArtifactId=${encodeURIComponent(a.id)}`}
              >
                Download {a.artifactType}
                {a.originalOrReprint === 'REPRINT' ? ` #${a.reprintSequence}` : ''}
              </a>
            ))}
          </div>

          {integrity && (
            <pre className="mt-4 overflow-auto rounded bg-slate-100 p-3 text-xs">
              {JSON.stringify(integrity, null, 2)}
            </pre>
          )}

          <h3 className="mt-6 text-sm font-semibold">QR evidence</h3>
          <ul className="mt-2 text-sm text-slate-700">
            {(selected.qrEvidence || []).map((q) => (
              <li key={q.id}>
                {q.sourceType} via {q.sourceField} · decodeVerified={String(q.decodeVerified)} ·
                checksum {q.exactSourceChecksum?.slice(0, 12)}…
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
