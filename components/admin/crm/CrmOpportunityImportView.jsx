'use client';

import { useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import CrmSectionNav from './CrmSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

export default function CrmOpportunityImportView() {
  const { t } = useI18n();
  const [jsonText, setJsonText] = useState('[]');
  const [preview, setPreview] = useState(null);
  const [confirmResult, setConfirmResult] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const parseRows = () => {
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) throw new Error(t('admin-pages.crm.imports.rowsMustBeArray'));
    return parsed;
  };

  const runPreview = async () => {
    setBusy(true);
    setMessage('');
    setConfirmResult(null);
    try {
      const rows = parseRows();
      const res = await adminFetch('/api/admin/crm/opportunities/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', rows }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.crm.imports.previewFailed'));
      setPreview(body);
      setMessage(t('admin-pages.crm.imports.previewOk'));
    } catch (e) {
      setPreview(null);
      setMessage(e.message || t('admin-pages.crm.imports.previewFailed'));
    } finally {
      setBusy(false);
    }
  };

  const runConfirm = async () => {
    setBusy(true);
    setMessage('');
    try {
      const rows = parseRows();
      const res = await adminFetch('/api/admin/crm/opportunities/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', rows }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.crm.imports.confirmFailed'));
      setConfirmResult(body);
      setMessage(t('admin-pages.crm.imports.confirmOk'));
    } catch (e) {
      setConfirmResult(null);
      setMessage(e.message || t('admin-pages.crm.imports.confirmFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.crm.sections.imports')}
        description={t('admin-pages.crm.sectionHints.imports')}
      />
      <CrmSectionNav />
      <p className="mt-2 text-sm text-[var(--admin-text-muted)]">
        {t('admin-pages.crm.imports.hint')}
      </p>
      <label className="mt-4 block text-sm text-[var(--admin-text)]">
        {t('admin-pages.crm.imports.jsonLabel')}
        <textarea
          className="mt-1 min-h-[180px] w-full rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 font-mono text-xs text-[var(--admin-text)]"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          spellCheck={false}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btnGhost} disabled={busy} onClick={runPreview}>
          {t('admin-pages.crm.imports.preview')}
        </button>
        <button type="button" className={btnGhost} disabled={busy} onClick={runConfirm}>
          {t('admin-pages.crm.imports.confirm')}
        </button>
      </div>
      {message ? (
        <p className="mt-3 text-sm text-[var(--admin-text)]">{message}</p>
      ) : null}
      {preview?.honesty ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span>{t('admin-pages.crm.imports.honesty')}</span>
          <AdminStatusBadge tone="info">
            {preview.honesty.status || 'READY'}
          </AdminStatusBadge>
          <span className="text-[var(--admin-text-muted)]">
            {t('admin-pages.crm.imports.noSuccessRate')}
          </span>
        </div>
      ) : null}
      {preview?.preview ? (
        <pre className="mt-3 max-h-64 overflow-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-3 text-xs text-[var(--admin-text)]">
          {JSON.stringify(
            {
              total: preview.preview.total,
              valid: preview.preview.valid,
              invalid: preview.preview.invalid,
              duplicateKeys: preview.preview.duplicateKeys,
            },
            null,
            2
          )}
        </pre>
      ) : null}
      {confirmResult?.honesty ? (
        <pre className="mt-3 max-h-64 overflow-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-3 text-xs text-[var(--admin-text)]">
          {JSON.stringify(confirmResult.honesty, null, 2)}
        </pre>
      ) : null}
    </AdminPageContainer>
  );
}
