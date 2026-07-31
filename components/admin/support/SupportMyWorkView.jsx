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
import SupportSectionNav from './SupportSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

function channelLabel(channel, t) {
  if (!channel || channel === 'ADMIN_MANUAL') return channel || 'ADMIN_MANUAL';
  if (channel === 'EMAIL' || channel === 'WHATSAPP' || channel === 'PORTAL') {
    return `${channel} (${t('admin-pages.support.channelNotAvailable')})`;
  }
  return channel;
}

export default function SupportMyWorkView() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ limit: '50', myWork: 'true' });
      const res = await adminFetch(`/api/admin/support/tickets?${qs}`, {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.support.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.support.loadFailed'));
      setItems(Array.isArray(body.items) ? body.items : []);
    } catch (e) {
      setError(e.message || t('admin-pages.support.loadFailed'));
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
        title={t('admin-pages.support.sections.myWork')}
        description={t('admin-pages.support.sectionHints.myWork')}
        actions={
          <button type="button" className={btnGhost} onClick={load} disabled={loading}>
            {t('admin-pages.common.refresh')}
          </button>
        }
      />
      <SupportSectionNav />

      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <AdminEmptyState
          title={t('admin-pages.support.myWork.emptyTitle')}
          description={t('admin-pages.support.myWork.emptyHint')}
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">{t('admin-pages.support.tickets.colNumber')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.support.tickets.colTitle')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.support.tickets.status')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.support.tickets.colQueue')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.support.tickets.colChannel')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-[var(--admin-border)]">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link
                      href={`/insightbooks/support/tickets/${encodeURIComponent(row.id)}`}
                      className="text-[var(--admin-accent)] hover:underline"
                    >
                      {row.ticketNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.title}</td>
                  <td className="px-3 py-2">
                    <AdminStatusBadge tone="info" label={row.status} />
                  </td>
                  <td className="px-3 py-2">{row.queueCode || '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    {channelLabel(row.sourceChannel, t)}
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
