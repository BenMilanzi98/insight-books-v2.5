'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import { healthDetailHref } from '@/lib/admin/healthNav';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import HealthSectionNav from './HealthSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

export default function HealthSnapshotsView() {
  const { t } = useI18n();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch(
        '/api/admin/intelligence/customer-health/snapshots?latestOnly=true&pageSize=50',
        { credentials: 'include' }
      );
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.customerHealth.forbidden'));
      }
      if (!res.ok) {
        throw new Error(body.error || t('admin-pages.customerHealth.snapshots.loadFailed'));
      }
      setRows(Array.isArray(body.rows) ? body.rows : Array.isArray(body.snapshots) ? body.snapshots : []);
    } catch (e) {
      setError(e.message || t('admin-pages.customerHealth.snapshots.loadFailed'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.customerHealth.sections.snapshots')}
        description={t('admin-pages.customerHealth.sectionHints.snapshots')}
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
      {!loading && !error && rows.length === 0 ? (
        <AdminEmptyState
          title={t('admin-pages.customerHealth.emptySnapshots')}
          description={t('admin-pages.customerHealth.emptySnapshotsHint')}
        />
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">
                  {t('admin-pages.customerHealth.snapshots.columns.customer')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t('admin-pages.customerHealth.snapshots.columns.score')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t('admin-pages.customerHealth.snapshots.columns.band')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t('admin-pages.customerHealth.snapshots.columns.confidence')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t('admin-pages.customerHealth.snapshots.columns.created')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const score =
                  row.score == null ? t('admin-pages.customerHealth.naLabel') : row.score;
                return (
                  <tr
                    key={row.id || `${row.tenantId}-${row.createdAt}`}
                    className="border-t border-[var(--admin-border)]"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={healthDetailHref(row.tenantId)}
                        className="text-[var(--admin-accent)] underline-offset-2 hover:underline"
                      >
                        {row.customerName || row.tenantId}
                      </Link>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{score}</td>
                    <td className="px-3 py-2">
                      <AdminStatusBadge tone="neutral">{row.band || 'UNKNOWN'}</AdminStatusBadge>
                    </td>
                    <td className="px-3 py-2">{row.confidence || '—'}</td>
                    <td className="px-3 py-2 text-[var(--admin-text-muted)]">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
