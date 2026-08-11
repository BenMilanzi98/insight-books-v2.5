'use client';

import Link from 'next/link';
import { useI18n } from '@/components/i18n/I18nProvider';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import HealthDimensionScore from './HealthDimensionScore';
import { healthDetailHref } from '@/lib/admin/healthNav';

function bandTone(band) {
  if (band === 'HEALTHY' || band === 'STABLE') return 'success';
  if (band === 'NEEDS_ATTENTION') return 'info';
  if (band === 'AT_RISK') return 'warning';
  if (band === 'CRITICAL') return 'danger';
  return 'neutral';
}

/**
 * Score / band / confidence / drivers / dimensions for one evaluation.
 */
export default function HealthEvaluationPanel({ evaluation }) {
  const { t } = useI18n();
  if (!evaluation) return null;

  const scoreDisplay =
    evaluation.score == null ? t('admin-pages.customerHealth.naLabel') : evaluation.score;
  const drivers = Array.isArray(evaluation.drivers) ? evaluation.drivers : [];
  const dimensions = Array.isArray(evaluation.dimensions) ? evaluation.dimensions : [];
  const overrides = Array.isArray(evaluation.overrides) ? evaluation.overrides : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--admin-text)]">
            {evaluation.customer?.displayName || evaluation.tenantId}
          </h2>
          {evaluation.customer?.customerReference ? (
            <p className="text-sm text-[var(--admin-text-muted)]">
              {evaluation.customer.customerReference}
            </p>
          ) : null}
          {evaluation.tenantId ? (
            <Link
              href={healthDetailHref(evaluation.tenantId)}
              className="mt-1 inline-block text-sm text-[var(--admin-accent)] underline-offset-2 hover:underline"
            >
              {evaluation.tenantId}
            </Link>
          ) : null}
        </div>
        <AdminStatusBadge tone={bandTone(evaluation.band)}>{evaluation.band}</AdminStatusBadge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
            {t('admin-pages.customerHealth.score')}
          </p>
          <p
            className={`mt-2 min-w-0 break-words text-xl font-bold leading-tight tabular-nums sm:text-2xl ${
              evaluation.score == null
                ? 'text-[var(--admin-danger)]'
                : 'text-[var(--admin-text)]'
            }`}
          >
            {scoreDisplay}
          </p>
        </article>
        <article className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
            {t('admin-pages.customerHealth.band')}
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--admin-text)]">{evaluation.band}</p>
        </article>
        <article className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
            {t('admin-pages.customerHealth.confidence')}
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--admin-text)]">
            {evaluation.confidence}
          </p>
          {Array.isArray(evaluation.confidenceReasons) && evaluation.confidenceReasons[0] ? (
            <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
              {evaluation.confidenceReasons[0]}
            </p>
          ) : null}
        </article>
      </div>

      <p className="text-xs text-[var(--admin-text-muted)]">
        {evaluation.disclaimer || t('admin-pages.customerHealth.disclaimer')}
      </p>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-[var(--admin-text)]">
          {t('admin-pages.customerHealth.dimensions')}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {dimensions.map((dim) => (
            <HealthDimensionScore key={dim.code} dimension={dim} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-[var(--admin-text)]">
          {t('admin-pages.customerHealth.drivers')}
        </h3>
        {drivers.length === 0 ? (
          <p className="text-sm text-[var(--admin-text-muted)]">
            {t('admin-pages.customerHealth.noDrivers')}
          </p>
        ) : (
          <ul className="space-y-2">
            {drivers.map((driver, idx) => (
              <li
                key={`${driver.dimension}-${driver.code || idx}`}
                className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm"
              >
                <span className="font-medium text-[var(--admin-text)]">
                  {driver.dimension}
                  {driver.code ? ` · ${driver.code}` : ''}
                </span>
                {driver.message || driver.label ? (
                  <span className="text-[var(--admin-text-muted)]">
                    {' '}
                    — {driver.message || driver.label}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {overrides.length > 0 ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-[var(--admin-text)]">
            {t('admin-pages.customerHealth.overrides')}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {overrides.map((o, idx) => (
              <AdminStatusBadge key={`${o.code || idx}`} tone="warning">
                {o.code || o.effect || 'override'}
              </AdminStatusBadge>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
