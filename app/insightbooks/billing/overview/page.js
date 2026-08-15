'use client';
import { tt } from '@/lib/i18n/runtime';

import { adminFetch } from '@/lib/admin/adminApi';

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
import { useI18n } from '@/components/i18n/I18nProvider';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]';

function money(amount, currency = 'MWK') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${currency} —`;
  return `${currency} ${n.toLocaleString()}`;
}

export default function AdminBillingOverviewPage() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/platform-billing/overview', {
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
        title={t('admin-pages.billing.overview.title')}
        description={t('admin-pages.billing.overview.description')}
        actions={
          <button type="button" onClick={load} className={btnGhost}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            {tt('Refresh')}
          </button>
        }
      />

      {loading ? <AdminLoadingState label="Loading platform billing" /> : null}
      {!loading && error ? (
        <AdminErrorState title="Billing overview unavailable" message={error} onRetry={load} />
      ) : null}

      {!loading && !error && s ? (
        <>
          <p className="mb-4 text-xs text-[var(--admin-text-muted)]">
            Source: {data.source} · Checked {new Date(data.checkedAt).toLocaleString()}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminSummaryCard
              label={t('admin-pages.dashboard.paymentsPeriod')}
              value={money(s.paymentsThisPeriod, currency)}
              href="/insightbooks/billing/payments"
              icon={Wallet}
              tone="success"
            />
            <AdminSummaryCard
              label={t('admin-pages.dashboard.mrr')}
              value={money(s.estimatedMrr ?? data?.saasKpis?.estimatedMrr, currency)}
              hint={t('admin-pages.dashboard.mrrHint')}
              href="/insightbooks/billing/subscriptions"
              icon={CreditCard}
              tone="success"
            />
            <AdminSummaryCard
              label={t('admin-pages.dashboard.outstanding')}
              value={money(s.outstandingTotal, currency)}
              hint={`${s.outstandingInvoiceCount} invoices`}
              href="/insightbooks/billing/invoices"
              icon={FileText}
              tone="warning"
            />
            <AdminSummaryCard
              label={t('admin-pages.dashboard.activeSubs')}
              value={s.activePaidSubscriptions ?? s.activeSubscriptions}
              hint={
                s.distinctActivePaidTenants != null
                  ? `${s.distinctActivePaidTenants} tenants`
                  : null
              }
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
              {tt('Plans')}
            </Link>
            <Link className="text-[var(--action-primary)] hover:underline" href="/insightbooks/billing/reconciliation">
              {tt('Reconciliation')}
            </Link>
            <Link className="text-[var(--action-primary)] hover:underline" href="/insightbooks/billing/invoices">
              {tt('Invoices')}
            </Link>
            <Link className="text-[var(--action-primary)] hover:underline" href="/insightbooks/billing/payments">
              {tt('Payments')}
            </Link>
          </div>
        </>
      ) : null}
    </AdminPageContainer>
  );
}
