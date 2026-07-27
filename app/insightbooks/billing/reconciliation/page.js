'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminEmptyState,
  AdminStatusBadge,
} from '@/components/admin';

export default function AdminBillingReconciliationPage() {
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/platform-billing/reconciliation', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Reconciliation failed');
      setChecks(body.checks || body.failures || []);
      setSummary(body.summary || null);
    } catch (e) {
      setError(e.message || 'Failed to run reconciliation');
      setChecks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Billing Reconciliation"
        description="Verifies platform invoice line math, payment allocations, and period uniqueness. Failures require remediation — never silent."
        actions={
          <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm">
            <RefreshCw className="h-4 w-4" /> Run checks
          </button>
        }
      />

      {summary ? (
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Passed {summary.passed ?? '—'} · Failed {summary.failed ?? checks.length} · Checked{' '}
          {summary.checkedAt ? new Date(summary.checkedAt).toLocaleString() : '—'}
        </p>
      ) : null}

      {loading ? <AdminLoadingState label="Running reconciliation" /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && checks.length === 0 ? (
        <AdminEmptyState
          title="All checks passed"
          description="No platform billing variances detected for the scanned set."
        />
      ) : null}

      {!loading && !error && checks.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Check</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Expected</th>
                <th className="px-4 py-3">Actual</th>
                <th className="px-4 py-3">Variance</th>
                <th className="px-4 py-3">Severity</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c, idx) => (
                <tr key={c.id || idx} className="border-t">
                  <td className="px-4 py-3">{c.checkId || c.name || c.type}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {c.invoiceId || c.paymentId || c.tenantId || '—'}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{c.expected ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{c.actual ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{c.variance ?? '—'}</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge
                      tone={
                        c.severity === 'critical' || c.severity === 'high'
                          ? 'danger'
                          : 'warning'
                      }
                    >
                      {c.severity || 'medium'}
                    </AdminStatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
