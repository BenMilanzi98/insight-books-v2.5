'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function TooltipBody({ active, payload, label, valueFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-[var(--admin-text)]">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="tabular-nums text-[var(--admin-text-muted)]">
          {p.name}: {valueFormatter ? valueFormatter(p.value) : Number(p.value).toLocaleString()}
        </div>
      ))}
    </div>
  );
}

export default function AdminTrendChart({
  data = [],
  xKey = 'label',
  yKey = 'value',
  yName = 'Value',
  color = 'var(--admin-chart-2)',
  valueFormatter,
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="adminTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: 'var(--admin-text-muted)' }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--admin-text-muted)' }}
          axisLine={false}
          tickLine={false}
          width={56}
          tickFormatter={(v) =>
            valueFormatter ? valueFormatter(v) : Number(v).toLocaleString()
          }
        />
        <Tooltip
          content={<TooltipBody valueFormatter={valueFormatter} />}
        />
        <Area
          type="monotone"
          dataKey={yKey}
          name={yName}
          stroke={color}
          strokeWidth={2.25}
          fill="url(#adminTrendFill)"
          animationDuration={700}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
