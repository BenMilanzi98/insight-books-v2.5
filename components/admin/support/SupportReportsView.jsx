'use client';

import { useCallback, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminErrorState from '@/components/admin/AdminErrorState';
import SupportSectionNav from './SupportSectionNav';

const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--admin-accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';
const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

/**
 * Export foundation + recon trigger. JSON/CSV only; no fake rows.
 */
export default function SupportReportsView() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [recon, setRecon] = useState(null);

  const downloadExport = useCallback(
    async (format) => {
      setBusy(true);
      setError('');
      setMessage('');
      try {
        const res = await adminFetch(
          `/api/admin/support/export?dataset=tickets&format=${encodeURIComponent(format)}`,
          { credentials: 'include' }
        );
        if (res.status === 403) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || t('admin-pages.support.forbidden'));
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || t('admin-pages.support.reports.exportFailed'));
        }
        if (format === 'csv') {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'support-tickets-export.csv';
          a.click();
          URL.revokeObjectURL(url);
        } else {
          const body = await res.json();
          const blob = new Blob([JSON.stringify(body, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'support-tickets-export.json';
          a.click();
          URL.revokeObjectURL(url);
        }
        setMessage(t('admin-pages.support.reports.exportOk'));
      } catch (e) {
        setError(e.message || t('admin-pages.support.reports.exportFailed'));
      } finally {
        setBusy(false);
      }
    },
    [t]
  );

  const runRecon = useCallback(async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await adminFetch('/api/admin/support/reconciliation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persist: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.support.forbidden'));
      }
      if (!res.ok) {
        throw new Error(body.error || t('admin-pages.support.reports.reconFailed'));
      }
      setRecon(body);
      setMessage(t('admin-pages.support.reports.reconOk'));
    } catch (e) {
      setError(e.message || t('admin-pages.support.reports.reconFailed'));
      setRecon(null);
    } finally {
      setBusy(false);
    }
  }, [t]);

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.support.sections.reports')}
        description={t('admin-pages.support.sectionHints.reports')}
      />
      <SupportSectionNav />
      <p className="mb-3 text-sm text-[var(--admin-text-muted)]">
        {t('admin-pages.support.reports.exportHint')}
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} disabled={busy} onClick={() => downloadExport('json')}>
          {t('admin-pages.support.reports.exportJson')}
        </button>
        <button type="button" className={btnGhost} disabled={busy} onClick={() => downloadExport('csv')}>
          {t('admin-pages.support.reports.exportCsv')}
        </button>
        <button type="button" className={btnGhost} disabled={busy} onClick={runRecon}>
          {t('admin-pages.support.reports.runRecon')}
        </button>
      </div>
      {error ? <AdminErrorState message={error} /> : null}
      {message ? <p className="mb-3 text-sm text-[var(--admin-text)]">{message}</p> : null}
      {recon?.status ? (
        <p className="text-sm text-[var(--admin-text-muted)]">
          {t('admin-pages.support.reports.reconStatus')}: {recon.status}
          {recon.summary?.ticketCount == null
            ? ` · ${t('admin-pages.support.reports.noFalseZero')}`
            : ` · tickets=${recon.summary.ticketCount}`}
        </p>
      ) : null}
    </AdminPageContainer>
  );
}
