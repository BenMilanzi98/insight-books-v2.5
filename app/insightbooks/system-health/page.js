'use client';
import { tt } from '@/lib/i18n/runtime';

import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Database, Mail, RefreshCw, Server } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminSummaryCard,
  AdminErrorState,
  AdminLoadingState,
  AdminStatusBadge,
} from '@/components/admin';

export default function SystemHealthPage() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState('');
  const [retryError, setRetryError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/system-health', { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Health check failed (${res.status})`);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setData(null);
      setError(e.message || 'Failed to load system health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const retryFailedEmails = async () => {
    setRetrying(true);
    setRetryMessage('');
    setRetryError('');
    try {
      const res = await adminFetch('/api/admin/system-health/retry', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType: 'email', allFailed: true, limit: 25 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Retry failed (${res.status})`);
      setRetryMessage(body.message || `Requeued ${body.requeued ?? 0} email(s).`);
      await load();
    } catch (e) {
      setRetryError(e.message || 'Failed to retry emails');
    } finally {
      setRetrying(false);
    }
  };

  const overall = data?.status || data?.overall || (error ? null : 'unknown');
  const emailQueue = data?.queues?.email;
  const emailFailed =
    emailQueue?.failed ?? data?.email?.failed ?? data?.jobs?.retryableFailedEmails;
  const emailPending = emailQueue?.pending ?? data?.email?.pending;
  const emailSent24h = emailQueue?.sent24h ?? data?.email?.sent24h;
  const emailStatus = data?.email?.status;

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.health.title')}
        description="Platform service status for System Administrators. Secrets and credentials are never shown."
        actions={
          <button
            type="button"
            onClick={load}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            {tt('Refresh')}
          </button>
        }
      />

      {loading ? <AdminLoadingState label="Loading system health" /> : null}
      {!loading && error ? (
        <AdminErrorState title="Health check unavailable" message={error} onRetry={load} />
      ) : null}

      {!loading && !error && data ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--admin-text-muted)]">{tt('Overall status')}</span>
            <AdminStatusBadge
              tone={
                overall === 'healthy' || overall === 'ok'
                  ? 'success'
                  : overall === 'degraded'
                    ? 'warning'
                    : 'danger'
              }
            >
              {String(overall || 'unknown')}
            </AdminStatusBadge>
            {data.checkedAt || data.timestamp ? (
              <span className="text-xs text-[var(--admin-text-muted)]">
                Checked {data.checkedAt || data.timestamp}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminSummaryCard
              label="Application"
              value={data.app?.status || data.application || 'OK'}
              icon={Server}
              tone="success"
            />
            <AdminSummaryCard
              label="Database"
              value={data.database?.status || data.db || '—'}
              icon={Database}
              tone={
                String(data.database?.status || data.db || '')
                  .toLowerCase()
                  .includes('fail')
                  ? 'danger'
                  : 'success'
              }
            />
            <AdminSummaryCard
              label="Email"
              value={emailStatus || '—'}
              hint={
                emailQueue?.error
                  ? emailQueue.error
                  : emailPending != null
                    ? `${emailPending} pending · ${emailFailed ?? 0} failed · ${emailSent24h ?? 0} sent (24h)`
                    : undefined
              }
              icon={Mail}
              tone={
                emailStatus === 'failed'
                  ? 'danger'
                  : emailStatus === 'degraded' || (emailFailed ?? 0) > 0
                    ? 'warning'
                    : 'success'
              }
              error={Boolean(emailQueue?.error || data?.email?.error)}
            />
            <AdminSummaryCard
              label="Retryable failed emails"
              value={
                data.jobs?.error != null
                  ? '—'
                  : data.jobs?.retryableFailedEmails != null
                    ? data.jobs.retryableFailedEmails
                    : '—'
              }
              icon={Activity}
              tone={(data.jobs?.retryableFailedEmails ?? 0) > 0 ? 'warning' : 'neutral'}
              error={Boolean(data.jobs?.error)}
            />
          </div>

          <div className="mt-6 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--admin-text)]">{tt('Email queue')}</h2>
                <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                  {emailQueue?.error
                    ? emailQueue.error
                    : `Pending ${emailPending ?? '—'} · Failed ${emailFailed ?? '—'} · Sent (24h) ${emailSent24h ?? '—'}`}
                </p>
              </div>
              <button
                type="button"
                onClick={retryFailedEmails}
                disabled={retrying || !emailFailed || emailFailed < 1}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm font-medium text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} aria-hidden />
                {retrying ? 'Retrying…' : 'Retry failed emails'}
              </button>
            </div>
            {retryMessage ? (
              <p className="mt-3 text-sm text-[var(--admin-success)]" role="status">
                {retryMessage}
              </p>
            ) : null}
            {retryError ? (
              <p className="mt-3 text-sm text-[var(--admin-danger)]" role="alert">
                {retryError}
              </p>
            ) : null}
          </div>

          {Array.isArray(data.services) && data.services.length > 0 ? (
            <div className="mt-6 overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--admin-surface-muted)] text-xs uppercase text-[var(--admin-text-muted)]">
                  <tr>
                    <th className="px-4 py-3">{tt('Service')}</th>
                    <th className="px-4 py-3">{tt('Status')}</th>
                    <th className="px-4 py-3">{tt('Detail')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.services.map((svc) => (
                    <tr key={svc.name || svc.id} className="border-t border-[var(--admin-border)]">
                      <td className="px-4 py-3 font-medium text-[var(--admin-text)]">
                        {svc.name || svc.id}
                      </td>
                      <td className="px-4 py-3">
                        <AdminStatusBadge
                          tone={
                            svc.status === 'healthy' || svc.status === 'ok'
                              ? 'success'
                              : svc.status === 'degraded'
                                ? 'warning'
                                : 'danger'
                          }
                        >
                          {svc.status}
                        </AdminStatusBadge>
                      </td>
                      <td className="px-4 py-3 text-[var(--admin-text-muted)]">
                        {svc.message ||
                          (svc.latencyMs != null ? `${svc.latencyMs}ms` : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </AdminPageContainer>
  );
}
