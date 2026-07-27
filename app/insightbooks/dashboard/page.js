'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Building2,
  CreditCard,
  Handshake,
  RefreshCw,
  Shield,
  Users,
} from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminSummaryCard,
  AdminLoadingState,
  AdminErrorState,
  AdminStatusBadge,
} from '@/components/admin';

function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString();
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tenantCount, setTenantCount] = useState(null);
  const [userCount, setUserCount] = useState(null);
  const [billing, setBilling] = useState(null);
  const [health, setHealth] = useState(null);
  const [affiliateCount, setAffiliateCount] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tenantsRes, usersRes, billingRes, healthRes, affRes] = await Promise.all([
        fetch('/api/admin/tenants', { credentials: 'include' }),
        fetch('/api/admin/users?page=1&limit=1', { credentials: 'include' }),
        fetch('/api/admin/platform-billing/overview', { credentials: 'include' }),
        fetch('/api/admin/system-health', { credentials: 'include' }),
        fetch('/api/admin/affiliate/stats', { credentials: 'include' }),
      ]);

      const tenantsBody = await tenantsRes.json().catch(() => ({}));
      const usersBody = await usersRes.json().catch(() => ({}));
      const billingBody = await billingRes.json().catch(() => ({}));
      const healthBody = await healthRes.json().catch(() => ({}));
      const affBody = await affRes.json().catch(() => ({}));

      if (!tenantsRes.ok && !usersRes.ok && !healthRes.ok) {
        throw new Error('Failed to load dashboard metrics');
      }

      setTenantCount(
        tenantsRes.ok
          ? Array.isArray(tenantsBody.tenants)
            ? tenantsBody.tenants.length
            : tenantsBody.total ?? null
          : null
      );
      setUserCount(
        usersRes.ok
          ? usersBody.pagination?.total ?? usersBody.total ?? usersBody.totalUsers ?? null
          : null
      );
      setBilling(billingRes.ok ? billingBody : null);
      setHealth(healthRes.ok ? healthBody : null);
      setAffiliateCount(
        affRes.ok
          ? affBody.stats?.totalAffiliates ?? affBody.totalAffiliates ?? null
          : null
      );
    } catch (e) {
      setError(e.message || 'Dashboard unavailable');
      setTenantCount(null);
      setUserCount(null);
      setBilling(null);
      setHealth(null);
      setAffiliateCount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const healthStatus = health?.status || (error ? null : 'unknown');
  const openInvoices =
    billing?.stats?.outstandingInvoiceCount ??
    billing?.summary?.openInvoices ??
    billing?.openInvoices ??
    null;
  const collectedPeriod =
    billing?.stats?.paymentsThisPeriod ?? billing?.summary?.mrr ?? billing?.mrr ?? null;

  const shortcuts = [
    { href: '/insightbooks/tenant-management', label: 'Tenants', icon: Building2 },
    { href: '/insightbooks/user-management', label: 'Users', icon: Users },
    { href: '/insightbooks/billing/overview', label: 'Billing', icon: CreditCard },
    { href: '/insightbooks/affiliate', label: 'Affiliates', icon: Handshake },
    { href: '/insightbooks/system-health', label: 'Health', icon: Activity },
    { href: '/insightbooks/audit', label: 'Audit', icon: Shield },
  ];

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Dashboard"
        description="Platform control-plane overview. Metrics are live; missing values show as em dash — never invented."
        actions={
          <button
            type="button"
            onClick={load}
            className="inline-flex h-11 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm font-medium text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
        }
      />

      {loading ? <AdminLoadingState label="Loading dashboard" /> : null}
      {!loading && error ? (
        <AdminErrorState title="Dashboard unavailable" message={error} onRetry={load} />
      ) : null}

      {!loading ? (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--admin-text-muted)]">System health</span>
            <AdminStatusBadge
              tone={
                healthStatus === 'healthy' || healthStatus === 'ok'
                  ? 'success'
                  : healthStatus === 'degraded'
                    ? 'warning'
                    : healthStatus
                      ? 'danger'
                      : 'neutral'
              }
            >
              {healthStatus || 'unavailable'}
            </AdminStatusBadge>
            {health?.checkedAt ? (
              <span className="text-xs text-[var(--admin-text-muted)]">
                Checked {new Date(health.checkedAt).toLocaleString()}
              </span>
            ) : null}
          </div>

          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <AdminSummaryCard
              label="Tenants"
              value={fmt(tenantCount)}
              icon={Building2}
              tone="neutral"
            />
            <AdminSummaryCard label="Users" value={fmt(userCount)} icon={Users} />
            <AdminSummaryCard
              label="Affiliates"
              value={fmt(affiliateCount)}
              icon={Handshake}
            />
            <AdminSummaryCard
              label="Open platform invoices"
              value={fmt(openInvoices)}
              icon={CreditCard}
              tone="info"
            />
            <AdminSummaryCard
              label="Payments this period"
              value={collectedPeriod == null ? '—' : `MWK ${fmt(collectedPeriod)}`}
              icon={CreditCard}
            />
            <AdminSummaryCard
              label="Email queue failed"
              value={fmt(health?.queues?.email?.failed ?? health?.jobs?.retryableFailedEmails)}
              icon={Activity}
              tone={
                (health?.queues?.email?.failed || 0) > 0 ? 'warning' : 'neutral'
              }
            />
          </div>

          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-[var(--admin-text)]">Quick navigation</h2>
            <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
              Jump to high-frequency control-plane surfaces.
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {shortcuts.map((s) => {
                const Icon = s.icon;
                return (
                  <li key={s.href}>
                    <button
                      type="button"
                      onClick={() => router.push(s.href)}
                      className="flex h-full min-h-11 w-full flex-col items-start gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] px-3 py-3 text-left text-sm font-medium text-[var(--admin-text)] hover:border-slate-300 hover:bg-white"
                    >
                      <Icon className="h-4 w-4 text-[var(--admin-text-muted)]" aria-hidden />
                      {s.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : null}
    </AdminPageContainer>
  );
}
