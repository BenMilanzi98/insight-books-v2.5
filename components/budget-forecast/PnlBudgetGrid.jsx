'use client';
import { tt } from '@/lib/i18n/runtime';

import { Fragment, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  buildPnlBudgetLayout,
  filterAccountsForSection,
  SIMPLE_PNL_SECTIONS,
} from '@/lib/budgetForecast/domain/pnlBudgetLayout.js';
import { BUDGET_GROWTH_MODES } from '@/lib/budgetForecast/domain/budgetGrowth.js';
import { BfPrimaryButton, BF_THEAD_CLASS } from '@/components/budget-forecast/BfShell';
import { formatCurrency } from '@/lib/currencyUtils';

function groupRowsForDisplay(rows) {
  const groups = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (row.rowType === 'SECTION') {
      const accounts = [];
      i += 1;
      while (i < rows.length && rows[i].rowType === 'ACCOUNT' && rows[i].lineId === row.lineId) {
        accounts.push(rows[i]);
        i += 1;
      }
      groups.push({ type: 'section', section: row, accounts });
    } else {
      groups.push({ type: 'row', row });
      i += 1;
    }
  }
  return groups;
}

function sumMonths(months, monthKeys) {
  return monthKeys.reduce((s, m) => s + (Number(months[m.key]) || 0), 0);
}

