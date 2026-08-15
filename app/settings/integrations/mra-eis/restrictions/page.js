'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Phase 17 — Restriction / Unblock compliance control UI.
 * Does not offer a “Set Active” control. Multiple restrictions coexist.
 */
export default function MraEisRestrictionsPage() {
  const [contracts, setContracts] = useState(null);
  const [restrictions, setRestrictions] = useState([]);
  const [projection, setProjection] = useState(null);
  const [capability, setCapability] = useState(null);
  const [unblock, setUnblock] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [terminalId, setTerminalId] = useState('TERM-P17-DEMO');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = terminalId ? `?terminalId=${encodeURIComponent(terminalId)}&environment=SANDBOX` : '';
      const res = await fetch(`/api/mra-eis/restrictions${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to load');
      setContracts(data.contracts || null);
      setRestrictions(data.restrictions || []);
      setProjection(data.projection || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [terminalId]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(action, extra = {}) {
    setError(null);
    const res = await fetch('/api/mra-eis/restrictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, terminalId, environment: 'SANDBOX', ...extra }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message || data.error || 'Action failed');
      return null;
    }
    return data;
  }

  async function ingestMraBlock() {
    await post('ingest', {
      reasonCode: 'MRA_TERMINAL_BLOCKED',
      sourceType: 'MRA_SALES_RESPONSE',
      sourceReference: `sales-block-${Date.now()}`,
      scopeType: 'TERMINAL',
      scopeId: terminalId,
      evidenceSafe: { mraRemark: 'Terminal blocked (synthetic)' },
    });
    await load();
  }

  async function evaluateCapability() {
    const data = await post('evaluate-capability', { requestedOperation: 'FINALIZE_EIS_SALE' });
    if (data) setCapability(data);
  }

  async function runUnblockHappyPath() {
    const created = await post('create-unblock-request', {
      reason: 'Remediation complete',
      mraSupportReference: 'MRA-SUP-DEMO-001',
      supportingEvidence: { remediation: 'credentials rotated (reference only)' },
    });
    if (!created?.request) return;
    let request = created.request;
    request = await post('submit-unblock-evidence', {
      requestId: request.id,
      evidence: { mraSupportReference: 'MRA-SUP-DEMO-001', remediationComplete: true },
    });
    if (!request) return;
    request = await post('approve-unblock-request', {
      requestId: request.id,
      requesterId: 'other-user',
    });
    if (!request) return;
    const status = await post('query-unblock-status', {
      requestId: request.id,
      mockScenario: 'TERMINAL_CLEARED',
    });
    if (!status) return;
    const final = await post('apply-clearance-revalidate', { requestId: request.id });
    setUnblock({ status, final });
    await load();
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <p className="text-sm text-slate-600">
          <Link href="/settings/integrations/mra-eis" className="underline">
            {tt('MRA EIS')}
          </Link>
          {' / '}
          Restrictions
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">{tt('EIS Compliance Restrictions')}</h1>
        <p className="text-sm text-slate-700" role="status">
          {tt('Restrictions are source-aware and evidence-driven. Existing accepted receipts remain available. There is no “Set Terminal Active” shortcut.')}
        </p>
      </header>

      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">
          {typeof error === 'string' ? error : JSON.stringify(error)}
        </div>
      ) : null}

      <section className="space-y-3" aria-labelledby="terminal-controls">
        <h2 id="terminal-controls" className="text-lg font-medium">
          {tt('Terminal scope')}
        </h2>
        <label className="block text-sm">
          {tt('Terminal ID')}
          <input
            className="mt-1 w-full max-w-md rounded border border-slate-300 px-3 py-2"
            value={terminalId}
            onChange={(e) => setTerminalId(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
            onClick={load}
            disabled={loading}
          >
            {tt('Refresh')}
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            onClick={ingestMraBlock}
          >
            {tt('Simulate MRA block')}
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            onClick={evaluateCapability}
          >
            {tt('Evaluate finalize capability')}
          </button>
          <button
            type="button"
            className="rounded border border-amber-600 px-3 py-2 text-sm text-amber-900"
            onClick={runUnblockHappyPath}
          >
            {tt('Mock unblock + revalidate')}
          </button>
        </div>
      </section>

      {contracts ? (
        <section aria-labelledby="contracts-heading" className="space-y-2">
          <h2 id="contracts-heading" className="text-lg font-medium">
            {tt('Contract decision')}
          </h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-600">{tt('Unblock production')}</dt>
              <dd className="font-medium">{contracts.unblockStatusProduction}</dd>
            </div>
            <div>
              <dt className="text-slate-600">{tt('HTTP success ≠ clearance')}</dt>
              <dd className="font-medium">{String(contracts.httpSuccessInsufficientForClearance)}</dd>
            </div>
            <div>
              <dt className="text-slate-600">{tt('Tenant cannot clear MRA')}</dt>
              <dd className="font-medium">{String(contracts.tenantCannotClearMra)}</dd>
            </div>
            <div>
              <dt className="text-slate-600">{tt('Direct ACTIVE forbidden')}</dt>
              <dd className="font-medium">{String(contracts.directActiveForbidden)}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="active-restrictions">
        <h2 id="active-restrictions" className="text-lg font-medium">
          Active restrictions ({restrictions.length})
        </h2>
        {restrictions.length === 0 ? (
          <p className="text-sm text-slate-600">{tt('No active restrictions for this scope.')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {restrictions.map((r) => (
              <li key={r.id} className="rounded border border-slate-200 p-3 text-sm">
                <p className="font-medium">
                  {r.reasonCode}{' '}
                  <span className="font-normal text-slate-600">({r.severity})</span>
                </p>
                <p className="text-slate-700">
                  Source {r.sourceType} · Scope {r.scopeType}/{r.scopeId} · {r.environment}
                </p>
                <p className="text-slate-600">Clear authority: {r.clearAuthority || 'n/a'}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {projection ? (
        <section aria-labelledby="projection-heading" className="space-y-2">
          <h2 id="projection-heading" className="text-lg font-medium">
            {tt('Terminal compliance projection')}
          </h2>
          <p className="text-sm" role="status">
            {tt('Effective state:')} <strong>{projection.effectiveState}</strong>
            {projection.primaryReasonCode ? ` — ${projection.primarySafeText}` : ''}
          </p>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            <li>Finalize EIS sale: {String(projection.canFinalizeEisSale)}</li>
            <li>Transmit online: {String(projection.canTransmitOnline)}</li>
            <li>Allocate fiscal number: {String(projection.canAllocateFiscalNumber)}</li>
            <li>Enter offline: {String(projection.canEnterOffline)}</li>
            <li>Reconciliation: {String(projection.canRunReconciliation)}</li>
            <li>View accepted receipt: {String(projection.canViewAcceptedReceipt)}</li>
          </ul>
        </section>
      ) : null}

      {capability ? (
        <section aria-labelledby="cap-heading">
          <h2 id="cap-heading" className="text-lg font-medium">
            {tt('Capability result')}
          </h2>
          <pre className="overflow-x-auto rounded bg-slate-50 p-3 text-xs">
            {JSON.stringify(capability, null, 2)}
          </pre>
        </section>
      ) : null}

      {unblock ? (
        <section aria-labelledby="unblock-heading">
          <h2 id="unblock-heading" className="text-lg font-medium">
            {tt('Unblock + revalidation result')}
          </h2>
          <p className="text-sm text-slate-700">
            Operational after revalidation:{' '}
            <strong>{String(Boolean(unblock.final?.operational))}</strong>. Terminal was not set
            ACTIVE directly.
          </p>
          <pre className="overflow-x-auto rounded bg-slate-50 p-3 text-xs">
            {JSON.stringify(unblock, null, 2)}
          </pre>
        </section>
      ) : null}
    </main>
  );
}
