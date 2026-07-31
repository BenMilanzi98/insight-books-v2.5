'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import HealthSectionNav from './HealthSectionNav';
import HealthEvaluationPanel from './HealthEvaluationPanel';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--admin-accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';
const inputCls =
  'h-10 w-full min-w-[12rem] rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text)]';

function bandTone(band) {
  if (band === 'HEALTHY' || band === 'STABLE') return 'success';
  if (band === 'NEEDS_ATTENTION') return 'info';
  if (band === 'AT_RISK') return 'warning';
  if (band === 'CRITICAL') return 'danger';
  return 'neutral';
}

export default function HealthOverviewView() {
  const { t } = useI18n();
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [inspectBusy, setInspectBusy] = useState(false);
  const [inspectError, setInspectError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/intelligence/customer-health/overview', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.customerHealth.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.customerHealth.loadFailed'));
      setPack(body);
    } catch (e) {
      setError(e.message || t('admin-pages.customerHealth.loadFailed'));
      setPack(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const inspect = async (e) => {
    e?.preventDefault?.();
    const id = tenantId.trim();
    if (!id) return;
    setInspectBusy(true);
    setInspectError('');
    setEvaluation(null);
    try {
      const res = await adminFetch(
        `/api/admin/intelligence/customer-health/${encodeURIComponent(id)}`,
        { credentials: 'include' }
      );
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.customerHealth.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.customerHealth.loadFailed'));
      setEvaluation(body.evaluation || null);
    } catch (err) {
      setInspectError(err.message || t('admin-pages.customerHealth.loadFailed'));
    } finally {
      setInspectBusy(false);
    }
  };

  const bandCounts = pack?.bandCounts || {};
  const bandEntries = Object.entries(bandCounts);
  const hasSnapshots = (pack?.tenantsWithSnapshots || 0) > 0;

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.customerHealth.title')}
        description={t('admin-pages.customerHealth.description')}
        actions={
          <button type="button" className={btnGhost} onClick={load} disabled={loading}>
            {t('admin-pages.common.refresh')}
          </button>
        }
      />

      <HealthSectionNav />

      {loading ? <AdminLoadingState label={t('admin-pages.common.loading')} /> : null}
      {error ? (
        <AdminErrorState title={t('admin-pages.common.unavailable')} message={error} />
      ) : null}

      {!loading && !error && pack ? (
        <div className="space-y-8">
          <p className="text-xs text-[var(--admin-text-muted)]">
            {t('admin-pages.customerHealth.definitionVersion')}: {pack.definitionVersion}
            {pack.asOf
              ? ` · ${new Date(pack.asOf).toLocaleString()}`
              : ''}
            {typeof pack.tenantsWithSnapshots === 'number'
              ? ` · ${t('admin-pages.customerHealth.tenantsWithSnapshots')}: ${pack.tenantsWithSnapshots}`
              : ''}
          </p>
          <p className="text-sm text-[var(--admin-text-muted)]">
            {pack.disclaimer || t('admin-pages.customerHealth.disclaimer')}
          </p>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--admin-text)]">
              {t('admin-pages.customerHealth.bandCounts')}
            </h2>
            {!hasSnapshots ? (
              <AdminEmptyState
                title={t('admin-pages.customerHealth.emptySnapshots')}
                description={t('admin-pages.customerHealth.emptySnapshotsHint')}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {bandEntries.map(([band, count]) => (
                  <article
                    key={band}
                    className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <AdminStatusBadge tone={bandTone(band)}>{band}</AdminStatusBadge>
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-[var(--admin-text)]">
                      {count}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          {Array.isArray(pack.limitations) && pack.limitations.length > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-[var(--admin-text)]">
                {t('admin-pages.customerHealth.limitations')}
              </h2>
              <ul className="list-inside list-disc space-y-1 text-sm text-[var(--admin-text-muted)]">
                {pack.limitations.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <h2 className="text-sm font-semibold text-[var(--admin-text)]">
              {t('admin-pages.customerHealth.inspectTitle')}
            </h2>
            <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
              {t('admin-pages.customerHealth.inspectHint')}
            </p>
            <form
              className="mt-4 flex flex-wrap items-end gap-2"
              onSubmit={inspect}
            >
              <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
                <span className="text-[var(--admin-text-muted)]">
                  {t('admin-pages.customerHealth.tenantId')}
                </span>
                <input
                  className={inputCls}
                  value={tenantId}
                  onChange={(ev) => setTenantId(ev.target.value)}
                  aria-label={t('admin-pages.customerHealth.tenantId')}
                />
              </label>
              <button
                type="submit"
                className={btnPrimary}
                disabled={inspectBusy || !tenantId.trim()}
              >
                {t('admin-pages.customerHealth.inspectAction')}
              </button>
            </form>
            {inspectError ? (
              <div className="mt-4">
                <AdminErrorState
                  title={t('admin-pages.common.unavailable')}
                  message={inspectError}
                />
              </div>
            ) : null}
            {evaluation ? (
              <div className="mt-6 border-t border-[var(--admin-border)] pt-6">
                <HealthEvaluationPanel evaluation={evaluation} />
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
