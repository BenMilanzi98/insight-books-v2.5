'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import LayoutPicker from '@/components/documentTemplates/LayoutPicker';
import { parseTemplateContent } from '@/lib/documentTemplates/parseTemplateContent';

/**
 * Bulk-apply document appearance to selected invoices or quotations.
 */
export default function BulkApplyTemplateDialog({
  open,
  onClose,
  documentType = 'invoice',
  selectedIds = [],
  branding,
  initialAppearance,
  onApplied,
}) {
  const [appearance, setAppearance] = useState(
    () => parseTemplateContent(initialAppearance || { layoutId: 'classic' })
  );
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const label = documentType === 'quotation' ? 'quotations' : 'invoices';
  const endpoint =
    documentType === 'quotation'
      ? '/api/quotations/bulk-template'
      : '/api/invoices/bulk-template';
  const idsKey = documentType === 'quotation' ? 'quotationIds' : 'invoiceIds';

  const handleApply = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          [idsKey]: selectedIds,
          appearance,
          setAsDefault,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to apply template');
      onApplied?.(data);
      onClose?.();
    } catch (e) {
      setError(e.message || 'Failed to apply template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Apply template</h2>
            <p className="text-sm text-gray-500">
              {selectedIds.length} selected {label} · preview updates live
            </p>
          </div>
          <button type="button" className="p-2 rounded-lg hover:bg-gray-100" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <LayoutPicker
            value={appearance}
            onChange={setAppearance}
            documentType={documentType}
            branding={branding || {}}
            setAsDefault={setAsDefault}
            onSetAsDefaultChange={setSetAsDefault}
            showLivePreview
          />
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t bg-gray-50">
          <button
            type="button"
            className="px-4 py-2 text-sm rounded-lg border border-gray-200"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50"
            onClick={handleApply}
            disabled={saving || selectedIds.length === 0}
          >
            {saving ? 'Applying…' : `Apply to ${selectedIds.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}
