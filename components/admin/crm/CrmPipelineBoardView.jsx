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

export default function CrmPipelineBoardView({ myPipeline = false }) {
  const { t } = useI18n();
  const [columns, setColumns] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [transitionError, setTransitionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (myPipeline) qs.set('myPipeline', '1');
      const res = await adminFetch(`/api/admin/crm/pipeline/board?${qs}`, {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.crm.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.crm.pipeline.loadFailed'));
      setColumns(Array.isArray(body.columns) ? body.columns : []);
      setMeta(body.meta || null);
    } catch (e) {
      setError(e.message || t('admin-pages.crm.pipeline.loadFailed'));
      setColumns([]);
    } finally {
      setLoading(false);
    }
  }, [myPipeline, t]);

  useEffect(() => {
    load();
  }, [load]);

  const moveCard = async (opp, toStageCode) => {
    if (!opp?.id || !toStageCode || toStageCode === opp.stageCode) return;
    setBusyId(opp.id);
    setTransitionError('');
    const previous = columns;
    // Optimistic remove from current column only for UX; restore on failure
    setColumns((cols) =>
      cols.map((col) => ({
        ...col,
        items: (col.items || []).filter((item) => item.id !== opp.id),
      }))
    );
    try {
      const res = await adminFetch(`/api/admin/crm/opportunities/${encodeURIComponent(opp.id)}/stage`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toStageCode,
          expectedVersion: opp.version,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setColumns(previous);
        const missing = Array.isArray(body.missingCriteria)
          ? body.missingCriteria.join(', ')
          : '';
        setTransitionError(
          [body.error || t('admin-pages.crm.pipeline.transitionFailed'), missing]
            .filter(Boolean)
            .join(' — ')
        );
        return;
      }
      await load();
    } catch (e) {
      setColumns(previous);
      setTransitionError(e.message || t('admin-pages.crm.pipeline.transitionFailed'));
    } finally {
      setBusyId('');
    }
  };

  const titleKey = myPipeline
    ? 'admin-pages.crm.sections.myPipeline'
    : 'admin-pages.crm.sections.pipelineBoard';
  const hintKey = myPipeline
    ? 'admin-pages.crm.sectionHints.myPipeline'
    : 'admin-pages.crm.sectionHints.pipelineBoard';

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t(titleKey)}
        description={t(hintKey)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/insightbooks/crm/pipeline/list" className={btnGhost}>
              {t('admin-pages.crm.pipeline.listView')}
            </Link>
            {!myPipeline ? (
              <Link href="/insightbooks/crm/pipeline/my-pipeline" className={btnGhost}>
                {t('admin-pages.crm.sections.myPipeline')}
              </Link>
            ) : (
              <Link href="/insightbooks/crm/pipeline/board" className={btnGhost}>
                {t('admin-pages.crm.sections.pipelineBoard')}
              </Link>
            )}
            <button type="button" className={btnGhost} onClick={load} disabled={loading}>
              {t('admin-pages.common.refresh')}
            </button>
          </div>
        }
      />
      <CrmSectionNav />

      <p className="mb-3 text-sm text-[var(--admin-text-muted)]" role="note">
        {t('admin-pages.crm.pipeline.boardHint')}
        {meta?.weightedUiEnabled === false
          ? ` ${t('admin-pages.crm.pipeline.weightedDark')}`
          : ''}
      </p>

      {transitionError ? (
        <div className="mb-3 rounded-[var(--admin-radius)] border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {transitionError}
        </div>
      ) : null}

      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && columns.every((c) => !(c.items || []).length) ? (
        <AdminEmptyState
          title={t('admin-pages.crm.pipeline.emptyTitle')}
          description={t('admin-pages.crm.pipeline.emptyHint')}
        />
      ) : null}

      {!loading && !error ? (
        <div className="mt-2 flex gap-3 overflow-x-auto pb-4" role="list" aria-label={t('admin-pages.crm.pipeline.boardLabel')}>
          {columns.map((col) => (
            <section
              key={col.stageCode}
              role="listitem"
              aria-label={col.stageName}
              className="min-w-[240px] max-w-[280px] flex-shrink-0 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)]"
            >
              <header className="border-b border-[var(--admin-border)] px-3 py-2">
                <h2 className="text-sm font-semibold text-[var(--admin-text)]">{col.stageName}</h2>
                <p className="text-xs text-[var(--admin-text-muted)]">
                  {col.meta?.count ?? 0}
                  {col.meta?.truncated ? ` (${t('admin-pages.crm.pipeline.truncated')})` : ''}
                </p>
              </header>
              <ul className="space-y-2 p-2">
                {(col.items || []).map((opp) => (
                  <li
                    key={opp.id}
                    className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2"
                  >
                    <Link
                      href={`/insightbooks/crm/opportunities/${encodeURIComponent(opp.id)}`}
                      className="block text-sm font-medium text-[var(--admin-accent)] hover:underline"
                    >
                      {opp.opportunityNumber}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--admin-text)]">{opp.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <AdminStatusBadge tone="info">{opp.status}</AdminStatusBadge>
                      <label className="flex min-w-0 flex-1 items-center gap-1 text-xs text-[var(--admin-text-muted)]">
                        <span className="sr-only">{t('admin-pages.crm.pipeline.moveStage')}</span>
                        <select
                          className={`${selectCls} h-8 w-full text-xs`}
                          value={opp.stageCode}
                          disabled={busyId === opp.id || Boolean(col.terminal)}
                          aria-label={`${t('admin-pages.crm.pipeline.moveStage')}: ${opp.opportunityNumber}`}
                          onChange={(e) => moveCard(opp, e.target.value)}
                        >
                          {columns.map((c) => (
                            <option key={c.stageCode} value={c.stageCode}>
                              {c.stageName}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
