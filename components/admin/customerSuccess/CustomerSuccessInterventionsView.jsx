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
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import CustomerSuccessSectionNav from './CustomerSuccessSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

export default function CustomerSuccessInterventionsView() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/customer-success/interventions?limit=50', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.customerSuccess.forbidden'));
      }
      if (!res.ok) {
        throw new Error(body.error || t('admin-pages.customerSuccess.interventions.loadFailed'));
      }
      setItems(Array.isArray(body.items) ? body.items : []);
    } catch (e) {
      setError(e.message || t('admin-pages.customerSuccess.interventions.loadFailed'));
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
        title={t('admin-pages.customerSuccess.sections.interventions')}
        description={t('admin-pages.customerSuccess.sectionHints.interventions')}
        actions={
          <button type="button" className={btnGhost} onClick={load} disabled={loading}>
            {t('admin-pages.common.refresh')}
          </button>
        }
      />
      <CustomerSuccessSectionNav />
      <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
        {t('admin-pages.customerSuccess.interventions.notTicket')}
      </p>
      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <AdminEmptyState
          title={t('admin-pages.customerSuccess.interventions.emptyTitle')}
          description={t('admin-pages.customerSuccess.interventions.emptyHint')}
        />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <ul className="mt-4 space-y-3 text-sm">
          {items.map((row) => (
            <li
              key={row.id}
              className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <AdminStatusBadge tone="neutral" label={row.type} />
                <span className="font-mono text-xs text-[var(--admin-text-muted)]">
                  {row.tenantId}
                </span>
                {row.caseId ? (
                  <Link
                    href={`/insightbooks/customer-success/cases/${encodeURIComponent(row.caseId)}`}
                    className="text-[var(--admin-accent)] hover:underline"
                  >
                    {t('admin-pages.customerSuccess.sections.cases')}
                  </Link>
                ) : null}
                <span className="text-xs text-[var(--admin-text-muted)]">
                  {row.performedAt || ''}
                </span>
              </div>
              {row.notes ? <p className="mt-2">{row.notes}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </AdminPageContainer>
  );
}
