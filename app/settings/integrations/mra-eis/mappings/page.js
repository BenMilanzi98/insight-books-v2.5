'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'sites', label: 'Sites & Branches' },
  { id: 'taxes', label: 'Taxes' },
  { id: 'payments', label: 'Payment Methods' },
  { id: 'conflicts', label: 'Conflicts' },
];

function StatusBadge({ status }) {
  const tone =
    status === 'ACTIVE'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : status === 'SUGGESTED' || status === 'MATCHED'
        ? 'bg-sky-50 text-sky-900 border-sky-200'
        : status === 'CONFLICT' || status === 'STALE' || status === 'BLOCKED'
          ? 'bg-red-50 text-red-900 border-red-200'
          : 'bg-slate-50 text-slate-800 border-slate-200';
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${tone}`}>
      <span className="sr-only">{tt('Status:')} </span>
      {status}
    </span>
  );
}

export default function MraEisMappingsPage() {
  const [tab, setTab] = useState('overview');
  const [environment] = useState('SANDBOX');
  const [readiness, setReadiness] = useState(null);
  const [completeness, setCompleteness] = useState(null);
  const [sites, setSites] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [taxMappings, setTaxMappings] = useState([]);
  const [paymentMappings, setPaymentMappings] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [r, c, s, m, t, p] = await Promise.all([
        fetch(`/api/mra-eis/mappings/readiness?environment=${environment}`).then((x) => x.json()),
        fetch(`/api/mra-eis/mappings/completeness?environment=${environment}`).then((x) => x.json()),
        fetch(`/api/mra-eis/mappings/sites?environment=${environment}`).then((x) => x.json()),
        fetch(`/api/mra-eis/mappings?kind=SITE&environment=${environment}`).then((x) => x.json()),
        fetch(`/api/mra-eis/mappings?kind=TAX&environment=${environment}`).then((x) => x.json()),
        fetch(`/api/mra-eis/mappings?kind=PAYMENT&environment=${environment}`).then((x) => x.json()),
      ]);
      if (!r.success) throw new Error(r?.error?.message || 'Failed to load readiness');
      setReadiness(r.data);
      setCompleteness(c.data);
      setSites(s.data || []);
      setMappings(m.data || []);
      setTaxMappings(t.data || []);
      setPaymentMappings(p.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [environment]);

  useEffect(() => {
    load();
  }, [load]);

  async function suggest(kind) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/mra-eis/mappings/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ kind, environment, persist: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Suggestion failed');
      setMessage(`${kind} suggestions generated. They are not active until verified and activated.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function lifecycle(kind, id, action, extra = {}) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/mra-eis/mappings/${kind}/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ environment, ...extra }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || `${action} failed`);
      setMessage(`${kind} mapping ${action} succeeded.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-600" role="status">
        {tt('Loading mapping workspace…')}
      </div>
    );
  }

  const conflicts = [
    ...mappings.filter((m) => ['CONFLICT', 'STALE'].includes(m.status)),
    ...taxMappings.filter((m) => ['CONFLICT', 'STALE'].includes(m.status)),
    ...paymentMappings.filter((m) => ['CONFLICT', 'STALE', 'BLOCKED'].includes(m.status)),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-medium text-slate-500">
          <a href="/settings/integrations/mra-eis" className="underline-offset-2 hover:underline">
            {tt('MRA EIS')}
          </a>{' '}
          / Mappings
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{tt('Site, Tax & Payment Mappings')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {tt('Controlled, versioned compliance relationships. Suggestions never auto-activate. Product and Service mapping remains Phase 10.')}
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          {message}
        </div>
      )}

      <nav className="mb-6 flex flex-wrap gap-2" aria-label={tt('Mapping sections')}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded px-3 py-2 text-sm ${tab === t.id ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white'}`}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <section className="space-y-4" aria-labelledby="overview-heading">
          <h2 id="overview-heading" className="text-lg font-semibold">
            {tt('Mapping readiness')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Completeness', completeness?.overallStatus],
              ['Phase 9 core ready', readiness?.phase9CoreReady ? 'Yes' : 'No'],
              ['Taxpayer identity', readiness?.taxpayerIdentityMapped ? 'Mapped' : 'Incomplete'],
              ['Site mappings', readiness?.branchSiteMappingComplete ? 'Complete' : 'Missing'],
              ['Tax mappings', readiness?.taxMappingComplete ? 'Complete' : 'Missing'],
              ['Payment mappings', readiness?.paymentMappingComplete ? 'Complete' : 'Missing'],
              ['Product mapping', 'Phase 10 placeholder'],
              ['Service mapping', 'Phase 10 placeholder'],
              ['Environment', environment],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
                <div className="mt-1 text-sm font-semibold">{String(value)}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-medium">{tt('Blockers')}</h3>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {(readiness?.blockers || []).map((b) => (
                <li key={b}>{b}</li>
              ))}
              {(readiness?.blockers || []).length === 0 && <li>{tt('None for Phase 9 view operations')}</li>}
            </ul>
            <h3 className="mt-4 font-medium">{tt('Warnings')}</h3>
            <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">
              {(readiness?.warnings || []).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={() => suggest('SITE')}
            >
              {tt('Generate site suggestions')}
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50"
              onClick={() => suggest('TAX')}
            >
              {tt('Generate tax suggestions')}
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded bg-slate-700 px-3 py-2 text-sm text-white disabled:opacity-50"
              onClick={() => suggest('PAYMENT')}
            >
              {tt('Generate payment suggestions')}
            </button>
          </div>
        </section>
      )}

      {tab === 'sites' && (
        <section aria-labelledby="sites-heading" className="space-y-4">
          <h2 id="sites-heading" className="text-lg font-semibold">
            {tt('Sites & branch mappings')}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">MRA sites (read-only catalogue)</caption>
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">{tt('MRA Site')}</th>
                  <th className="px-3 py-2">{tt('Name')}</th>
                  <th className="px-3 py-2">{tt('Active')}</th>
                  <th className="px-3 py-2">{tt('Mapped branches')}</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.mraSiteId} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{s.mraSiteId}</td>
                    <td className="px-3 py-2">{s.siteName}</td>
                    <td className="px-3 py-2">{s.active ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2">{(s.localBranchesMapped || []).length}</td>
                  </tr>
                ))}
                {sites.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-slate-500">
                      {tt('No MRA sites in active configuration. Sync configuration first.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">{tt('Branch to site mappings')}</caption>
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">{tt('Branch')}</th>
                  <th className="px-3 py-2">{tt('MRA Site')}</th>
                  <th className="px-3 py-2">{tt('Status')}</th>
                  <th className="px-3 py-2">{tt('Version')}</th>
                  <th className="px-3 py-2">{tt('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{m.branchId}</td>
                    <td className="px-3 py-2 font-mono text-xs">{m.mraSiteId}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={m.status} />
                      {m.status === 'SUGGESTED' && (
                        <span className="ml-2 text-xs text-slate-500">(not active)</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{m.mappingVersion}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {['SUGGESTED', 'MATCHED', 'PENDING_VERIFICATION'].includes(m.status) && (
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-xs"
                            disabled={busy}
                            onClick={() => lifecycle('SITE', m.id, 'verify', { expectedVersion: m.version })}
                          >
                            {tt('Verify')}
                          </button>
                        )}
                        {m.status === 'VERIFIED' && !m.approvedBy && (
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-xs"
                            disabled={busy}
                            onClick={() => lifecycle('SITE', m.id, 'approve', { expectedVersion: m.version })}
                          >
                            {tt('Approve')}
                          </button>
                        )}
                        {m.status === 'VERIFIED' && (
                          <button
                            type="button"
                            className="rounded bg-slate-900 px-2 py-1 text-xs text-white"
                            disabled={busy}
                            onClick={() => lifecycle('SITE', m.id, 'activate', { expectedVersion: m.version })}
                          >
                            {tt('Activate')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'taxes' && (
        <section aria-labelledby="taxes-heading">
          <h2 id="taxes-heading" className="mb-3 text-lg font-semibold">
            {tt('Tax mappings')}
          </h2>
          <p className="mb-3 text-sm text-slate-600">
            {tt('Zero-rated and exempt remain distinct. VAT5 is a separate workflow. Local rates are never modified.')}
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">{tt('Local tax')}</th>
                  <th className="px-3 py-2">{tt('MRA tax')}</th>
                  <th className="px-3 py-2">{tt('Treatment')}</th>
                  <th className="px-3 py-2">{tt('Rates')}</th>
                  <th className="px-3 py-2">{tt('Status')}</th>
                  <th className="px-3 py-2">{tt('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {taxMappings.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{m.localTaxRateId}</td>
                    <td className="px-3 py-2 font-mono text-xs">{m.mraTaxRateId}</td>
                    <td className="px-3 py-2">{m.treatmentType || '—'}</td>
                    <td className="px-3 py-2">
                      {String(m.localRateSnapshot)} / {String(m.mraRateSnapshot)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-3 py-2">
                      {['SUGGESTED', 'MATCHED'].includes(m.status) && (
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-xs"
                          disabled={busy}
                          onClick={() => lifecycle('TAX', m.id, 'verify', { expectedVersion: m.version })}
                        >
                          {tt('Verify')}
                        </button>
                      )}
                      {m.status === 'VERIFIED' && (
                        <button
                          type="button"
                          className="ml-1 rounded bg-slate-900 px-2 py-1 text-xs text-white"
                          disabled={busy}
                          onClick={() => lifecycle('TAX', m.id, 'activate', { expectedVersion: m.version })}
                        >
                          {tt('Activate')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {taxMappings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-slate-500">
                      {tt('No tax mappings yet. Generate suggestions or create a verified mapping.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'payments' && (
        <section aria-labelledby="payments-heading">
          <h2 id="payments-heading" className="mb-3 text-lg font-semibold">
            {tt('Payment method mappings')}
          </h2>
          <p className="mb-3 text-sm text-slate-600">
            Display names are not API codes. Split payments remain blocked until MRA clarifies representation.
            Credit Sale fiscalization is separate from later customer collections.
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">{tt('Local method')}</th>
                  <th className="px-3 py-2">{tt('MRA code')}</th>
                  <th className="px-3 py-2">{tt('Status')}</th>
                  <th className="px-3 py-2">{tt('Version')}</th>
                  <th className="px-3 py-2">{tt('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paymentMappings.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{m.localPaymentMethodId}</td>
                    <td className="px-3 py-2 font-mono text-xs">{m.mraPaymentMethodCode}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-3 py-2">{m.mappingVersion}</td>
                    <td className="px-3 py-2">
                      {['SUGGESTED', 'MATCHED'].includes(m.status) && (
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-xs"
                          disabled={busy}
                          onClick={() => lifecycle('PAYMENT', m.id, 'verify', { expectedVersion: m.version })}
                        >
                          {tt('Verify')}
                        </button>
                      )}
                      {m.status === 'VERIFIED' && (
                        <button
                          type="button"
                          className="ml-1 rounded bg-slate-900 px-2 py-1 text-xs text-white"
                          disabled={busy}
                          onClick={() => lifecycle('PAYMENT', m.id, 'activate', { expectedVersion: m.version })}
                        >
                          {tt('Activate')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'conflicts' && (
        <section aria-labelledby="conflicts-heading">
          <h2 id="conflicts-heading" className="mb-3 text-lg font-semibold">
            {tt('Conflicts & stale mappings')}
          </h2>
          <ul className="space-y-2">
            {conflicts.map((m) => (
              <li key={m.id} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm">
                <StatusBadge status={m.status} />{' '}
                <span className="font-mono text-xs">{m.id}</span>
                <div className="mt-1 text-red-900">
                  {tt('Conflicted or stale mappings cannot resolve future sales until revalidated or superseded.')}
                </div>
              </li>
            ))}
            {conflicts.length === 0 && <li className="text-sm text-slate-500">{tt('No conflicted or stale mappings.')}</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
