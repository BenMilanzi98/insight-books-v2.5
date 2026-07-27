'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminEmptyState,
  AdminStatusBadge,
  AdminDataTable,
  AdminSummaryCard,
} from '@/components/admin';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]';

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

  const columns = useMemo(
    () => [
      {
        key: 'check',
        header: 'Check',
        render: (c) => c.checkId || c.name || c.type,
      },
      {
        key: 'entity',
        header: 'Entity',
        render: (c) => (
          <span className="font-mono text-xs text-[var(--admin-text)]">
            {c.invoiceId || c.paymentId || c.tenantId || '—'}
          </span>
        ),
      },
      {
        key: 'expected',
        header: 'Expected',
        cellClassName: 'tabular-nums',
        render: (c) => c.expected ?? '—',
      },
      {
        key: 'actual',
        header: 'Actual',
        cellClassName: 'tabular-nums',
        render: (c) => c.actual ?? '—',
      },
      {
        key: 'variance',
        header: 'Variance',
        cellClassName: 'tabular-nums',
        render: (c) => c.variance ?? '—',
      },
      {
        key: 'severity',
        header: 'Severity',
        render: (c) => (
          <AdminStatusBadge
            tone={c.severity === 'critical' || c.severity === 'high' ? 'danger' : 'warning'}
          >
            {c.severity || 'medium'}
          </AdminStatusBadge>
        ),
      },
    ],
    []
  );

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Billing Reconciliation"
        description="Verifies platform invoice line math, payment allocations, and period uniqueness. Failures require remediation — never silent."
        actions={
          <button type="button" onClick={load} className={btnGhost}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Run checks
          </button>
        }
      />

      {summary ? (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <AdminSummaryCard label="Passed" value={summary.passed ?? '—'} tone="success" />
          <AdminSummaryCard
            label="Failed"
            value={summary.failed ?? checks.length}
            tone={(summary.failed ?? checks.length) > 0 ? 'danger' : 'neutral'}
          />
          <AdminSummaryCard
            label="Checked"
            value={summary.checkedAt ? new Date(summary.checkedAt).toLocaleString() : '—'}
          />
        </div>
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
        <AdminDataTable
          columns={columns}
          rows={checks}
          rowKey={(c, idx) => c.id || idx}
        />
      ) : null}
    </AdminPageContainer>
  );
}
