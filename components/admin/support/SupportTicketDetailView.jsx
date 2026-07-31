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
import SupportSectionNav from './SupportSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--admin-accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';
const inputCls =
  'h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text)]';
const areaCls =
  'min-h-[5rem] w-full rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-text)]';
const selectCls =
  'h-10 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)]';

function slaTone(state) {
  if (state === 'BREACHED') return 'danger';
  if (state === 'PAUSED') return 'warning';
  if (state === 'STOPPED') return 'neutral';
  return 'info';
}

function channelBadge(channel, t) {
  if (channel === 'EMAIL' || channel === 'WHATSAPP' || channel === 'PORTAL') {
    return `${channel} · ${t('admin-pages.support.channelNotAvailable')}`;
  }
  return channel || 'ADMIN_MANUAL';
}

export default function SupportTicketDetailView({ ticketId }) {
  const { t } = useI18n();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [clocks, setClocks] = useState([]);
  const [slaStatus, setSlaStatus] = useState('AVAILABLE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toStatus, setToStatus] = useState('');
  const [resolutionCategory, setResolutionCategory] = useState('');
  const [assigneeAdminId, setAssigneeAdminId] = useState('');
  const [queueCode, setQueueCode] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [noteBody, setNoteBody] = useState('');

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setError('');
    try {
      const [ticketRes, msgRes, slaRes] = await Promise.all([
        adminFetch(`/api/admin/support/tickets/${encodeURIComponent(ticketId)}`, {
          credentials: 'include',
        }),
        adminFetch(`/api/admin/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
          credentials: 'include',
        }),
        adminFetch(`/api/admin/support/tickets/${encodeURIComponent(ticketId)}/sla`, {
          credentials: 'include',
        }),
      ]);

      const ticketBody = await ticketRes.json().catch(() => ({}));
      if (ticketRes.status === 403) {
        throw new Error(ticketBody.error || t('admin-pages.support.forbidden'));
      }
      if (ticketRes.status === 404) {
        throw new Error(t('admin-pages.support.tickets.notFound'));
      }
      if (!ticketRes.ok) {
        throw new Error(ticketBody.error || t('admin-pages.support.tickets.loadFailed'));
      }
      setTicket(ticketBody.ticket || null);
      setAssigneeAdminId(ticketBody.ticket?.assigneeAdminId || '');
      setQueueCode(ticketBody.ticket?.queueCode || '');

      const msgBody = await msgRes.json().catch(() => ({}));
      setMessages(msgRes.ok && Array.isArray(msgBody.items) ? msgBody.items : []);

      const slaBody = await slaRes.json().catch(() => ({}));
      setSlaStatus(slaBody.status || (slaRes.ok ? 'AVAILABLE' : 'UNAVAILABLE'));
      setClocks(slaRes.ok && Array.isArray(slaBody.items) ? slaBody.items : []);
    } catch (e) {
      setError(e.message || t('admin-pages.support.tickets.loadFailed'));
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [ticketId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const transition = async () => {
    if (!toStatus) return;
    setBusy(true);
    setError('');
    try {
      const res = await adminFetch(
        `/api/admin/support/tickets/${encodeURIComponent(ticketId)}/status`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toStatus,
            resolutionCategory: resolutionCategory || undefined,
            reason: 'admin_ui',
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.support.tickets.updateFailed'));
      setToStatus('');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const assign = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await adminFetch(
        `/api/admin/support/tickets/${encodeURIComponent(ticketId)}/assign`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assigneeAdminId: assigneeAdminId || null,
            queueCode: queueCode || null,
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.support.tickets.assignFailed'));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const postMessage = async (type) => {
    const bodyText = type === 'INTERNAL_NOTE' ? noteBody : replyBody;
    if (!bodyText.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await adminFetch(
        `/api/admin/support/tickets/${encodeURIComponent(ticketId)}/messages`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, body: bodyText.trim() }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.support.tickets.messageFailed'));
      if (type === 'INTERNAL_NOTE') setNoteBody('');
      else setReplyBody('');
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
        title={ticket?.ticketNumber || t('admin-pages.support.sections.tickets')}
        description={ticket?.title || t('admin-pages.support.sectionHints.tickets')}
        actions={
          <Link href="/insightbooks/support/tickets" className={btnGhost}>
            {t('admin-pages.support.tickets.backToList')}
          </Link>
        }
      />
      <SupportSectionNav />

      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}

      {!loading && ticket ? (
        <div className="mt-4 space-y-6">
          <div className="flex flex-wrap gap-3 text-sm">
            <AdminStatusBadge tone="info" label={ticket.status} />
            <AdminStatusBadge tone="neutral" label={ticket.priority || '—'} />
            <span className="text-[var(--admin-text-muted)]">
              {channelBadge(ticket.sourceChannel, t)}
            </span>
            <span className="font-mono text-xs text-[var(--admin-text-muted)]">
              {ticket.tenantId}
            </span>
          </div>

          {ticket.description ? (
            <p className="whitespace-pre-wrap text-sm text-[var(--admin-text)]">
              {ticket.description}
            </p>
          ) : null}

          <section>
            <h2 className="mb-2 text-sm font-semibold text-[var(--admin-text)]">
              {t('admin-pages.support.sla.title')}
            </h2>
            {slaStatus === 'UNAVAILABLE' || slaStatus === 'NOT_AVAILABLE' ? (
              <p className="text-sm text-[var(--admin-text-muted)]">
                {t('admin-pages.support.sla.unavailable')}
              </p>
            ) : null}
            {slaStatus !== 'UNAVAILABLE' &&
            slaStatus !== 'NOT_AVAILABLE' &&
            clocks.length === 0 ? (
              <p className="text-sm text-[var(--admin-text-muted)]">
                {t('admin-pages.support.sla.empty')}
              </p>
            ) : null}
            {clocks.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {clocks.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{c.clockType}</span>
                      <AdminStatusBadge tone={slaTone(c.state)} label={c.state} />
                    </div>
                    <dl className="mt-2 space-y-1 text-xs text-[var(--admin-text-muted)]">
                      <div className="flex justify-between gap-2">
                        <dt>{t('admin-pages.support.sla.dueAt')}</dt>
                        <dd className="font-mono">{c.dueAt || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>{t('admin-pages.support.sla.policyVersion')}</dt>
                        <dd className="font-mono">{c.policyVersion}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>{t('admin-pages.support.sla.calendarVersion')}</dt>
                        <dd className="font-mono">{c.calendarVersion}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">
                {t('admin-pages.support.tickets.transition')}
              </h2>
              <select
                className={selectCls + ' w-full'}
                value={toStatus}
                onChange={(e) => setToStatus(e.target.value)}
              >
                <option value="">{t('admin-pages.support.tickets.selectStatus')}</option>
                <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                <option value="TRIAGE">TRIAGE</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="WAITING_FOR_CUSTOMER">WAITING_FOR_CUSTOMER</option>
                <option value="WAITING_FOR_INTERNAL_TEAM">WAITING_FOR_INTERNAL_TEAM</option>
                <option value="WAITING_FOR_VENDOR">WAITING_FOR_VENDOR</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
                <option value="REOPENED">REOPENED</option>
              </select>
              {toStatus === 'RESOLVED' ? (
                <input
                  className={inputCls}
                  placeholder={t('admin-pages.support.tickets.resolutionCategory')}
                  value={resolutionCategory}
                  onChange={(e) => setResolutionCategory(e.target.value)}
                />
              ) : null}
              <button
                type="button"
                className={btnPrimary}
                disabled={busy || !toStatus}
                onClick={transition}
              >
                {t('admin-pages.support.tickets.applyStatus')}
              </button>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold">{t('admin-pages.support.tickets.assign')}</h2>
              <input
                className={inputCls}
                placeholder={t('admin-pages.support.tickets.assigneeAdminId')}
                value={assigneeAdminId}
                onChange={(e) => setAssigneeAdminId(e.target.value)}
              />
              <input
                className={inputCls}
                placeholder={t('admin-pages.support.tickets.queueCode')}
                value={queueCode}
                onChange={(e) => setQueueCode(e.target.value)}
              />
              <button type="button" className={btnPrimary} disabled={busy} onClick={assign}>
                {t('admin-pages.support.tickets.applyAssign')}
              </button>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">
              {t('admin-pages.support.tickets.messages')}
            </h2>
            <ul className="space-y-2">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3 text-sm"
                >
                  <div className="mb-1 flex flex-wrap gap-2 text-xs text-[var(--admin-text-muted)]">
                    <AdminStatusBadge tone="neutral" label={m.type} />
                    <span>{m.createdAt}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </li>
              ))}
              {messages.length === 0 ? (
                <li className="text-sm text-[var(--admin-text-muted)]">
                  {t('admin-pages.support.tickets.noMessages')}
                </li>
              ) : null}
            </ul>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs text-[var(--admin-text-muted)]">
                  {t('admin-pages.support.tickets.publicReply')}
                </label>
                <textarea
                  className={areaCls}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                />
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busy || !replyBody.trim()}
                  onClick={() => postMessage('PUBLIC_AGENT_REPLY')}
                >
                  {t('admin-pages.support.tickets.sendReply')}
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-[var(--admin-text-muted)]">
                  {t('admin-pages.support.tickets.internalNote')}
                </label>
                <textarea
                  className={areaCls}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                />
                <button
                  type="button"
                  className={btnGhost}
                  disabled={busy || !noteBody.trim()}
                  onClick={() => postMessage('INTERNAL_NOTE')}
                >
                  {t('admin-pages.support.tickets.addNote')}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
