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

export default function HealthDefinitionsView() {
  const { t } = useI18n();
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/intelligence/customer-health/definitions', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.customerHealth.forbidden'));
      }
      if (!res.ok) {
        throw new Error(body.error || t('admin-pages.customerHealth.definitions.loadFailed'));
      }
      setPack(body);
    } catch (e) {
      setError(e.message || t('admin-pages.customerHealth.definitions.loadFailed'));
      setPack(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const def = pack?.definition || {};
  const weights = def.weights || {};
  const bands = def.bands || {};
  const naDims = Array.isArray(pack?.notApplicableDimensions)
    ? pack.notApplicableDimensions
    : [];

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.customerHealth.sections.definitions')}
        description={t('admin-pages.customerHealth.sectionHints.definitions')}
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
          <p className="text-sm text-[var(--admin-text-muted)]">
            {t('admin-pages.customerHealth.definitionVersion')}: {pack.activeVersion}
          </p>
          <p className="text-sm text-[var(--admin-text-muted)]">
            {pack.disclaimer || t('admin-pages.customerHealth.disclaimer')}
          </p>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-[var(--admin-text)]">
              {t('admin-pages.customerHealth.definitions.missingPolicy')}
            </h2>
            <AdminStatusBadge tone="info">{def.missingPolicy || '—'}</AdminStatusBadge>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--admin-text)]">
              {t('admin-pages.customerHealth.definitions.weights')}
            </h2>
            <dl className="grid gap-2 sm:grid-cols-2">
              {Object.entries(weights).map(([code, weight]) => (
                <div
                  key={code}
                  className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm"
                >
                  <dt className="text-[var(--admin-text-muted)]">{code}</dt>
                  <dd className="font-medium tabular-nums text-[var(--admin-text)]">{weight}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--admin-text)]">
              {t('admin-pages.customerHealth.definitions.bands')}
            </h2>
            <dl className="grid gap-2 sm:grid-cols-2">
              {Object.entries(bands).map(([band, range]) => (
                <div
                  key={band}
                  className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm"
                >
                  <dt className="text-[var(--admin-text-muted)]">{band}</dt>
                  <dd className="font-medium tabular-nums text-[var(--admin-text)]">
                    {range?.min != null && range?.max != null
                      ? `${range.min}–${range.max}`
                      : '—'}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-[var(--admin-text)]">
              {t('admin-pages.customerHealth.definitions.naDimensions')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {naDims.map((code) => (
                <AdminStatusBadge key={code} tone="danger">
                  {code}: {t('admin-pages.customerHealth.naLabel')}
                </AdminStatusBadge>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
