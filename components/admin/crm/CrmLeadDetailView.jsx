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
import CrmChannelBadge from './CrmChannelBadge';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm text-white hover:opacity-90 disabled:opacity-50';

export default function CrmLeadDetailView({ leadId }) {
  const { t } = useI18n();
  const [lead, setLead] = useState(null);
  const [history, setHistory] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activities, setActivities] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [scoreEval, setScoreEval] = useState(null);
  const [scoreStatus, setScoreStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setError('');
    try {
      const [leadRes, tlRes, notesRes, scoreRes, actRes] = await Promise.all([
        adminFetch(`/api/admin/crm/leads/${encodeURIComponent(leadId)}`, {
          credentials: 'include',
        }),
        adminFetch(
          `/api/admin/crm/timeline?subjectType=LEAD&subjectId=${encodeURIComponent(leadId)}&limit=30`,
          { credentials: 'include' }
        ),
        adminFetch(
          `/api/admin/crm/notes?subjectType=LEAD&subjectId=${encodeURIComponent(leadId)}&limit=30`,
          { credentials: 'include' }
        ),
        adminFetch(
          `/api/admin/crm/scoring?leadId=${encodeURIComponent(leadId)}`,
          { credentials: 'include' }
        ),
        adminFetch(
          `/api/admin/crm/activities?primarySubjectType=LEAD&primarySubjectId=${encodeURIComponent(leadId)}&limit=20`,
          { credentials: 'include' }
        ),
      ]);
      const leadBody = await leadRes.json().catch(() => ({}));
      if (leadRes.status === 403) {
        throw new Error(leadBody.error || t('admin-pages.crm.forbidden'));
      }
      if (leadRes.status === 404) throw new Error(t('admin-pages.crm.leads.notFound'));
      if (!leadRes.ok) throw new Error(leadBody.error || t('admin-pages.crm.leads.loadFailed'));
      setLead(leadBody.lead || null);
      setHistory(Array.isArray(leadBody.statusHistory) ? leadBody.statusHistory : []);

      const tlBody = await tlRes.json().catch(() => ({}));
      setTimeline(Array.isArray(tlBody.items) ? tlBody.items : []);

      const notesBody = await notesRes.json().catch(() => ({}));
      setNotes(Array.isArray(notesBody.items) ? notesBody.items : []);

      const actBody = await actRes.json().catch(() => ({}));
      setActivities(Array.isArray(actBody.items) ? actBody.items : []);

      const scoreBody = await scoreRes.json().catch(() => ({}));
      if (scoreRes.ok && scoreBody.evaluation) {
        setScoreEval(scoreBody.evaluation);
        setScoreStatus(scoreBody.status || 'OK');
      } else if (scoreRes.ok) {
        setScoreEval(null);
        setScoreStatus(scoreBody.status || 'INSUFFICIENT');
      } else {
        setScoreEval(null);
        setScoreStatus('UNAVAILABLE');
      }
    } catch (e) {
      setError(e.message || t('admin-pages.crm.leads.loadFailed'));
      setLead(null);
    } finally {
      setLoading(false);
    }
  }, [leadId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const runReadiness = async (markReady = false) => {
    setBusy(true);
    try {
      const res = await adminFetch('/api/admin/crm/opportunity-readiness', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, markReady }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.crm.readiness.failed'));
      setReadiness(body);
      await load();
    } catch (e) {
      setError(e.message || t('admin-pages.crm.readiness.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={lead?.leadNumber || t('admin-pages.crm.sections.leads')}
        description={t('admin-pages.crm.sectionHints.leadDetail')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/insightbooks/crm/leads" className={btnGhost}>
              {t('admin-pages.crm.leads.backToList')}
            </Link>
            <button
              type="button"
              className={btnGhost}
              onClick={load}
              disabled={loading || busy}
            >
              {t('admin-pages.common.refresh')}
            </button>
          </div>
        }
      />
      <CrmSectionNav />

      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}

      {!loading && lead ? (
        <div className="mt-4 space-y-6">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-[var(--admin-text)]">{lead.title}</h2>
            <div className="flex flex-wrap gap-2">
              <AdminStatusBadge tone="info">{lead.status}</AdminStatusBadge>
              <CrmChannelBadge channel={lead.channel} />
              <AdminStatusBadge tone="neutral">{lead.source || '—'}</AdminStatusBadge>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--admin-text-muted)]">{t('admin-pages.crm.leads.account')}</dt>
                <dd>{lead.accountId || '—'}</dd>
              </div>
              <div>
                <dt className="text-[var(--admin-text-muted)]">{t('admin-pages.crm.leads.contact')}</dt>
                <dd>{lead.contactId || '—'}</dd>
              </div>
              <div>
                <dt className="text-[var(--admin-text-muted)]">{t('admin-pages.crm.leads.owner')}</dt>
                <dd>{lead.ownerAdminId || '—'}</dd>
              </div>
              <div>
                <dt className="text-[var(--admin-text-muted)]">{t('admin-pages.crm.leads.qualification')}</dt>
                <dd>
                  {lead.status === 'QUALIFIED' || lead.status === 'OPPORTUNITY_READY'
                    ? t('admin-pages.crm.leads.qualifiedYes')
                    : t('admin-pages.crm.leads.qualifiedNo')}
                </dd>
              </div>
            </dl>
            {lead.summary ? (
              <p className="text-sm text-[var(--admin-text-muted)]">{lead.summary}</p>
            ) : null}
          </section>

          <section>
            <h3 className="text-sm font-semibold">{t('admin-pages.crm.leads.scoreSection')}</h3>
            <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
              {t('admin-pages.crm.leads.scoreNeverProbability')}
            </p>
            {scoreEval ? (
              <div className="mt-2 space-y-2 text-sm">
                <p>
                  {scoreEval.displayLabel || t('admin-pages.crm.leads.fitScoreLabel')}
                  {': '}
                  {scoreEval.score}
                  {scoreEval.band ? ` (${scoreEval.band})` : ''}
                </p>
                <p>
                  {t('admin-pages.crm.leads.scoreConfidence')}:{' '}
                  <AdminStatusBadge tone="info">{scoreEval.confidence}</AdminStatusBadge>
                </p>
                <p className="text-xs text-[var(--admin-text-muted)]">
                  version {scoreEval.definitionVersionId}
                  {scoreEval.id ? ` · eval ${scoreEval.id}` : ''}
                </p>
                <div>
                  <p className="text-xs font-medium text-[var(--admin-text-muted)]">
                    {t('admin-pages.crm.leads.scoreDimensions')}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {(scoreEval.contributions || []).map((c) => (
                      <li key={c.dimensionKey} className="flex flex-wrap gap-2">
                        <span>{c.label || c.dimensionKey}</span>
                        <span className="text-[var(--admin-text-muted)]">
                          {c.missing
                            ? 'N/A'
                            : `${c.points ?? '—'}/${c.maxPoints ?? '—'}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {(scoreEval.contributions || []).length === 0 ? (
                    <p className="mt-1 text-[var(--admin-text-muted)]">
                      {t('admin-pages.crm.leads.scoreInsufficient')}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--admin-text-muted)]">
                {scoreStatus === 'UNAVAILABLE'
                  ? t('admin-pages.crm.leads.scoreUnavailable')
                  : t('admin-pages.crm.leads.scoreInsufficient')}
              </p>
            )}
          </section>

          <section>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{t('admin-pages.crm.readiness.title')}</h3>
              <button
                type="button"
                className={btnGhost}
                disabled={busy}
                onClick={() => runReadiness(false)}
              >
                {t('admin-pages.crm.readiness.evaluate')}
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={busy}
                onClick={() => runReadiness(true)}
              >
                {t('admin-pages.crm.readiness.markReady')}
              </button>
            </div>
            <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
              {t('admin-pages.crm.readiness.noOpportunity')}
            </p>
            {readiness ? (
              <div className="mt-3 space-y-2">
                <AdminStatusBadge tone="info">{readiness.readinessStatus}</AdminStatusBadge>
                <ul className="space-y-1 text-sm">
                  {(readiness.checklist || []).map((c) => (
                    <li key={c.key} className="flex flex-wrap gap-2">
                      <AdminStatusBadge
                        tone={c.ok ? 'success' : c.blocker ? tt('danger') : tt('warning')}
                      >
                        {c.key}
                      </AdminStatusBadge>
                      <span className="text-[var(--admin-text-muted)]">{c.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section>
            <h3 className="text-sm font-semibold">{t('admin-pages.crm.leads.consent')}</h3>
            <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
              {t('admin-pages.crm.leads.consentHint')}
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold">{t('admin-pages.crm.leads.notes')}</h3>
            {notes.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                {t('admin-pages.crm.leads.noNotes')}
              </p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {notes.map((n) => (
                  <li key={n.id} className="border-t border-[var(--admin-border)] pt-2">
                    <AdminStatusBadge tone="neutral">{n.visibility}</AdminStatusBadge>
                    <p className="mt-1">{n.redacted ? t('admin-pages.crm.leads.noteRedacted') : n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold">{t('admin-pages.crm.sections.activities')}</h3>
            <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
              {t('admin-pages.crm.sectionHints.activitiesList')}
            </p>
            {activities.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                {t('admin-pages.crm.activities.emptyTitle')}
              </p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {activities.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2">
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
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold">{t('admin-pages.crm.leads.timeline')}</h3>
            {timeline.length === 0 && history.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                {t('admin-pages.crm.leads.noTimeline')}
              </p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {timeline.map((ev) => (
                  <li key={ev.id}>
                    <span className="font-mono text-xs text-[var(--admin-text-muted)]">
                      {ev.at}
                    </span>{' '}
                    <AdminStatusBadge tone="neutral">{ev.eventType}</AdminStatusBadge> {ev.summary}
                  </li>
                ))}
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="font-mono text-xs text-[var(--admin-text-muted)]">
                      {h.at}
                    </span>{' '}
                    {h.fromStatus || '—'} → {h.toStatus}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
