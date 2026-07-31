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
import CustomerSuccessSectionNav from './CustomerSuccessSectionNav';

export default function CustomerSuccessHandoffsView() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/customer-success/handoffs?limit=50', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.customerSuccess.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.customerSuccess.handoffs.loadFailed'));
      setItems(Array.isArray(body.items) ? body.items : []);
    } catch (e) {
      setError(e.message || t('admin-pages.customerSuccess.handoffs.loadFailed'));
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
        title={t('admin-pages.customerSuccess.sections.handoffs')}
        description={t('admin-pages.customerSuccess.sectionHints.handoffs')}
      />
      <CustomerSuccessSectionNav />
      <p className="mb-3 text-sm text-[var(--admin-text-muted)]">
        {t('admin-pages.customerSuccess.handoffs.recordOnlyHint')}
      </p>
      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <AdminEmptyState
          title={t('admin-pages.customerSuccess.handoffs.emptyTitle')}
          description={t('admin-pages.customerSuccess.handoffs.emptyHint')}
        />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.cases.colTenant')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.handoffs.colReason')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.handoffs.colAction')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.cases.status')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((h) => (
                <tr key={h.id} className="border-t border-[var(--admin-border)]">
                  <td className="px-3 py-2 text-[var(--admin-text-muted)]">{h.tenantId}</td>
                  <td className="px-3 py-2 text-[var(--admin-text)]">{h.reason || '—'}</td>
                  <td className="px-3 py-2 text-[var(--admin-text)]">{h.recommendedAction}</td>
                  <td className="px-3 py-2">
                    <AdminStatusBadge tone="neutral">{h.status}</AdminStatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
