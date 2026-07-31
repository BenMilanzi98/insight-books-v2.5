'use client';

import { useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminErrorState from '@/components/admin/AdminErrorState';
import HealthSectionNav from './HealthSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--admin-accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HealthReportsView() {
  const { t } = useI18n();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const exportData = async (format) => {
    setBusy(format);
    setError('');
    setNotice('');
    try {
      const qs = new URLSearchParams({ format, pageSize: '100' });
      const res = await adminFetch(
        `/api/admin/intelligence/customer-health/export?${qs}`,
        { credentials: 'include' }
      );

      if (format === 'csv') {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || t('admin-pages.customerHealth.reports.exportFailed'));
        }
        const blob = await res.blob();
        downloadBlob(blob, 'customer-health-snapshots.csv');
        setNotice(t('admin-pages.customerHealth.reports.exportOk'));
        return;
      }

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || t('admin-pages.customerHealth.reports.exportFailed'));
      }
      const blob = new Blob([JSON.stringify(body, null, 2)], {
        type: 'application/json',
      });
      downloadBlob(blob, 'customer-health-snapshots.json');
      setNotice(t('admin-pages.customerHealth.reports.exportOk'));
    } catch (e) {
      setError(e.message || t('admin-pages.customerHealth.reports.exportFailed'));
    } finally {
      setBusy('');
    }
  };

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.customerHealth.sections.reports')}
        description={t('admin-pages.customerHealth.sectionHints.reports')}
      />
      <HealthSectionNav />
      {error ? (
        <AdminErrorState title={t('admin-pages.common.unavailable')} message={error} />
      ) : null}
      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <h2 className="text-sm font-semibold text-[var(--admin-text)]">
          {t('admin-pages.customerHealth.reports.exportTitle')}
        </h2>
        <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
          {t('admin-pages.customerHealth.reports.exportHint')}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={btnPrimary}
            disabled={Boolean(busy)}
            onClick={() => exportData('json')}
          >
            {t('admin-pages.customerHealth.reports.exportJson')}
          </button>
          <button
            type="button"
            className={btnGhost}
            disabled={Boolean(busy)}
            onClick={() => exportData('csv')}
          >
            {t('admin-pages.customerHealth.reports.exportCsv')}
          </button>
        </div>
        {notice ? (
          <p className="mt-3 text-sm text-[var(--admin-text)]" role="status">
            {notice}
          </p>
        ) : null}
      </section>
    </AdminPageContainer>
  );
}
