'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import RevenueSectionNav from '@/components/admin/revenue/RevenueSectionNav';

export default function RevenueDefinitionsPage() {
  const { t } = useI18n();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/intelligence/revenue/definitions', {
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

  const definitions = payload?.definitions || {};
  const entries = Object.entries(definitions);

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.revenue.sections.definitions')}
        description={t('admin-pages.revenue.sectionHints.definitions')}
      />
      <RevenueSectionNav />

      {loading ? <AdminLoadingState label={t('admin-pages.common.loading')} /> : null}
      {error ? (
        <AdminErrorState title={t('admin-pages.common.unavailable')} message={error} />
      ) : null}

      {!loading && !error && payload ? (
        <div className="space-y-4">
          <p className="text-xs text-[var(--admin-text-muted)]">
            {t('admin-pages.revenue.catalogue')}: {payload.catalogueVersion}
          </p>
          {payload.notes?.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--admin-text-muted)]">
              {payload.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          <div className="overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">{tt('Code')}</th>
                  <th className="px-3 py-2 font-medium">{tt('Label')}</th>
                  <th className="px-3 py-2 font-medium">{tt('Readiness')}</th>
                  <th className="px-3 py-2 font-medium">{tt('Definition')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([code, d]) => (
                  <tr key={code} className="border-t border-[var(--admin-border)]">
                    <td className="px-3 py-2 font-mono text-xs text-[var(--admin-text)]">
                      {code}
                    </td>
                    <td className="px-3 py-2 text-[var(--admin-text)]">{d.label}</td>
                    <td className="px-3 py-2 text-[var(--admin-text-muted)]">{d.readiness}</td>
                    <td className="px-3 py-2 text-[var(--admin-text-muted)]">{d.definition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
