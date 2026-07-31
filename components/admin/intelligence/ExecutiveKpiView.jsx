'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import ExecutiveSectionNav from './ExecutiveSectionNav';
import MetricCard from './MetricCard';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--admin-accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';

const AREA_GROUPS = {
  overview: [
    {
      titleKey: 'admin-pages.intelligence.areas.financial',
      codes: [
        'platform.mrr.estimated',
        'platform.arr.estimated',
        'platform.payments.collected_period',
        'platform.payments.collected_all_time',
      ],
    },
    {
      titleKey: 'admin-pages.intelligence.areas.customers',
      codes: [
        'tenants.active_paid',
        'tenants.trial',
        'tenants.total',
        'users.total',
        'subscriptions.active',
      ],
    },
    {
      titleKey: 'admin-pages.intelligence.areas.productOps',
      codes: [
        'engagement.dau',
        'product.feature_adoption',
        'crm.pipeline',
        'support.pressure',
        'mra_eis.entitled',
        'ops.system_health',
        'pipeline.freshness',
      ],
    },
  ],
};

/**
 * Shared executive intelligence view.
 * @param {{ section?: string|null, title: string, description: string, showAttention?: boolean, showExport?: boolean }} props
 */
export default function ExecutiveKpiView({
  section = null,
  title,
  description,
  showAttention = true,
  showExport = false,
}) {
  const { t } = useI18n();
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ days: String(days) });
      if (section) qs.set('section', section);
      const res = await adminFetch(
        `/api/admin/intelligence/executive/overview?${qs.toString()}`,
        { credentials: 'include' }
      );
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.intelligence.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.intelligence.loadFailed'));
      setPack(body);
    } catch (e) {
      setError(e.message || t('admin-pages.intelligence.loadFailed'));
      setPack(null);
    } finally {
      setLoading(false);
    }
  }, [days, section, t]);

  useEffect(() => {
    load();
  }, [load]);

  const exportPack = async (format) => {
    try {
      const res = await adminFetch(
        `/api/admin/intelligence/executive/export?format=${format}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Export failed');
      }
      if (format === 'csv') {
        const text = await res.text();
        const blob = new Blob([text], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'executive-kpis.csv';
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const body = await res.json();
      const blob = new Blob([JSON.stringify(body, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'executive-kpis.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || 'Export failed');
    }
  };

  const metrics = pack?.metrics || {};
  const metricList = Object.values(metrics);
  const attention = pack?.attention || [];

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={title}
        description={description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                className={days === d ? btnPrimary : btnGhost}
                onClick={() => setDays(d)}
              >
                {d}d
              </button>
            ))}
            <button type="button" className={btnGhost} onClick={load} disabled={loading}>
              {t('admin-pages.common.refresh')}
            </button>
            {showExport ? (
              <>
                <button type="button" className={btnGhost} onClick={() => exportPack('json')}>
                  JSON
                </button>
                <button type="button" className={btnPrimary} onClick={() => exportPack('csv')}>
                  CSV
                </button>
              </>
            ) : null}
          </div>
        }
      />

      <ExecutiveSectionNav />

      {loading ? <AdminLoadingState label={t('admin-pages.common.loading')} /> : null}
      {error ? <AdminErrorState title={t('admin-pages.common.unavailable')} message={error} /> : null}

      {!loading && !error && pack ? (
        <>
          {pack.catalogueVersion ? (
            <p className="mb-4 text-xs text-[var(--admin-text-muted)]">
              {t('admin-pages.intelligence.catalogue')}: {pack.catalogueVersion}
              {pack.generatedAt
                ? ` · ${t('admin-pages.intelligence.generated')} ${new Date(pack.generatedAt).toLocaleString()}`
                : ''}
            </p>
          ) : null}

          {showAttention && attention.length > 0 ? (
            <section className="mb-6 rounded-[var(--admin-radius)] border border-amber-200 bg-amber-50 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-amber-900">
                  {t('admin-pages.intelligence.attentionTitle')}
                </h2>
                <Link
                  href="/insightbooks/intelligence/executive/attention"
                  className="text-xs font-medium text-amber-800 underline"
                >
                  {t('admin-pages.intelligence.viewAll')}
                </Link>
              </div>
              <ul className="space-y-1 text-sm text-amber-900">
                {attention.slice(0, 5).map((item) => (
                  <li key={`${item.code}-${item.title}`}>
                    <Link href={item.href || '#'} className="underline-offset-2 hover:underline">
                      [{item.severity}] {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {section === 'attention' ? (
            attention.length === 0 ? (
              <AdminEmptyState
                title={t('admin-pages.intelligence.attentionEmpty')}
                description={t('admin-pages.intelligence.attentionEmptyHint')}
              />
            ) : (
              <ul className="space-y-3">
                {attention.map((item) => (
                  <li
                    key={`${item.code}-${item.title}`}
                    className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
                  >
                    <p className="text-xs font-semibold uppercase text-[var(--admin-text-muted)]">
                      {item.severity}
                    </p>
                    <p className="mt-1 font-medium text-[var(--admin-text)]">{item.title}</p>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="mt-2 inline-block text-sm text-[var(--admin-accent)] underline"
                      >
                        {t('admin-pages.intelligence.open')}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {section === 'reports' ? (
            <section className="mb-6 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <h2 className="text-sm font-semibold text-[var(--admin-text)]">
                {t('admin-pages.intelligence.exportTitle')}
              </h2>
              <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                {t('admin-pages.intelligence.exportHint')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={btnGhost} onClick={() => exportPack('json')}>
                  {t('admin-pages.intelligence.exportJson')}
                </button>
                <button type="button" className={btnPrimary} onClick={() => exportPack('csv')}>
                  {t('admin-pages.intelligence.exportCsv')}
                </button>
              </div>
            </section>
          ) : null}

          {!section || section === 'overview' ? (
            AREA_GROUPS.overview.map((group) => {
              const cards = group.codes
                .map((code) => metrics[code])
                .filter(Boolean);
              if (!cards.length) return null;
              return (
                <section key={group.titleKey} className="mb-8">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
                    {t(group.titleKey)}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {cards.map((m) => (
                      <MetricCard key={m.code} metric={m} />
                    ))}
                  </div>
                </section>
              );
            })
          ) : section !== 'attention' && section !== 'reports' ? (
            metricList.length === 0 ? (
              <AdminEmptyState
                title={t('admin-pages.intelligence.emptySection')}
                description={t('admin-pages.intelligence.emptySectionHint')}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {metricList.map((m) => (
                  <MetricCard key={m.code} metric={m} />
                ))}
              </div>
            )
          ) : null}
        </>
      ) : null}
    </AdminPageContainer>
  );
}
