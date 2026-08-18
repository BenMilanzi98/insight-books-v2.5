'use client';
import { tt } from '@/lib/i18n/runtime';

import React from 'react';
import { X } from 'lucide-react';

/**
 * Custom range + single-day pickers for report timeframes (used on /stock and /reports).
 */
export function ReportDateRangeModals({
  showCustomDateRange,
  onCloseCustom,
  customDateRange,
  onCustomDateRangeChange,
  onApplyCustom,
  showSingleDayPicker,
  onCloseSingleDay,
  singleDayPickerDate,
  onSingleDayDateChange,
  onApplySingleDay,
  singleDayTitle = 'Pick a day',
  singleDayDescription = 'Show stock movements for one calendar day only.',
}) {
  return (
    <>
      {showSingleDayPicker && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
          role="dialog"
          aria-modal="true"
        >
          <ModalPanel>
            <ModalHeader title={singleDayTitle} onClose={onCloseSingleDay} />
            <p className="text-sm text-slate-500 mb-4">{singleDayDescription}</p>
            <DateField label="Date" value={singleDayPickerDate} onChange={onSingleDayDateChange} />
            <ModalActions onCancel={onCloseSingleDay} onApply={onApplySingleDay} applyLabel="Apply" />
          </ModalPanel>
        </div>
      )}

      {showCustomDateRange && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
          role="dialog"
          aria-modal="true"
        >
          <ModalPanel>
            <ModalHeader title={tt('Custom date range')} onClose={onCloseCustom} />
            <div className="space-y-4">
              <DateField
                label="Start date"
                value={customDateRange.startDate}
                onChange={(v) => onCustomDateRangeChange('startDate', v)}
              />
              <DateField
                label="End date"
                value={customDateRange.endDate}
                onChange={(v) => onCustomDateRangeChange('endDate', v)}
              />
            </div>
            <ModalActions onCancel={onCloseCustom} onApply={onApplyCustom} applyLabel="Apply range" />
          </ModalPanel>
        </div>
      )}
    </>
  );
}

function ModalPanel({ children }) {
  return (
    <div className="bg-white p-6 rounded-2xl w-full max-w-md border border-slate-200 shadow-xl">
      {children}
    </div>
  );
}

function ModalHeader({ title, onClose }) {
  return (
    <div className="flex justify-between items-center mb-5">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
        aria-label={tt('Close')}
      >
        <X size={20} />
      </button>
    </div>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
      />
    </div>
  );
}

function ModalActions({ onCancel, onApply, applyLabel }) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button
        type="button"
        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium"
        onClick={onCancel}
      >
        {tt('Cancel')}
      </button>
      <button
        type="button"
        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors text-sm font-medium"
        onClick={onApply}
      >
        {applyLabel}
      </button>
    </div>
  );
}
