'use client';
import { tt } from '@/lib/i18n/runtime';

/**
 * Internal, administrator-only, read-only Accounting Architecture status page.
 * Displays configuration, posting mode, flags, event registry counts, and shadow
 * comparison health. Flag/config changes go through the audited API with a reason;
 * this page performs no financial calculations and offers no repair actions.
 */

import { useEffect, useState } from 'react';

const badge = (text, tone) => (
  <span
    className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
      tone === 'ok'
        ? 'bg-green-100 text-green-800'
        : tone === 'warn'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-slate-100 text-slate-700'
    }`}
  >
    {text}
  </span>
);

/** User-facing labels must not expose internal "V2" naming. */
function friendlyLabel(value) {
  if (value == null) return '—';
  return String(value)
    .replace(/ACCOUNTING_V2/gi, 'Canonical Accounting')
    .replace(/CLOSE_V2/gi, 'Year-End Close')
    .replace(/PLAN_V2/gi, 'Financial Planning')
    .replace(/V2Enabled/g, '')
    .replace(/V2/gi, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function AccountingArchitecturePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/system/accounting-architecture')
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="p-8 text-slate-500">{tt('Loading architecture status…')}</div>;
  if (error)
    return (
      <div className="p-8">
        <h1 className="mb-2 text-xl font-bold">{tt('Accounting Architecture')}</h1>
        <p className="text-red-600">{error}</p>
      </div>
    );

  const events = data.events || {};
  const comparisons = data.shadowComparisons || {};

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <header>
        <h1 className="text-2xl font-bold">{tt('Accounting Architecture')}</h1>
        <p className="text-sm text-slate-500">
          {tt('Internal console — Phase 9: NEW_ENGINE is authoritative.')}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded border p-4">
          <div className="text-xs uppercase text-slate-500">{tt('Architecture version')}</div>
          <div className="mt-1 font-semibold">{friendlyLabel(data.architectureVersion)}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-xs uppercase text-slate-500">{tt('Default posting mode')}</div>
          <div className="mt-1">
            {badge(data.defaultPostingMode, data.defaultPostingMode === 'NEW_ENGINE' ? 'ok' : 'warn')}
          </div>
        </div>
        <div className="rounded border p-4">
          <div className="text-xs uppercase text-slate-500">{tt('Integrity monitoring')}</div>
          <div className="mt-1">{badge(data.integrityMonitoring ? 'ENABLED' : 'OFF', data.integrityMonitoring ? 'ok' : 'muted')}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-xs uppercase text-slate-500">{tt('Cutover readiness')}</div>
          <div className="mt-1 text-sm">{data.cutoverReadiness}</div>
        </div>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-2 font-semibold">{tt('Event registry')}</h2>
        {Object.keys(events).length === 0 ? (
          <p className="text-sm text-slate-500">{tt('No accounting events registered yet.')}</p>
        ) : (
          <ul className="flex flex-wrap gap-3 text-sm">
            {Object.entries(events).map(([status, count]) => (
              <li key={status}>
                {badge(`${status}: ${count}`, status === 'FAILED' ? 'warn' : 'muted')}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-2 font-semibold">{tt('Shadow comparisons')}</h2>
        <div className="mb-2 text-sm">
          Outstanding critical/high findings:{' '}
          {badge(String(data.outstandingCriticalBlockers), data.outstandingCriticalBlockers > 0 ? 'warn' : 'ok')}
        </div>
        {Object.keys(comparisons).length === 0 ? (
          <p className="text-sm text-slate-500">{tt('No shadow comparisons recorded.')}</p>
        ) : (
          <ul className="flex flex-wrap gap-3 text-sm">
            {Object.entries(comparisons).map(([status, count]) => (
              <li key={status}>
                {badge(`${status}: ${count}`, status === 'EXACT_MATCH' ? 'ok' : 'warn')}
              </li>
            ))}
          </ul>
        )}
        {data.lastComparison && (
          <p className="mt-2 text-xs text-slate-500">
            Last comparison: {data.lastComparison.status} ({data.lastComparison.severity}) at{' '}
            {new Date(data.lastComparison.createdAt).toLocaleString()}
          </p>
        )}
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-2 font-semibold">{tt('Feature flags')}</h2>
        {(!data.flags || data.flags.length === 0) ? (
          <p className="text-sm text-slate-500">{tt('No accounting flags configured — full legacy behaviour.')}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                <th className="py-1 pr-4">{tt('Flag')}</th>
                <th className="py-1 pr-4">{tt('Scope')}</th>
                <th className="py-1">{tt('State')}</th>
              </tr>
            </thead>
            <tbody>
              {data.flags.map((f, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1 pr-4 font-mono text-xs">{friendlyLabel(f.flagKey)}</td>
                  <td className="py-1 pr-4 text-xs">
                    {f.scope.tenantId === '*' ? tt('global') : tt('business')} / {f.scope.moduleKey} / {f.scope.eventType}
                  </td>
                  <td className="py-1">{badge(f.enabled ? 'ON' : 'OFF', f.enabled ? 'warn' : 'muted')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Changes require the accounting architecture permission, a reason, and are written to the
          audit trail via the API. The new posting engine cannot be activated in this release.
        </p>
      </section>
    </div>
  );
}
