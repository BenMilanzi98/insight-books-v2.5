'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import CustomerSuccessSectionNav from './CustomerSuccessSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--admin-accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';
const inputCls =
  'h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text)]';
const areaCls =
  'min-h-[5rem] w-full rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-text)]';

export default function CustomerSuccessCaseDetailView({ caseId }) {
  const { t } = useI18n();
  const [detail, setDetail] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [intType, setIntType] = useState('NOTE');
  const [intNotes, setIntNotes] = useState('');

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch(
        `/api/admin/customer-success/cases/${encodeURIComponent(caseId)}`,
        { credentials: 'include' }
      );
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.customerSuccess.forbidden'));
      }
      if (res.status === 404) {
        throw new Error(t('admin-pages.customerSuccess.cases.notFound'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.customerSuccess.cases.loadFailed'));
      setDetail(body.case || null);
      setTasks(Array.isArray(body.tasks) ? body.tasks : []);
      setInterventions(Array.isArray(body.interventions) ? body.interventions : []);
    } catch (e) {
      setError(e.message || t('admin-pages.customerSuccess.cases.loadFailed'));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [caseId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (status) => {
    setBusy(true);
    setError('');
    try {
      const res = await adminFetch(
        `/api/admin/customer-success/cases/${encodeURIComponent(caseId)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.customerSuccess.cases.updateFailed'));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    setBusy(true);
    try {
      const res = await adminFetch('/api/admin/customer-success/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, title: taskTitle.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.customerSuccess.tasks.createFailed'));
      setTaskTitle('');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const addIntervention = async () => {
    if (!intType.trim()) return;
    setBusy(true);
    try {
      const res = await adminFetch('/api/admin/customer-success/interventions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          type: intType.trim(),
          notes: intNotes.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || t('admin-pages.customerSuccess.interventions.createFailed'));
      }
      setIntNotes('');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={detail?.title || t('admin-pages.customerSuccess.sections.cases')}
        description={t('admin-pages.customerSuccess.cases.detailHint')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/insightbooks/customer-success/cases" className={btnGhost}>
              {t('admin-pages.customerSuccess.cases.backToQueue')}
            </Link>
            <button type="button" className={btnGhost} onClick={load} disabled={loading || busy}>
              {t('admin-pages.common.refresh')}
            </button>
          </div>
        }
      />
      <CustomerSuccessSectionNav />

      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}

      {!loading && detail ? (
        <div className="mt-4 space-y-6">
          <section className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <AdminStatusBadge tone="info" label={detail.status} />
              <AdminStatusBadge tone="neutral" label={detail.priority || 'MEDIUM'} />
              <span className="text-[var(--admin-text-muted)]">
                {detail.triggerType}
                {detail.triggerCode ? ` · ${detail.triggerCode}` : ''}
              </span>
            </div>
            <p className="font-mono text-xs text-[var(--admin-text-muted)]">
              {t('admin-pages.customerSuccess.cases.colTenant')}: {detail.tenantId}
            </p>
            {detail.summary ? (
              <p className="text-[var(--admin-text)]">{detail.summary}</p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                className={btnGhost}
                disabled={busy}
                onClick={() => setStatus('IN_PROGRESS')}
              >
                IN_PROGRESS
              </button>
              <button
                type="button"
                className={btnGhost}
                disabled={busy}
                onClick={() => setStatus('RESOLVED')}
              >
                RESOLVED
              </button>
              <button
                type="button"
                className={btnGhost}
                disabled={busy}
                onClick={() => setStatus('CLOSED')}
              >
                CLOSED
              </button>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--admin-text)]">
              {t('admin-pages.customerSuccess.sections.tasks')}
            </h2>
            <div className="mb-3 flex flex-wrap gap-2">
              <input
                className={inputCls}
                style={{ maxWidth: '24rem' }}
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder={t('admin-pages.customerSuccess.tasks.titlePlaceholder')}
              />
              <button type="button" className={btnPrimary} disabled={busy} onClick={addTask}>
                {t('admin-pages.customerSuccess.tasks.add')}
              </button>
            </div>
            <ul className="space-y-1 text-sm">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between border-b border-[var(--admin-border)] py-2"
                >
                  <span>{task.title}</span>
                  <AdminStatusBadge tone="info" label={task.status} />
                </li>
              ))}
              {tasks.length === 0 ? (
                <li className="text-[var(--admin-text-muted)]">
                  {t('admin-pages.customerSuccess.tasks.emptyHint')}
                </li>
              ) : null}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--admin-text)]">
              {t('admin-pages.customerSuccess.sections.interventions')}
            </h2>
            <p className="mb-2 text-xs text-[var(--admin-text-muted)]">
              {t('admin-pages.customerSuccess.interventions.notTicket')}
            </p>
            <div className="mb-3 grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
              <input
                className={inputCls}
                value={intType}
                onChange={(e) => setIntType(e.target.value)}
                placeholder="NOTE"
              />
              <textarea
                className={areaCls}
                value={intNotes}
                onChange={(e) => setIntNotes(e.target.value)}
                placeholder={t('admin-pages.customerSuccess.interventions.notesPlaceholder')}
              />
              <button
                type="button"
                className={btnPrimary}
                disabled={busy}
                onClick={addIntervention}
              >
                {t('admin-pages.customerSuccess.interventions.add')}
              </button>
            </div>
            <ul className="space-y-2 text-sm">
              {interventions.map((row) => (
                <li key={row.id} className="border-b border-[var(--admin-border)] py-2">
                  <div className="flex items-center gap-2">
                    <AdminStatusBadge tone="neutral" label={row.type} />
                    <span className="text-xs text-[var(--admin-text-muted)]">
                      {row.performedAt || ''}
                    </span>
                  </div>
                  {row.notes ? <p className="mt-1">{row.notes}</p> : null}
                </li>
              ))}
              {interventions.length === 0 ? (
                <li className="text-[var(--admin-text-muted)]">
                  {t('admin-pages.customerSuccess.interventions.emptyHint')}
                </li>
              ) : null}
            </ul>
          </section>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
