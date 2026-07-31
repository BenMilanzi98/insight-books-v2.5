'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import { CUSTOMER_BASE } from '@/lib/admin/customerNav';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import MetricCard from '@/components/admin/intelligence/MetricCard';
import CustomerSectionNav from './CustomerSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

const CURRENCIES = ['MWK', 'USD', 'ZAR', 'EUR'];

function SectionCard({ title, children, status, statusTone = 'neutral' }) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-card)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--admin-text)]">{title}</h2>
        {status ? <AdminStatusBadge tone={statusTone}>{status}</AdminStatusBadge> : null}
      </div>
      {children}
    </section>
  );
}

function readinessTone(status) {
  if (!status) return 'neutral';
  if (status === 'READY' || status === 'READY_WITH_LIMITATIONS') return 'success';
  if (status === 'UNAVAILABLE' || status === 'NOT_INSTRUMENTED' || status === 'FORBIDDEN') {
    return 'danger';
  }
  return 'info';
}

function formatScalar(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }
  return String(value);
}

function DlGrid({ entries }) {
  return (
    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      {entries.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[var(--admin-text-muted)]">{label}</dt>
          <dd className="font-medium text-[var(--admin-text)]">{formatScalar(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function Customer360View() {
  const { t } = useI18n();
  const params = useParams();
  const tenantId = params?.tenantId ? String(params.tenantId) : '';
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currency, setCurrency] = useState('MWK');

  const load = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      setError(t('admin-pages.customers.detail.missingId'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ currency });
      const res = await adminFetch(
        `/api/admin/intelligence/customers/${encodeURIComponent(tenantId)}?${qs}`,
        { credentials: 'include' }
      );
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.customers.forbidden'));
      }
      if (res.status === 404) {
        throw new Error(body.error || t('admin-pages.customers.detail.notFound'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.customers.loadFailed'));
      setPack(body);
    } catch (e) {
      setError(e.message || t('admin-pages.customers.loadFailed'));
      setPack(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, currency, t]);

  useEffect(() => {
    load();
  }, [load]);

  const customer = pack?.customer;
  const commercialEnvelopes = pack?.commercial?._envelope
    ? Object.values(pack.commercial._envelope).filter(Boolean)
    : [];
  const signalBuckets = pack?.signals || { risk: [], opportunity: [], attention: [] };
  const signalCount =
    (signalBuckets.risk?.length || 0) +
    (signalBuckets.opportunity?.length || 0) +
    (signalBuckets.attention?.length || 0);

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={
          customer?.displayName ||
          t('admin-pages.customers.detail.title')
        }
        description={
          customer
            ? `${customer.customerReference || customer.tenantId} · ${customer.lifecycleStage || '—'}`
            : t('admin-pages.customers.detail.description')
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`${CUSTOMER_BASE}/directory`}
              className={btnGhost}
            >
              {t('admin-pages.common.back')}
            </Link>
            <label className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
              <span className="sr-only">{t('admin-pages.customers.currency')}</span>
              <select
                className="h-10 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)]"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                aria-label={t('admin-pages.customers.currency')}
              >
                {CURRENCIES.map((ccy) => (
                  <option key={ccy} value={ccy}>
                    {ccy}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className={btnGhost} onClick={load} disabled={loading}>
              {t('admin-pages.common.refresh')}
            </button>
          </div>
        }
      />

      <CustomerSectionNav />

      {loading ? <AdminLoadingState label={t('admin-pages.common.loading')} /> : null}
      {error ? (
        <AdminErrorState title={t('admin-pages.common.unavailable')} message={error} />
      ) : null}

      {!loading && !error && pack ? (
        <div className="space-y-6">
          {pack.catalogueVersion ? (
            <p className="text-xs text-[var(--admin-text-muted)]">
              {t('admin-pages.customers.catalogue')}: {pack.catalogueVersion}
              {pack.meta?.generatedAt
                ? ` · ${t('admin-pages.customers.generated')} ${new Date(pack.meta.generatedAt).toLocaleString()}`
                : ''}
              {currency ? ` · ${currency}` : ''}
            </p>
          ) : null}

          <SectionCard title={t('admin-pages.customers.detail.identity')}>
            <DlGrid
              entries={[
                [t('admin-pages.customers.detail.displayName'), customer?.displayName],
                [t('admin-pages.customers.detail.reference'), customer?.customerReference],
                [t('admin-pages.customers.detail.tenantId'), customer?.tenantId],
                [t('admin-pages.customers.detail.lifecycle'), customer?.lifecycleStage],
                [t('admin-pages.customers.detail.status'), customer?.status],
                [t('admin-pages.customers.detail.customerSince'), customer?.customerSince],
              ]}
            />
          </SectionCard>

          <SectionCard
            title={t('admin-pages.customers.detail.hierarchy')}
            status={pack.hierarchy?.status}
            statusTone={readinessTone(pack.hierarchy?.status)}
          >
            <DlGrid
              entries={[
                [t('admin-pages.customers.detail.branches'), pack.hierarchy?.branchCount],
                [t('admin-pages.customers.detail.users'), pack.hierarchy?.userCount],
                [t('admin-pages.customers.detail.activeUsers'), pack.hierarchy?.activeUserCount],
              ]}
            />
            {pack.hierarchy?.limitations ? (
              <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
                {pack.hierarchy.limitations}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard
            title={t('admin-pages.customers.detail.commercial')}
            status={pack.commercial?.status}
            statusTone={readinessTone(pack.commercial?.status)}
          >
            <DlGrid
              entries={[
                [t('admin-pages.customers.detail.plan'), pack.commercial?.plan],
                [
                  t('admin-pages.customers.detail.subscriptionStatus'),
                  pack.commercial?.subscriptionStatus,
                ],
                [t('admin-pages.customers.detail.renewalDate'), pack.commercial?.renewalDate],
                [t('admin-pages.customers.currency'), pack.commercial?.currency],
              ]}
            />
            {commercialEnvelopes.length ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {commercialEnvelopes.map((m) => (
                  <MetricCard key={m.code} metric={m} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--admin-text-muted)]">
                {pack.commercial?.reason || t('admin-pages.customers.sectionHints.commercial')}
              </p>
            )}
            {pack.commercial?.limitations ? (
              <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
                {pack.commercial.limitations}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard
            title={t('admin-pages.customers.detail.engagement')}
            status={pack.engagement?.status}
            statusTone={readinessTone(pack.engagement?.status)}
          >
            <DlGrid
              entries={[
                [t('admin-pages.customers.detail.lastLogin'), pack.engagement?.lastLoginAt],
                [
                  t('admin-pages.customers.detail.lastActivity'),
                  pack.engagement?.lastMeaningfulActivityAt,
                ],
                [
                  t('admin-pages.customers.detail.activeUsersProxy'),
                  pack.engagement?.activeUsersProxy,
                ],
              ]}
            />
            {pack.engagement?.limitations ? (
              <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
                {pack.engagement.limitations}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard
            title={t('admin-pages.customers.detail.adoption')}
            status={pack.adoption?.status || 'UNAVAILABLE'}
            statusTone="danger"
          >
            <p className="text-sm text-[var(--admin-text-muted)]">
              {pack.adoption?.reason || t('admin-pages.customers.sectionHints.adoption')}
            </p>
          </SectionCard>

          <SectionCard
            title={t('admin-pages.customers.detail.mraEis')}
            status={pack.mraEis?.status}
            statusTone={readinessTone(pack.mraEis?.status)}
          >
            <DlGrid
              entries={[
                [
                  t('admin-pages.customers.detail.entitlementStatus'),
                  pack.mraEis?.entitlementStatus,
                ],
                [t('admin-pages.customers.detail.commercialPlan'), pack.mraEis?.commercialPlan],
                [
                  t('admin-pages.customers.detail.operationalReadiness'),
                  pack.mraEis?.operationalReadiness,
                ],
              ]}
            />
            {pack.mraEis?.limitations ? (
              <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
                {pack.mraEis.limitations}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard
            title={t('admin-pages.customers.detail.support')}
            status="NOT_INSTRUMENTED"
            statusTone="danger"
          >
            <div className="flex flex-wrap gap-2">
              {['support', 'onboarding', 'training'].map((key) => (
                <AdminStatusBadge key={key} tone="danger">
                  {key}: {pack.service?.[key]?.status || 'NOT_INSTRUMENTED'}
                </AdminStatusBadge>
              ))}
            </div>
            <p className="mt-2 text-sm text-[var(--admin-text-muted)]">
              {t('admin-pages.customers.sectionHints.support')}
            </p>
          </SectionCard>

          <SectionCard
            title={t('admin-pages.customers.detail.signals')}
            status={pack.signals?.status || (signalCount ? 'READY_WITH_LIMITATIONS' : 'EMPTY')}
            statusTone={signalCount ? 'info' : 'neutral'}
          >
            {pack.signals?.ruleVersion ? (
              <p className="mb-2 text-xs text-[var(--admin-text-muted)]">
                {t('admin-pages.customers.signals.ruleVersion')}: {pack.signals.ruleVersion}
                {pack.signals.persistence ? ` · ${pack.signals.persistence}` : ''}
              </p>
            ) : null}
            {signalCount === 0 ? (
              <AdminEmptyState
                title={t('admin-pages.customers.detail.signalsEmpty')}
                description={t('admin-pages.customers.sectionHints.signals')}
              />
            ) : (
              <ul className="space-y-2 text-sm text-[var(--admin-text)]">
                {[
                  ...(signalBuckets.risk || []).map((s) => ({ ...s, kind: 'risk' })),
                  ...(signalBuckets.opportunity || []).map((s) => ({
                    ...s,
                    kind: 'opportunity',
                  })),
                  ...(signalBuckets.attention || []).map((s) => ({
                    ...s,
                    kind: 'attention',
                  })),
                ].map((s, idx) => (
                  <li
                    key={`${s.kind}-${s.code || s.id || idx}`}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <AdminStatusBadge tone="info">{s.kind}</AdminStatusBadge>
                    <AdminStatusBadge
                      tone={
                        s.severity === 'CRITICAL'
                          ? 'danger'
                          : s.severity === 'HIGH'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {s.severity}
                    </AdminStatusBadge>
                    <span className="font-medium">{s.title || s.code}</span>
                    <span className="text-xs text-[var(--admin-text-muted)]">{s.code}</span>
                  </li>
                ))}
              </ul>
            )}
            {pack.signals?.limitations ? (
              <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
                {pack.signals.limitations}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard
            title={t('admin-pages.customers.detail.ownership')}
            status={pack.ownership?.status || 'UNAVAILABLE'}
            statusTone={
              pack.ownership?.status === 'READY'
                ? 'success'
                : pack.ownership?.status === 'READY_WITH_LIMITATIONS'
                  ? 'warning'
                  : 'danger'
            }
          >
            <DlGrid
              entries={[
                [
                  t('admin-pages.customers.detail.portfolioId'),
                  pack.ownership?.portfolioName ||
                    pack.ownership?.portfolioCode ||
                    pack.ownership?.portfolioId ||
                    t('admin-pages.customers.detail.unavailableValue'),
                ],
                [
                  t('admin-pages.customers.detail.primaryOwner'),
                  pack.ownership?.primaryOwnerName ||
                    pack.ownership?.primaryOwnerEmail ||
                    pack.ownership?.primaryOwnerId ||
                    t('admin-pages.customers.detail.unavailableValue'),
                ],
              ]}
            />
            {pack.ownership?.assignments?.length ? (
              <ul className="mt-3 space-y-1 text-sm text-[var(--admin-text-muted)]">
                {pack.ownership.assignments.map((a) => (
                  <li key={a.id}>
                    {a.ownerAdminName || a.ownerAdminId}
                    {a.isPrimary
                      ? ` · ${t('admin-pages.customers.portfolios.primary')}`
                      : ''}
                    {a.portfolioCode ? ` · ${a.portfolioCode}` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--admin-text-muted)]">
                {pack.ownership?.limitations ||
                  t('admin-pages.customers.sectionHints.portfolios')}
              </p>
            )}
          </SectionCard>

          {pack.reliability?.limitations?.length ? (
            <SectionCard title={t('admin-pages.customers.limitations')}>
              <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--admin-text-muted)]">
                {pack.reliability.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </SectionCard>
          ) : null}
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
