'use client';

import { Fragment, useState } from 'react';
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
  if (line.lineId === 'gross-margin' || line.isPercent) return 'text-emerald-600 font-medium';
  if (line.lineType === 'GRAND_TOTAL' || line.lineType === 'CALCULATED_TOTAL') return 'font-bold text-slate-900';
  if (line.lineType === 'ACCOUNT_GROUP' || line.lineType === 'SECTION') return 'font-semibold text-slate-800';
  return 'text-slate-700';
}

export default function ProfitLossTable({ report, onDrill }) {
  const periods = report?.periods || [];
  const lines = report?.lines || [];
  const [expanded, setExpanded] = useState(() => new Set(['revenue', 'operating-expenses', 'cost-of-sales']));

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b-2 border-blue-600 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="sticky left-0 z-10 bg-white py-3 pr-4 font-semibold text-slate-700"> </th>
            {periods.map((p) => (
              <th key={p.key} className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                {p.label}
              </th>
            ))}
            <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const hasChildren = Array.isArray(line.children) && line.children.length > 0;
            const open = expanded.has(line.lineId);
            const isRatio = line.lineId === 'gross-margin' || line.isPercent;
            return (
              <Fragment key={line.lineId}>
                <tr className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="sticky left-0 z-10 bg-white py-2.5 pr-4">
                    <button
                      type="button"
                      className={`inline-flex max-w-[16rem] items-center gap-1 text-left ${lineTone(line)}`}
                      onClick={() => (hasChildren ? toggle(line.lineId) : onDrill?.(line))}
                    >
                      {hasChildren ? (
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
                    {isRatio
                      ? line.percent != null
                        ? `${line.percent}%`
                        : fmtMoney(line.currentAmount)
                      : fmtMoney(line.currentAmount)}
                  </td>
                </tr>
                {hasChildren && open
                  ? line.children.map((child) => (
                      <tr key={child.lineId} className="border-b border-slate-50 bg-slate-50/40">
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
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
