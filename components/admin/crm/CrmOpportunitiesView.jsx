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

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const selectCls =
  'h-10 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)]';

const PAGE_SIZE = 25;

export default function CrmOpportunitiesView({ myPipeline = false }) {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [stageCode, setStageCode] = useState('');
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
      if (stageCode) qs.set('stageCode', stageCode);
      if (myPipeline) qs.set('myPipeline', '1');
      const res = await adminFetch(`/api/admin/crm/opportunities?${qs}`, {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.crm.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.crm.opportunities.loadFailed'));
      setItems(Array.isArray(body.items) ? body.items : []);
      setMeta(body.meta || { limit: PAGE_SIZE, count: 0, offset });
    } catch (e) {
      setError(e.message || t('admin-pages.crm.opportunities.loadFailed'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [stageCode, offset, myPipeline, t]);

  useEffect(() => {
    load();
  }, [load]);

  const canPrev = offset > 0;
  const canNext = (meta.count || 0) >= PAGE_SIZE;

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t(
          myPipeline
            ? 'admin-pages.crm.sections.myPipeline'
            : 'admin-pages.crm.sections.opportunities'
        )}
        description={t(
          myPipeline
            ? 'admin-pages.crm.sectionHints.myPipeline'
            : 'admin-pages.crm.sectionHints.opportunities'
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/insightbooks/crm/opportunities/new" className={btnGhost}>
              {t('admin-pages.crm.opportunities.new')}
            </Link>
            <Link href="/insightbooks/crm/pipeline/board" className={btnGhost}>
              {t('admin-pages.crm.pipeline.boardView')}
            </Link>
            <label className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
              <span>{t('admin-pages.crm.opportunities.stage')}</span>
              <select
                className={selectCls}
                value={stageCode}
                onChange={(e) => {
                  setOffset(0);
                  setStageCode(e.target.value);
                }}
                aria-label={t('admin-pages.crm.opportunities.stage')}
              >
                <option value="">{t('admin-pages.crm.opportunities.stageAll')}</option>
                <option value="OPPORTUNITY_IDENTIFIED">OPPORTUNITY_IDENTIFIED</option>
                <option value="DISCOVERY">DISCOVERY</option>
                <option value="NEED_CONFIRMED">NEED_CONFIRMED</option>
                <option value="SOLUTION_FIT">SOLUTION_FIT</option>
                <option value="COMMERCIAL_SCOPING">COMMERCIAL_SCOPING</option>
                <option value="DECISION_PROCESS">DECISION_PROCESS</option>
                <option value="PROPOSAL_READY">PROPOSAL_READY</option>
                <option value="CUSTOMER_DECISION">CUSTOMER_DECISION</option>
                <option value="CLOSED_WON">CLOSED_WON</option>
                <option value="CLOSED_LOST">CLOSED_LOST</option>
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
          title={t('admin-pages.crm.opportunities.emptyTitle')}
          description={t('admin-pages.crm.opportunities.emptyHint')}
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <div className="mt-4 hidden overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)] md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('admin-pages.crm.opportunities.colNumber')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin-pages.crm.opportunities.colTitle')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin-pages.crm.opportunities.stage')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin-pages.crm.opportunities.status')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin-pages.crm.opportunities.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--admin-border)]">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link
                        href={`/insightbooks/crm/opportunities/${encodeURIComponent(row.id)}`}
                        className="text-[var(--admin-accent)] hover:underline"
                      >
                        {row.opportunityNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{row.title}</td>
                    <td className="px-3 py-2 text-xs">{row.stageCode}</td>
                    <td className="px-3 py-2">
                      <AdminStatusBadge tone="info">{row.status}</AdminStatusBadge>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.amount != null && row.currency
                        ? `${row.amount} ${row.currency}`
                        : '—'}
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
                  href={`/insightbooks/crm/opportunities/${encodeURIComponent(row.id)}`}
                  className="font-mono text-xs text-[var(--admin-accent)]"
                >
                  {row.opportunityNumber}
                </Link>
                <p className="mt-1 text-sm">{row.title}</p>
                <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{row.stageCode}</p>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              className={btnGhost}
              disabled={!canPrev || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              {t('admin-pages.crm.opportunities.prev')}
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={!canNext || loading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              {t('admin-pages.crm.opportunities.next')}
            </button>
            <span className="text-xs text-[var(--admin-text-muted)]">
              {t('admin-pages.crm.opportunities.pageOffset')}: {offset}
            </span>
          </div>
        </>
      ) : null}
    </AdminPageContainer>
  );
}
