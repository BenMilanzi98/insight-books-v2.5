'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Phase 16 — Certified Offline administration (fail-closed).
 * No cashier force-offline toggle. Production remains blocked without certification.
 */
export default function MraEisOfflinePage() {
  const [contracts, setContracts] = useState(null);
  const [agents, setAgents] = useState([]);
  const [capability, setCapability] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [terminalId, setTerminalId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mra-eis/offline');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setContracts(data.contracts || null);
      setAgents(data.agents || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function evaluateCapability() {
    setError(null);
    const res = await fetch('/api/mra-eis/offline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'evaluate-capability',
        terminalId: terminalId || null,
        mode: 'MOCK',
        environment: 'SANDBOX',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message || data.error || 'Capability evaluation failed');
      return;
    }
    setCapability(data);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <p className="text-sm text-slate-600">
          <Link href="/settings/integrations/mra-eis" className="underline">
            {tt('MRA EIS')}
          </Link>
          {' / '}
          Certified Offline
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">{tt('Certified Offline EIS')}</h1>
        <p className="text-sm text-slate-700" role="status">
          Offline mode is disabled by default. Network loss alone does not enable offline
          fiscalization. Browser-only signing and localStorage queues are not authoritative.
        </p>
      </header>

      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">
          {typeof error === 'string' ? error : JSON.stringify(error)}
        </div>
      ) : null}

      {loading ? <p>{tt('Loading…')}</p> : null}

      <section className="space-y-2" aria-labelledby="contracts-heading">
        <h2 id="contracts-heading" className="text-lg font-medium">
          {tt('Contract decisions')}
        </h2>
        {contracts ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {Object.entries(contracts).map(([k, v]) => (
              <div key={k} className="rounded border border-slate-200 p-2">
                <dt className="font-medium text-slate-800">{k}</dt>
                <dd className="break-words text-slate-700">{String(v)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      <section className="space-y-3" aria-labelledby="capability-heading">
        <h2 id="capability-heading" className="text-lg font-medium">
          {tt('Capability evaluation')}
        </h2>
        <label className="block text-sm">
          Terminal ID (optional)
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            value={terminalId}
            onChange={(e) => setTerminalId(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={evaluateCapability}
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          {tt('Evaluate offline capability')}
        </button>
        {capability ? (
          <div className="rounded border border-slate-200 p-3 text-sm">
            <p>
              <strong>{tt('Entry allowed:')}</strong>{' '}
              <span>{capability.offlineEntryAllowed ? 'Yes (mock path)' : 'No'}</span>
            </p>
            <p>
              <strong>{tt('Certification:')}</strong> {capability.certificationStatus}
            </p>
            {capability.blockers?.length ? (
              <ul className="mt-2 list-disc pl-5">
                {capability.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-slate-600">{tt('No blockers for current mock evaluation.')}</p>
            )}
            <p className="mt-2 text-slate-600">
              {tt('Production offline remains blocked until CERTIFIED_PRODUCTION and verified contracts.')}
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-2" aria-labelledby="agents-heading">
        <h2 id="agents-heading" className="text-lg font-medium">
          {tt('Trusted agents')}
        </h2>
        {agents.length === 0 ? (
          <p className="text-sm text-slate-600">{tt('No agents registered.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th scope="col">{tt('Agent')}</th>
                  <th scope="col">{tt('Terminal')}</th>
                  <th scope="col">{tt('Lifecycle')}</th>
                  <th scope="col">{tt('Trust')}</th>
                  <th scope="col">{tt('Environment')}</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id} className="border-t border-slate-200">
                    <td className="break-all py-2 pr-2">{a.id}</td>
                    <td className="break-all py-2 pr-2">{a.terminalId}</td>
                    <td className="py-2 pr-2">{a.lifecycleState}</td>
                    <td className="py-2 pr-2">{a.trustState}</td>
                    <td className="py-2 pr-2">{a.environment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2 text-sm text-slate-700" aria-labelledby="truth-heading">
        <h2 id="truth-heading" className="text-lg font-medium text-slate-900">
          {tt('Truthful statuses')}
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>{tt('Online — Connected to MRA EIS when online transmission is available.')}</li>
          <li>Offline candidate — Connectivity unstable; verifying offline eligibility.</li>
          <li>Offline active — Certified offline mode is active (agent-gated).</li>
          <li>Upload pending — Created offline; awaiting MRA upload (not yet accepted).</li>
          <li>{tt('Unknown upload — Will not be resent until Phase 15 reconciliation completes.')}</li>
        </ul>
      </section>
    </main>
  );
}
