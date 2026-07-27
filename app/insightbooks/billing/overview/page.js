'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard, FileText, RefreshCw, Wallet } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminSummaryCard,
  AdminLoadingState,
  AdminErrorState,
} from '@/components/admin';

function money(amount, currency = 'MWK') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${currency} —`;
  return `${currency} ${n.toLocaleString()}`;
}

export default function AdminBillingOverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/platform-billing/overview', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      setData(body);
    } catch (e) {
      setData(null);
      setError(e.message || 'Failed to load billing overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const s = data?.stats;
  const currency = data?.currency || 'MWK';

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Billing Overview"
        description="InsightBooks platform SaaS billing — not tenant customer AR revenue."
        actions={
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
        }
      />

      {loading ? <AdminLoadingState label="Loading platform billing" /> : null}
      {!loading && error ? (
        <AdminErrorState title="Billing overview unavailable" message={error} onRetry={load} />
      ) : null}

      {!loading && !error && s ? (
        <>
          <p className="mb-4 text-xs text-[var(--text-muted)]">
            Source: {data.source} · Checked {new Date(data.checkedAt).toLocaleString()}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminSummaryCard
              label="Collected this period"
              value={money(s.paymentsThisPeriod, currency)}
              href="/insightbooks/billing/payments"
              icon={Wallet}
              tone="success"
            />
            <AdminSummaryCard
              label="Outstanding"
              value={money(s.outstandingTotal, currency)}
              hint={`${s.outstandingInvoiceCount} invoices`}
              href="/insightbooks/billing/invoices"
              icon={FileText}
              tone="warning"
            />
            <AdminSummaryCard
              label="Overdue invoices"
              value={s.overdueInvoiceCount}
              href="/insightbooks/billing/invoices"
              icon={FileText}
              tone={s.overdueInvoiceCount > 0 ? 'danger' : 'neutral'}
            />
            <AdminSummaryCard
              label="Active subscriptions"
              value={s.activeSubscriptions}
              href="/insightbooks/billing/subscriptions"
              icon={CreditCard}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminSummaryCard
              label="Billed (all time)"
              value={money(s.billedTotal, currency)}
            />
            <AdminSummaryCard
              label="Collected (all time)"
              value={money(s.collectedAllTime, currency)}
              tone="success"
            />
            <AdminSummaryCard label="Open credits" value={s.openCredits} href="/insightbooks/billing/credits" />
            <AdminSummaryCard
              label="Refunds this period"
              value={money(s.refundsThisPeriod, currency)}
              href="/insightbooks/billing/credits"
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link className="text-[var(--action-primary)] hover:underline" href="/insightbooks/billing/plans">
              Plans
            </Link>
            <Link className="text-[var(--action-primary)] hover:underline" href="/insightbooks/billing/reconciliation">
              Reconciliation
            </Link>
            <Link className="text-[var(--action-primary)] hover:underline" href="/insightbooks/billing/invoices">
              Invoices
            </Link>
            <Link className="text-[var(--action-primary)] hover:underline" href="/insightbooks/billing/payments">
              Payments
            </Link>
          </div>
        </>
      ) : null}
    </AdminPageContainer>
  );
}
