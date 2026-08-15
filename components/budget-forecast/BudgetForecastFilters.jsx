'use client';
import { tt } from '@/lib/i18n/runtime';

import { reportNeedsBudget, reportNeedsForecast } from '@/lib/budgetForecast/reportFilterConfig';

export { reportNeedsBudget, reportNeedsForecast };

export default function BudgetForecastFilters({
  draft,
  onChange,
  onApply,
  onReset,
  onClose,
  definitions = [],
  budgets = [],
  forecasts = [],
  applying = false,
}) {
  const set = (patch) => onChange({ ...draft, ...patch });
  const reportId = draft.reportId;

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
          <span className="font-medium text-slate-700">{tt('Report')}</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={reportId}
            onChange={(e) => set({ reportId: e.target.value })}
          >
            {(definitions.length ? definitions : [{ id: 'BVA', name: 'Budget versus Actual' }]).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        {reportNeedsBudget(reportId) ? (
          <label className="block text-sm">
            <span className="font-medium text-slate-700">{tt('Budget')}</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={draft.budgetId}
              onChange={(e) => set({ budgetId: e.target.value })}
            >
              <option value="">{tt('Select…')}</option>
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} (v{b.versionNumber})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {reportNeedsForecast(reportId) ? (
          <label className="block text-sm">
            <span className="font-medium text-slate-700">{tt('Forecast')}</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={draft.forecastId}
              onChange={(e) => set({ forecastId: e.target.value })}
            >
              <option value="">{tt('Select…')}</option>
              {forecasts.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
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
          {applying ? 'Applying…' : 'Apply'}
        </button>
      </div>
    </aside>
  );
}
