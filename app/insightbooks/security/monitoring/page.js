'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Globe,
  MapPin,
  RefreshCw,
  Shield,
  User,
  XCircle,
} from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminEmptyState,
  AdminSummaryCard,
  AdminStatusBadge,
} from '@/components/admin';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const inputCls =
  'rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-text)]';

function threatTone(level) {
  const l = String(level || '').toLowerCase();
  if (l === 'high') return 'danger';
  if (l === 'medium') return 'warning';
  if (l === 'low') return 'success';
  return 'neutral';
}

function EventIcon({ eventType }) {
  switch (eventType) {
    case 'LOGIN_ATTEMPT':
      return <User className="h-4 w-4 text-[var(--admin-text-muted)]" aria-hidden />;
    case 'UNAUTHORIZED_ACCESS':
      return <AlertTriangle className="h-4 w-4 text-[var(--status-danger)]" aria-hidden />;
    case 'SUSPICIOUS_ACTIVITY':
      return <Eye className="h-4 w-4 text-[var(--status-warning)]" aria-hidden />;
    case 'RATE_LIMIT_EXCEEDED':
      return <Clock className="h-4 w-4 text-[var(--status-warning)]" aria-hidden />;
    case 'IP_BLOCKED':
      return <Globe className="h-4 w-4 text-[var(--status-danger)]" aria-hidden />;
    case 'SECURITY_ALERT':
      return <Shield className="h-4 w-4 text-[var(--action-primary)]" aria-hidden />;
    default:
      return <Activity className="h-4 w-4 text-[var(--admin-text-muted)]" aria-hidden />;
  }
}

function eventStatus(event) {
  if (event.blocked) return { label: 'Blocked', tone: 'success' };
  if (event.threatLevel === 'high') return { label: 'High risk', tone: 'danger' };
  if (event.threatLevel === 'medium') return { label: 'Medium risk', tone: 'warning' };
  return { label: 'Low risk', tone: 'success' };
}

export default function SecurityMonitoringPage() {
  const { t } = useI18n();
  const [securityEvents, setSecurityEvents] = useState([]);
  const [threatMetrics, setThreatMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('24h');

  const fetchSecurityData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const qs = new URLSearchParams({ timeframe: selectedTimeframe });
      const [eventsResponse, metricsResponse] = await Promise.all([
        adminFetch(`/api/admin/security/monitoring/events?${qs}`, { credentials: 'include' }),
        adminFetch(`/api/admin/security/monitoring/metrics?${qs}`, { credentials: 'include' }),
      ]);

      const eventsBody = await eventsResponse.json().catch(() => ({}));
      const metricsBody = await metricsResponse.json().catch(() => ({}));

      if (!eventsResponse.ok && !metricsResponse.ok) {
        throw new Error(
          eventsBody.error ||
            metricsBody.error ||
            `Monitoring unavailable (${eventsResponse.status})`
        );
      }

      setSecurityEvents(eventsResponse.ok ? eventsBody.events || [] : []);
      setThreatMetrics(metricsResponse.ok ? metricsBody.metrics || null : null);

      if (!eventsResponse.ok || !metricsResponse.ok) {
        setError(
          !eventsResponse.ok
            ? eventsBody.error || 'Events unavailable'
            : metricsBody.error || 'Metrics unavailable'
        );
      }
    } catch (err) {
      setSecurityEvents([]);
      setThreatMetrics(null);
      setError(err.message || 'Failed to fetch security data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedTimeframe]);

  useEffect(() => {
    fetchSecurityData();
    if (!autoRefresh) return undefined;
    const interval = setInterval(fetchSecurityData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchSecurityData]);

  const m = threatMetrics || {};

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.security.monitoring.title')}
        description="Security events and threat signals from platform monitoring APIs. Values shown only when the API returns them."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-[var(--admin-text)]">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--admin-border)]"
              />
              Auto-refresh
            </label>
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className={inputCls}
              aria-label="Timeframe"
            >
              <option value="1h">Last hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <button type="button" onClick={fetchSecurityData} className={btnGhost}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </button>
          </div>
        }
      />

      {isLoading ? <AdminLoadingState label="Loading security monitoring" /> : null}

      {!isLoading && error && !threatMetrics && securityEvents.length === 0 ? (
        <AdminErrorState title="Monitoring unavailable" message={error} onRetry={fetchSecurityData} />
      ) : null}

      {!isLoading && (threatMetrics || securityEvents.length > 0 || !error) ? (
        <>
          {error ? (
            <div
              role="status"
              className="mb-4 rounded-[var(--admin-radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              Partial data: {error}
            </div>
          ) : null}

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AdminSummaryCard
              label="Total threats"
              value={m.totalThreats ?? '—'}
              icon={AlertTriangle}
              tone="danger"
            />
            <AdminSummaryCard
              label="High risk"
              value={m.highRisk ?? '—'}
              icon={XCircle}
              tone="danger"
            />
            <AdminSummaryCard
              label="Medium risk"
              value={m.mediumRisk ?? '—'}
              icon={AlertTriangle}
              tone="warning"
            />
            <AdminSummaryCard
              label="Low risk"
              value={m.lowRisk ?? '—'}
              icon={CheckCircle}
              tone="success"
            />
            <AdminSummaryCard
              label="Blocked"
              value={m.blockedAttempts ?? '—'}
              icon={Shield}
              tone="info"
            />
            <AdminSummaryCard
              label="Suspicious"
              value={m.suspiciousActivities ?? '—'}
              icon={Eye}
            />
          </div>

          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex items-center gap-2 border-b border-[var(--admin-border)] px-4 py-3 sm:px-6">
              <Activity className="h-5 w-5 text-[var(--admin-text-muted)]" aria-hidden />
              <h2 className="text-base font-semibold text-[var(--admin-text)]">
                Recent security events
              </h2>
            </div>
            <div className="p-4 sm:p-6">
              {securityEvents.length > 0 ? (
                <ul className="space-y-3">
                  {securityEvents.map((event, index) => {
                    const status = eventStatus(event);
                    return (
                      <li
                        key={event.id || `${event.timestamp}-${index}`}
                        className="flex flex-col gap-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-start gap-3">
                          <EventIcon eventType={event.eventType} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--admin-text)]">
                              {event.description || event.eventType}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--admin-text-muted)]">
                              <span>
                                <User className="mr-1 inline h-3 w-3" aria-hidden />
                                {event.user || event.ipAddress || 'Unknown'}
                              </span>
                              <span>
                                <MapPin className="mr-1 inline h-3 w-3" aria-hidden />
                                {event.ipAddress || 'N/A'}
                              </span>
                              <span>
                                <Clock className="mr-1 inline h-3 w-3" aria-hidden />
                                {event.timestamp
                                  ? new Date(event.timestamp).toLocaleString()
                                  : '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {event.threatLevel ? (
                            <AdminStatusBadge tone={threatTone(event.threatLevel)}>
                              {event.threatLevel}
                            </AdminStatusBadge>
                          ) : null}
                          <AdminStatusBadge tone={status.tone}>{status.label}</AdminStatusBadge>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <AdminEmptyState
                  title="No security events"
                  description="No events returned for this timeframe."
                />
              )}
            </div>
          </section>
        </>
      ) : null}
    </AdminPageContainer>
  );
}
