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
import ProductAnalyticsSectionNav from './ProductAnalyticsSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

const OVERVIEW_METRIC_ORDER = [
  'product.feature.invoices.post.count',
  'product.feature.sales.pos.complete.count',
  'product.feature.eis.fiscal.accept.count',
];

function instrumentationTone(status) {
  if (status === 'AVAILABLE' || status === 'INSTRUMENTED') return 'success';
  if (status === 'NOT_INSTRUMENTED' || status === 'UNAVAILABLE') return 'danger';
  return 'neutral';
}

export default function ProductAnalyticsOverviewView() {
  const { t } = useI18n();
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/intelligence/product-analytics/overview', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.productAnalytics.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.productAnalytics.loadFailed'));
      setPack(body);
    } catch (e) {
      setError(e.message || t('admin-pages.productAnalytics.loadFailed'));
      setPack(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const metrics = pack?.metrics || {};
  const metricList = OVERVIEW_METRIC_ORDER.map((code) => metrics[code]).filter(Boolean);
  const sampleModules = (pack?.modules || []).slice(0, 8);

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.productAnalytics.title')}
        description={t('admin-pages.productAnalytics.description')}
        actions={
          <button type="button" className={btnGhost} onClick={load} disabled={loading}>
            {t('admin-pages.common.refresh')}
          </button>
        }
      />

      <ProductAnalyticsSectionNav />

      {loading ? <AdminLoadingState label={t('admin-pages.common.loading')} /> : null}
      {error ? (
        <AdminErrorState title={t('admin-pages.common.unavailable')} message={error} />
      ) : null}

      {!loading && !error && pack ? (
        <div className="space-y-8">
          <p className="text-xs text-[var(--admin-text-muted)]">
            {t('admin-pages.productAnalytics.catalogue')}: {pack.catalogueVersion}
            {pack.analyticsCatalogueVersion ? ` · ${pack.analyticsCatalogueVersion}` : ''}
            {pack.generatedAt
              ? ` · ${t('admin-pages.productAnalytics.generated')} ${new Date(pack.generatedAt).toLocaleString()}`
              : ''}
          </p>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--admin-text)]">
              {t('admin-pages.productAnalytics.commerceMetrics')}
            </h2>
            {metricList.length === 0 ? (
              <AdminEmptyState
                title={t('admin-pages.productAnalytics.emptyMetrics')}
                description={t('admin-pages.productAnalytics.emptyMetricsHint')}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {metricList.map((m) => (
                  <MetricCard key={m.code} metric={m} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--admin-text)]">
              {t('admin-pages.productAnalytics.moduleSnapshot')}
            </h2>
            <p className="mb-3 text-sm text-[var(--admin-text-muted)]">
              {t('admin-pages.productAnalytics.naHint')}
            </p>
            <div className="flex flex-wrap gap-2">
              {sampleModules.map((m) => (
                <AdminStatusBadge key={m.code} tone={instrumentationTone(m.status)}>
                  {m.code}: {m.status === 'AVAILABLE' ? 'INSTRUMENTED' : m.status}
                </AdminStatusBadge>
              ))}
            </div>
          </section>

          {pack.limitations?.length ? (
            <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
                {t('admin-pages.productAnalytics.limitations')}
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--admin-text-muted)]">
                {pack.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
