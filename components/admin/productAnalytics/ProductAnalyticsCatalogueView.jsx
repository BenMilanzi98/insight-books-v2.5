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
import ProductAnalyticsSectionNav from './ProductAnalyticsSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

function statusTone(status) {
  if (status === 'AVAILABLE' || status === 'INSTRUMENTED') return 'success';
  if (status === 'NOT_INSTRUMENTED' || status === 'UNAVAILABLE') return 'danger';
  return 'warning';
}

/**
 * @param {{ kind: 'modules' | 'features' }} props
 */
export default function ProductAnalyticsCatalogueView({ kind }) {
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

  const rows = kind === 'modules' ? pack?.modules || [] : pack?.features || [];
  const sectionKey = kind === 'modules' ? 'modules' : 'features';

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t(`admin-pages.productAnalytics.sections.${sectionKey}`)}
        description={t(`admin-pages.productAnalytics.sectionHints.${sectionKey}`)}
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
        rows.length === 0 ? (
          <AdminEmptyState
            title={t('admin-pages.productAnalytics.emptyCatalogue')}
            description={t('admin-pages.productAnalytics.emptyCatalogueHint')}
          />
        ) : (
          <div className="overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">
                    {t('admin-pages.productAnalytics.columns.code')}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t('admin-pages.productAnalytics.columns.name')}
                  </th>
                  {kind === 'features' ? (
                    <th className="px-3 py-2 font-medium">
                      {t('admin-pages.productAnalytics.columns.module')}
                    </th>
                  ) : (
                    <th className="px-3 py-2 font-medium">
                      {t('admin-pages.productAnalytics.columns.area')}
                    </th>
                  )}
                  <th className="px-3 py-2 font-medium">
                    {t('admin-pages.productAnalytics.columns.status')}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t('admin-pages.productAnalytics.columns.value')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status = row.status || row.instrumentation || 'NOT_INSTRUMENTED';
                  const showNa =
                    status === 'NOT_INSTRUMENTED' ||
                    status === 'UNAVAILABLE' ||
                    status === 'DEFINITION_MISSING';
                  return (
                    <tr
                      key={row.code}
                      className="border-t border-[var(--admin-border)] text-[var(--admin-text)]"
                    >
                      <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 text-[var(--admin-text-muted)]">
                        {kind === 'features' ? row.moduleCode : row.area}
                      </td>
                      <td className="px-3 py-2">
                        <AdminStatusBadge tone={statusTone(status)}>{status}</AdminStatusBadge>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-[var(--admin-text-muted)]">
                        {showNa
                          ? t('admin-pages.productAnalytics.naLabel')
                          : row.value != null
                            ? row.value
                            : t('admin-pages.productAnalytics.naLabel')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </AdminPageContainer>
  );
}
