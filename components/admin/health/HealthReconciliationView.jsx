'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import HealthSectionNav from './HealthSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

function statusTone(status) {
  if (status === 'READY') return 'success';
  if (status === 'READY_WITH_LIMITATIONS' || status === 'FAIL') return 'warning';
  if (status === 'UNAVAILABLE' || status === 'FORBIDDEN') return 'danger';
  return 'neutral';
}

export default function HealthReconciliationView() {
  const { t } = useI18n();
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/intelligence/customer-health/reconcile', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.customerHealth.forbidden'));
      }
      if (!res.ok) {
        throw new Error(body.error || t('admin-pages.customerHealth.reconciliation.loadFailed'));
      }
      setPack(body);
    } catch (e) {
      setError(e.message || t('admin-pages.customerHealth.reconciliation.loadFailed'));
      setPack(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = Array.isArray(pack?.cards) ? pack.cards : [];

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.customerHealth.sections.reconciliation')}
        description={t('admin-pages.customerHealth.sectionHints.reconciliation')}
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
        <div className="space-y-6">
          <p className="text-xs text-[var(--admin-text-muted)]">
            {pack.definitionVersion
              ? `${t('admin-pages.customerHealth.definitionVersion')}: ${pack.definitionVersion}`
              : ''}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <article
                key={card.id}
                className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[var(--admin-text)]">{card.label}</h2>
                  <AdminStatusBadge tone={statusTone(card.status)}>{card.status}</AdminStatusBadge>
                </div>
                <p className="text-xl font-bold tabular-nums text-[var(--admin-text)]">
                  {card.value == null ? t('admin-pages.customerHealth.naLabel') : String(card.value)}
                </p>
                {card.detail ? (
                  <p className="mt-2 text-xs text-[var(--admin-text-muted)]">{card.detail}</p>
                ) : null}
              </article>
            ))}
          </div>
          {Array.isArray(pack.limitations) && pack.limitations.length > 0 ? (
            <ul className="list-inside list-disc space-y-1 text-sm text-[var(--admin-text-muted)]">
              {pack.limitations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
