'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Phase 11 — Sales EIS bridge status workspace.
 * Does not claim MRA acceptance, show fiscal numbers, or QR codes.
 */
export default function MraEisSalesBridgePage() {
  const [bridges, setBridges] = useState([]);
  const [preflight, setPreflight] = useState(null);
  const [reconcile, setReconcile] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mra-eis/sales-bridge');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load bridges');
      setBridges(data.bridges || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runReconcileDryRun() {
    setError(null);
    const res = await fetch('/api/mra-eis/sales-bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reconcile', dryRun: true, limit: 25 }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message || data.error || 'Reconcile failed');
      return;
    }
    setReconcile(data);
  }

  async function runSamplePreflight() {
    setError(null);
    const res = await fetch('/api/mra-eis/sales-eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceType: 'POS_SALE',
        sourceState: 'COMPLETED',
        lines: [{ productId: 'sample', quantity: 1, unitPrice: 1000, description: 'Sample' }],
        payments: [{ localPaymentMethodId: 'Cash', amount: 1000 }],
        header: { subtotal: 1000, taxAmount: 0, total: 1000, paymentMethod: 'Cash' },
        buyer: { customerName: 'Walk-in Customer' },
      }),
    });
    const data = await res.json();
    setPreflight(data);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-sm text-slate-600">
        <Link href="/settings/integrations/mra-eis">← MRA EIS settings</Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">{tt('Sales eligibility & bridge')}</h1>
      <p className="mt-2 max-w-2xl text-slate-700">
        Phase 11 local compliance handoff. Eligible sales create a bridge and outbox event for Phase 12
        fiscal snapshots. No MRA submission, fiscal number, or QR code is produced here.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={load}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {tt('Refresh bridges')}
        </button>
        <button
          type="button"
          onClick={runSamplePreflight}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {tt('Run sample preflight')}
        </button>
        <button
          type="button"
          onClick={runReconcileDryRun}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {tt('Missed-bridge dry run')}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && <p className="mt-4 text-sm text-slate-600">{tt('Loading…')}</p>}

      <section className="mt-8" aria-labelledby="bridges-heading">
        <h2 id="bridges-heading" className="text-lg font-medium">
          {tt('Recent bridges')}
        </h2>
        {!bridges.length && !loading && (
          <p className="mt-2 text-sm text-slate-600">{tt('No bridge records yet.')}</p>
        )}
        <ul className="mt-3 space-y-2">
          {bridges.map((b) => (
            <li key={b.id} className="border-b border-slate-200 py-2 text-sm">
              <span className="font-medium">{b.sourceType}</span> · {b.sourceTransactionNumber || b.sourceId}
              <br />
              {tt('Status:')} <span aria-label={`Bridge status ${b.status}`}>{b.status}</span>
              {' · '}
              Env: {b.environment}
              <br />
              <span className="text-slate-600">
                {tt('Not submitted to MRA · No fiscal number · No QR')}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {preflight && (
        <section className="mt-8" aria-labelledby="preflight-heading">
          <h2 id="preflight-heading" className="text-lg font-medium">
            {tt('Preflight result')}
          </h2>
          <p className="mt-2 text-sm">{preflight.eligibility?.safeDecisionSummary || preflight.eisStatus}</p>
          <p className="text-sm text-slate-600">{preflight.notice}</p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {(preflight.eligibility?.blockerCodes || []).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      {reconcile && (
        <section className="mt-8" aria-labelledby="reconcile-heading">
          <h2 id="reconcile-heading" className="text-lg font-medium">
            {tt('Reconciliation dry run')}
          </h2>
          <p className="mt-2 text-sm">
            Missing bridges: {reconcile.summary?.missingBridges ?? 0} · Already bridged:{' '}
            {reconcile.summary?.alreadyBridged ?? 0} · Before go-live:{' '}
            {reconcile.summary?.beforeGoLive ?? 0}
          </p>
          <p className="text-sm text-slate-600">
            {tt('Repair never reposts accounting or inventory. Historical pre-go-live sales are excluded.')}
          </p>
        </section>
      )}
    </main>
  );
}
