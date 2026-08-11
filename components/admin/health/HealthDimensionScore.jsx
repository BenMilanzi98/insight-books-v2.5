'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import { DIMENSION_STATUS } from '@/lib/admin/health/catalogue';

function bandTone(status) {
  if (status === DIMENSION_STATUS.SCORED) return 'success';
  if (status === DIMENSION_STATUS.NOT_APPLICABLE || status === DIMENSION_STATUS.UNAVAILABLE) {
    return 'danger';
  }
  if (status === DIMENSION_STATUS.FAILED) return 'warning';
  return 'neutral';
}

/**
 * Render a dimension score — N/A for missing/unavailable, never coerce to 0.
 */
export default function HealthDimensionScore({ dimension }) {
  const { t } = useI18n();
  if (!dimension) return null;

  const isNa =
    dimension.status === DIMENSION_STATUS.NOT_APPLICABLE ||
    dimension.status === DIMENSION_STATUS.UNAVAILABLE ||
    dimension.status === DIMENSION_STATUS.FAILED ||
    dimension.score == null;

  return (
    <article className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--admin-text)]">{dimension.code}</h3>
        <AdminStatusBadge tone={bandTone(dimension.status)}>
          {dimension.status}
        </AdminStatusBadge>
      </div>
      <p
        className={`min-w-0 break-words text-lg font-bold leading-tight tabular-nums sm:text-xl ${
          isNa ? 'text-[var(--admin-danger)]' : 'text-[var(--admin-text)]'
        }`}
        role="status"
      >
        {isNa ? t('admin-pages.customerHealth.naLabel') : dimension.score}
      </p>
      {dimension.reason ? (
        <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{dimension.reason}</p>
      ) : null}
      {dimension.effectiveWeight != null && dimension.status === DIMENSION_STATUS.SCORED ? (
        <p className="mt-1 text-[10px] text-[var(--admin-text-muted)]">
          {t('admin-pages.customerHealth.weightLabel')}{' '}
          {Number(dimension.effectiveWeight).toFixed(3)}
        </p>
      ) : null}
    </article>
  );
}
