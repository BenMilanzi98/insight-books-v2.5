'use client';

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';

const DEFAULT_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#f43f5e', '#6366f1', '#64748b'];

function TooltipBody({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const value = Number(item.value) || 0;
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="flex items-center gap-2 font-semibold text-slate-900">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: item.payload?.color || item.color }}
          aria-hidden
        />
        {item.name}
      </div>
      <div className="mt-1 tabular-nums text-slate-600">
        {value.toLocaleString()} · {pct.toFixed(1)}%
      </div>
    </div>
  );
}

/**
 * Donut chart with a custom breakdown legend (avoids cramped Recharts legend).
 */
export default function AdminPieChart({
  data = [],
  dataKey = 'value',
  nameKey = 'name',
  colors = DEFAULT_COLORS,
  innerRadius = 62,
  outerRadius = 92,
  centerLabel,
  centerValue,
  breakdown,
  className,
}) {
  const chartData = (data || [])
    .map((d, i) => ({
      ...d,
      color: d.color || colors[i % colors.length],
      [dataKey]: Number(d[dataKey]) || 0,
    }))
    .filter((d) => d[dataKey] > 0);

  const legendRows = Array.isArray(breakdown) && breakdown.length
    ? breakdown
    : (data || []).map((d, i) => ({
        ...d,
        color: d.color || colors[i % colors.length],
        value: Number(d[dataKey]) || 0,
      }));

  const total = legendRows.reduce((s, d) => s + (Number(d.value ?? d[dataKey]) || 0), 0);

  return (
    <div className={cn('flex h-full min-h-0 w-full flex-col gap-3 sm:flex-row sm:items-center', className)}>
      <div className="relative mx-auto h-52 w-52 shrink-0 sm:h-56 sm:w-56">
        <div
          className="pointer-events-none absolute inset-[18%] rounded-full bg-gradient-to-br from-sky-50 via-white to-emerald-50 shadow-inner"
          aria-hidden
        />
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData.length ? chartData : [{ name: 'Empty', value: 1, color: '#e2e8f0' }]}
              dataKey={dataKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={chartData.length > 1 ? 3 : 0}
              cornerRadius={6}
              stroke="#ffffff"
              strokeWidth={3}
              isAnimationActive
              animationDuration={700}
            >
              {(chartData.length ? chartData : [{ color: '#e2e8f0' }]).map((entry, i) => (
                <Cell
                  key={entry[nameKey] || i}
                  fill={entry.color || colors[i % colors.length]}
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(15,23,42,0.12))' }}
                />
              ))}
            </Pie>
            {chartData.length ? (
              <Tooltip content={<TooltipBody total={total} />} />
            ) : null}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">
              {centerValue != null ? centerValue : total.toLocaleString()}
            </div>
            {centerLabel ? (
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {centerLabel}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2.5 px-1">
        {legendRows.map((row) => {
          const value = Number(row.value ?? row[dataKey]) || 0;
          const pct = total > 0 ? (value / total) * 100 : 0;
          return (
            <li
              key={row[nameKey] || row.name}
              className="rounded-xl border border-slate-100 bg-white/80 px-3 py-2.5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white shadow"
                    style={{ background: row.color }}
                    aria-hidden
                  />
                  <span className="truncate text-sm font-medium text-slate-800">
                    {row.name}
                  </span>
                </div>
                <span className="tabular-nums text-sm font-semibold text-slate-900">
                  {value.toLocaleString()}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(pct > 0 ? 4 : 0, pct)}%`,
                    background: row.color,
                  }}
                />
              </div>
              <div className="mt-1 text-[11px] tabular-nums text-slate-500">
                {pct.toFixed(0)}% of tenants
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
