'use client';

/**
 * Internal, read-only Posting Engine diagnostics page (Phase 4).
 * Shows engine status, posting mode, event counters, shadow-comparison health,
 * recent posting attempts and the template catalogue for the session business.
 * Requires accountingDiagnostics.view; offers no posting capability.
 */

import { useEffect, useState } from 'react';

const badge = (text, tone) => (
  <span
    className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
      tone === 'ok'
        ? 'bg-green-100 text-green-800'
        : tone === 'warn'
          ? 'bg-amber-100 text-amber-800'
          : tone === 'bad'
            ? 'bg-red-100 text-red-800'
            : 'bg-slate-100 text-slate-700'
    }`}
  >
    {text}
  </span>
);

const attemptTone = (status) =>
  status === 'SUCCEEDED' ? 'ok' : status?.startsWith('FAILED') ? 'bad' : 'muted';

function friendlyLabel(value) {
  if (value == null) return '—';
  return String(value)
    .replace(/ACCOUNTING_V2/gi, 'Canonical Accounting')
    .replace(/V2Enabled/g, '')
    .replace(/V2/gi, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function PostingEngineDiagnosticsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/accounting-v2/posting-engine')
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

  if (loading) return <div className="p-8 text-slate-500">Loading posting engine diagnostics…</div>;
  if (error)
    return (
      <div className="p-8">
        <h1 className="mb-2 text-xl font-bold">Accounting Posting Engine</h1>
        <p className="text-red-600">{error}</p>
      </div>
    );

  const { engine = {}, events = {}, shadowComparisons = {}, recentAttempts = [], templates = [], processMetrics = {} } = data;
  const exactRate = shadowComparisons.exactMatchRate;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <header>
        <h1 className="text-2xl font-bold">Accounting Posting Engine</h1>
        <p className="text-sm text-slate-500">
          Internal Phase 4 diagnostics — read-only. Posting mode is resolved server-side and cannot
          be changed from this page.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded border p-4">
          <div className="text-xs uppercase text-slate-500">Architecture version</div>
          <div className="mt-1 font-semibold">{friendlyLabel(engine.architectureVersion)}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-xs uppercase text-slate-500">Default posting mode</div>
          <div className="mt-1">
            {badge(engine.defaultPostingMode, engine.defaultPostingMode === 'LEGACY' ? 'ok' : 'warn')}
          </div>
        </div>
        <div className="rounded border p-4">
          <div className="text-xs uppercase text-slate-500">Shadow exact-match rate</div>
          <div className="mt-1">
            {exactRate == null
              ? badge('NO DATA', 'muted')
              : badge(`${(exactRate * 100).toFixed(1)}%`, exactRate >= 0.98 ? 'ok' : 'warn')}
          </div>
        </div>
        <div className="rounded border p-4">
          <div className="text-xs uppercase text-slate-500">Templates registered</div>
          <div className="mt-1 font-semibold">{templates.length}</div>
        </div>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-2 font-semibold">Accounting events</h2>
        <ul className="flex flex-wrap gap-3 text-sm">
          {Object.entries(events).map(([status, count]) => (
            <li key={status}>
              {badge(
                `${status}: ${count}`,
                status === 'posted' ? 'ok' : status === 'failed' || status === 'rejected' ? (count > 0 ? 'bad' : 'muted') : 'muted'
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-2 font-semibold">Shadow comparisons</h2>
        {(shadowComparisons.total ?? 0) === 0 ? (
          <p className="text-sm text-slate-500">No shadow comparisons recorded for this business.</p>
        ) : (
          <ul className="flex flex-wrap gap-3 text-sm">
            {Object.entries(shadowComparisons.byStatus || {}).map(([status, count]) => (
              <li key={status}>{badge(`${status}: ${count}`, status === 'EXACT_MATCH' ? 'ok' : 'warn')}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-2 font-semibold">Recent posting attempts</h2>
        {recentAttempts.length === 0 ? (
          <p className="text-sm text-slate-500">No posting attempts recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-500">
                  <th className="py-1 pr-4">Started</th>
                  <th className="py-1 pr-4">Event</th>
                  <th className="py-1 pr-4">Source</th>
                  <th className="py-1 pr-4">Attempt</th>
                  <th className="py-1 pr-4">Status</th>
                  <th className="py-1 pr-4">Failure</th>
                  <th className="py-1 pr-4">Duration</th>
                  <th className="py-1">Request ID</th>
                </tr>
              </thead>
              <tbody>
                {recentAttempts.map((a) => (
                  <tr key={a.id} className="border-b align-top last:border-0">
                    <td className="py-1 pr-4 text-xs whitespace-nowrap">
                      {a.startedAt ? new Date(a.startedAt).toLocaleString() : '—'}
                    </td>
                    <td className="py-1 pr-4 text-xs">{a.event?.eventType}</td>
                    <td className="py-1 pr-4 font-mono text-xs">
                      {a.event ? `${a.event.sourceType}/${a.event.sourceId}` : '—'}
                    </td>
                    <td className="py-1 pr-4 text-xs">#{a.attemptNumber}</td>
                    <td className="py-1 pr-4">{badge(a.status, attemptTone(a.status))}</td>
                    <td className="py-1 pr-4 font-mono text-xs">{a.failureCode || '—'}</td>
                    <td className="py-1 pr-4 text-xs">{a.durationMs != null ? `${a.durationMs} ms` : '—'}</td>
                    <td className="py-1 font-mono text-xs">{a.requestId || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-2 font-semibold">Posting template catalogue</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-slate-500">
              <th className="py-1 pr-4">Template</th>
              <th className="py-1 pr-4">Version</th>
              <th className="py-1 pr-4">Event type</th>
              <th className="py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={`${t.templateId}-${t.templateVersion}`} className="border-b last:border-0">
                <td className="py-1 pr-4 font-mono text-xs">{t.templateId}</td>
                <td className="py-1 pr-4 text-xs">v{t.templateVersion}</td>
                <td className="py-1 pr-4 text-xs">{t.eventType}</td>
                <td className="py-1">{badge(t.status, t.status === 'ACTIVE' ? 'ok' : 'muted')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-2 font-semibold">Process metrics (since last restart)</h2>
        <ul className="flex flex-wrap gap-3 text-sm">
          {Object.entries(processMetrics).map(([key, value]) => (
            <li key={key}>{badge(`${key}: ${value}`, 'muted')}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
