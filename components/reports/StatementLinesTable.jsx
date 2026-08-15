'use client';
import { tt } from '@/lib/i18n/runtime';

import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

function fmtMoney(amount) {
  if (amount == null) return '—';
  if (amount.isPercent || amount.percent != null) {
    const p = amount.percent ?? Number(amount.decimal);
    return p == null || Number.isNaN(p) ? '—' : `${p}%`;
  }
  const n = Number(amount.decimal ?? amount);
  if (Number.isNaN(n)) return '—';
  return n < 0
    ? `(${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2 })})`
    : n.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function lineTone(line) {
  if (line.lineId === 'gross-margin' || line.lineId === 'net-margin' || line.isPercent || line.lineType === 'RATIO') return 'text-emerald-600 font-medium';
  if (line.lineType === 'GRAND_TOTAL' || line.lineType === 'CALCULATED_TOTAL') return 'font-bold text-slate-900';
  if (line.lineType === 'SUBTOTAL') return 'font-bold text-slate-900';
  if (line.lineType === 'ACCOUNT_GROUP' || line.lineType === 'SECTION') return 'font-semibold text-blue-600';
  return 'text-slate-700';
}

function amountCell(line) {
  if (line.lineType === 'SECTION' && !line.currentAmount) return '';
  if (line.isPercent || line.lineId === 'gross-margin' || line.lineId === 'net-margin' || line.lineType === 'RATIO') {
    return line.percent != null ? `${line.percent}%` : fmtMoney(line.currentAmount);
  }
  return fmtMoney(line.currentAmount);
}

function rowKey(line, index, prefix = '') {
  return `${prefix}${line.lineId ?? 'line'}-${index}`;
}

/**
 * FreshBooks-style statement table: blue header rule, blue section labels,
 * indented children/accounts, bold totals, green margin %.
 */
export default function StatementLinesTable({ report, onDrill }) {
  const periods = report?.periods || [];
  const lines = report?.lines || [];
  const hasPeriods = periods.length > 0 && lines.some((l) => Array.isArray(l.periodAmounts) && l.periodAmounts.length);
  const hasBudget = lines.some((l) => l.budgetAmount);
  const hasComp = lines.some((l) => l.comparativeAmount);
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    setExpanded(
      new Set(
        (report?.lines || [])
          .filter((l) => l.lineType === 'SECTION' || l.lineType === 'ACCOUNT_GROUP')
          .map((l) => l.lineId)
      )
    );
  }, [report]);

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (hasPeriods) {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b-2 border-blue-600 text-left text-xs uppercase tracking-wide text-blue-600">
              <th className="sticky left-0 z-10 bg-white py-3 pr-4 font-semibold"> </th>
              {periods.map((p) => (
                <th key={p.key} className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                  {p.label}
                </th>
              ))}
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">{tt('Total')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const hasChildren = Array.isArray(line.children) && line.children.length > 0;
              const hasAccounts = Array.isArray(line.accounts) && line.accounts.length > 0;
              const open = expanded.has(line.lineId);
              const isRatio = line.lineId === 'gross-margin' || line.isPercent;
              const zebra = i % 2 === 1 ? 'bg-slate-50/70' : 'bg-white';
              return (
                <Fragment key={rowKey(line, i)}>
                  <tr className={`border-b border-slate-100 ${zebra}`}>
                    <td className={`sticky left-0 z-10 py-2.5 pr-4 ${zebra}`}>
                      <button
                        type="button"
                        className={`inline-flex max-w-[16rem] items-center gap-1 text-left ${lineTone(line)}`}
                        onClick={() => (hasChildren || hasAccounts ? toggle(line.lineId) : onDrill?.(line))}
                      >
                        {hasChildren || hasAccounts ? (
                          open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <span className="inline-block w-3.5" />
                        )}
                        <span>{line.label}</span>
                      </button>
                    </td>
                    {periods.map((p, idx) => {
                      const pa = line.periodAmounts?.[idx];
                      const cell = isRatio
                        ? pa?.percent != null
                          ? `${pa.percent}%`
                          : fmtMoney({ ...pa?.amount, isPercent: true, percent: pa?.percent })
                        : fmtMoney(pa?.amount);
                      return (
                        <td key={p.key} className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${lineTone(line)}`}>
                          {onDrill && !isRatio && !hasChildren ? (
                            <button type="button" className="text-blue-600 hover:underline" onClick={() => onDrill(line)}>
                              {cell}
                            </button>
                          ) : (
                            cell
                          )}
                        </td>
                      );
                    })}
                    <td className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${lineTone(line)}`}>
                      {amountCell(line)}
                    </td>
                  </tr>
                  {hasChildren && open
                    ? line.children.map((child, ci) => (
                        <tr key={rowKey(child, ci, `${line.lineId}-child-`)} className="border-b border-slate-50 bg-slate-50/40">
                          <td className="sticky left-0 z-10 bg-slate-50/95 py-2 pl-8 pr-4 text-slate-600">
                            <button
                              type="button"
                              className="text-left text-blue-600 hover:underline"
                              onClick={() => onDrill?.(child)}
                            >
                              {child.label}
                            </button>
                          </td>
                          {periods.map((p, idx) => (
                            <td key={p.key} className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-600">
                              {fmtMoney(child.periodAmounts?.[idx]?.amount)}
                            </td>
                          ))}
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-600">
                            {fmtMoney(child.currentAmount)}
                          </td>
                        </tr>
                      ))
                    : null}
                  {hasAccounts && open
                    ? line.accounts.map((a) => (
                        <tr key={`${line.lineId}-${a.accountId}`} className="border-b border-slate-50 bg-slate-50/40">
                          <td className="sticky left-0 z-10 bg-slate-50/95 py-2 pl-8 pr-4">
                            <a className="text-blue-600 hover:underline" href={`/general-ledger-v2?accountId=${a.accountId}`}>
                              {a.accountCode} — {a.accountName}
                            </a>
                          </td>
                          {periods.map((p) => (
                            <td key={p.key} className="px-3 py-2" />
                          ))}
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-600">
                            {fmtMoney(a.amount)}
                          </td>
                        </tr>
                      ))
                    : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b-2 border-blue-600 text-left text-xs uppercase tracking-wide text-blue-600">
            <th className="sticky left-0 z-10 bg-white py-3 pr-4 font-semibold"> </th>
            {hasBudget ? (
              <>
                <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">{tt('Budget')}</th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">{tt('Actual')}</th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">{tt('Variance')}</th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">%</th>
              </>
            ) : (
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">{tt('Total')}</th>
            )}
            {hasComp ? (
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">{tt('Comparative')}</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const hasAccounts = Array.isArray(line.accounts) && line.accounts.length > 0;
            const hasChildren = Array.isArray(line.children) && line.children.length > 0;
            const open = expanded.has(line.lineId);
            const zebra = i % 2 === 1 ? 'bg-slate-50/70' : 'bg-white';
            return (
              <Fragment key={rowKey(line, i)}>
                <tr className={`border-b border-slate-100 ${zebra}`}>
                  <td className={`sticky left-0 z-10 py-2.5 pr-4 ${zebra}`}>
                    <button
                      type="button"
                      className={`inline-flex max-w-[20rem] items-center gap-1 text-left ${lineTone(line)}`}
                      onClick={() => (hasAccounts || hasChildren ? toggle(line.lineId) : onDrill?.(line))}
                    >
                      {hasAccounts || hasChildren ? (
                        open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <span className="inline-block w-3.5" />
                      )}
                      <span>{line.label}</span>
                    </button>
                  </td>
                  {hasBudget ? (
                    <>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-700">
                        {line.budgetAmount ? fmtMoney(line.budgetAmount) : '—'}
                      </td>
                      <td className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${lineTone(line)}`}>
                        {line.lineType === 'SECTION' ? '' : amountCell(line)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${
                          line.metadata?.isFavourable === false ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {line.budgetVariance ? fmtMoney(line.budgetVariance) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {line.variancePercentage != null ? `${Number(line.variancePercentage).toFixed(1)}%` : '—'}
                      </td>
                    </>
                  ) : (
                    <td className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${lineTone(line)}`}>
                      {onDrill && line.lineType !== 'SECTION' ? (
                        <button type="button" className="text-blue-600 hover:underline" onClick={() => onDrill(line)}>
                          {amountCell(line)}
                        </button>
                      ) : (
                        amountCell(line)
                      )}
                    </td>
                  )}
                  {hasComp ? (
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-600">
                      {line.comparativeAmount ? fmtMoney(line.comparativeAmount) : ''}
                    </td>
                  ) : null}
                </tr>
                {hasChildren && open
                  ? line.children.map((child) => (
                      <tr key={rowKey(child, ci, `${line.lineId}-child-`)} className="border-b border-slate-50 bg-slate-50/40">
                        <td className="sticky left-0 z-10 bg-slate-50/95 py-2 pl-8 pr-4">
                          <button type="button" className="text-left text-blue-600 hover:underline" onClick={() => onDrill?.(child)}>
                            {child.label}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-600">
                          {fmtMoney(child.currentAmount)}
                        </td>
                        {hasComp ? <td /> : null}
                      </tr>
                    ))
                  : null}
                {hasAccounts && open
                  ? line.accounts.map((a) => (
                      <tr key={`${line.lineId}-${a.accountId}`} className="border-b border-slate-50 bg-slate-50/40">
                        <td className="sticky left-0 z-10 bg-slate-50/95 py-2 pl-8 pr-4">
                          <a className="text-blue-600 hover:underline" href={`/general-ledger-v2?accountId=${a.accountId}`}>
                            {a.accountCode} — {a.accountName}
                          </a>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-600">{fmtMoney(a.amount)}</td>
                        {hasComp ? <td /> : null}
                        {hasBudget ? (
                          <>
                            <td />
                            <td />
                            <td />
                          </>
                        ) : null}
                      </tr>
                    ))
                  : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
