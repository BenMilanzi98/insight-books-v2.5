'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Phase 18 — Tenant EIS Administration Centre.
 * Operational window over Phases 1–17. No Set Active / Clear MRA / edit fiscal numbers.
 */
export default function MraEisAdminCentrePage() {
  const [data, setData] = useState(null);
  const [section, setSection] = useState('overview');
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [exports, setExports] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mra-eis/admin?action=overview&environment=SANDBOX');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || json.error || 'Failed to load');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    if (params.get('section')) setSection(params.get('section'));
  }, [load]);

  async function runSearch(e) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/mra-eis/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'search',
        query: searchQ,
        environment: 'SANDBOX',
        records: [], // server never invents foreign-tenant hits
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error?.message || 'Search failed');
      return;
    }
    setSearchResults(json);
  }

  async function requestExport() {
    setError(null);
    const create = await fetch('/api/mra-eis/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create-export',
        reportId: 'ACTIVE_RESTRICTIONS',
        format: 'CSV',
        environment: 'SANDBOX',
        userPermissions: ['eis.restrictions.view'],
      }),
    });
    const created = await create.json();
    if (!create.ok) {
      setError(created.error?.message || 'Export create failed');
      return;
    }
    const gen = await fetch('/api/mra-eis/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate-export',
        jobId: created.job.id,
        environment: 'SANDBOX',
        userPermissions: ['eis.restrictions.view'],
        rows: [{ restrictionId: 'demo', reasonCode: 'MRA_TERMINAL_BLOCKED', state: 'ACTIVE' }],
      }),
    });
    const generated = await gen.json();
    if (!gen.ok) {
      setError(generated.error?.message || 'Export generate failed');
      return;
    }
    setExports((prev) => [generated.job, ...prev]);
  }

  const ctx = data?.context;
  const overview = data?.overview;
  const health = data?.health;
  const sections = data?.sections || [];

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <p className="text-sm text-slate-600">
          <Link href="/settings/integrations/mra-eis" className="underline">
            {tt('MRA EIS')}
          </Link>
          {' / '}
          Administration Centre
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">{tt('EIS Administration Centre')}</h1>
        <p className="text-sm text-slate-700" role="status">
          Unified operational monitoring for MRA EIS. Statuses come from server-side domain data.
          This centre does not edit fiscal evidence, set Terminals Active, or clear MRA blocks.
        </p>
      </header>

      {/* Global context bar */}
      {ctx ? (
        <section
          aria-label={tt('EIS context')}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
        >
          <span>
            {tt('Tenant')} <strong className="break-all">{ctx.tenantId || '—'}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {tt('Business')} <strong className="break-all">{ctx.businessId || '—'}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span
            className={
              ctx.environment === 'PRODUCTION'
                ? 'rounded border border-red-700 px-2 py-0.5 font-medium text-red-900'
                : 'rounded border border-amber-600 px-2 py-0.5 font-medium text-amber-900'
            }
          >
            {ctx.environmentLabel}{' '}
            <span className="sr-only">{ctx.environmentSrText}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {tt('Freshness')} <strong>{ctx.dataFreshness}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {tt('Capability')} <strong>{ctx.effectiveCapabilityStatus}</strong>
          </span>
          {ctx.primaryRestriction ? (
            <>
              <span aria-hidden="true">·</span>
              <span role="status" className="font-medium text-red-800">
                Restriction: {ctx.primaryRestriction}
              </span>
            </>
          ) : null}
          <button
            type="button"
            className="ml-auto rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            onClick={load}
            disabled={loading}
          >
            {tt('Refresh')}
          </button>
        </section>
      ) : null}

      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      ) : null}

      <nav aria-label={tt('EIS sections')} className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className={`rounded border px-3 py-1.5 text-sm ${
              section === s.id
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-800'
            }`}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      <section aria-labelledby="search-heading" className="space-y-2">
        <h2 id="search-heading" className="text-lg font-medium">
          {tt('Global search')}
        </h2>
        <form onSubmit={runSearch} className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="eis-search">
            {tt('Search EIS entities')}
          </label>
          <input
            id="eis-search"
            className="min-w-[12rem] flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder={tt('Terminal, fiscal number, correlation ID…')}
          />
          <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
            {tt('Search')}
          </button>
        </form>
        {searchResults ? (
          <p className="text-sm text-slate-600" role="status">
            {searchResults.resultCount} result(s). Tenant-isolated:{' '}
            {String(searchResults.tenantIsolated)}. Credentials never indexed.
          </p>
        ) : null}
      </section>

      {overview ? (
        <section aria-labelledby="overview-heading" className="space-y-3">
          <h2 id="overview-heading" className="text-lg font-medium">
            {tt('Operational overview')}
          </h2>
          <p className="text-sm text-slate-600">
            {tt('Freshness:')} <strong>{overview.freshness}</strong>
            {overview.partial ? ' — PARTIAL data (failed queries are not shown as zero).' : null}
            {' · '}
            Not financial source of truth.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overview.cards.map((c) => (
              <li key={c.key} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">{c.label}</p>
                {c.error ? (
                  <p className="mt-1 text-sm font-medium text-red-800" role="alert">
                    {tt('Unavailable')}
                  </p>
                ) : (
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{c.value}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">{c.sourceEntity || 'derived'}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {health ? (
        <section aria-labelledby="health-heading" className="space-y-2">
          <h2 id="health-heading" className="text-lg font-medium">
            {tt('Health scorecard')}
          </h2>
          <p className="text-sm" role="status">
            {tt('Band:')} <strong>{health.band}</strong> · Score {health.score}/100 (raw {health.rawScore})
          </p>
          <p className="text-sm text-slate-700">{health.interpretation}</p>
          {health.blocking?.length ? (
            <ul className="list-disc pl-5 text-sm text-red-800">
              {health.blocking.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="safe-actions" className="space-y-2">
        <h2 id="safe-actions" className="text-lg font-medium">
          {tt('Safe workspaces')}
        </h2>
        <p className="text-sm text-slate-600">
          {tt('Deep links into Phase 1–17 domain UIs. No direct state mutation from this centre.')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded border border-slate-300 px-3 py-2 text-sm" href="/settings/integrations/mra-eis/restrictions">
            {tt('Restrictions & Unblock')}
          </Link>
          <Link className="rounded border border-slate-300 px-3 py-2 text-sm" href="/settings/integrations/mra-eis/reconciliation">
            {tt('Reconciliation')}
          </Link>
          <Link className="rounded border border-slate-300 px-3 py-2 text-sm" href="/settings/integrations/mra-eis/sales-transmission">
            {tt('Transmissions')}
          </Link>
          <Link className="rounded border border-slate-300 px-3 py-2 text-sm" href="/settings/integrations/mra-eis/offline">
            {tt('Offline')}
          </Link>
          <Link className="rounded border border-slate-300 px-3 py-2 text-sm" href="/settings/integrations/mra-eis/fiscal-receipts">
            {tt('Receipts')}
          </Link>
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            onClick={requestExport}
          >
            Export Active Restrictions (CSV)
          </button>
        </div>
        {exports.length ? (
          <ul className="text-sm text-slate-700">
            {exports.map((j) => (
              <li key={j.id}>
                Export {j.id.slice(0, 8)}… · {j.state} · checksum {j.checksum?.slice(0, 12)}…
                {j.signedUrl ? (
                  <>
                    {' '}
                    <a className="underline" href={j.signedUrl}>
                      Download (expires)
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="forbidden" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        <h2 id="forbidden" className="font-medium">
          {tt('Forbidden from this UI')}
        </h2>
        <ul className="mt-1 list-disc pl-5">
          <li>{tt('Set Terminal Active')}</li>
          <li>{tt('Mark Transmission Accepted')}</li>
          <li>{tt('Clear MRA restriction without evidence')}</li>
          <li>{tt('Edit fiscal numbers, Snapshots, Response Evidence, Offline Envelopes')}</li>
          <li>{tt('Delete or reorder Offline Queue Items')}</li>
          <li>{tt('Overwrite original Fiscal Receipts')}</li>
          <li>Generic Retry (use Phase 15 safe-retry authorization)</li>
        </ul>
      </section>
    </main>
  );
}
