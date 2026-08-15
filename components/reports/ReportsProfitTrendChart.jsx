'use client';
import { tt } from '@/lib/i18n/runtime';

import { useId } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '@/lib/currencyUtils';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-slate-900">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="tabular-nums text-slate-600">
          <span style={{ color: p.color }}>{p.name}:</span> {formatCurrency(p.value)}
        </div>
      ))}
    </div>
  );
}

/**
 * Multi-series trend for income, expenses, and net profit.
 * Shared by reports Dashboard and Profit Analysis.
 */
export default function ReportsProfitTrendChart({
  months = [],
  income = [],
  expenses = [],
  title = null,
  heightClass = 'h-56',
  className = '',
}) {
  const uid = useId().replace(/:/g, '');
  const incomeFill = `reportsIncomeFill-${uid}`;
  const expenseFill = `reportsExpenseFill-${uid}`;
  const profitFill = `reportsProfitFill-${uid}`;

  if (!months.length) return null;

  const data = months.map((label, i) => {
    const inc = Number(income[i]) || 0;
    const exp = Number(expenses[i]) || 0;
    return { label, income: inc, expenses: exp, profit: inc - exp };
  });

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h3 className="mb-3 text-sm font-bold text-slate-900">{title ?? tt('Profit trend')}</h3>
      <div className={`w-full ${heightClass}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={incomeFill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id={expenseFill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id={profitFill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              minTickGap={16}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              width={64}
              tickFormatter={(v) =>
                Number(v).toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })
              }
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="income"
              name="Income"
              stroke="#10b981"
              fill={`url(#${incomeFill})`}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke="#f43f5e"
              fill={`url(#${expenseFill})`}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="profit"
              name="Net profit"
              stroke="#0ea5e9"
              fill={`url(#${profitFill})`}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
