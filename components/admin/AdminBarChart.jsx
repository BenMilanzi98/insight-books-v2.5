'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function TooltipBody({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-[var(--admin-text)]">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="tabular-nums text-[var(--admin-text-muted)]">
          {p.name}: {Number(p.value).toLocaleString()}
        </div>
      ))}
    </div>
  );
}

export default function AdminBarChart({
  data = [],
  xKey = 'label',
  bars = [{ key: 'value', name: 'Value', color: 'var(--admin-chart-1)' }],
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: 'var(--admin-text-muted)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--admin-text-muted)' }}
          axisLine={false}
          tickLine={false}
          width={40}
          allowDecimals={false}
        />
        <Tooltip content={<TooltipBody />} cursor={{ fill: 'var(--admin-surface-muted)' }} />
        {bars.map((b) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.name}
            fill={b.color}
            radius={[4, 4, 0, 0]}
            animationDuration={650}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