function SectionAddAccount({ sectionLineId, allAccounts, selectedAccountIds, onAddAccount }) {
  const [open, setOpen] = useState(false);
  const options = useMemo(
    () => filterAccountsForSection(allAccounts, sectionLineId, selectedAccountIds).slice(0, 80),
    [allAccounts, sectionLineId, selectedAccountIds]
  );

  if (sectionLineId === 'unmapped') return null;

  return (
    <tr className="border-b border-slate-100/60 bg-slate-50/40">
      <td colSpan={999} className="py-2 pl-6">
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            <Plus className="h-3.5 w-3.5" />
            {tt('Add account')}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="max-w-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
              defaultValue=""
              onChange={(e) => {
                const id = e.target.value;
                if (id) {
                  onAddAccount(id);
                  setOpen(false);
                }
              }}
            >
              <option value="">{tt('Choose account…')}</option>
              {options.map((a) => {
                const id = a.id || a.accountId;
                return (
                  <option key={id} value={id}>
                    {a.accountCode || a.code} — {a.accountName || a.name}
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-700"
              onClick={() => setOpen(false)}
            >
              {tt('Cancel')}
            </button>
            {options.length === 0 ? (
              <span className="text-xs text-slate-400">{tt('No more accounts in this section.')}</span>
            ) : null}
          </div>
        )}
      </td>
    </tr>
  );
}

/**
 * P&L-grouped budget planner grid.
 */
export default function PnlBudgetGrid({
  monthKeys,
  accounts,
  selectedAccountIds,
  periodEdits,
  onAddAccount,
  onRemoveAccount,
  onMonthChange,
  onAnnualChange,
  onSave,
  saving,
  showAdvanced,
  onShowAdvancedChange,
  growthSettings = {},
  onGrowthChange,
  onApplyGrowth,
  plannerTitle = 'P&L budget planner',
  plannerHint = 'Accounts grouped like your Profit & Loss. Profit lines update automatically.',
  saveLabel = 'Save lines',
}) {
  const periodKeys = useMemo(() => monthKeys.map((m) => m.key), [monthKeys]);

  const { rows, summary } = useMemo(
    () =>
      buildPnlBudgetLayout({
        accounts,
        selectedAccountIds,
        periodEdits,
        periodKeys,
        showAdvanced,
      }),
    [accounts, selectedAccountIds, periodEdits, periodKeys, showAdvanced]
  );

  const groups = useMemo(() => groupRowsForDisplay(rows), [rows]);

  const colSpan = monthKeys.length + 3;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{tt(plannerTitle)}</h2>
          <p className="text-xs text-slate-500">{tt(plannerHint)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={showAdvanced}
              onChange={(e) => onShowAdvancedChange(e.target.checked)}
            />
            {tt('Show advanced P&L lines')}
          </label>
          <BfPrimaryButton type="button" success disabled={saving} onClick={onSave}>
            {saving ? tt('Saving…') : tt(saveLabel)}
          </BfPrimaryButton>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs">
          <span className="font-medium text-emerald-800">{tt('Gross Profit')}</span>
          <div className="text-sm font-semibold text-emerald-900">{formatCurrency(summary.grossProfit)}</div>
        </div>
        <div className="rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-2 text-xs">
          <span className="font-medium text-rose-800">{tt('Total Expenses')}</span>
          <div className="text-sm font-semibold text-rose-900">{formatCurrency(summary.operatingExpenses)}</div>
        </div>
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs">
          <span className="font-medium text-indigo-800">{tt('Net Profit')}</span>
          <div className="text-sm font-semibold text-indigo-900">{formatCurrency(summary.netProfit)}</div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead>
            <tr className={BF_THEAD_CLASS}>
              <th className="sticky left-0 z-10 min-w-[12rem] bg-inherit py-2.5 pr-2">{tt('Account')}</th>
              <th className="min-w-[8rem] py-2.5 px-1 text-left font-medium">{tt('Growth')}</th>
              {monthKeys.map((m) => (
                <th key={m.key} className="px-1 py-2.5 text-right font-medium">
                  {m.label}
                </th>
              ))}
              <th className="py-2.5 pl-2 text-right">{tt('Total')}</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="py-8 text-center text-slate-500">
                  {tt('Add accounts under Income, COGS, or Operating Expenses to start planning.')}
                </td>
              </tr>
            ) : null}

            {groups.map((group, gi) => {
              if (group.type === 'section') {
                const { section, accounts: sectionAccounts } = group;
                const canAdd = SIMPLE_PNL_SECTIONS.includes(section.lineId) || showAdvanced;
                return (
                  <Fragment key={`section-${section.lineId}-${gi}`}>
                    <tr key={`section-h-${section.lineId}-${gi}`} className="border-t-2 border-slate-200 bg-slate-100/80">
                      <td
                        colSpan={colSpan}
                        className="sticky left-0 py-2.5 pl-3 text-xs font-bold uppercase tracking-wide text-slate-700"
                      >
                        {section.label}
                      </td>
                    </tr>
                    {sectionAccounts.length === 0 ? (
                      <tr key={`section-empty-${section.lineId}-${gi}`}>
                        <td colSpan={colSpan} className="py-2 pl-6 text-xs italic text-slate-400">
                          {tt('No accounts yet — add one below.')}
                        </td>
                      </tr>
                    ) : null}
                    {sectionAccounts.map((row) => (
                      <AccountRow
                        key={row.accountId}
                        row={row}
                        monthKeys={monthKeys}
                        periodEdits={periodEdits}
                        onMonthChange={onMonthChange}
                        onAnnualChange={onAnnualChange}
                        onRemove={onRemoveAccount}
                        growth={growthSettings[row.accountId]}
                        onGrowthChange={(patch) => onGrowthChange?.(row.accountId, patch)}
                        onApplyGrowth={() => onApplyGrowth?.(row.accountId)}
                      />
                    ))}
                    {canAdd ? (
                      <SectionAddAccount
                        key={`section-add-${section.lineId}-${gi}`}
                        sectionLineId={section.lineId}
                        allAccounts={accounts}
                        selectedAccountIds={selectedAccountIds}
                        onAddAccount={onAddAccount}
                      />
                    ) : null}
                  </Fragment>
                );
              }

              const { row } = group;
              if (row.rowType === 'CALCULATED') {
                return (
                  <tr
                    key={row.lineId}
                    className="border-t border-slate-200 bg-indigo-50/50 font-semibold text-indigo-950"
                  >
                    <td className="sticky left-0 z-10 bg-indigo-50/95 py-2.5 pl-3 backdrop-blur-sm">
                      {row.label}
                    </td>
                    <td className="px-1 py-2.5" />
                    {monthKeys.map((m) => (
                      <td key={m.key} className="px-1 py-2.5 text-right text-xs text-indigo-800/70">
                        —
                      </td>
                    ))}
                    <td className="py-2.5 pl-2 text-right">{formatCurrency(row.total)}</td>
                  </tr>
                );
              }
              return null;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountRow({
  row,
  monthKeys,
  periodEdits,
  onMonthChange,
  onAnnualChange,
  onRemove,
  growth,
  onGrowthChange,
  onApplyGrowth,
}) {
  const months = periodEdits[row.accountId] || {};
  const total = sumMonths(months, monthKeys);
  const mode = growth?.mode || BUDGET_GROWTH_MODES.MANUAL;

  return (
    <tr className="border-b border-slate-100/80 hover:bg-white/60">
      <td className="sticky left-0 z-10 bg-white/95 py-2 pl-6 pr-2 backdrop-blur-sm">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[11px] text-slate-500">{row.code}</div>
            <div className="max-w-[10rem] truncate font-medium text-slate-800">{row.label}</div>
          </div>
          <button
            type="button"
            onClick={() => onRemove(row.accountId)}
            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
            title={tt('Remove from budget')}
            aria-label={tt('Remove from budget')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
      <td className="px-1 py-1 align-top">
        <div className="flex min-w-[7.5rem] flex-col gap-1">
          <select
            className="w-full rounded border border-slate-200 bg-white px-1 py-1 text-[11px]"
            value={mode}
            onChange={(e) => onGrowthChange?.({ mode: e.target.value })}
          >
            <option value={BUDGET_GROWTH_MODES.MANUAL}>{tt('Manual')}</option>
            <option value={BUDGET_GROWTH_MODES.GROWTH_PERCENT}>{tt('+%')}</option>
            <option value={BUDGET_GROWTH_MODES.GROWTH_FIXED}>{tt('+Fixed')}</option>
          </select>
          {mode === BUDGET_GROWTH_MODES.GROWTH_PERCENT ? (
            <input
              className="w-full rounded border border-slate-200 px-1 py-1 text-[11px]"
              value={growth?.growthPercent ?? 0}
              onChange={(e) => onGrowthChange?.({ growthPercent: Number(e.target.value) || 0 })}
              placeholder="10"
              inputMode="decimal"
              aria-label={tt('Growth percent')}
            />
          ) : null}
          {mode === BUDGET_GROWTH_MODES.GROWTH_FIXED ? (
            <input
              className="w-full rounded border border-slate-200 px-1 py-1 text-[11px]"
              value={growth?.fixedIncrement ?? 0}
              onChange={(e) => onGrowthChange?.({ fixedIncrement: Number(e.target.value) || 0 })}
              placeholder="5000000"
              inputMode="decimal"
              aria-label={tt('Fixed increment')}
            />
          ) : null}
          {mode !== BUDGET_GROWTH_MODES.MANUAL ? (
            <button
              type="button"
              onClick={onApplyGrowth}
              className="text-left text-[10px] font-medium text-indigo-600 hover:text-indigo-800"
            >
              {tt('Apply →')}
            </button>
          ) : null}
        </div>
      </td>
      {monthKeys.map((m) => (
        <td key={m.key} className="px-0.5 py-1">
          <input
            className="w-[4.5rem] rounded border border-slate-300 bg-white/90 px-1 py-1 text-right text-xs"
            value={months[m.key] ?? '0'}
            onChange={(e) => onMonthChange(row.accountId, m.key, e.target.value)}
            inputMode="decimal"
            aria-label={`${row.label} ${m.label}`}
          />
        </td>
      ))}
      <td className="py-1 pl-2">
        <input
          className="w-24 rounded border border-slate-300 bg-slate-50 px-2 py-1 text-right text-xs font-semibold"
          value={String(Math.round(total * 100) / 100)}
          onChange={(e) => onAnnualChange(row.accountId, e.target.value)}
          inputMode="decimal"
          title={tt('Edit to re-spread evenly across months')}
          aria-label={`${row.label} total`}
        />
      </td>
    </tr>
  );
}
