'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, CreditCard, Download, Handshake, RefreshCw, Upload } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminSummaryCard,
  AdminLoadingState,
  AdminErrorState,
} from '@/components/admin';

async function fetchReport(type) {
  const res = await adminFetch(`/api/admin/platform-reports?type=${encodeURIComponent(type)}`, {
    credentials: 'include',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Failed to load ${type} report (${res.status})`);
  }
  return body;
}

function StatusBreakdown({ byStatus }) {
  if (!byStatus || typeof byStatus !== 'object') return null;
  const entries = Object.entries(byStatus);
  if (!entries.length) return <p className="text-sm text-[var(--admin-text-muted)]">No status breakdown</p>;
  return (
    <ul className="mt-2 space-y-1 text-sm text-[var(--admin-text-muted)]">
      {entries.map(([status, count]) => (
        <li key={status} className="flex justify-between gap-4">
          <span className="capitalize">{status}</span>
          <span className="font-medium tabular-nums text-[var(--admin-text)]">{count}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PlatformReportsPage() {
  const { t } = useI18n();
  const [tenants, setTenants] = useState(null);
  const [subscriptions, setSubscriptions] = useState(null);
  const [affiliates, setAffiliates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({ tenants: '', subscriptions: '', affiliates: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setErrors({ tenants: '', subscriptions: '', affiliates: '' });

    const [t, s, a] = await Promise.allSettled([
      fetchReport('tenants'),
      fetchReport('subscriptions'),
      fetchReport('affiliates'),
    ]);

    if (t.status === 'fulfilled') {
      setTenants(t.value);
    } else {
      setTenants(null);
      setErrors((prev) => ({ ...prev, tenants: t.reason?.message || 'Failed to load tenants' }));
    }

    if (s.status === 'fulfilled') {
      setSubscriptions(s.value);
    } else {
      setSubscriptions(null);
      setErrors((prev) => ({
        ...prev,
        subscriptions: s.reason?.message || 'Failed to load subscriptions',
      }));
    }

    if (a.status === 'fulfilled') {
      setAffiliates(a.value);
    } else {
      setAffiliates(null);
      setErrors((prev) => ({
        ...prev,
        affiliates: a.reason?.message || 'Failed to load affiliates',
      }));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allFailed = !loading && !tenants && !subscriptions && !affiliates;

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.reports.title')}
        description="Real summary metrics for tenants, subscriptions, and affiliates. Errors do not show fake zeros."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/insightbooks/imports"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]"
            >
              <Upload className="h-4 w-4" aria-hidden />
              Import dry-run
            </Link>
            <button
              type="button"
              onClick={load}
              className="inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white hover:opacity-90"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </button>
          </div>
        }
      />

      {loading ? <AdminLoadingState label="Loading platform reports" /> : null}

      {!loading && allFailed ? (
        <AdminErrorState
          title="Reports unavailable"
          message={errors.tenants || errors.subscriptions || errors.affiliates}
          onRetry={load}
        />
      ) : null}

      {!loading && !allFailed ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-text)]">
                <Building2 className="h-4 w-4" aria-hidden />
                Tenants
              </h2>
              <a
                href="/api/admin/platform-reports?type=tenants&format=csv"
                className="inline-flex items-center gap-1 text-xs text-[var(--action-primary)] hover:underline"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV
              </a>
            </div>
            {errors.tenants ? (
              <AdminErrorState title="Tenants unavailable" message={errors.tenants} onRetry={load} />
            ) : (
              <>
                <AdminSummaryCard
                  label="Total tenants"
                  value={tenants?.summary?.total}
                  tone="neutral"
                />
                <StatusBreakdown byStatus={tenants?.summary?.byStatus} />
                {tenants?.generatedAt ? (
                  <p className="mt-3 text-xs text-[var(--admin-text-muted)]">
                    Generated {new Date(tenants.generatedAt).toLocaleString()}
                  </p>
                ) : null}
              </>
            )}
          </section>

          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-text)]">
                <CreditCard className="h-4 w-4" aria-hidden />
                Subscriptions
              </h2>
              <a
                href="/api/admin/platform-reports?type=subscriptions&format=csv"
                className="inline-flex items-center gap-1 text-xs text-[var(--action-primary)] hover:underline"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV
              </a>
            </div>
            {errors.subscriptions ? (
              <AdminErrorState
                title="Subscriptions unavailable"
                message={errors.subscriptions}
                onRetry={load}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <AdminSummaryCard
                    label="Account subscriptions"
                    value={subscriptions?.summary?.accountSubscriptions?.total}
                    hint={`${subscriptions?.summary?.accountSubscriptions?.active ?? '—'} active`}
                  />
                  <AdminSummaryCard
                    label="Branch subscriptions"
                    value={subscriptions?.summary?.branchSubscriptions?.total}
                    hint={`${subscriptions?.summary?.branchSubscriptions?.active ?? '—'} active`}
                  />
                </div>
                {subscriptions?.generatedAt ? (
                  <p className="mt-3 text-xs text-[var(--admin-text-muted)]">
                    Generated {new Date(subscriptions.generatedAt).toLocaleString()}
                  </p>
                ) : null}
              </>
            )}
          </section>

          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-text)]">
                <Handshake className="h-4 w-4" aria-hidden />
                Affiliates
              </h2>
              <a
                href="/api/admin/platform-reports?type=affiliates&format=csv"
                className="inline-flex items-center gap-1 text-xs text-[var(--action-primary)] hover:underline"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV
              </a>
            </div>
            {errors.affiliates ? (
              <AdminErrorState
                title="Affiliates unavailable"
                message={errors.affiliates}
                onRetry={load}
              />
            ) : (
              <>
                <AdminSummaryCard label="Total affiliates" value={affiliates?.summary?.total} />
                <StatusBreakdown byStatus={affiliates?.summary?.byStatus} />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <AdminSummaryCard label="Referrals" value={affiliates?.summary?.referrals} />
                  <AdminSummaryCard label="Payouts" value={affiliates?.summary?.payouts} />
                </div>
                {affiliates?.generatedAt ? (
                  <p className="mt-3 text-xs text-[var(--admin-text-muted)]">
                    Generated {new Date(affiliates.generatedAt).toLocaleString()}
                  </p>
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
