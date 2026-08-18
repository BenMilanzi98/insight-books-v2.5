'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  AdminChartCard,
  AdminPieChart,
  AdminTrendChart,
  AdminBarChart,
} from '@/components/admin';
import { adminApi } from '@/lib/admin/adminApi';
import { useI18n } from '@/components/i18n/I18nProvider';

function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString();
}

function fmtMoney(n, currency = 'MWK') {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${currency} ${Number(n).toLocaleString()}`;
}

function growthHint(v) {
  if (v == null || v === '' || Number.isNaN(Number(v))) return null;
  const n = Number(v);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n}% vs prior period`;
}

function isSuccessfulPayment(status) {
  const s = String(status || '').toUpperCase();
  return s === 'SUCCEEDED' || s === 'SUCCESS' || s === 'PAID' || s === 'COMPLETED';
}

function bucketPayments(payments, rangeDays) {
  const now = Date.now();
  const start = now - rangeDays * 24 * 60 * 60 * 1000;
  const byDay = new Map();

  for (const p of payments || []) {
    if (!isSuccessfulPayment(p.status)) continue;
    const t = new Date(p.paidAt || p.createdAt).getTime();
    if (Number.isNaN(t) || t < start) continue;
    const d = new Date(t);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    byDay.set(key, (byDay.get(key) || 0) + (Number(p.amount) || 0));
  }

  // Fill gaps so the chart reads as a continuous series
  const points = [];
  for (let i = rangeDays - 1; i >= 0; i -= 1) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    points.push({
      key,
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: byDay.get(key) || 0,
    });
  }
  return points;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState('');
  const [range, setRange] = useState(30);
  const [refreshedAt, setRefreshedAt] = useState(null);

  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState('');
  const [growth, setGrowth] = useState(null);
  const [growthError, setGrowthError] = useState('');
  const [billing, setBilling] = useState(null);
  const [billingError, setBillingError] = useState('');
  const [payments, setPayments] = useState([]);
  const [paymentsError, setPaymentsError] = useState('');
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState('');
  const [userStats, setUserStats] = useState(null);
  const [userStatsError, setUserStatsError] = useState('');
  const [affiliates, setAffiliates] = useState(null);
  const [affiliatesError, setAffiliatesError] = useState('');
  const [kpiPack, setKpiPack] = useState(null);
  const [kpiPackError, setKpiPackError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setFatal('');
    setStatsError('');
    setGrowthError('');
    setBillingError('');
    setPaymentsError('');
    setHealthError('');
    setUserStatsError('');
    setAffiliatesError('');
    setKpiPackError('');

    try {
      const [
        statsRes,
        growthRes,
        billingRes,
        paymentsRes,
        healthRes,
        usersRes,
        affRes,
        kpiRes,
      ] = await Promise.all([
        adminApi('/api/admin/dashboard/stats', { throwOnError: false }),
        adminApi('/api/admin/dashboard/tenant-growth?groupBy=month', { throwOnError: false }),
        adminApi('/api/admin/platform-billing/overview', { throwOnError: false }),
        adminApi('/api/admin/platform-billing/payments?limit=200', { throwOnError: false }),
        adminApi('/api/admin/system-health', { throwOnError: false }),
        adminApi('/api/admin/users/stats', { throwOnError: false }),
        adminApi('/api/admin/affiliate/stats', { throwOnError: false }),
        adminApi('/api/admin/intelligence/executive/overview?days=30', {
          throwOnError: false,
        }),
      ]);

      const statsBody = statsRes.data || {};
      const growthBody = growthRes.data || {};
      const billingBody = billingRes.data || {};
      const paymentsBody = paymentsRes.data || {};
      const healthBody = healthRes.data || {};
      const usersBody = usersRes.data || {};
      const affBody = affRes.data || {};

      if (!statsRes.ok && !billingRes.ok && !healthRes.ok && !growthRes.ok) {
        throw new Error(t('admin-foundation.errors.generic'));
      }

      if (statsRes.ok && statsBody.success !== false) {
        setStats(statsBody.stats || statsBody);
      } else {
        setStats(null);
        setStatsError(statsRes.error?.message || statsBody.error || 'Stats unavailable');
      }

      if (growthRes.ok && growthBody.success !== false) {
        setGrowth(growthBody);
      } else {
        setGrowth(null);
        setGrowthError(growthRes.error?.message || growthBody.error || 'Tenant mix unavailable');
      }

      if (billingRes.ok && billingBody.success !== false) {
        setBilling(billingBody);
      } else {
        setBilling(null);
        setBillingError(billingRes.error?.message || billingBody.error || 'Billing unavailable');
      }

      if (paymentsRes.ok && paymentsBody.success !== false) {
        setPayments(Array.isArray(paymentsBody.payments) ? paymentsBody.payments : []);
      } else {
        setPayments([]);
        setPaymentsError(
          paymentsRes.error?.message || paymentsBody.error || 'Payment trend unavailable'
        );
      }

      if (healthRes.ok) {
        setHealth(healthBody);
      } else {
        setHealth(null);
        setHealthError(healthRes.error?.message || healthBody.error || 'Health unavailable');
      }

      if (usersRes.ok) {
        setUserStats(usersBody);
      } else {
        setUserStats(null);
        setUserStatsError(usersRes.error?.message || usersBody.error || 'User growth unavailable');
      }

      if (affRes.ok) {
        setAffiliates(affBody);
      } else {
        setAffiliates(null);
        setAffiliatesError(affRes.error?.message || affBody.error || 'Affiliate stats unavailable');
      }

      const kpiBody = kpiRes.data || {};
      if (kpiRes.ok && kpiBody.success !== false && kpiBody.metrics) {
        setKpiPack(kpiBody);
      } else {
        setKpiPack(null);
        setKpiPackError(
          kpiRes.error?.message || kpiBody.error || 'Executive KPI pack unavailable'
        );
      }

      setRefreshedAt(new Date());
    } catch (e) {
      setFatal(e.message || t('admin-foundation.errors.generic'));
      setStats(null);
      setGrowth(null);
      setBilling(null);
      setPayments([]);
      setHealth(null);
      setUserStats(null);
      setAffiliates(null);
      setKpiPack(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const packMetric = (code) => {
    const m = kpiPack?.metrics?.[code];
    if (!m) return null;
    const ready =
      typeof m.status === 'string' &&
      (m.status.startsWith('READY') ||
        m.status === 'STALE' ||
        m.status === 'RECON_FAILED');
    if (!ready || m.value == null) return { unavailable: true, metric: m };
    return { unavailable: false, metric: m, value: m.value };
  };

  const mrrPack = packMetric('platform.mrr.estimated');
  const paymentsPack = packMetric('platform.payments.collected_period');
  const tenantsPack = packMetric('tenants.total');
  const usersPack = packMetric('users.total');
  const subsPack = packMetric('subscriptions.active');

  const currency =
    mrrPack?.metric?.currency || billing?.currency || 'MWK';
  const tenantTotal =
    tenantsPack && !tenantsPack.unavailable
      ? tenantsPack.value
      : growth?.summary?.total ?? growth?.summary?.totalTenants ?? stats?.totalTenants ?? null;
  const userTotal =
    usersPack && !usersPack.unavailable
      ? usersPack.value
      : userStats?.overview?.totalUsers ?? stats?.totalUsers ?? null;
  const activeSubs =
    subsPack && !subsPack.unavailable
      ? subsPack.value
      : billing?.stats?.activeSubscriptions ?? stats?.activeSubscriptions ?? null;
  const mrrMasked = Boolean(mrrPack?.metric?.masked);
  const mrr =
    mrrPack && !mrrPack.unavailable && !mrrMasked ? mrrPack.value : null;
  const mrrUnavailable = Boolean(
    kpiPackError || !mrrPack || mrrPack.unavailable
  );
  const paymentsPeriod =
    paymentsPack && !paymentsPack.unavailable
      ? paymentsPack.metric.masked
        ? null
        : paymentsPack.value
      : billing?.stats?.paymentsThisPeriod ?? null;
  const openInvoices = billing?.stats?.outstandingInvoiceCount ?? null;
  const affiliateCount =
    affiliates?.stats?.totalAffiliates ?? affiliates?.totalAffiliates ?? null;

  const healthStatus = health?.status || (healthError ? null : 'unknown');
  const emailFailed =
    health?.queues?.email?.failed ?? health?.jobs?.retryableFailedEmails ?? null;
  const memoryMb = health?.process?.memoryRssMb ?? stats?.performanceMetrics?.memoryRssMb ?? null;
  const uptimeSec =
    health?.process?.uptimeSeconds ?? stats?.performanceMetrics?.processUptimeSeconds ?? null;

  const pieBreakdown = useMemo(() => {
    const summary = growth?.summary;
    if (!summary) return [];
    return [
      {
        name: 'Active',
        value: summary.active ?? summary.activeTenants ?? 0,
        color: '#10b981',
      },
      {
        name: 'Trial',
        value: summary.trial ?? summary.trialCount ?? 0,
        color: '#0ea5e9',
      },
      {
        name: 'Inactive',
        value: summary.inactive ?? summary.inactiveTenants ?? 0,
        color: '#f59e0b',
      },
    ];
  }, [growth]);

  const pieHasTenants = pieBreakdown.some((s) => s.value > 0);

  const trendData = useMemo(() => bucketPayments(payments, range), [payments, range]);
  const trendHasSignal = trendData.some((p) => p.value > 0);

  const barData = useMemo(() => {
    const series = userStats?.growth?.monthlyGrowth;
    if (Array.isArray(series) && series.length) {
      return series.map((r) => ({
        label: r.month,
        users: r.count || 0,
      }));
    }
    const ts = growth?.timeSeries;
    if (Array.isArray(ts) && ts.length) {
      return ts.slice(-6).map((r) => ({
        label: r.label,
        users: r.all || 0,
      }));
    }
    return [];
  }, [userStats, growth]);

  const activity = useMemo(() => {
    const list = stats?.recentActivity;
    return Array.isArray(list) ? list.slice(0, 8) : [];
  }, [stats]);

  const shortcuts = [
    {
      href: '/insightbooks/tenant-management',
      label: 'Tenants',
      icon: Building2,
      tone: 'from-sky-50 to-sky-100 border-sky-200 text-sky-800',
      iconTone: 'text-sky-600',
    },
    {
      href: '/insightbooks/user-management',
      label: 'Users',
      icon: Users,
      tone: 'from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-800',
      iconTone: 'text-indigo-600',
    },
    {
      href: '/insightbooks/intelligence/executive',
      label: 'Intelligence',
      icon: Activity,
      tone: 'from-teal-50 to-teal-100 border-teal-200 text-teal-800',
      iconTone: 'text-teal-600',
    },
    {
      href: '/insightbooks/billing/overview',
      label: 'Billing',
      icon: CreditCard,
      tone: 'from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-800',
      iconTone: 'text-emerald-600',
    },
    {
      href: '/insightbooks/affiliate',
      label: 'Affiliates',
      icon: Handshake,
      tone: 'from-cyan-50 to-cyan-100 border-cyan-200 text-cyan-800',
      iconTone: 'text-cyan-600',
    },
    {
      href: '/insightbooks/system-health',
      label: 'Health',
      icon: Activity,
      tone: 'from-amber-50 to-amber-100 border-amber-200 text-amber-900',
      iconTone: 'text-amber-600',
    },
    {
      href: '/insightbooks/audit',
      label: 'Audit',
      icon: Shield,
      tone: 'from-rose-50 to-rose-100 border-rose-200 text-rose-800',
      iconTone: 'text-rose-600',
    },
  ];

  const rangeButtons = [
    { days: 7, label: '7d' },
    { days: 30, label: '30d' },
    { days: 90, label: '90d' },
  ];

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.dashboard.title')}
        description={t('admin-pages.dashboard.description')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {refreshedAt ? (
              <span className="text-xs text-[var(--admin-text-muted)]">
                Updated {refreshedAt.toLocaleTimeString()}
              </span>
            ) : null}
            <button
              type="button"
              onClick={load}
              className="admin-btn-primary inline-flex h-11 items-center gap-2 rounded-[var(--admin-radius)] px-3.5 text-sm font-semibold"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              {tt('Refresh')}
            </button>
          </div>
        }
      />

      {loading && !stats && !billing && !health ? (
        <AdminLoadingState label={t('admin-pages.dashboard.loading')} />
      ) : null}

      {!loading && fatal ? (
        <AdminErrorState
          title={t('admin-pages.dashboard.unavailable')}
          message={fatal}
          onRetry={load}
        />
      ) : null}

      {!fatal ? (
        <>
          <div className="admin-stagger mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <AdminSummaryCard
              label="Tenants"
              value={fmt(tenantTotal)}
              hint={growthHint(stats?.tenantGrowth)}
              icon={Building2}
              tone="info"
              href="/insightbooks/tenant-management"
              error={Boolean(statsError && growthError)}
            />
            <AdminSummaryCard
              label="Users"
              value={fmt(userTotal)}
              hint={growthHint(stats?.userGrowth)}
              icon={Users}
              tone="neutral"
              href="/insightbooks/user-management"
              error={Boolean(statsError && userStatsError)}
            />
            <AdminSummaryCard
              label={t('admin-pages.dashboard.activeSubs')}
              value={fmt(activeSubs)}
              icon={CreditCard}
              tone="success"
              href="/insightbooks/billing/subscriptions"
              error={Boolean(billingError && statsError)}
            />
            <AdminSummaryCard
              label={t('admin-pages.dashboard.mrr')}
              value={
                mrrMasked
                  ? '••••'
                  : mrrUnavailable
                    ? '—'
                    : fmtMoney(mrr, currency)
              }
              hint={
                mrrUnavailable
                  ? mrrPack?.metric?.reasonMessage ||
                    kpiPackError ||
                    t('admin-pages.common.unavailable')
                  : paymentsPeriod != null
                    ? `${t('admin-pages.dashboard.paymentsPeriod')}: ${fmtMoney(paymentsPeriod, currency)}`
                    : t('admin-pages.dashboard.mrrHint')
              }
              icon={CreditCard}
              tone="success"
              href="/insightbooks/intelligence/executive/financial"
              error={mrrUnavailable && !mrrMasked}
            />
            <AdminSummaryCard
              label={t('admin-pages.dashboard.outstanding')}
              value={fmt(openInvoices)}
              hint={
                billing?.stats?.outstandingTotal != null
                  ? fmtMoney(billing.stats.outstandingTotal, currency)
                  : null
              }
              icon={CreditCard}
              tone="warning"
              href="/insightbooks/billing/invoices"
              error={Boolean(billingError)}
            />
            <AdminSummaryCard
              label="Affiliates"
              value={fmt(affiliateCount)}
              icon={Handshake}
              tone="info"
              href="/insightbooks/affiliate"
              error={Boolean(affiliatesError)}
            />
          </div>

          <section className="admin-lift mb-6 overflow-hidden rounded-[var(--admin-radius)] border border-cyan-200 bg-gradient-to-br from-white via-sky-50 to-emerald-50 p-4 shadow-[var(--admin-shadow-card)] sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-semibold text-[var(--admin-text)]">{tt('Ops health')}</h2>
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
                {healthError ? 'unavailable' : healthStatus || 'unknown'}
              </AdminStatusBadge>
              {health?.checkedAt ? (
                <span className="text-xs text-[var(--admin-text-muted)]">
                  Checked {new Date(health.checkedAt).toLocaleString()}
                </span>
              ) : null}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-[var(--admin-radius)] bg-[var(--admin-surface-muted)] px-3 py-2.5">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">
                  {tt('Email queue failed')}
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--admin-text)]">
                  {fmt(emailFailed)}
                </dd>
              </div>
              <div className="rounded-[var(--admin-radius)] bg-[var(--admin-surface-muted)] px-3 py-2.5">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">
                  {tt('Memory RSS')}
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--admin-text)]">
                  {memoryMb != null ? `${fmt(memoryMb)} MB` : '—'}
                </dd>
              </div>
              <div className="rounded-[var(--admin-radius)] bg-[var(--admin-surface-muted)] px-3 py-2.5">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">
                  {tt('Process uptime')}
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--admin-text)]">
                  {uptimeSec != null ? `${Math.floor(uptimeSec / 3600)}h` : '—'}
                </dd>
              </div>
              <div className="rounded-[var(--admin-radius)] bg-[var(--admin-surface-muted)] px-3 py-2.5">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">
                  {tt('Overdue invoices')}
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--admin-text)]">
                  {fmt(billing?.stats?.overdueInvoiceCount)}
                </dd>
              </div>
            </dl>
          </section>

          <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-5">
            <AdminChartCard
              className="xl:col-span-2"
              accent="emerald"
              title={tt('Tenant mix')}
              description="Active, trial, and inactive tenants by subscription status."
              loading={loading && !growth}
              error={growthError || undefined}
              empty={!pieHasTenants}
              emptyTitle="No tenant mix"
              emptyDescription="Tenant growth data is empty."
              onRetry={load}
              heightClass="h-auto min-h-72"
            >
              <AdminPieChart
                data={pieBreakdown}
                breakdown={pieBreakdown}
                centerLabel="Tenants"
              />
            </AdminChartCard>

            <AdminChartCard
              className="xl:col-span-3"
              accent="sky"
              title={t('admin-pages.billing.payments.title')}
              description="Successful InsightBooks SaaS collections (not tenant customer AR)."
              loading={loading && !payments.length && !paymentsError}
              error={paymentsError || undefined}
              empty={!trendHasSignal}
              emptyTitle="No payments in range"
              emptyDescription="No successful platform payments for the selected window."
              onRetry={load}
              actions={
                <div className="inline-flex rounded-[var(--admin-radius)] border border-sky-200 bg-sky-50/80 p-0.5">
                  {rangeButtons.map((r) => (
                    <button
                      key={r.days}
                      type="button"
                      onClick={() => setRange(r.days)}
                      className={`h-8 rounded-[calc(var(--admin-radius)-2px)] px-2.5 text-xs font-medium transition-colors ${
                        range === r.days
                          ? 'bg-gradient-to-r from-sky-600 to-teal-600 text-white shadow-sm'
                          : 'text-[var(--admin-text-muted)] hover:bg-white hover:text-[var(--admin-text)]'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              }
            >
              <AdminTrendChart
                data={trendData}
                yName="Collected"
                valueFormatter={(v) => fmtMoney(v, currency)}
              />
            </AdminChartCard>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-5">
            <AdminChartCard
              className="xl:col-span-3"
              accent="amber"
              title={tt('User growth')}
              description="New users created per month (last 6 months)."
              loading={loading && !userStats && !growth}
              error={userStatsError && growthError ? userStatsError : undefined}
              empty={!barData.length}
              emptyTitle="No growth series"
              emptyDescription="User or tenant growth history is unavailable."
              onRetry={load}
            >
              <AdminBarChart
                data={barData}
                bars={[
                  {
                    key: 'users',
                    name: userStats?.growth?.monthlyGrowth ? 'New users' : 'New tenants',
                    color: 'var(--admin-chart-1)',
                  },
                ]}
              />
            </AdminChartCard>

            <section className="admin-lift xl:col-span-2 overflow-hidden rounded-[var(--admin-radius)] border border-amber-200 bg-gradient-to-b from-white to-amber-50/50 p-4 shadow-[var(--admin-shadow-card)] sm:p-5">
              <div className="mb-1 h-1 w-12 rounded-full bg-gradient-to-r from-amber-400 to-orange-400" aria-hidden />
              <h2 className="text-sm font-semibold text-[var(--admin-text)]">{tt('Recent activity')}</h2>
              <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">
                {tt('Latest control-plane events from dashboard stats.')}
              </p>
              {loading && !activity.length ? (
                <AdminLoadingState label="Loading activity" className="mt-4" />
              ) : activity.length ? (
                <ul className="mt-4 space-y-2">
                  {activity.map((item, i) => (
                    <li
                      key={item.id || `${item.action}-${i}`}
                      className="admin-row-reveal rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)]/60 px-3 py-2.5"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="text-sm font-medium text-[var(--admin-text)]">
                        {item.action || item.type || 'Event'}
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--admin-text-muted)]">
                        {[item.user || item.admin || item.actor, item.description || item.details]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </div>
                      {item.timestamp || item.createdAt ? (
                        <div className="mt-1 text-[11px] tabular-nums text-[var(--admin-text-muted)]">
                          {new Date(item.timestamp || item.createdAt).toLocaleString()}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-6 text-sm text-[var(--admin-text-muted)]">
                  {statsError || 'No recent activity to show.'}
                </p>
              )}
            </section>
          </div>

          <section className="admin-lift rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-white/80 p-4 shadow-[var(--admin-shadow-card)] sm:p-5">
            <h2 className="text-sm font-semibold text-[var(--admin-text)]">{tt('Quick navigation')}</h2>
            <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
              {tt('Jump to high-frequency control-plane surfaces.')}
            </p>
            <ul className="admin-stagger mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {shortcuts.map((s) => {
                const Icon = s.icon;
                return (
                  <li key={s.href}>
                    <button
                      type="button"
                      onClick={() => router.push(s.href)}
                      className={`admin-lift flex h-full min-h-11 w-full flex-col items-start gap-2 rounded-[var(--admin-radius)] border bg-gradient-to-br px-3 py-3 text-left text-sm font-semibold ${s.tone}`}
                    >
                      <Icon className={`h-4 w-4 ${s.iconTone}`} aria-hidden />
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
