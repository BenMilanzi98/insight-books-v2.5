'use client';
import { tt } from '@/lib/i18n/runtime';
import { DATE_PRESETS } from '@/lib/reports/reportDatePresets';

export default function ProfitLossFilters({
  draft,
  onChange,
  onApply,
  onReset,
  onClose,
  currencyOptions = [],
  applying = false,
}) {
  const set = (patch) => onChange({ ...draft, ...patch });

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-t border-slate-200 bg-white lg:w-80 lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-900">{tt('Filters')}</h2>
        <button type="button" onClick={onReset} className="text-sm font-medium text-blue-600 hover:text-blue-800">
          {tt('Reset all')}
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">{tt('Date range')}</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={draft.preset}
            onChange={(e) => set({ preset: e.target.value })}
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        {draft.preset === 'custom' ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-600">
              {tt('From')}
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                value={draft.fromDate}
                onChange={(e) => set({ fromDate: e.target.value })}
              />
            </label>
            <label className="text-xs text-slate-600">
              {tt('To')}
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                value={draft.toDate}
                onChange={(e) => set({ toDate: e.target.value })}
              />
            </label>
          </div>
        ) : null}

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">{tt('Group by')}</legend>
          <div className="mt-2 space-y-2">
            {['MONTH', 'QUARTER'].map((g) => (
              <label key={g} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="pl-groupby"
                  checked={draft.groupBy === g}
                  onChange={() => set({ groupBy: g })}
                />
                {g === 'MONTH' ? 'Month' : 'Quarter'}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">{tt('Accounting method')}</legend>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="pl-basis"
                checked={draft.reportBasis === 'ACCRUAL'}
                onChange={() => set({ reportBasis: 'ACCRUAL' })}
              />
              Billed (Accrual)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="pl-basis"
                checked={draft.reportBasis === 'CASH'}
                onChange={() => set({ reportBasis: 'CASH' })}
              />
              Collected (Cash-Based)
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">{tt('Breakdown')}</legend>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="pl-breakdown"
                checked={draft.breakdown === 'SOURCE_TYPE'}
                onChange={() => set({ breakdown: 'SOURCE_TYPE' })}
              />
              {tt('By Transaction type')}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="pl-breakdown"
                checked={draft.breakdown === 'ACCOUNT'}
                onChange={() => set({ breakdown: 'ACCOUNT' })}
              />
              {tt('By Account')}
            </label>
          </div>
        </fieldset>

        <label className="block text-sm">
          <span className="font-medium text-slate-700">{tt('Currency')}</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={draft.currency || ''}
            onChange={(e) => set({ currency: e.target.value || null })}
          >
            <option value="">{tt('Primary business currency')}</option>
            {currencyOptions.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
        {onClose ? (
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            {tt('Close')}
          </button>
        ) : null}
        <button
          type="button"
          disabled={applying}
          onClick={onApply}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
        >
          {applying ? 'Applying…' : 'Apply'}
        </button>
      </div>
    </aside>
  );
}

export { DATE_PRESETS };
