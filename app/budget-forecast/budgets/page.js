'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PermissionGuard from '@/components/PermissionGuard';
import BfShell, {
  StatusBadge,
  SummaryCard,
  BfPrimaryButton,
  BfSecondaryButton,
} from '@/components/budget-forecast/BfShell';
import PosStylePanel from '@/components/shell/PosStylePanel';
import { formatCurrency } from '@/lib/currencyUtils';

export default function BudgetsPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    startDate: `${new Date().getFullYear()}-01-01`,
    endDate: `${new Date().getFullYear()}-12-31`,
    frequency: 'MONTHLY',
    budgetMethod: 'CREATE_MANUALLY',
  });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/budget-forecast/budgets?dashboard=1');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setDashboard(json.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createBudget(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/budget-forecast/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Create failed');
      router.push(`/budget-forecast/budgets/${json.data.id}`);
    } catch (e) {
      setError(e.message);
      setCreating(false);
    }
  }

  async function migrateBf() {
    setError('');
    const res = await fetch('/api/budget-forecast/migrate', { method: 'POST' });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Migration failed');
      return;
    }
    await load();
  }

  const cards = dashboard?.cards || {};

  return (
    <PermissionGuard requiredPermission="budgets.view">
      <BfShell
        title="Budgets"
        subtitle="Plan revenue and expenses against the Chart of Accounts. Budgets never post to the General Ledger."
        actions={
          <BfSecondaryButton type="button" onClick={migrateBf}>
            Migrate legacy BF data
          </BfSecondaryButton>
        }
      >
        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Planned revenue"
            value={formatCurrency(cards.plannedRevenue || 0)}
            hint="All listed budgets"
            barClassName="from-emerald-400 via-green-500 to-teal-500"
          />
          <SummaryCard
            label="Planned expenses"
            value={formatCurrency(cards.plannedExpense || 0)}
            barClassName="from-rose-400 via-rose-500 to-orange-500"
          />
          <SummaryCard
            label="Expected profit"
            value={formatCurrency(cards.expectedProfit || 0)}
            barClassName="from-blue-500 via-sky-500 to-indigo-500"
          />
          <SummaryCard
            label="Active completion"
            value={`${cards.completion || 0}%`}
            hint={cards.activeStatus || 'No active budget'}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <PosStylePanel accent="default" className="lg:col-span-2">
            <div className="border-b border-white/60 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Budgets</h2>
            </div>
            {loading ? (
              <p className="p-4 text-sm text-slate-500">Loading…</p>
            ) : (
              <ul className="divide-y divide-slate-100/80">
                {(dashboard?.recent || []).length === 0 ? (
                  <li className="p-6 text-sm text-slate-500">No budgets yet. Create one to start planning.</li>
                ) : (
                  (dashboard?.recent || []).map((b) => (
                    <li key={b.id}>
                      <Link
                        href={`/budget-forecast/budgets/${b.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/60"
                      >
                        <div>
                          <p className="font-medium text-slate-900">{b.name}</p>
                          <p className="text-xs text-slate-500">
                            v{b.versionNumber}.{b.revisionNumber} · {b.frequency} · {b.currency}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {b.completion ? (
                            <span className="text-xs text-slate-500">{b.completion.percent}%</span>
                          ) : null}
                          <StatusBadge status={b.status} />
                        </div>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            )}
          </PosStylePanel>

          <PosStylePanel accent="green" className="p-4">
            <h2 className="text-sm font-semibold text-slate-900">Create budget</h2>
            <form className="mt-4 space-y-3" onSubmit={createBudget}>
              <label className="block text-sm">
                <span className="text-slate-600">Name</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Start</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">End</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Frequency</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2"
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="ANNUAL">Annual</option>
                </select>
              </label>
              <BfPrimaryButton type="submit" success className="w-full" disabled={creating}>
                {creating ? 'Creating…' : 'Create draft'}
              </BfPrimaryButton>
            </form>
          </PosStylePanel>
        </div>
      </BfShell>
    </PermissionGuard>
  );
}
