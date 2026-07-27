'use client';

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
      const res = await fetch('/api/admin/system-health', { credentials: 'include' });
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
      const res = await fetch('/api/admin/system-health/retry', {
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
        title="System Health"
        description="Platform service status for System Administrators. Secrets and credentials are never shown."
        actions={
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--action-primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--action-primary-hover)]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
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
            <span className="text-sm text-[var(--text-secondary)]">Overall status</span>
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
              <span className="text-xs text-[var(--text-muted)]">
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

          <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-primary)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Email queue</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {emailQueue?.error
                    ? emailQueue.error
                    : `Pending ${emailPending ?? '—'} · Failed ${emailFailed ?? '—'} · Sent (24h) ${emailSent24h ?? '—'}`}
                </p>
              </div>
              <button
                type="button"
                onClick={retryFailedEmails}
                disabled={retrying || !emailFailed || emailFailed < 1}
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} aria-hidden />
                {retrying ? 'Retrying…' : 'Retry failed emails'}
              </button>
            </div>
            {retryMessage ? (
              <p className="mt-3 text-sm text-[var(--status-success)]" role="status">
                {retryMessage}
              </p>
            ) : null}
            {retryError ? (
              <p className="mt-3 text-sm text-[var(--status-danger)]" role="alert">
                {retryError}
              </p>
            ) : null}
          </div>

          {Array.isArray(data.services) && data.services.length > 0 ? (
            <div className="mt-6 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-primary)]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.services.map((svc) => (
                    <tr key={svc.name || svc.id} className="border-t border-[var(--border-default)]">
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
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
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
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
