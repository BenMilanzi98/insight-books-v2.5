'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import CrmSectionNav from './CrmSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

export default function CrmFoundationsView() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/crm/foundations', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.crm.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.crm.foundations.loadFailed'));
      setItems(Array.isArray(body.items) ? body.items : []);
    } catch (e) {
      setError(e.message || t('admin-pages.crm.foundations.loadFailed'));
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
        title={t('admin-pages.crm.sections.foundations')}
        description={t('admin-pages.crm.sectionHints.foundations')}
        actions={
          <button type="button" className={btnGhost} onClick={load} disabled={loading}>
            {t('admin-pages.common.refresh')}
          </button>
        }
      />
      <CrmSectionNav />
      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              key={item.kind}
              className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{item.kind}</span>
                <AdminStatusBadge
                  tone={item.status === 'NOT_AVAILABLE' ? tt('warning') : tt('info')}
                >
                  {item.status}
                </AdminStatusBadge>
              </div>
              <p className="mt-2 text-sm text-[var(--admin-text-muted)]">{item.contract}</p>
              <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
                {t('admin-pages.crm.foundations.deferredTo')}: {item.deferredTo}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </AdminPageContainer>
  );
}
