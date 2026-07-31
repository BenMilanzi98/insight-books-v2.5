'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import RevenueSectionNav from '@/components/admin/revenue/RevenueSectionNav';

export default function RevenueSettingsPage() {
  const { t } = useI18n();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/intelligence/revenue/settings', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.revenue.loadFailed'));
      setPayload(body);
    } catch (e) {
      setError(e.message || t('admin-pages.revenue.loadFailed'));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const config = payload?.config || {};

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.revenue.sections.settings')}
        description={t('admin-pages.revenue.sectionHints.settings')}
      />
      <RevenueSectionNav />

      {loading ? <AdminLoadingState label={t('admin-pages.common.loading')} /> : null}
      {error ? (
        <AdminErrorState title={t('admin-pages.common.unavailable')} message={error} />
      ) : null}

      {!loading && !error && payload ? (
        <section className="max-w-xl space-y-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <p className="text-sm text-[var(--admin-text-muted)]">
            {payload.message || t('admin-pages.revenue.settingsReadOnly')}
          </p>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--admin-text-muted)]">
                {t('admin-pages.revenue.settingsDefaultCurrency')}
              </dt>
              <dd className="font-medium text-[var(--admin-text)]">
                {config.defaultCurrency || 'MWK'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--admin-text-muted)]">
                {t('admin-pages.revenue.settingsFx')}
              </dt>
              <dd className="font-medium text-[var(--admin-text)]">
                {config.fxStatus || 'UNAVAILABLE'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--admin-text-muted)]">
                {t('admin-pages.revenue.settingsForecast')}
              </dt>
              <dd className="font-medium text-[var(--admin-text)]">
                {config.forecastLabel || 'deterministic renewal exposure'}
                {config.forecastMultipliers
                  ? ` (${Object.entries(config.forecastMultipliers)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(', ')})`
                  : ''}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
    </AdminPageContainer>
  );
}
