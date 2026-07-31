'use client';

import { useState } from 'react';
import AdminModal from './AdminModal';
import { useI18n } from '@/components/i18n/I18nProvider';

/** Shell only — does not invent export business rules. */
export default function AdminExportDialog({ open, onClose, onExport, configured = false }) {
  const { t } = useI18n();
  const [format, setFormat] = useState('csv');

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={t('admin-foundation.export.title')}
    >
      <p className="text-sm text-[var(--admin-text-muted)]">
        {configured
          ? t('admin-foundation.export.description')
          : t('admin-foundation.export.notConfigured')}
      </p>
      {configured ? (
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="export-format"
              checked={format === 'csv'}
              onChange={() => setFormat('csv')}
            />
            {t('admin-foundation.export.formatCsv')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="export-format"
              checked={format === 'xlsx'}
              onChange={() => setFormat('xlsx')}
            />
            {t('admin-foundation.export.formatXlsx')}
          </label>
          <button
            type="button"
            className="mt-2 h-11 rounded-[var(--admin-radius)] bg-[var(--admin-accent,#0ea5e9)] px-4 text-sm font-medium text-white"
            onClick={() => onExport?.({ format })}
          >
            {t('admin-foundation.export.start')}
          </button>
        </div>
      ) : null}
    </AdminModal>
  );
}
