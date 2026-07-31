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

/**
 * Source-gated onboarding / training / survey foundation view.
 * Empty → NOT_INSTRUMENTED; never shows invented progress %.
 */
export default function CustomerSuccessFoundationsView({ kind }) {
  const { t } = useI18n();
  const [status, setStatus] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const sectionKey =
    kind === 'training' ? 'training' : kind === 'survey' ? 'surveys' : 'onboarding';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ kind });
      const res = await adminFetch(`/api/admin/customer-success/foundations?${qs}`, {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.customerSuccess.forbidden'));
      }
      if (!res.ok) {
        throw new Error(body.error || t('admin-pages.customerSuccess.foundations.loadFailed'));
      }
      setStatus(body.status || 'NOT_INSTRUMENTED');
      setItems(Array.isArray(body.items) ? body.items : []);
    } catch (e) {
      setError(e.message || t('admin-pages.customerSuccess.foundations.loadFailed'));
      setStatus('NOT_INSTRUMENTED');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [kind, t]);

  useEffect(() => {
    load();
  }, [load]);

  const notInstrumented = status === 'NOT_INSTRUMENTED' || status === 'UNAVAILABLE';

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t(`admin-pages.customerSuccess.sections.${sectionKey}`)}
        description={t(`admin-pages.customerSuccess.sectionHints.${sectionKey}`)}
      />
      <CustomerSuccessSectionNav />
      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && notInstrumented ? (
        <AdminEmptyState
          title={t('admin-pages.customerSuccess.unavailableTitle')}
          description={t('admin-pages.customerSuccess.foundations.notInstrumentedHint')}
        />
      ) : null}
      {!loading && !error && !notInstrumented ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
            <span>{t('admin-pages.customerSuccess.foundations.status')}</span>
            <AdminStatusBadge tone="info">{status}</AdminStatusBadge>
            <span>{t('admin-pages.customerSuccess.foundations.noPercent')}</span>
          </div>
          {items.length === 0 ? (
            <AdminEmptyState
              title={t('admin-pages.customerSuccess.unavailableTitle')}
              description={t('admin-pages.customerSuccess.foundations.notInstrumentedHint')}
            />
          ) : (
            <div className="overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">
                      {t('admin-pages.customerSuccess.cases.colTenant')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t('admin-pages.customerSuccess.foundations.colKey')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t('admin-pages.customerSuccess.cases.status')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--admin-border)]">
                      <td className="px-3 py-2 text-[var(--admin-text-muted)]">{row.tenantId}</td>
                      <td className="px-3 py-2 text-[var(--admin-text)]">
                        {row.checklistKey || '—'}
                      </td>
                      <td className="px-3 py-2 text-[var(--admin-text)]">{row.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
