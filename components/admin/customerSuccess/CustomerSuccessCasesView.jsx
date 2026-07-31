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
const selectCls =
  'h-10 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)]';

function priorityTone(priority) {
  if (priority === 'CRITICAL') return 'danger';
  if (priority === 'HIGH') return 'warning';
  if (priority === 'LOW') return 'neutral';
  return 'info';
}

export default function CustomerSuccessCasesView() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('OPEN');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ limit: '50' });
      if (status) qs.set('status', status);
      const res = await adminFetch(`/api/admin/customer-success/cases?${qs}`, {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.customerSuccess.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.customerSuccess.cases.loadFailed'));
      setItems(Array.isArray(body.items) ? body.items : []);
    } catch (e) {
      setError(e.message || t('admin-pages.customerSuccess.cases.loadFailed'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.customerSuccess.sections.cases')}
        description={t('admin-pages.customerSuccess.sectionHints.cases')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
              <span>{t('admin-pages.customerSuccess.cases.status')}</span>
              <select
                className={selectCls}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label={t('admin-pages.customerSuccess.cases.status')}
              >
                <option value="">{t('admin-pages.customerSuccess.cases.statusAll')}</option>
                <option value="OPEN">OPEN</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </label>
            <button type="button" className={btnGhost} onClick={load} disabled={loading}>
              {t('admin-pages.common.refresh')}
            </button>
          </div>
        }
      />
      <CustomerSuccessSectionNav />

      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <AdminEmptyState
          title={t('admin-pages.customerSuccess.cases.emptyTitle')}
          description={t('admin-pages.customerSuccess.cases.emptyHint')}
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.cases.colTitle')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.cases.colTenant')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.cases.colTrigger')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.cases.status')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.cases.colPriority')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-[var(--admin-border)]">
                  <td className="px-3 py-2">
                    <Link
                      href={`/insightbooks/customer-success/cases/${encodeURIComponent(row.id)}`}
                      className="text-[var(--admin-accent)] hover:underline"
                    >
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.tenantId}</td>
                  <td className="px-3 py-2">
                    {row.triggerType}
                    {row.triggerCode ? ` · ${row.triggerCode}` : ''}
                  </td>
                  <td className="px-3 py-2">
                    <AdminStatusBadge tone="info" label={row.status} />
                  </td>
                  <td className="px-3 py-2">
                    <AdminStatusBadge
                      tone={priorityTone(row.priority)}
                      label={row.priority || 'MEDIUM'}
                    />
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
