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
import CrmSectionNav from './CrmSectionNav';
import CrmChannelBadge from './CrmChannelBadge';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

export default function CrmMyWorkView() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ limit: '50', myWork: 'true' });
      const [leadsRes, tasksRes] = await Promise.all([
        adminFetch(`/api/admin/crm/leads?${qs}`, { credentials: 'include' }),
        adminFetch(`/api/admin/crm/tasks?${qs}&status=TODO`, { credentials: 'include' }),
      ]);
      const leadsBody = await leadsRes.json().catch(() => ({}));
      const tasksBody = await tasksRes.json().catch(() => ({}));
      if (leadsRes.status === 403) {
        throw new Error(leadsBody.error || t('admin-pages.crm.forbidden'));
      }
      if (!leadsRes.ok) throw new Error(leadsBody.error || t('admin-pages.crm.loadFailed'));
      setItems(Array.isArray(leadsBody.items) ? leadsBody.items : []);
      setTasks(Array.isArray(tasksBody.items) ? tasksBody.items : []);
    } catch (e) {
      setError(e.message || t('admin-pages.crm.loadFailed'));
      setItems([]);
      setTasks([]);
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
        title={t('admin-pages.crm.sections.myWork')}
        description={t('admin-pages.crm.sectionHints.myWork')}
        actions={
          <button type="button" className={btnGhost} onClick={load} disabled={loading}>
            {t('admin-pages.common.refresh')}
          </button>
        }
      />
      <CrmSectionNav />

      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <AdminEmptyState
          title={t('admin-pages.crm.myWork.emptyTitle')}
          description={t('admin-pages.crm.myWork.emptyHint')}
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <div className="mt-4 hidden overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)] md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('admin-pages.crm.leads.colNumber')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin-pages.crm.leads.colTitle')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin-pages.crm.leads.status')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin-pages.crm.leads.colChannel')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--admin-border)]">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link
                        href={`/insightbooks/crm/leads/${encodeURIComponent(row.id)}`}
                        className="text-[var(--admin-accent)] hover:underline"
                      >
                        {row.leadNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{row.title}</td>
                    <td className="px-3 py-2">
                      <AdminStatusBadge tone="info">{row.status}</AdminStatusBadge>
                    </td>
                    <td className="px-3 py-2">
                      <CrmChannelBadge channel={row.channel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-4 space-y-3 md:hidden">
            {items.map((row) => (
              <li
                key={row.id}
                className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3"
              >
                <Link
                  href={`/insightbooks/crm/leads/${encodeURIComponent(row.id)}`}
                  className="font-mono text-xs text-[var(--admin-accent)] hover:underline"
                >
                  {row.leadNumber}
                </Link>
                <p className="mt-1 text-sm font-medium text-[var(--admin-text)]">{row.title}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <AdminStatusBadge tone="info">{row.status}</AdminStatusBadge>
                  <CrmChannelBadge channel={row.channel} />
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {!loading && !error && tasks.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-[var(--admin-text)]">
            {t('admin-pages.crm.myWork.openTasks')}
          </h2>
          <ul className="mt-2 space-y-2 text-sm">
            {tasks.map((task) => (
              <li key={task.id} className="text-[var(--admin-text-muted)]">
                <span className="font-medium text-[var(--admin-text)]">{task.title}</span>
                {' · '}
                {task.subjectType}/{task.subjectId}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
