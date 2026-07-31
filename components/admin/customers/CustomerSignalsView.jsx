'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import { customerDetailHref } from '@/lib/admin/customerNav';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import CustomerSectionNav from './CustomerSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--admin-accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';
const inputCls =
  'h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text)]';

function severityTone(severity) {
  if (severity === 'CRITICAL') return 'danger';
  if (severity === 'HIGH') return 'warning';
  if (severity === 'MEDIUM') return 'info';
  return 'neutral';
}

export default function CustomerSignalsView() {
  const { t } = useI18n();
  const [queue, setQueue] = useState('attention');
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [dismissReason, setDismissReason] = useState({});
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const qs = new URLSearchParams({ queue, limit: '50' });
      const res = await adminFetch(
        `/api/admin/intelligence/customers/signals?${qs}`,
        { credentials: 'include' }
      );
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.customers.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.customers.signals.loadFailed'));
      setItems(Array.isArray(body.items) ? body.items : []);
      setMeta(body);
    } catch (e) {
      setError(e.message || t('admin-pages.customers.signals.loadFailed'));
      setItems([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [queue, t]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (item, action) => {
    setBusyId(item.id);
    setNotice('');
    try {
      const reason = dismissReason[item.id] || '';
      const res = await adminFetch(
        `/api/admin/intelligence/customers/signals/${encodeURIComponent(item.id)}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reason }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.customers.signals.actionFailed'));
      setNotice(
        action === 'dismiss'
          ? t('admin-pages.customers.signals.dismissOk')
          : t('admin-pages.customers.signals.ackOk')
      );
      await load();
    } catch (e) {
      setError(e.message || t('admin-pages.customers.signals.actionFailed'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.customers.sections.signals')}
        description={t('admin-pages.customers.sectionHints.signals')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
              <span>{t('admin-pages.customers.signals.queue')}</span>
              <select
                className={inputCls}
                style={{ width: 'auto' }}
                value={queue}
                onChange={(e) => setQueue(e.target.value)}
                aria-label={t('admin-pages.customers.signals.queue')}
              >
                <option value="attention">{t('admin-pages.customers.signals.queues.attention')}</option>
                <option value="risk">{t('admin-pages.customers.signals.queues.risk')}</option>
                <option value="opportunity">{t('admin-pages.customers.signals.queues.opportunity')}</option>
                <option value="all">{t('admin-pages.customers.signals.queues.all')}</option>
              </select>
            </label>
            <button type="button" className={btnGhost} onClick={load} disabled={loading}>
              {t('admin-pages.common.refresh')}
            </button>
          </div>
        }
      />

      <CustomerSectionNav />

      {meta?.ruleVersion ? (
        <p className="mb-4 text-xs text-[var(--admin-text-muted)]">
          {t('admin-pages.customers.signals.ruleVersion')}: {meta.ruleVersion}
          {meta.persistence ? ` · ${meta.persistence}` : ''}
          {meta.scope?.mode ? ` · scope: ${meta.scope.mode}` : ''}
        </p>
      ) : null}

      {loading ? <AdminLoadingState label={t('admin-pages.common.loading')} /> : null}
      {error ? (
        <AdminErrorState title={t('admin-pages.common.unavailable')} message={error} />
      ) : null}
      {notice ? (
        <p className="mb-3 text-sm text-[var(--admin-text)]" role="status">
          {notice}
        </p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <AdminEmptyState
          title={t('admin-pages.customers.signalsEmptyTitle')}
          description={t('admin-pages.customers.signals.emptyHint')}
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customers.signals.columns.customer')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customers.signals.columns.code')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customers.signals.columns.severity')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customers.signals.columns.status')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customers.signals.columns.detected')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customers.signals.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-[var(--admin-border)]">
                  <td className="px-3 py-2">
                    <Link
                      href={customerDetailHref(item.tenantId)}
                      className="font-medium text-[var(--admin-accent)] hover:underline"
                    >
                      {item.tenantName || item.tenantId}
                    </Link>
                    <div className="text-xs text-[var(--admin-text-muted)]">
                      {item.tenantReference}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-[var(--admin-text)]">{item.title || item.code}</div>
                    <div className="text-xs text-[var(--admin-text-muted)]">{item.code}</div>
                  </td>
                  <td className="px-3 py-2">
                    <AdminStatusBadge tone={severityTone(item.severity)}>
                      {item.severity}
                    </AdminStatusBadge>
                  </td>
                  <td className="px-3 py-2">{item.status}</td>
                  <td className="px-3 py-2 text-[var(--admin-text-muted)]">
                    {item.lastDetectedAt
                      ? new Date(item.lastDetectedAt).toLocaleString()
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex min-w-[220px] flex-col gap-2">
                      <button
                        type="button"
                        className={btnGhost}
                        disabled={busyId === item.id || item.status === 'ACKNOWLEDGED'}
                        onClick={() => act(item, 'acknowledge')}
                      >
                        {t('admin-pages.customers.signals.acknowledge')}
                      </button>
                      <input
                        className={inputCls}
                        placeholder={t('admin-pages.customers.signals.dismissReason')}
                        value={dismissReason[item.id] || ''}
                        onChange={(e) =>
                          setDismissReason((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className={btnPrimary}
                        disabled={busyId === item.id || !(dismissReason[item.id] || '').trim()}
                        onClick={() => act(item, 'dismiss')}
                      >
                        {t('admin-pages.customers.signals.dismiss')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {meta?.limitations?.length ? (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-[var(--admin-text-muted)]">
          {meta.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </AdminPageContainer>
  );
}
