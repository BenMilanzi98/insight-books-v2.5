'use client';
import { tt } from '@/lib/i18n/runtime';

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

const METHODS = [
  {
    id: 'CREATE_MANUALLY',
    label: 'Blank budget',
    hint: 'Start from scratch and enter amounts by account.',
  },
  {
    id: 'GENERATE_FROM_ACTUALS',
    label: 'Previous year (actuals)',
    hint: 'Seed from posted ledger actuals for last year, then adjust.',
  },
  {
    id: 'COPY_PREVIOUS_BUDGET',
    label: 'Previous budget',
    hint: 'Duplicate an existing budget.',
  },
  {
    id: 'PERCENTAGE_ADJUSTMENT',
    label: 'Percentage adjustment',
    hint: 'Copy a budget and apply a % increase or decrease.',
  },
];

function previousYearRange() {
  const y = new Date().getFullYear() - 1;
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

export default function BudgetsPage() {
  const router = useRouter();
  const year = new Date().getFullYear();
  const [dashboard, setDashboard] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    frequency: 'MONTHLY',
    budgetType: 'OPERATING',
    budgetMethod: 'CREATE_MANUALLY',
    sourceBudgetId: '',
    growthPercent: '0',
    departmentId: '',
  });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [dashRes, listRes, deptRes] = await Promise.all([
        fetch('/api/budget-forecast/budgets?dashboard=1'),
        fetch('/api/budget-forecast/budgets'),
        fetch('/api/departments').catch(() => null),
      ]);
      const dashJson = await dashRes.json();
      if (!dashRes.ok) throw new Error(dashJson.error || 'Failed to load dashboard');
      setDashboard(dashJson.data);

      const listJson = await listRes.json();
      if (listRes.ok) setBudgets(listJson.data || []);

      if (deptRes?.ok) {
        const deptJson = await deptRes.json();
        setDepartments(Array.isArray(deptJson) ? deptJson : deptJson.data || []);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setField(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function createBudget(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const method = form.budgetMethod;
      let body;

      if (method === 'GENERATE_FROM_ACTUALS') {
        const prior = previousYearRange();
        body = {
          action: 'generateFromActuals',
          name: form.name,
          description: form.description || undefined,
          actualsStart: prior.start,
          actualsEnd: prior.end,
          budgetStart: form.startDate,
          budgetEnd: form.endDate,
          startDate: prior.start,
          endDate: prior.end,
          frequency: form.frequency,
          growthPercent: Number(form.growthPercent || 0),
          departmentId: form.departmentId || undefined,
          budgetType: form.budgetType,
        };
      } else if (method === 'COPY_PREVIOUS_BUDGET' || method === 'PERCENTAGE_ADJUSTMENT') {
        if (!form.sourceBudgetId) throw new Error('Select a budget to copy');
        body = {
          action: 'copy',
          sourceBudgetId: form.sourceBudgetId,
          name: form.name,
          growthPercent:
            method === 'PERCENTAGE_ADJUSTMENT' ? Number(form.growthPercent || 0) : 0,
        };
      } else {
        body = {
          name: form.name,
          description: form.description || undefined,
          startDate: form.startDate,
          endDate: form.endDate,
          frequency: form.frequency,
          budgetType: form.budgetType,
          budgetMethod: 'CREATE_MANUALLY',
          departmentId: form.departmentId || undefined,
          fiscalYear: new Date(form.startDate).getFullYear(),
        };
      }

      const res = await fetch('/api/budget-forecast/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
  const callouts = dashboard?.varianceCallouts || [];
  const needsSource =
    form.budgetMethod === 'COPY_PREVIOUS_BUDGET' ||
    form.budgetMethod === 'PERCENTAGE_ADJUSTMENT';
  const showGrowth =
    form.budgetMethod === 'PERCENTAGE_ADJUSTMENT' ||
    form.budgetMethod === 'GENERATE_FROM_ACTUALS';

  return (
    <PermissionGuard requiredPermission="budgets.view">
      <BfShell
        title="Budgets"
        subtitle="Plan revenue and expenses against the Chart of Accounts. Budgets never post to the General Ledger."
        actions={
          <BfSecondaryButton type="button" onClick={migrateBf}>
            {tt('Migrate legacy BF data')}
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
            label="Annual budget"
            value={formatCurrency(cards.annualBudget ?? cards.plannedRevenue + cards.plannedExpense ?? 0)}
            hint="Planned revenue + expenses"
            barClassName="from-blue-500 via-sky-500 to-indigo-500"
          />
          <SummaryCard
            label="Actual revenue (YTD)"
            value={formatCurrency(cards.actualRevenue || 0)}
            hint={cards.actualsPeriodLabel || 'From posted journals'}
            barClassName="from-emerald-400 via-green-500 to-teal-500"
          />
          <SummaryCard
            label="Actual expenses (YTD)"
            value={formatCurrency(cards.actualExpense || 0)}
            barClassName="from-rose-400 via-rose-500 to-orange-500"
          />
          <SummaryCard
            label="Actual profit (YTD)"
            value={formatCurrency(cards.actualProfit || 0)}
            hint={cards.activeBudgetName ? `vs ${cards.activeBudgetName}` : cards.activeStatus || 'No active budget'}
            barClassName="from-amber-400 via-yellow-500 to-orange-500"
          />
        </div>

        {callouts.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {callouts.map((c) => (
              <div
                key={c.key}
                className={`rounded-xl border px-4 py-3 text-sm ${
                  c.isFavourable
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-rose-200 bg-rose-50 text-rose-900'
                }`}
              >
                <p className="font-medium">{c.message}</p>
                {c.budgetId ? (
                  <Link
                    href={`/budget-forecast/reports?reportId=BVA&budgetId=${c.budgetId}`}
                    className="mt-1 inline-block text-xs font-semibold underline"
                  >
                    Open Budget vs Actual
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <PosStylePanel accent="default" className="lg:col-span-2">
            <div className="border-b border-white/60 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">{tt('Budgets')}</h2>
            </div>
            {loading ? (
              <p className="p-4 text-sm text-slate-500">{tt('Loading…')}</p>
            ) : (
              <ul className="divide-y divide-slate-100/80">
                {(dashboard?.recent || []).length === 0 ? (
                  <li className="p-6 text-sm text-slate-500">{tt('No budgets yet. Create one to start planning.')}</li>
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
            <h2 className="text-sm font-semibold text-slate-900">{tt('Create budget')}</h2>
            <form className="mt-4 space-y-3" onSubmit={createBudget}>
              <fieldset>
                <legend className="text-sm text-slate-600">{tt('How to create')}</legend>
                <div className="mt-2 space-y-2">
                  {METHODS.map((m) => (
                    <label
                      key={m.id}
                      className={`flex cursor-pointer gap-2 rounded-lg border px-3 py-2 text-sm ${
                        form.budgetMethod === m.id
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-slate-200 bg-white/80'
                      }`}
                    >
                      <input
                        type="radio"
                        name="budgetMethod"
                        className="mt-1"
                        checked={form.budgetMethod === m.id}
                        onChange={() => setField({ budgetMethod: m.id })}
                      />
                      <span>
                        <span className="font-medium text-slate-900">{m.label}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{m.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="block text-sm">
                <span className="text-slate-600">{tt('Name')}</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2"
                  value={form.name}
                  onChange={(e) => setField({ name: e.target.value })}
                  required
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-600">{tt('Description')}</span>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setField({ description: e.target.value })}
                />
              </label>

              {form.budgetMethod === 'CREATE_MANUALLY' ||
              form.budgetMethod === 'GENERATE_FROM_ACTUALS' ? (
                <>
                  <label className="block text-sm">
                    <span className="text-slate-600">{tt('Start')}</span>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2"
                      value={form.startDate}
                      onChange={(e) => setField({ startDate: e.target.value })}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">{tt('End')}</span>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2"
                      value={form.endDate}
                      onChange={(e) => setField({ endDate: e.target.value })}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">{tt('Frequency')}</span>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2"
                      value={form.frequency}
                      onChange={(e) => setField({ frequency: e.target.value })}
                    >
                      <option value="MONTHLY">{tt('Monthly')}</option>
                      <option value="QUARTERLY">{tt('Quarterly')}</option>
                      <option value="ANNUAL">{tt('Annual')}</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">{tt('Budget type')}</span>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2"
                      value={form.budgetType}
                      onChange={(e) => setField({ budgetType: e.target.value })}
                    >
                      <option value="OPERATING">{tt('Operating')}</option>
                      <option value="CAPEX">{tt('Capital expenditure')}</option>
                      <option value="DEPARTMENT">{tt('Department')}</option>
                    </select>
                  </label>
                </>
              ) : null}

              {needsSource ? (
                <label className="block text-sm">
                  <span className="text-slate-600">{tt('Source budget')}</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2"
                    value={form.sourceBudgetId}
                    onChange={(e) => setField({ sourceBudgetId: e.target.value })}
                    required
                  >
                    <option value="">{tt('Select…')}</option>
                    {budgets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.status})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {showGrowth ? (
                <label className="block text-sm">
                  <span className="text-slate-600">
                    {form.budgetMethod === 'GENERATE_FROM_ACTUALS'
                      ? 'Optional growth on actuals (%)'
                      : 'Adjustment (%)'}
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2"
                    value={form.growthPercent}
                    onChange={(e) => setField({ growthPercent: e.target.value })}
                  />
                </label>
              ) : null}

              {departments.length > 0 &&
              (form.budgetMethod === 'CREATE_MANUALLY' ||
                form.budgetMethod === 'GENERATE_FROM_ACTUALS') ? (
                <label className="block text-sm">
                  <span className="text-slate-600">{tt('Department (optional)')}</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2"
                    value={form.departmentId}
                    onChange={(e) => setField({ departmentId: e.target.value })}
                  >
                    <option value="">{tt('All / none')}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

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
