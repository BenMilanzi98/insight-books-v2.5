'use client';
import { tt } from '@/lib/i18n/runtime';

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
const selectCls =
  'h-10 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)]';

const PAGE_SIZE = 25;

export default function CrmLeadsView() {
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
      const res = await adminFetch(`/api/admin/crm/leads?${qs}`, {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.crm.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.crm.leads.loadFailed'));
      setItems(Array.isArray(body.items) ? body.items : []);
      setMeta(body.meta || { limit: PAGE_SIZE, count: 0, offset });
    } catch (e) {
      setError(e.message || t('admin-pages.crm.leads.loadFailed'));
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
        title={t('admin-pages.crm.sections.leads')}
        description={t('admin-pages.crm.sectionHints.leads')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
              <span>{t('admin-pages.crm.leads.status')}</span>
              <select
                className={selectCls}
                value={status}
                onChange={(e) => {
                  setOffset(0);
                  setStatus(e.target.value);
                }}
                aria-label={t('admin-pages.crm.leads.status')}
              >
                <option value="">{t('admin-pages.crm.leads.statusAll')}</option>
                <option value="NEW">NEW</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="ACCEPTED">ACCEPTED</option>
                <option value="QUALIFICATION_IN_PROGRESS">{tt('QUALIFICATION_IN_PROGRESS')}</option>
                <option value="QUALIFIED">QUALIFIED</option>
                <option value="OPPORTUNITY_READY">{tt('OPPORTUNITY_READY')}</option>
                <option value="NURTURE">NURTURE</option>
                <option value="MERGED">MERGED</option>
              </select>
            </label>
            <button type="button" className={btnGhost} onClick={load} disabled={loading}>
              {t('admin-pages.common.refresh')}
            </button>
          </div>
        }
      />
      <CrmSectionNav />

      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <AdminEmptyState
          title={t('admin-pages.crm.leads.emptyTitle')}
          description={t('admin-pages.crm.leads.emptyHint')}
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
                  <th className="px-3 py-2 font-medium">{t('admin-pages.crm.leads.colSource')}</th>
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
                    <td className="px-3 py-2 text-xs">{row.source || '—'}</td>
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
                <p className="mt-1 text-sm font-medium">{row.title}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <AdminStatusBadge tone="info">{row.status}</AdminStatusBadge>
                  <CrmChannelBadge channel={row.channel} />
                </div>
                <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{row.source}</p>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              className={btnGhost}
              disabled={!canPrev || loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              {t('admin-pages.crm.leads.prev')}
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={!canNext || loading}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              {t('admin-pages.crm.leads.next')}
            </button>
            <span className="text-xs text-[var(--admin-text-muted)]">
              {t('admin-pages.crm.leads.pageOffset')} {offset}
            </span>
          </div>
        </>
      ) : null}
    </AdminPageContainer>
  );
}
