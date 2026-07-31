'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';

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
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--admin-accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';

export default function AdminBillingReconciliationPage() {
  const { t } = useI18n();
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);

  const [backfillPlan, setBackfillPlan] = useState(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillError, setBackfillError] = useState('');
  const [backfillResult, setBackfillResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/platform-billing/reconciliation', {
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

  const loadBackfillPlan = useCallback(async () => {
    setBackfillLoading(true);
    setBackfillError('');
    setBackfillResult(null);
    try {
      const res = await adminFetch(
        '/api/admin/platform-billing/paychangu-backfill?limit=100',
        { credentials: 'include' }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to plan backfill');
      setBackfillPlan(body);
    } catch (e) {
      setBackfillError(e.message || 'Failed to plan PayChangu backfill');
      setBackfillPlan(null);
    } finally {
      setBackfillLoading(false);
    }
  }, []);

  const executeBackfill = useCallback(async () => {
    const count = backfillPlan?.summary?.eligible ?? backfillPlan?.actions?.length ?? 0;
    if (!count) return;
    const ok = window.confirm(
      `Create ${Math.min(count, 50)} missing PlatformInvoice/Payment rows from historical PayChangu subscriptions? This is idempotent but writes the platform ledger.`
    );
    if (!ok) return;

    setBackfillBusy(true);
    setBackfillError('');
    try {
      const res = await adminFetch('/api/admin/platform-billing/paychangu-backfill', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false, limit: 100, maxExecute: 50 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Backfill execute failed');
      setBackfillResult(body);
      await loadBackfillPlan();
      await load();
    } catch (e) {
      setBackfillError(e.message || 'Backfill execute failed');
    } finally {
      setBackfillBusy(false);
    }
  }, [backfillPlan, load, loadBackfillPlan]);

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

  const backfillActions = backfillPlan?.actions || [];
  const toCreate = backfillPlan?.summary?.eligible ?? backfillActions.length;
  const unmatchedOrphans = backfillPlan?.unmatchedOrphans || [];
  const rs = backfillResult?.resultSummary;
  const createdCount = rs?.succeeded ?? (backfillResult?.executed || []).filter((r) => r.ok).length;
  const executeErrorCount = rs?.failed ?? backfillResult?.errors?.length ?? 0;
  const createdInvoices = rs?.createdInvoices ?? 0;
  const linkedPayments = rs?.linkedPayments ?? 0;

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.billing.reconciliation.title')}
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

      <section className="mt-10 border-t border-[var(--admin-border)] pt-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--admin-text)]">
              PayChangu ledger backfill
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--admin-text-muted)]">
              Dry-run scans paid account/branch subscriptions for missing or unlinked
              PlatformInvoice/Payment rows, then optionally repairs them (idempotent).
              Unmatched orphan payments are reported only — never invents invoices.
              Requires reconciliation permission to execute.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadBackfillPlan}
              disabled={backfillLoading || backfillBusy}
              className={btnGhost}
            >
              {backfillLoading ? 'Planning…' : 'Dry-run plan'}
            </button>
            <button
              type="button"
              onClick={executeBackfill}
              disabled={!toCreate || backfillLoading || backfillBusy}
              className={btnPrimary}
            >
              {backfillBusy ? 'Executing…' : `Execute (max 50)`}
            </button>
          </div>
        </div>

        {backfillError ? (
          <p className="mb-3 text-sm text-[var(--admin-danger)]" role="alert">
            {backfillError}
          </p>
        ) : null}

        {backfillResult && backfillResult.dryRun === false ? (
          <p className="mb-3 text-sm text-[var(--admin-text)]">
            Last execute: succeeded {createdCount}, invoices created {createdInvoices}, payments
            linked {linkedPayments}, errors {executeErrorCount}.
          </p>
        ) : null}

        {backfillPlan ? (
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <AdminSummaryCard label="Actions" value={toCreate} tone={toCreate ? 'warning' : 'success'} />
            <AdminSummaryCard
              label="Skipped"
              value={backfillPlan.summary?.skipped ?? backfillPlan.skipped?.length ?? 0}
            />
            <AdminSummaryCard
              label="Examined"
              value={backfillPlan.summary?.examined ?? '—'}
            />
            <AdminSummaryCard
              label="Unmatched orphans"
              value={backfillPlan.summary?.unmatchedOrphans ?? unmatchedOrphans.length}
              tone={unmatchedOrphans.length ? 'warning' : 'neutral'}
            />
          </div>
        ) : null}

        {backfillActions.length > 0 ? (
          <AdminDataTable
            columns={[
              {
                key: 'subscription',
                header: 'Subscription',
                render: (a) => (
                  <span className="font-mono text-xs">{a.subscriptionId}</span>
                ),
              },
              {
                key: 'source',
                header: 'Source',
                render: (a) => a.source || 'account',
              },
              {
                key: 'tenant',
                header: 'Tenant',
                render: (a) => (
                  <span className="font-mono text-xs">{a.tenantId}</span>
                ),
              },
              {
                key: 'amount',
                header: 'Amount',
                cellClassName: 'tabular-nums',
                render: (a) => a.amount ?? '—',
              },
              {
                key: 'action',
                header: 'Action',
                render: (a) => a.action || 'create_ledger',
              },
            ]}
            rows={backfillActions.slice(0, 25)}
            rowKey={(a, idx) => `${a.source || 'a'}-${a.subscriptionId || idx}`}
          />
        ) : null}

        {unmatchedOrphans.length > 0 ? (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-[var(--admin-text)]">
              Unmatched orphan payments (manual review)
            </h3>
            <AdminDataTable
              columns={[
                {
                  key: 'payment',
                  header: 'Payment',
                  render: (o) => (
                    <span className="font-mono text-xs">{o.paymentId}</span>
                  ),
                },
                {
                  key: 'ref',
                  header: 'Gateway ref',
                  render: (o) => (
                    <span className="font-mono text-xs">{o.gatewayReference}</span>
                  ),
                },
                {
                  key: 'reason',
                  header: 'Reason',
                  render: (o) => o.reason,
                },
              ]}
              rows={unmatchedOrphans.slice(0, 25)}
              rowKey={(o, idx) => o.paymentId || idx}
            />
          </div>
        ) : null}
      </section>
    </AdminPageContainer>
  );
}
