'use client';

import { useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminErrorState from '@/components/admin/AdminErrorState';
import CustomerSectionNav from './CustomerSectionNav';

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

export default function CustomerReportsView() {
  const { t } = useI18n();
  const [dataset, setDataset] = useState('directory');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const exportData = async (format) => {
    setBusy(format);
    setError('');
    setNotice('');
    try {
      const qs = new URLSearchParams({ format, dataset, pageSize: '100' });
      const res = await adminFetch(
        `/api/admin/intelligence/customers/export?${qs}`,
        { credentials: 'include' }
      );

      if (format === 'csv') {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || t('admin-pages.customers.reports.exportFailed'));
        }
        const blob = await res.blob();
        downloadBlob(blob, `customers-${dataset}.csv`);
        setNotice(t('admin-pages.customers.reports.exportOk'));
        return;
      }

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || t('admin-pages.customers.reports.exportFailed'));
      }
      const blob = new Blob([JSON.stringify(body, null, 2)], {
        type: 'application/json',
      });
      downloadBlob(blob, `customers-${dataset}.json`);
      setNotice(t('admin-pages.customers.reports.exportOk'));
    } catch (e) {
      setError(e.message || t('admin-pages.customers.reports.exportFailed'));
    } finally {
      setBusy('');
    }
  };

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.customers.sections.reports')}
        description={t('admin-pages.customers.sectionHints.reports')}
      />

      <CustomerSectionNav />

      {error ? (
        <AdminErrorState title={t('admin-pages.common.unavailable')} message={error} />
      ) : null}
      {notice ? (
        <p className="mb-3 text-sm text-[var(--admin-text)]" role="status">
          {notice}
        </p>
      ) : null}

      <section className="max-w-xl space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <h2 className="text-sm font-semibold text-[var(--admin-text)]">
          {t('admin-pages.customers.reports.exportTitle')}
        </h2>
        <p className="text-sm text-[var(--admin-text-muted)]">
          {t('admin-pages.customers.reports.exportHint')}
        </p>

        <label className="block text-sm text-[var(--admin-text-muted)]">
          <span className="mb-1 block">{t('admin-pages.customers.reports.dataset')}</span>
          <select
            className="h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text)]"
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
          >
            <option value="directory">{t('admin-pages.customers.reports.datasets.directory')}</option>
            <option value="overview">{t('admin-pages.customers.reports.datasets.overview')}</option>
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnPrimary}
            disabled={Boolean(busy)}
            onClick={() => exportData('json')}
          >
            {busy === 'json'
              ? t('admin-pages.common.loading')
              : t('admin-pages.customers.reports.exportJson')}
          </button>
          <button
            type="button"
            className={btnGhost}
            disabled={Boolean(busy)}
            onClick={() => exportData('csv')}
          >
            {busy === 'csv'
              ? t('admin-pages.common.loading')
              : t('admin-pages.customers.reports.exportCsv')}
          </button>
        </div>
      </section>
    </AdminPageContainer>
  );
}
