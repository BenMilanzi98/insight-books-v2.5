'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

/**
 * Report integrity status — surfaces ledger/COA/journal mismatches.
 */
export default function ReportIntegrityPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reports/integrity');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Integrity check failed');
      setResult(data);
    } catch (err) {
      setError(err.message || 'Integrity check failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  const status = result?.status || (error ? 'error' : 'loading');
  const icon =
    status === 'ok' ? (
      <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
    ) : status === 'warning' ? (
      <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
    ) : (
      <ShieldAlert className="h-5 w-5 text-red-600" aria-hidden />
    );

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      aria-label="Report integrity status"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Report Integrity</h3>
            <p className="text-xs text-slate-500">
              Ledger-backed reconciliation — Chart of Accounts vs General Ledger vs journals
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={runCheck}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Re-run check'}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-slate-700">
            Status:{' '}
            <span className="font-medium capitalize">{result.status}</span>
            {' · '}
            {result.issueCount} issue{result.issueCount === 1 ? '' : 's'}
            {result.warningCount > 0 && ` · ${result.warningCount} warning(s)`}
          </p>
          {result.issues?.length > 0 && (
            <ul className="max-h-40 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs text-red-800">
              {result.issues.slice(0, 8).map((issue, i) => (
                <li key={`${issue.code}-${i}`} className="mb-1">
                  <span className="font-semibold">{issue.code}:</span> {issue.message}
                </li>
              ))}
              {result.issues.length > 8 && (
                <li className="text-red-600">…and {result.issues.length - 8} more</li>
              )}
            </ul>
          )}
          {result.warnings?.length > 0 && result.issues?.length === 0 && (
            <ul className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              {result.warnings.map((w, i) => (
                <li key={`${w.code}-${i}`}>{w.message}</li>
              ))}
            </ul>
          )}
          {result.status === 'ok' && (
            <p className="text-xs text-emerald-700">
              No integrity issues detected. Reports are aligned with posted ledger entries.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
