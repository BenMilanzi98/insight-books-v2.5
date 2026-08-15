'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/currencyUtils';

const COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#f43f5e', '#6366f1', '#64748b', '#14b8a6', '#a855f7'];

function ChartTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const value = Number(item.value) || 0;
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-slate-900">{item.name}</div>
      <div className="mt-1 tabular-nums text-slate-600">
        {formatCurrency(value)} · {pct.toFixed(1)}%
      </div>
    </div>
  );
}

/**
 * Donut chart for reports dashboard summaries.
 */
export default function ReportsDonutChart({
  title,
  data = [],
  centerLabel,
  centerValue,
  emptyLabel = 'No data',
}) {
  const rows = (data || [])
    .map((d, i) => ({
      name: d.name,
      value: Math.max(0, Number(d.value) || 0),
      color: d.color || COLORS[i % COLORS.length],
    }))
    .filter((d) => d.value > 0);

  const total = rows.reduce((s, d) => s + d.value, 0);
  const chartRows = rows.length ? rows : [{ name: emptyLabel, value: 1, color: '#e2e8f0' }];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {title ? <h3 className="mb-3 text-sm font-bold text-slate-900">{title}</h3> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative mx-auto h-48 w-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartRows}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={rows.length > 1 ? 2 : 0}
                stroke="#fff"
                strokeWidth={2}
              >
                {chartRows.map((entry, i) => (
                  <Cell key={entry.name || i} fill={entry.color} />
                ))}
              </Pie>
              {rows.length ? <Tooltip content={<ChartTooltip total={total} />} /> : null}
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-lg font-bold tabular-nums text-slate-900">
                {centerValue ?? (total > 0 ? formatCurrency(total) : '—')}
              </div>
              {centerLabel ? <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{centerLabel}</div> : null}
            </div>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-2">
          {rows.length ? (
            rows.map((row) => {
              const pct = total > 0 ? (row.value / total) * 100 : 0;
              return (
                <li key={row.name} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-slate-700">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
                    <span className="truncate">{row.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-slate-900">
                    {formatCurrency(row.value)}
                    <span className="ml-1 text-xs text-slate-400">({pct.toFixed(0)}%)</span>
                  </span>
                </li>
              );
            })
          ) : (
            <li className="text-sm text-slate-500">{emptyLabel}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
