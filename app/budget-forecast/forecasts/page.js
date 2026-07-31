'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PermissionGuard from '@/components/PermissionGuard';
import BfShell, { StatusBadge, SummaryCard } from '@/components/budget-forecast/BfShell';
import { formatCurrency } from '@/lib/currencyUtils';

export default function ForecastsPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    startDate: `${new Date().getFullYear()}-01-01`,
    endDate: `${new Date().getFullYear()}-12-31`,
    scenarioType: 'BASE_CASE',
    action: 'rolling',
  });

  async function load() {
    const res = await fetch('/api/budget-forecast/forecasts?dashboard=1');
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Failed to load');
      return;
    }
    setDashboard(json.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/budget-forecast/forecasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        cutoffDate: new Date().toISOString(),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Create failed');
      return;
    }
    const id = Array.isArray(json.data) ? json.data[0]?.id : json.data.id;
    router.push(`/budget-forecast/forecasts/${id}`);
  }

  const cards = dashboard?.cards || {};

  return (
    <PermissionGuard requiredPermission="budgets.view">
      <BfShell
        title="Forecasts"
        subtitle="Rolling, cash flow and scenario forecasts. Deterministic methods only — never posts to the ledger."
      >
        {error ? <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Forecast revenue" value={formatCurrency(cards.forecastRevenue || 0)} />
          <SummaryCard label="Forecast expenses" value={formatCurrency(cards.forecastExpense || 0)} />
          <SummaryCard label="Forecast profit" value={formatCurrency(cards.forecastProfit || 0)} />
          <SummaryCard label="Forecasts" value={String(cards.forecastCount || 0)} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3 text-sm font-semibold">Recent forecasts</div>
            <ul className="divide-y">
              {(dashboard?.recent || []).length === 0 ? (
                <li className="p-6 text-sm text-slate-500">No forecasts yet.</li>
              ) : (
                (dashboard?.recent || []).map((f) => (
                  <li key={f.id}>
                    <Link href={`/budget-forecast/forecasts/${f.id}`} className="flex justify-between px-4 py-3 hover:bg-slate-50">
                      <div>
                        <p className="font-medium">{f.name}</p>
                        <p className="text-xs text-slate-500">
                          {f.forecastType} · {f.scenarioType} · {f.calculationVersion}
                        </p>
                      </div>
                      <StatusBadge status={f.status} />
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Generate forecast</h2>
            <form className="mt-4 space-y-3" onSubmit={create}>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <input type="date" className="w-full rounded-lg border px-3 py-2 text-sm" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              <input type="date" className="w-full rounded-lg border px-3 py-2 text-sm" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
                <option value="rolling">Rolling forecast</option>
                <option value="cashFlow">Cash flow forecast</option>
                <option value="scenarios">Base / Best / Worst scenarios</option>
                <option value="create">Draft only</option>
              </select>
              <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.scenarioType} onChange={(e) => setForm({ ...form, scenarioType: e.target.value })}>
                <option value="BASE_CASE">Base case</option>
                <option value="BEST_CASE">Best case</option>
                <option value="WORST_CASE">Worst case</option>
              </select>
              <button type="submit" className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">
                Create
              </button>
            </form>
          </section>
        </div>
      </BfShell>
    </PermissionGuard>
  );
}
