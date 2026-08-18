'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Phase 19 — Migration Administration UI (evidence-driven, additive only).
 * No “Migrate everything”, no Set Active, no historical transmit, no credential fields.
 */
export default function MraEisMigrationPage() {
  const [sources, setSources] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [invariants, setInvariants] = useState(null);
  const [run, setRun] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sourceName, setSourceName] = useState('Legacy EIS Assessment DB');
  const [environment, setEnvironment] = useState('SANDBOX');
  const [lastDecision, setLastDecision] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mra-eis/migration');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to load');
      setSources(data.sources || []);
      setCohorts(data.cohorts || []);
      setInvariants(data.invariants || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function post(action, extra = {}) {
    setError(null);
    const res = await fetch('/api/mra-eis/migration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, environment, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message || data.error || 'Action failed');
      return null;
    }
    return data;
  }

  async function registerDemoSource() {
    const data = await post('register-source', {
      name: sourceName,
      sourceType: 'LEGACY_EIS_DATABASE',
      environmentClassification: environment,
      readOnlyVerified: true,
      credentialReference: 'secret-provider://mra-eis/migration/read-only-ref',
      locationReference: 'isolated-assessment-restore',
    });
    if (data) await load();
  }

  async function runDemoDryRun() {
    let sourceId = sources[0]?.id;
    if (!sourceId) {
      const reg = await post('register-source', {
        name: sourceName,
        sourceType: 'LEGACY_EIS_DATABASE',
        environmentClassification: environment,
        readOnlyVerified: true,
        credentialReference: 'secret-provider://mra-eis/migration/read-only-ref',
      });
      if (!reg?.source) return;
      sourceId = reg.source.id;
      await load();
    }

    const created = await post('create-run', {
      cohortId: 'ACCEPTED_TRANSACTIONS',
      sourceSystemId: sourceId,
      mode: 'DRY_RUN',
    });
    if (!created?.run) return;

    const candidates = [
      {
        id: 'sale-accepted-1',
        sourceRecordId: 'sale-accepted-1',
        sourceNaturalKey: 'POS_SALE:sale-accepted-1',
        sourceEntityType: 'POS_SALE',
        tenantId: null, // filled server-side from session
        businessId: null,
        environment,
        hasAcceptedResponseEvidence: true,
        mraTransactionId: 'MRA-TX-DEMO-001',
        hasReceipt: true,
        fiscalNumber: 'FN-1001',
        journalExists: true,
        journalBalanced: true,
        stockMovementExists: true,
      },
      {
        id: 'sale-receipt-only',
        sourceRecordId: 'sale-receipt-only',
        sourceNaturalKey: 'POS_SALE:sale-receipt-only',
        sourceEntityType: 'POS_SALE',
        environment,
        hasReceipt: true,
        hasAcceptedResponseEvidence: false,
        localStatusSaysAccepted: true,
        fiscalNumber: 'FN-1002',
      },
      {
        id: 'sale-eligible-never-sent',
        sourceRecordId: 'sale-eligible-never-sent',
        sourceNaturalKey: 'POS_SALE:sale-eligible-never-sent',
        sourceEntityType: 'POS_SALE',
        environment,
        eisEligible: true,
        hasAnyMraEvidence: false,
        journalExists: true,
        journalBalanced: true,
      },
    ];

    const dry = await post('dry-run', {
      runId: created.run.id,
      candidates,
    });
    if (!dry) return;
    setRun(dry.run);
    setReconciliation(dry.reconciliation || null);
    setLastDecision({
      expectedInserts: dry.expectedInserts,
      expectedQuarantines: dry.expectedQuarantines,
      targetMutated: dry.targetMutated,
      historicalSaleSubmitted: dry.historicalSaleSubmitted,
    });
  }

  async function approveAndMigrateSandbox() {
    if (!run?.id || !run.dryRunChecksum) {
      setError('Run a Dry Run first.');
      return;
    }
    if (environment === 'PRODUCTION') {
      setError('Production migration requires separate platform approval — not available from this demo control.');
      return;
    }
    const approved = await post('approve-run', {
      runId: run.id,
      dryRunChecksum: run.dryRunChecksum,
      requesterId: 'plan-author-other',
    });
    if (!approved) return;
    const migrated = await post('migrate', {
      runId: run.id,
      dryRunChecksum: run.dryRunChecksum,
      backupVerified: true,
    });
    if (!migrated) return;
    setRun(migrated.run);
    setReconciliation(migrated.reconciliation || null);
    setLastDecision({
      migrated: migrated.run?.migratedRecords,
      linked: migrated.run?.linkedRecords,
      journalCreated: migrated.journalCreated,
      stockMovementCreated: migrated.stockMovementCreated,
      historicalSaleSubmitted: migrated.historicalSaleSubmitted,
    });
  }

  async function rollbackRun() {
    if (!run?.id) return;
    const out = await post('rollback', { runId: run.id });
    if (!out) return;
    setRun(out.run);
    setLastDecision({
      removed: out.removed,
      lineagePreserved: out.lineagePreserved,
      journalsPreserved: out.journalsPreserved,
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-slate-600">
          <Link href="/settings/integrations/mra-eis/centre" className="underline">
            {tt('EIS Admin Centre')}
          </Link>{' '}
          / Data Migration
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">{tt('MRA EIS Data Migration')}</h1>
        <p className="text-sm text-slate-700 max-w-3xl">
          Evidence-driven assessment and additive historical import. Ambiguous ownership, environment, or
          fiscal evidence defaults to quarantine and manual review. Historical sales are never submitted.
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      )}

      {invariants && (
        <section aria-labelledby="invariants-heading" className="rounded border border-slate-200 p-4">
          <h2 id="invariants-heading" className="font-medium text-slate-900 mb-2">
            {tt('Migration invariants')}
          </h2>
          <ul className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
            {Object.entries(invariants).map(([k, v]) => (
              <li key={k}>
                <span className="font-mono text-xs text-slate-500">{k}</span>: {String(v)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="controls-heading" className="rounded border border-slate-200 p-4 space-y-3">
        <h2 id="controls-heading" className="font-medium text-slate-900">
          {tt('Assessment controls')}
        </h2>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm block">
            {tt('Source name')}
            <input
              className="mt-1 block w-64 border border-slate-300 px-2 py-1"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
            />
          </label>
          <label className="text-sm block">
            {tt('Environment')}
            <select
              className="mt-1 block border border-slate-300 px-2 py-1"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
            >
              <option value="SANDBOX">SANDBOX</option>
              <option value="PRODUCTION">PRODUCTION</option>
              <option value="CERTIFICATION">CERTIFICATION</option>
              <option value="UNKNOWN">UNKNOWN</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="border border-slate-400 px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={registerDemoSource}
          >
            {tt('Register read-only source')}
          </button>
          <button
            type="button"
            className="border border-slate-800 bg-slate-900 text-white px-3 py-1.5 text-sm"
            onClick={runDemoDryRun}
          >
            Run Dry Run (demo cohort)
          </button>
          <button
            type="button"
            className="border border-emerald-700 px-3 py-1.5 text-sm text-emerald-900 hover:bg-emerald-50"
            onClick={approveAndMigrateSandbox}
            disabled={environment === 'PRODUCTION'}
          >
            Approve + additive migrate (non-Production)
          </button>
          <button
            type="button"
            className="border border-amber-700 px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-50"
            onClick={rollbackRun}
          >
            {tt('Rollback migration-created records')}
          </button>
          <button
            type="button"
            className="border border-slate-300 px-3 py-1.5 text-sm"
            onClick={load}
          >
            {tt('Refresh')}
          </button>
        </div>
        <p className="text-xs text-slate-600">
          There is no “Migrate everything” action. Production migrate requires approved Dry Run checksum,
          backup verification, and segregated approval.
        </p>
      </section>

      {loading ? (
        <p className="text-sm text-slate-600" aria-live="polite">
          {tt('Loading sources…')}
        </p>
      ) : (
        <section aria-labelledby="sources-heading" className="rounded border border-slate-200 p-4">
          <h2 id="sources-heading" className="font-medium text-slate-900 mb-2">
            Source systems ({sources.length})
          </h2>
          {sources.length === 0 ? (
            <p className="text-sm text-slate-600">{tt('No sources registered yet.')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <caption className="sr-only">{tt('Registered migration source systems')}</caption>
                <thead>
                  <tr className="border-b text-left">
                    <th scope="col" className="py-2 pr-3">
                      {tt('Name')}
                    </th>
                    <th scope="col" className="py-2 pr-3">
                      {tt('Type')}
                    </th>
                    <th scope="col" className="py-2 pr-3">
                      {tt('Environment')}
                    </th>
                    <th scope="col" className="py-2 pr-3">
                      {tt('Read-only')}
                    </th>
                    <th scope="col" className="py-2">
                      {tt('Status')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{s.name}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{s.sourceType}</td>
                      <td className="py-2 pr-3">{s.environmentClassification}</td>
                      <td className="py-2 pr-3">{s.readOnlyVerified ? tt('Yes') : tt('No')}</td>
                      <td className="py-2">{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="cohorts-heading" className="rounded border border-slate-200 p-4">
        <h2 id="cohorts-heading" className="font-medium text-slate-900 mb-2">
          {tt('Migration cohorts')}
        </h2>
        <ul className="flex flex-wrap gap-2 text-xs">
          {cohorts.map((c) => (
            <li key={c} className="border border-slate-300 px-2 py-1 font-mono">
              {c}
            </li>
          ))}
        </ul>
      </section>

      {run && (
        <section aria-labelledby="run-heading" className="rounded border border-slate-200 p-4 space-y-3" aria-live="polite">
          <h2 id="run-heading" className="font-medium text-slate-900">
            {tt('Migration run')}
          </h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{tt('State / mode')}</dt>
              <dd>
                {run.state} / {run.mode}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Dry-run checksum')}</dt>
              <dd className="font-mono text-xs break-all">{run.dryRunChecksum || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Assessed / eligible / quarantined')}</dt>
              <dd>
                {run.assessedRecords} / {run.eligibleRecords} / {run.quarantinedRecords}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Migrated / linked / failed')}</dt>
              <dd>
                {run.migratedRecords} / {run.linkedRecords} / {run.failedRecords}
              </dd>
            </div>
          </dl>

          {Array.isArray(run.records) && run.records.length > 0 && (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="min-w-full text-sm">
                <caption className="sr-only">{tt('Record-level migration lineage')}</caption>
                <thead>
                  <tr className="border-b text-left">
                    <th scope="col" className="py-2 pr-2">
                      {tt('Source')}
                    </th>
                    <th scope="col" className="py-2 pr-2">
                      {tt('Decision')}
                    </th>
                    <th scope="col" className="py-2 pr-2">
                      {tt('Classification')}
                    </th>
                    <th scope="col" className="py-2 pr-2">
                      {tt('State')}
                    </th>
                    <th scope="col" className="py-2">
                      {tt('Blockers')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {run.records.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-2 font-mono text-xs">{r.sourceRecordId}</td>
                      <td className="py-2 pr-2 text-xs">{r.decision}</td>
                      <td className="py-2 pr-2 text-xs">{r.saleClassification || '—'}</td>
                      <td className="py-2 pr-2">{r.state}</td>
                      <td className="py-2 text-xs text-slate-600">
                        {(r.blockers || []).join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {(reconciliation || lastDecision) && (
        <section aria-labelledby="recon-heading" className="rounded border border-slate-200 p-4">
          <h2 id="recon-heading" className="font-medium text-slate-900 mb-2">
            {tt('Reconciliation / result')}
          </h2>
          <pre className="text-xs overflow-x-auto whitespace-pre-wrap bg-slate-50 p-3 border border-slate-100">
            {JSON.stringify({ reconciliation, lastDecision }, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
