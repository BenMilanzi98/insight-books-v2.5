'use client';

import { useState } from 'react';
import AdminModal from './AdminModal';
import { useI18n } from '@/components/i18n/I18nProvider';

/** Shell only — dry-run import UI foundation. */
export default function AdminImportDialog({ open, onClose, onImport, configured = false }) {
  const { t } = useI18n();
  const [file, setFile] = useState(null);

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={t('admin-foundation.import.title')}
    >
      <p className="text-sm text-[var(--admin-text-muted)]">
        {configured
          ? t('admin-foundation.import.description')
          : t('admin-foundation.import.notConfigured')}
      </p>
      {configured ? (
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-[var(--admin-text)]">
            {t('admin-foundation.import.chooseFile')}
            <input
              type="file"
              className="mt-1 block w-full text-sm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            type="button"
            disabled={!file}
            className="h-11 rounded-[var(--admin-radius)] bg-[var(--admin-accent,#0ea5e9)] px-4 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => onImport?.({ file })}
          >
            {t('admin-foundation.import.start')}
          </button>
        </div>
      ) : null}
    </AdminModal>
  );
}
