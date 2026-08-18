'use client';
import { tt } from '@/lib/i18n/runtime';

/**
 * Internal Historical Accounting Repair console (Phase 6).
 *
 * Shows the anomaly registry, repair batches and exception register for the
 * session business, with a detection trigger. All destructive capability
 * lives behind the permission-gated APIs — this page offers no raw SQL, no
 * debit/credit editing, no journal deletion and no account reassignment.
 */

import { useCallback, useEffect, useState } from 'react';

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

const severityTone = (s) => (s === 'CRITICAL' ? 'bad' : s === 'HIGH' ? 'warn' : 'muted');
const statusTone = (s) =>
  ['VERIFIED', 'REPAIRED', 'COMPLETED'].includes(s)
    ? 'ok'
    : ['REPAIR_FAILED', 'FAILED', 'ROLLED_BACK'].includes(s)
      ? 'bad'
      : ['DETECTED', 'UNDER_INVESTIGATION', 'EVIDENCE_INCOMPLETE'].includes(s)
        ? 'warn'
        : 'muted';

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export default function AccountingRepairPage() {
  const [anomalies, setAnomalies] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [batches, setBatches] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [filters, setFilters] = useState({ status: '', severity: '', anomalyType: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
      const [a, b, e] = await Promise.all([
        fetchJson(`/api/accounting-v2/repair/anomalies?${params}`),
        fetchJson('/api/accounting-v2/repair/batches'),
        fetchJson('/api/accounting-v2/repair/exceptions'),
      ]);
      setAnomalies(a.anomalies ?? []);
      setPagination(a.pagination ?? null);
      setBatches(b.batches ?? []);
      setExceptions(e.exceptions ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const runDetection = async () => {
    setDetecting(true);
    setError(null);
    try {
      const json = await fetchJson('/api/accounting-v2/repair/anomalies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'detect' }),
      });
      setDetectionResult(json.detection);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDetecting(false);
    }
  };

  const bySeverity = anomalies.reduce((acc, a) => {
    acc[a.severity] = (acc[a.severity] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tt('Historical Accounting Repair')}</h1>
          <p className="text-sm text-slate-500">
            Phase 6 repair console — anomaly registry, repair batches and exception register for
            the current business. Every repair is evidence-based, approved and idempotent; posted
            journals are never edited or deleted.
          </p>
        </div>
        <button
          onClick={runDetection}
          disabled={detecting}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {detecting ? tt('Detecting…') : tt('Run detection')}
        </button>
      </header>

      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {detectionResult && (
        <p className="rounded bg-green-50 p-3 text-sm text-green-800">
          Detection completed in {detectionResult.durationMs} ms — {detectionResult.detected}{' '}
          finding(s). Reconciliation: {detectionResult.reconciliationStatus}.
        </p>
      )}

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded border p-4">
          <div className="text-xs uppercase text-slate-500">{tt('Open anomalies')}</div>
          <div className="text-2xl font-bold">{pagination?.total ?? anomalies.length}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-xs uppercase text-slate-500">{tt('Critical / High')}</div>
          <div className="text-2xl font-bold">
            {(bySeverity.CRITICAL ?? 0) + (bySeverity.HIGH ?? 0)}
          </div>
        </div>
        <div className="rounded border p-4">
          <div className="text-xs uppercase text-slate-500">{tt('Repair batches')}</div>
          <div className="text-2xl font-bold">{batches.length}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-xs uppercase text-slate-500">{tt('Exceptions')}</div>
          <div className="text-2xl font-bold">{exceptions.length}</div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{tt('Anomaly registry')}</h2>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={filters.severity}
            onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))}
          >
            <option value="">{tt('All severities')}</option>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">{tt('All statuses')}</option>
            {[
              'DETECTED',
              'UNDER_INVESTIGATION',
              'EVIDENCE_INCOMPLETE',
              'READY_FOR_REVIEW',
              'APPROVED_FOR_REPAIR',
              'REPAIRED',
              'VERIFIED',
              'ACCEPTED_EXCEPTION',
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">{tt('Loading…')}</p>
        ) : anomalies.length === 0 ? (
          <p className="text-sm text-slate-500">{tt('No anomalies match the current filters.')}</p>
        ) : (
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">{tt('Code')}</th>
                  <th className="px-3 py-2">{tt('Type')}</th>
                  <th className="px-3 py-2">{tt('Severity')}</th>
                  <th className="px-3 py-2">{tt('Confidence')}</th>
                  <th className="px-3 py-2">{tt('Status')}</th>
                  <th className="px-3 py-2">Impact (minor)</th>
                  <th className="px-3 py-2">{tt('Detected')}</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{a.findingCode}</td>
                    <td className="px-3 py-2">{a.anomalyType}</td>
                    <td className="px-3 py-2">{badge(a.severity, severityTone(a.severity))}</td>
                    <td className="px-3 py-2 text-xs">{a.confidence}</td>
                    <td className="px-3 py-2">{badge(a.status, statusTone(a.status))}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {a.financialImpactMinor != null ? String(a.financialImpactMinor) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {new Date(a.discoveredAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{tt('Repair batches')}</h2>
        {batches.length === 0 ? (
          <p className="text-sm text-slate-500">{tt('No repair batches yet.')}</p>
        ) : (
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">{tt('Batch')}</th>
                  <th className="px-3 py-2">{tt('Category')}</th>
                  <th className="px-3 py-2">{tt('Status')}</th>
                  <th className="px-3 py-2">{tt('Actions')}</th>
                  <th className="px-3 py-2">{tt('Dry run')}</th>
                  <th className="px-3 py-2">{tt('Approved by')}</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{b.batchNumber}</td>
                    <td className="px-3 py-2">{b.repairCategory}</td>
                    <td className="px-3 py-2">{badge(b.status, statusTone(b.status))}</td>
                    <td className="px-3 py-2">{b.recordCount}</td>
                    <td className="px-3 py-2">{b.dryRun ? tt('yes') : tt('no')}</td>
                    <td className="px-3 py-2 text-xs">{b.approvedBy ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{tt('Exception register')}</h2>
        {exceptions.length === 0 ? (
          <p className="text-sm text-slate-500">{tt('No accepted exceptions.')}</p>
        ) : (
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">{tt('Type')}</th>
                  <th className="px-3 py-2">{tt('Status')}</th>
                  <th className="px-3 py-2">Amount (minor)</th>
                  <th className="px-3 py-2">{tt('Reason blocked')}</th>
                  <th className="px-3 py-2">{tt('Owner')}</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2">{e.anomalyType}</td>
                    <td className="px-3 py-2">{badge(e.status, statusTone(e.status))}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {e.amountMinor != null ? String(e.amountMinor) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">{e.reasonBlocked}</td>
                    <td className="px-3 py-2 text-xs">{e.responsibleOwner ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
