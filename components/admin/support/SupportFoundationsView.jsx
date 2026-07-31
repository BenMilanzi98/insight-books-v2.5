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
import SupportSectionNav from './SupportSectionNav';

/**
 * KB / Problem / CSAT / Automation contracts — no fake CSAT scores.
 */
export default function SupportFoundationsView() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/support/foundations', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.support.forbidden'));
      }
      if (!res.ok) {
        throw new Error(body.error || t('admin-pages.support.foundations.loadFailed'));
      }
      setItems(Array.isArray(body.items) ? body.items : []);
    } catch (e) {
      setError(e.message || t('admin-pages.support.foundations.loadFailed'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.support.sections.foundations')}
        description={t('admin-pages.support.sectionHints.foundations')}
      />
      <SupportSectionNav />
      <p className="mb-3 text-sm text-[var(--admin-text-muted)]">
        {t('admin-pages.support.foundations.noCsatHint')}
      </p>
      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <AdminEmptyState
          title={t('admin-pages.support.foundations.emptyTitle')}
          description={t('admin-pages.support.foundations.emptyHint')}
        />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.kind}
              className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-[var(--admin-text)]">{item.kind}</span>
                <AdminStatusBadge tone="neutral">{item.status}</AdminStatusBadge>
              </div>
              <p className="text-sm text-[var(--admin-text-muted)]">{item.contract}</p>
              {item.kind === 'CSAT' ? (
                <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
                  {t('admin-pages.support.foundations.scoreLabel')}: null
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
