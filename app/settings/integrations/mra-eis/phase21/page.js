'use client';
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Phase 21 — Certification / Pilot / Rollout control surface.
 * Does not offer Enable All Tenants, Set Active, or credential entry fields.
 */
export default function MraEisPhase21Page() {
  const [meta, setMeta] = useState(null);
  const [gate, setGate] = useState(null);
  const [programme, setProgramme] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/mra-eis/phase21')
      .then((r) => r.json())
      .then(setMeta)
      .catch((e) => setError(e.message));
  }, []);

  async function post(action, extra = {}) {
    setError(null);
    const res = await fetch('/api/mra-eis/phase21', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message || data.error || 'Failed');
      return null;
    }
    return data;
  }

  async function revalidateGate() {
    const data = await post('revalidate-release-gate', {
      releaseId: 'ui-rc',
      commit: 'local',
    });
    if (data) setGate(data.result);
  }

  async function programmeStatus() {
    const data = await post('programme-status', {
      statusInput: {
        releaseGateOk: true,
        sandboxValidated: false,
        certificationApproved: false,
      },
    });
    if (data) setProgramme(data.status);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-slate-600">
          <Link href="/settings/integrations/mra-eis/centre" className="underline">
            {tt('EIS Admin Centre')}
          </Link>{' '}
          / Phase 21 Rollout
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">{tt('MRA EIS Certification & Rollout')}</h1>
        <p className="text-sm text-slate-700">
          Controlled certification, pilot, cohort rollout and Hypercare. Sandbox success is not Production
          certification. Tenants and Businesses are never enabled automatically.
        </p>
      </header>

      {error && (
        <div role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      )}

      {meta?.invariants && (
        <section className="border border-slate-200 p-4" aria-labelledby="inv-h">
          <h2 id="inv-h" className="font-medium mb-2">
            {tt('Programme invariants')}
          </h2>
          <ul className="text-sm grid gap-1 sm:grid-cols-2">
            {Object.entries(meta.invariants).map(([k, v]) => (
              <li key={k}>
                <span className="font-mono text-xs text-slate-500">{k}</span>: {String(v)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border border-slate-200 p-4 space-y-3">
        <h2 className="font-medium">{tt('Controls')}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="border border-slate-800 bg-slate-900 text-white px-3 py-1.5 text-sm"
            onClick={revalidateGate}
          >
            {tt('Revalidate Phase 20 Release Gate')}
          </button>
          <button
            type="button"
            className="border border-slate-400 px-3 py-1.5 text-sm"
            onClick={programmeStatus}
          >
            {tt('Evaluate programme status')}
          </button>
        </div>
        <p className="text-xs text-slate-600">
          There is no “Enable all Tenants” or “Self-declare certified” action. Production credential
          provisioning requires four-eyes approval via Secret Provider references only.
        </p>
      </section>

      {gate && (
        <section className="border border-slate-200 p-4" aria-live="polite">
          <h2 className="font-medium mb-2">{tt('Release Gate')}</h2>
          <pre className="text-xs overflow-x-auto whitespace-pre-wrap bg-slate-50 p-3">
            {JSON.stringify(
              {
                phase20Decision: gate.phase20Decision,
                gateDecision: gate.gate?.decision,
                proceedToProductionProvisioning: gate.proceedToProductionProvisioning,
              },
              null,
              2
            )}
          </pre>
        </section>
      )}

      {programme && (
        <section className="border border-slate-200 p-4" aria-live="polite">
          <h2 className="font-medium mb-2">{tt('Programme status')}</h2>
          <pre className="text-xs overflow-x-auto whitespace-pre-wrap bg-slate-50 p-3">
            {JSON.stringify(programme, null, 2)}
          </pre>
        </section>
      )}

      {meta?.cohorts && (
        <section className="border border-slate-200 p-4">
          <h2 className="font-medium mb-2">{tt('Rollout cohorts')}</h2>
          <ul className="text-sm space-y-1">
            {meta.cohorts.map((c) => (
              <li key={c.id} className="font-mono text-xs border border-slate-200 px-2 py-1">
                {c.id}: {c.label}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
