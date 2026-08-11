'use client';

import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import { METRIC_STATUS } from '@/lib/admin/intelligence/metricStates';
import { formatMetricValue } from '@/lib/admin/intelligence/formatMetricValue';
import { cn } from '@/lib/utils';

function statusTone(status) {
  switch (status) {
    case METRIC_STATUS.READY:
      return 'success';
    case METRIC_STATUS.READY_WITH_LIMITATIONS:
    case METRIC_STATUS.READY_WITH_RECONCILIATION:
      return 'info';
    case METRIC_STATUS.STALE:
    case METRIC_STATUS.RECON_FAILED:
      return 'warning';
    case METRIC_STATUS.FORBIDDEN:
    case METRIC_STATUS.UNAVAILABLE:
    case METRIC_STATUS.NOT_SUPPORTED:
    case 'NOT_INSTRUMENTED':
      return 'danger';
    default:
      return 'neutral';
  }
}

/**
 * Renders a KPI envelope — never coerces null/unavailable to 0.
 */
export default function MetricCard({ metric, className }) {
  if (!metric) return null;

  const displayable =
    metric.status === METRIC_STATUS.READY ||
    metric.status === METRIC_STATUS.READY_WITH_LIMITATIONS ||
    metric.status === METRIC_STATUS.READY_WITH_RECONCILIATION ||
    metric.status === METRIC_STATUS.STALE ||
    metric.status === METRIC_STATUS.RECON_FAILED;

  const formatted = displayable ? formatMetricValue(metric) : null;
  const showUnavailable = !displayable || formatted == null;

  return (
    <article
      className={cn(
        'admin-lift rounded-[var(--admin-radius)] border border-l-4 border-[var(--admin-border)] border-l-[var(--admin-accent-strong)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-card)]',
        className
      )}
      aria-label={metric.label}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
          {metric.label}
        </p>
        <AdminStatusBadge tone={statusTone(metric.status)}>
          {metric.status}
        </AdminStatusBadge>
      </div>

      {showUnavailable ? (
        <p className="mt-2 text-sm font-medium text-[var(--admin-danger)]" role="status">
          {metric.status === 'NOT_INSTRUMENTED' ? 'Not instrumented' : 'Unavailable'}
        </p>
      ) : (
        <p className="mt-2 min-w-0 break-words text-xl font-bold leading-tight tabular-nums tracking-tight text-[var(--admin-text)] sm:text-2xl">
          {formatted}
        </p>
      )}

      {metric.reasonMessage ? (
        <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{metric.reasonMessage}</p>
      ) : null}

      {metric.limitations ? (
        <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{metric.limitations}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[var(--admin-text-muted)]">
        {metric.freshness?.asOf ? (
          <span>As of {new Date(metric.freshness.asOf).toLocaleString()}</span>
        ) : null}
        {metric.reconciliation?.status ? (
          <span>Recon: {metric.reconciliation.status}</span>
        ) : null}
        {metric.source ? <span title={metric.definition || ''}>Src: {metric.source}</span> : null}
      </div>
    </article>
  );
}
