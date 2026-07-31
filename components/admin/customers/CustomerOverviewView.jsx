'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
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

const OVERVIEW_METRIC_ORDER = [
  'customer.overview.tenants_total',
  'customer.overview.tenants_active_paid',
  'customer.overview.tenants_trial',
  'customer.overview.tenants_suspended',
  'customer.overview.tenants_archived',
  'customer.overview.tenants_unassigned',
];

export default function CustomerOverviewView() {
  const { t } = useI18n();
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currency, setCurrency] = useState('MWK');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ currency });
      const res = await adminFetch(
        `/api/admin/intelligence/customers/overview?${qs}`,
        { credentials: 'include' }
      );
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.customers.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.customers.loadFailed'));
      setPack(body);
    } catch (e) {
      setError(e.message || t('admin-pages.customers.loadFailed'));
      setPack(null);
    } finally {
      setLoading(false);
    }
  }, [currency, t]);

  useEffect(() => {
    load();
  }, [load]);

  const metrics = pack?.metrics || {};
  const metricList = OVERVIEW_METRIC_ORDER.map((code) => metrics[code]).filter(Boolean);

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.customers.title')}
        description={t('admin-pages.customers.description')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
        <>
          {pack.catalogueVersion ? (
            <p className="mb-4 text-xs text-[var(--admin-text-muted)]">
              {t('admin-pages.customers.catalogue')}: {pack.catalogueVersion}
              {pack.generatedAt
                ? ` · ${t('admin-pages.customers.generated')} ${new Date(pack.generatedAt).toLocaleString()}`
                : ''}
              {currency ? ` · ${currency}` : ''}
            </p>
          ) : null}

          {metricList.length === 0 ? (
            <AdminEmptyState
              title={t('admin-pages.customers.emptySection')}
              description={t('admin-pages.customers.emptySectionHint')}
            />
          ) : (
            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {metricList.map((m) => (
                <MetricCard key={m.code} metric={m} />
              ))}
            </div>
          )}

          <section className="mb-6 grid gap-4 sm:grid-cols-2">
            <article className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <h2 className="text-sm font-semibold text-[var(--admin-text)]">
                {t('admin-pages.customers.areas.adoption')}
              </h2>
              <div className="mt-2 flex items-center gap-2">
                <AdminStatusBadge tone="danger">
                  {pack.adoption?.status || 'UNAVAILABLE'}
                </AdminStatusBadge>
              </div>
              <p className="mt-2 text-sm text-[var(--admin-text-muted)]">
                {pack.adoption?.reason || t('admin-pages.customers.sectionHints.adoption')}
              </p>
            </article>
            <article className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <h2 className="text-sm font-semibold text-[var(--admin-text)]">
                {t('admin-pages.customers.areas.support')}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {['support', 'onboarding', 'training'].map((key) => (
                  <AdminStatusBadge key={key} tone="danger">
                    {key}: {pack.service?.[key]?.status || 'NOT_INSTRUMENTED'}
                  </AdminStatusBadge>
                ))}
              </div>
              <p className="mt-2 text-sm text-[var(--admin-text-muted)]">
                {t('admin-pages.customers.sectionHints.support')}
              </p>
            </article>
          </section>

          {pack.limitations?.length ? (
            <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
                {t('admin-pages.customers.limitations')}
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--admin-text-muted)]">
                {pack.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </AdminPageContainer>
  );
}
