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
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import CrmSectionNav from './CrmSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm text-white hover:opacity-90 disabled:opacity-50';
const inputCls =
  'h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)]';
const selectCls =
  'h-10 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)]';

export default function CrmOpportunityDetailView({ opportunityId }) {
  const { t } = useI18n();
  const [opp, setOpp] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [risks, setRisks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [winReason, setWinReason] = useState('BEST_FIT');
  const [lossReason, setLossReason] = useState('NO_BUDGET');
  const [decisionDate, setDecisionDate] = useState('');
  const [evidence, setEvidence] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [readiness, setReadiness] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const id = encodeURIComponent(opportunityId);
      const [oppRes, tlRes, riskRes, taskRes, actRes] = await Promise.all([
        adminFetch(`/api/admin/crm/opportunities/${id}`, { credentials: 'include' }),
        adminFetch(`/api/admin/crm/opportunities/${id}/timeline?limit=50`, {
          credentials: 'include',
        }),
        adminFetch(`/api/admin/crm/opportunities/${id}/risks?evaluate=1`, {
          credentials: 'include',
        }),
        adminFetch(`/api/admin/crm/opportunities/${id}/tasks`, { credentials: 'include' }),
        adminFetch(
          `/api/admin/crm/activities?primarySubjectType=OPPORTUNITY&primarySubjectId=${id}&limit=20`,
          { credentials: 'include' }
        ),
      ]);
      const oppBody = await oppRes.json().catch(() => ({}));
      if (!oppRes.ok) throw new Error(oppBody.error || t('admin-pages.crm.opportunities.notFound'));
      setOpp(oppBody.opportunity || oppBody);
      const tlBody = await tlRes.json().catch(() => ({}));
      setTimeline(Array.isArray(tlBody.items) ? tlBody.items : []);
      const riskBody = await riskRes.json().catch(() => ({}));
      setRisks(Array.isArray(riskBody.risks) ? riskBody.risks : riskBody.items || []);
      const taskBody = await taskRes.json().catch(() => ({}));
      setTasks(Array.isArray(taskBody.items) ? taskBody.items : []);
      const actBody = await actRes.json().catch(() => ({}));
      setActivities(Array.isArray(actBody.items) ? actBody.items : []);
    } catch (e) {
      setError(e.message || t('admin-pages.crm.opportunities.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [opportunityId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const closeWon = async () => {
    setMsg('');
    const res = await adminFetch(
      `/api/admin/crm/opportunities/${encodeURIComponent(opportunityId)}/close`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'WON',
          winReason,
          decisionDate: decisionDate || new Date().toISOString().slice(0, 10),
          evidence: evidence
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(
        [body.error, ...(body.missingCriteria || [])].filter(Boolean).join(' — ') ||
          t('admin-pages.crm.opportunities.closeFailed')
      );
      return;
    }
    setMsg(t('admin-pages.crm.opportunities.closedWonOk'));
    await load();
  };

  const closeLost = async () => {
    setMsg('');
    const res = await adminFetch(
      `/api/admin/crm/opportunities/${encodeURIComponent(opportunityId)}/close`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'LOST', lossReason }),
      }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(body.error || t('admin-pages.crm.opportunities.closeFailed'));
      return;
    }
    setMsg(t('admin-pages.crm.opportunities.closedLostOk'));
    await load();
  };

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    const res = await adminFetch(
      `/api/admin/crm/opportunities/${encodeURIComponent(opportunityId)}/tasks`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: taskTitle.trim() }),
      }
    );
    if (res.ok) {
      setTaskTitle('');
      await load();
    }
  };

  const evalProposal = async () => {
    const res = await adminFetch(
      `/api/admin/crm/opportunities/${encodeURIComponent(opportunityId)}/proposal-readiness`,
      { method: 'POST', credentials: 'include' }
    );
    const body = await res.json().catch(() => ({}));
    setReadiness({ kind: 'proposal', ...body });
  };

  const evalConversion = async () => {
    const res = await adminFetch(
      `/api/admin/crm/opportunities/${encodeURIComponent(opportunityId)}/conversion-readiness`,
      { method: 'POST', credentials: 'include' }
    );
    const body = await res.json().catch(() => ({}));
    setReadiness({ kind: 'conversion', ...body });
  };

  if (loading) {
    return (
      <AdminPageContainer>
        <CrmSectionNav />
        <AdminLoadingState />
      </AdminPageContainer>
    );
  }

  if (error || !opp) {
    return (
      <AdminPageContainer>
        <CrmSectionNav />
        <AdminErrorState message={error || t('admin-pages.crm.opportunities.notFound')} onRetry={load} />
      </AdminPageContainer>
    );
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={opp.opportunityNumber || t('admin-pages.crm.sections.opportunities')}
        description={opp.title || ''}
        actions={
          <Link href="/insightbooks/crm/opportunities" className={btnGhost}>
            {t('admin-pages.crm.opportunities.backToList')}
          </Link>
        }
      />
      <CrmSectionNav />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-4">
          <h2 className="text-sm font-semibold">{t('admin-pages.crm.opportunities.summary')}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--admin-text-muted)]">{t('admin-pages.crm.opportunities.stage')}</dt>
              <dd>{opp.stageCode}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--admin-text-muted)]">{t('admin-pages.crm.opportunities.status')}</dt>
              <dd>
                <AdminStatusBadge tone="info">{opp.status}</AdminStatusBadge>
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--admin-text-muted)]">{t('admin-pages.crm.opportunities.amount')}</dt>
              <dd>
                {opp.amount != null && opp.currency ? `${opp.amount} ${opp.currency}` : '—'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-4">
          <h2 className="text-sm font-semibold">{t('admin-pages.crm.opportunities.closeTitle')}</h2>
          <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
            {t('admin-pages.crm.opportunities.closeHint')}
          </p>
          <div className="mt-3 space-y-2">
            <label className="block text-xs">
              {t('admin-pages.crm.opportunities.winReason')}
              <select className={`${selectCls} mt-1 w-full`} value={winReason} onChange={(e) => setWinReason(e.target.value)}>
                <option value="BEST_FIT">BEST_FIT</option>
                <option value="PRICE">PRICE</option>
                <option value="RELATIONSHIP">RELATIONSHIP</option>
                <option value="URGENCY">URGENCY</option>
                <option value="OTHER">OTHER</option>
              </select>
            </label>
            <label className="block text-xs">
              {t('admin-pages.crm.opportunities.decisionDate')}
              <input
                type="date"
                className={`${inputCls} mt-1`}
                value={decisionDate}
                onChange={(e) => setDecisionDate(e.target.value)}
              />
            </label>
            <label className="block text-xs">
              {t('admin-pages.crm.opportunities.evidence')}
              <textarea
                className={`${inputCls} mt-1 h-20 py-2`}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder={t('admin-pages.crm.opportunities.evidenceHint')}
              />
            </label>
            <button type="button" className={btnPrimary} onClick={closeWon}>
              {t('admin-pages.crm.opportunities.closeWon')}
            </button>
            <div className="border-t border-[var(--admin-border)] pt-2">
              <label className="block text-xs">
                {t('admin-pages.crm.opportunities.lossReason')}
                <select className={`${selectCls} mt-1 w-full`} value={lossReason} onChange={(e) => setLossReason(e.target.value)}>
                  <option value="NO_BUDGET">NO_BUDGET</option>
                  <option value="COMPETITOR">COMPETITOR</option>
                  <option value="NO_DECISION">NO_DECISION</option>
                  <option value="TIMING">TIMING</option>
                  <option value="REQUIREMENTS_MISMATCH">{tt('REQUIREMENTS_MISMATCH')}</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </label>
              <button type="button" className={`${btnGhost} mt-2`} onClick={closeLost}>
                {t('admin-pages.crm.opportunities.closeLost')}
              </button>
            </div>
          </div>
          {msg ? (
            <p className="mt-2 text-sm" role="status">
              {msg}
            </p>
          ) : null}
        </section>

        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-4">
          <h2 className="text-sm font-semibold">{t('admin-pages.crm.opportunities.risks')}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {risks.length === 0 ? (
              <li className="text-[var(--admin-text-muted)]">{t('admin-pages.crm.opportunities.noRisks')}</li>
            ) : (
              risks.map((r) => (
                <li key={r.code || r.id}>
                  <AdminStatusBadge tone={r.severity === 'CRITICAL' ? 'danger' : 'info'}>
                    {r.severity}
                  </AdminStatusBadge>{' '}
                  {r.code}: {r.detail}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-4">
          <h2 className="text-sm font-semibold">{t('admin-pages.crm.opportunities.tasks')}</h2>
          <div className="mt-2 flex gap-2">
            <input
              className={inputCls}
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder={t('admin-pages.crm.opportunities.taskTitle')}
            />
            <button type="button" className={btnGhost} onClick={addTask}>
              {t('admin-pages.crm.opportunities.addTask')}
            </button>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {tasks.map((task) => (
              <li key={task.id}>
                {task.title} — {task.status}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold">{t('admin-pages.crm.opportunities.readiness')}</h2>
          <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
            {t('admin-pages.crm.opportunities.readinessHint')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={evalProposal}>
              {t('admin-pages.crm.opportunities.evalProposal')}
            </button>
            <button type="button" className={btnGhost} onClick={evalConversion}>
              {t('admin-pages.crm.opportunities.evalConversion')}
            </button>
          </div>
          {readiness ? (
            <pre className="mt-3 overflow-x-auto rounded bg-[var(--admin-surface-muted)] p-3 text-xs">
              {JSON.stringify(
                {
                  kind: readiness.kind,
                  readinessStatus: readiness.readinessStatus,
                  proposalCreated: readiness.proposalCreated,
                  conversionExecuted: readiness.conversionExecuted,
                  handoffPayload: readiness.handoffPayload,
                },
                null,
                2
              )}
            </pre>
          ) : null}
        </section>

        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold">{t('admin-pages.crm.sections.activities')}</h2>
          <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
            {t('admin-pages.crm.sectionHints.activitiesList')}
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {activities.length === 0 ? (
              <li className="text-[var(--admin-text-muted)]">
                {t('admin-pages.crm.activities.emptyTitle')}
              </li>
            ) : (
              activities.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 border-t border-[var(--admin-border)] pt-2">
                  <Link
                    href={`/insightbooks/crm/activities/${encodeURIComponent(a.id)}`}
                    className="font-mono text-xs text-[var(--admin-link)] hover:underline"
                  >
                    {a.activityNumber || a.id}
                  </Link>
                  <AdminStatusBadge tone="neutral">{a.type}</AdminStatusBadge>
                  <AdminStatusBadge tone="info">{a.status}</AdminStatusBadge>
                  <span>{a.title || '—'}</span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold">{t('admin-pages.crm.opportunities.timeline')}</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {timeline.length === 0 ? (
              <li className="text-[var(--admin-text-muted)]">{t('admin-pages.crm.opportunities.noTimeline')}</li>
            ) : (
              timeline.map((ev) => (
                <li key={ev.id} className="border-t border-[var(--admin-border)] pt-2">
                  <span className="text-xs text-[var(--admin-text-muted)]">{ev.at}</span>
                  <div>
                    {ev.eventType}: {ev.summary}
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </AdminPageContainer>
  );
}
