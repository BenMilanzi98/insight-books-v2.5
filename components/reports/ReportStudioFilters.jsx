'use client';
import { tt } from '@/lib/i18n/runtime';

import { DATE_PRESETS } from '../../lib/reports/reportDatePresets';

/**
 * FreshBooks-style filter sidebar. Sections are toggled via `config`.
 */
export default function ReportStudioFilters({
  draft,
  onChange,
  onApply,
  onReset,
  onClose,
  applying = false,
  config = {},
}) {
  const set = (patch) => onChange({ ...draft, ...patch });
  const showGroupBy = config.groupBy !== false && config.groupBy != null ? config.groupBy : false;
  const showBasis = Boolean(config.basis);
  const showBreakdown = Boolean(config.breakdown);
  const showAsOf = Boolean(config.asOf);
  const showIncludeZero = Boolean(config.includeZero);

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
          <span className="font-medium text-slate-700">{showAsOf ? tt('As of') : tt('Date range')}</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={draft.preset}
            onChange={(e) => set({ preset: e.target.value })}
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {tt(p.label)}
              </option>
            ))}
          </select>
        </label>

        {draft.preset === 'custom' || showAsOf ? (
          <div className={showAsOf ? '' : 'grid grid-cols-2 gap-2'}>
            {!showAsOf ? (
              <label className="text-xs text-slate-600">
                {tt('From')}
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                  value={draft.fromDate}
                  onChange={(e) => set({ fromDate: e.target.value })}
                />
              </label>
            ) : null}
            <label className="text-xs text-slate-600">
              {showAsOf ? tt('As of date') : tt('To')}
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                value={draft.toDate}
                onChange={(e) => set(showAsOf ? { preset: 'custom', toDate: e.target.value } : { toDate: e.target.value })}
              />
            </label>
          </div>
        ) : null}

        {showGroupBy ? (
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">{tt('Group by')}</legend>
            <div className="mt-2 space-y-2">
              {['MONTH', 'QUARTER'].map((g) => (
                <label key={g} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="studio-groupby"
                    checked={draft.groupBy === g}
                    onChange={() => set({ groupBy: g })}
                  />
                  {g === 'MONTH' ? tt('Month') : tt('Quarter')}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {showBasis ? (
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">{tt('Accounting method')}</legend>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="studio-basis"
                  checked={draft.reportBasis === 'ACCRUAL'}
                  onChange={() => set({ reportBasis: 'ACCRUAL' })}
                />
                {tt('Billed (Accrual)')}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="studio-basis"
                  checked={draft.reportBasis === 'CASH'}
                  onChange={() => set({ reportBasis: 'CASH' })}
                />
                {tt('Collected (Cash-Based)')}
              </label>
            </div>
          </fieldset>
        ) : null}

        {showBreakdown ? (
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">{tt('Breakdown')}</legend>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="studio-breakdown"
                  checked={draft.breakdown === 'SOURCE_TYPE'}
                  onChange={() => set({ breakdown: 'SOURCE_TYPE' })}
                />
                {tt('By Transaction type')}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="studio-breakdown"
                  checked={draft.breakdown === 'ACCOUNT'}
                  onChange={() => set({ breakdown: 'ACCOUNT' })}
                />
                {tt('By Account')}
              </label>
            </div>
          </fieldset>
        ) : null}

        {showIncludeZero ? (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(draft.includeZero)}
              onChange={(e) => set({ includeZero: e.target.checked })}
            />
            {tt('Include zero balances')}
          </label>
        ) : null}
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
          {applying ? tt('Applying…') : tt('Apply')}
        </button>
      </div>
    </aside>
  );
}

export { DATE_PRESETS };
