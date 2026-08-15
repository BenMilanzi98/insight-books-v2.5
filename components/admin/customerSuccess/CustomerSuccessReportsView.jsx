'use client';
import { tt } from '@/lib/i18n/runtime';

import { useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import CustomerSuccessSectionNav from './CustomerSuccessSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const selectCls =
  'h-10 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)]';

export default function CustomerSuccessReportsView() {
  const { t } = useI18n();
  const [dataset, setDataset] = useState('cases');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function exportPack(format) {
    setBusy(true);
    setMessage('');
    try {
      const qs = new URLSearchParams({ dataset, format });
      const res = await adminFetch(`/api/admin/customer-success/export?${qs}`, {
        credentials: 'include',
      });
      if (format === 'csv') {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || t('admin-pages.customerSuccess.reports.exportFailed'));
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cs-${dataset}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setMessage(t('admin-pages.customerSuccess.reports.exportOk'));
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.customerSuccess.reports.exportFailed'));
      const count = Array.isArray(body.rows) ? body.rows.length : 0;
      setMessage(`${t('admin-pages.customerSuccess.reports.exportJsonOk')} (${count})`);
    } catch (e) {
      setMessage(e.message || t('admin-pages.customerSuccess.reports.exportFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.customerSuccess.sections.reports')}
        description={t('admin-pages.customerSuccess.sectionHints.reports')}
      />
      <CustomerSuccessSectionNav />
      <p className="mb-3 text-sm text-[var(--admin-text-muted)]">
        {t('admin-pages.customerSuccess.reports.foundationHint')}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
          <span>{t('admin-pages.customerSuccess.reports.dataset')}</span>
          <select
            className={selectCls}
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
            aria-label={t('admin-pages.customerSuccess.reports.dataset')}
          >
            <option value="cases">{tt('cases')}</option>
            <option value="tasks">{tt('tasks')}</option>
            <option value="plans">{tt('plans')}</option>
            <option value="handoffs">{tt('handoffs')}</option>
          </select>
        </label>
        <button type="button" className={btnGhost} disabled={busy} onClick={() => exportPack('json')}>
          {t('admin-pages.customerSuccess.reports.exportJson')}
        </button>
        <button type="button" className={btnGhost} disabled={busy} onClick={() => exportPack('csv')}>
          {t('admin-pages.customerSuccess.reports.exportCsv')}
        </button>
      </div>
      {message ? (
        <p className="mt-3 text-sm text-[var(--admin-text-muted)]" role="status">
          {message}
        </p>
      ) : null}
    </AdminPageContainer>
  );
}
