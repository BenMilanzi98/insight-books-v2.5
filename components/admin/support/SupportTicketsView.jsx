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
const selectCls =
  'h-10 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)]';

const PAGE_SIZE = 25;

function priorityTone(priority) {
  if (priority === 'P1') return 'danger';
  if (priority === 'P2') return 'warning';
  if (priority === 'P4' || priority === 'P5') return 'neutral';
  return 'info';
}

export default function SupportTicketsView() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [meta, setMeta] = useState({ limit: PAGE_SIZE, count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (status) qs.set('status', status);
      const res = await adminFetch(`/api/admin/support/tickets?${qs}`, {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.support.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.support.tickets.loadFailed'));
      setItems(Array.isArray(body.items) ? body.items : []);
      setMeta(body.meta || { limit: PAGE_SIZE, count: 0, offset });
    } catch (e) {
      setError(e.message || t('admin-pages.support.tickets.loadFailed'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, offset, t]);

  useEffect(() => {
    load();
  }, [load]);

  const canPrev = offset > 0;
  const canNext = (meta.count || 0) >= PAGE_SIZE;

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.support.sections.tickets')}
        description={t('admin-pages.support.sectionHints.tickets')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
              <span>{t('admin-pages.support.tickets.status')}</span>
              <select
                className={selectCls}
                value={status}
                onChange={(e) => {
                  setOffset(0);
                  setStatus(e.target.value);
                }}
                aria-label={t('admin-pages.support.tickets.status')}
              >
                <option value="">{t('admin-pages.support.tickets.statusAll')}</option>
                <option value="NEW">NEW</option>
                <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                <option value="TRIAGE">TRIAGE</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="WAITING_FOR_CUSTOMER">WAITING_FOR_CUSTOMER</option>
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
      <SupportSectionNav />

      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <AdminEmptyState
          title={t('admin-pages.support.tickets.emptyTitle')}
          description={t('admin-pages.support.tickets.emptyHint')}
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <div className="mt-4 overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('admin-pages.support.tickets.colNumber')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin-pages.support.tickets.colTitle')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin-pages.support.tickets.colTenant')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin-pages.support.tickets.status')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin-pages.support.tickets.colPriority')}</th>
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
                    <td className="px-3 py-2 font-mono text-xs">{row.tenantId}</td>
                    <td className="px-3 py-2">
                      <AdminStatusBadge tone="info" label={row.status} />
                    </td>
                    <td className="px-3 py-2">
                      <AdminStatusBadge
                        tone={priorityTone(row.priority)}
                        label={row.priority || '—'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className={btnGhost}
              disabled={!canPrev || loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              {t('admin-pages.support.tickets.prev')}
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={!canNext || loading}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              {t('admin-pages.support.tickets.next')}
            </button>
            <span className="text-xs text-[var(--admin-text-muted)]">
              {t('admin-pages.support.tickets.pageOffset')}: {offset}
            </span>
          </div>
        </>
      ) : null}
    </AdminPageContainer>
  );
}
