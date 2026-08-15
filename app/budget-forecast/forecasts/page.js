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
} from '@/components/budget-forecast/BfShell';
import PosStylePanel from '@/components/shell/PosStylePanel';
import { formatCurrency } from '@/lib/currencyUtils';

const METHODS = [
  {
    id: 'CURRENT_RUN_RATE',
    label: 'Current run rate',
    hint: 'Average monthly actuals × forecast months.',
  },
  {
    id: 'HISTORICAL_AVERAGE',
    label: 'Historical average',
    hint: 'Same as run rate over the actuals window.',
  },
  {
    id: 'BUDGET_REMAINDER',
    label: 'Budget remainder',
    hint: 'Remaining budget after year-to-date actuals (needs source budget).',
  },
  {
    id: 'RECURRING',
    label: 'Recurring monthly',
    hint: 'Fixed monthly amount (or average actual) across the horizon.',
  },
  {
    id: 'OPEN_RECEIVABLES',
    label: 'Open receivables',
    hint: 'Schedule collections from open customer invoices by aging.',
  },
  {
    id: 'OPEN_PAYABLES',
    label: 'Open payables',
    hint: 'Schedule payments from open supplier bills by aging.',
  },
  {
    id: 'INVENTORY_DEMAND',
    label: 'Inventory demand',
    hint: 'Draft purchase/COGS projections from sales velocity (never creates POs).',
  },
  {
    id: 'MANUAL',
    label: 'Manual',
    hint: 'Seed zero lines for accounts — edit months on the detail page.',
  },
];

export default function ForecastsPage() {
  const router = useRouter();
  const year = new Date().getFullYear();
  const [dashboard, setDashboard] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [assumptionSets, setAssumptionSets] = useState([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    scenarioType: 'BASE_CASE',
    action: 'rolling',
    method: 'CURRENT_RUN_RATE',
    sourceBudgetId: '',
    growthPercent: '0',
    recurringAmount: '',
    departmentId: '',
    assumptionSetId: '',
    assumptionName: '',
    assumptionGrowth: '0',
  });

  async function load() {
    setError('');
    try {
      const [dashRes, budgetRes, deptRes, assumRes] = await Promise.all([
        fetch('/api/budget-forecast/forecasts?dashboard=1'),
        fetch('/api/budget-forecast/budgets'),
        fetch('/api/departments').catch(() => null),
        fetch('/api/budget-forecast/assumptions'),
      ]);
      const dashJson = await dashRes.json();
      if (!dashRes.ok) throw new Error(dashJson.error || 'Failed to load');
      setDashboard(dashJson.data);

      const budgetJson = await budgetRes.json();
      if (budgetRes.ok) setBudgets(budgetJson.data || []);

      if (deptRes?.ok) {
        const deptJson = await deptRes.json();
        setDepartments(Array.isArray(deptJson) ? deptJson : deptJson.data || []);
      }

      const assumJson = await assumRes.json();
      if (assumRes.ok) setAssumptionSets(assumJson.data || []);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setField(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function create(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      if (form.method === 'BUDGET_REMAINDER' && !form.sourceBudgetId) {
        throw new Error('Select a source budget for budget remainder');
      }
      let assumptionSetId = form.assumptionSetId || undefined;
      if (!assumptionSetId && form.assumptionName.trim()) {
        const aRes = await fetch('/api/budget-forecast/assumptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.assumptionName.trim(),
            assumptions: [
              {
                assumptionType: 'GROWTH',
                scopeType: 'GLOBAL',
                unit: 'PERCENT',
                value: Number(form.assumptionGrowth || 0),
              },
            ],
          }),
        });
        const aJson = await aRes.json();
        if (!aRes.ok) throw new Error(aJson.error || 'Failed to create assumption set');
        assumptionSetId = aJson.data.id;
      }

      const body = {
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate,
        scenarioType: form.scenarioType,
        action: form.action,
        method: form.method,
        sourceBudgetId: form.sourceBudgetId || undefined,
        growthPercent: Number(form.growthPercent || 0),
        departmentId: form.departmentId || undefined,
        assumptionSetId,
        cutoffDate: new Date().toISOString(),
      };
      if (form.method === 'RECURRING' && form.recurringAmount !== '') {
        body.recurringAmount = Number(form.recurringAmount);
      }

      const res = await fetch('/api/budget-forecast/forecasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Create failed');
      const id = Array.isArray(json.data) ? json.data[0]?.id : json.data?.base?.id || json.data?.id;
      if (!id) throw new Error('Forecast created but no id returned');
      router.push(`/budget-forecast/forecasts/${id}`);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  const cards = dashboard?.cards || {};
  const primaryId = dashboard?.primaryForecastId;
  const alerts = dashboard?.alerts || [];
  const needsBudget = form.method === 'BUDGET_REMAINDER' || form.action !== 'create';
  const showRecurring = form.method === 'RECURRING';

  return (
    <PermissionGuard requiredPermission="budgets.view">
      <BfShell
        title="Forecasts"
        subtitle="Rolling, cash flow and scenario forecasts. Deterministic methods only — never posts to the ledger."
        actions={
          primaryId ? (
            <Link
              href={`/budget-forecast/reports?reportId=CASH_OUTLOOK&forecastId=${primaryId}`}
              className="inline-flex items-center rounded-lg bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-white"
            >
              {tt('Cash outlook')}
            </Link>
          ) : null
        }
      >
        {error ? (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}

        {alerts.length > 0 ? (
          <div className="mb-4 space-y-2">
            {alerts.map((a) => (
              <div
                key={a.key}
                className={`rounded-lg px-4 py-3 text-sm ${
                  a.severity === 'critical'
                    ? 'border border-red-200 bg-red-50 text-red-900'
                    : a.severity === 'warning'
                      ? 'border border-amber-200 bg-amber-50 text-amber-900'
                      : 'border border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                {a.message}
                {primaryId ? (
                  <>
                    {' '}
                    <Link
                      className="font-medium underline"
                      href={`/budget-forecast/forecasts/${primaryId}`}
                    >
                      {tt('Open forecast')}
                    </Link>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Forecast revenue"
            value={formatCurrency(cards.forecastRevenue || 0)}
            barClassName="from-emerald-400 via-green-500 to-teal-500"
          />
          <SummaryCard
            label="Forecast expenses"
            value={formatCurrency(cards.forecastExpense || 0)}
            barClassName="from-rose-400 via-rose-500 to-orange-500"
          />
          <SummaryCard
            label="Forecast profit"
            value={formatCurrency(cards.forecastProfit || 0)}
            barClassName="from-blue-500 via-sky-500 to-indigo-500"
          />
          <SummaryCard label="Forecasts" value={String(cards.forecastCount || 0)} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <PosStylePanel accent="default" className="lg:col-span-2">
            <div className="border-b border-white/60 px-4 py-3 text-sm font-semibold text-slate-900">
              {tt('Recent forecasts')}
            </div>
            <ul className="divide-y divide-slate-100/80">
              {(dashboard?.recent || []).length === 0 ? (
                <li className="p-6 text-sm text-slate-500">{tt('No forecasts yet.')}</li>
              ) : (
                (dashboard?.recent || []).map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/budget-forecast/forecasts/${f.id}`}
                      className="flex justify-between px-4 py-3 hover:bg-white/60"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{f.name}</p>
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
          </PosStylePanel>

          <PosStylePanel accent="green" className="p-4">
            <h2 className="text-sm font-semibold text-slate-900">{tt('Create forecast')}</h2>
            <form className="mt-4 space-y-3" onSubmit={create}>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
                placeholder={tt('Name')}
                value={form.name}
                onChange={(e) => setField({ name: e.target.value })}
                required
              />
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
                value={form.startDate}
                onChange={(e) => setField({ startDate: e.target.value })}
              />
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
                value={form.endDate}
                onChange={(e) => setField({ endDate: e.target.value })}
              />
              <label className="block text-xs font-medium text-slate-600">{tt('Type')}</label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
                value={form.action}
                onChange={(e) => setField({ action: e.target.value })}
              >
                <option value="rolling">{tt('Rolling forecast')}</option>
                <option value="cashFlow">{tt('Cash flow forecast')}</option>
                <option value="scenarios">{tt('Base / Best / Worst scenarios')}</option>
                <option value="create">{tt('Draft only')}</option>
              </select>
              <label className="block text-xs font-medium text-slate-600">{tt('Method')}</label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
                value={form.method}
                onChange={(e) => setField({ method: e.target.value })}
                disabled={form.action === 'create'}
              >
                {METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {tt(m.label)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                {tt(METHODS.find((m) => m.id === form.method)?.hint || '')}
              </p>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
                value={form.scenarioType}
                onChange={(e) => setField({ scenarioType: e.target.value })}
              >
                <option value="BASE_CASE">{tt('Base case')}</option>
                <option value="BEST_CASE">{tt('Best case')}</option>
                <option value="WORST_CASE">{tt('Worst case')}</option>
              </select>
              {(needsBudget || form.sourceBudgetId) && form.action !== 'create' ? (
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
                  value={form.sourceBudgetId}
                  onChange={(e) => setField({ sourceBudgetId: e.target.value })}
                  required={form.method === 'BUDGET_REMAINDER'}
                >
                  <option value="">{tt('Source budget (optional)')}</option>
                  {budgets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.status})
                    </option>
                  ))}
                </select>
              ) : null}
              {form.action !== 'create' ? (
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
                  placeholder={tt('Growth %')}
                  value={form.growthPercent}
                  onChange={(e) => setField({ growthPercent: e.target.value })}
                />
              ) : null}
              {showRecurring ? (
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
                  placeholder={tt('Recurring monthly amount')}
                  value={form.recurringAmount}
                  onChange={(e) => setField({ recurringAmount: e.target.value })}
                />
              ) : null}
              <select
                className="w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
                value={form.assumptionSetId}
                onChange={(e) => setField({ assumptionSetId: e.target.value })}
              >
                <option value="">{tt('Assumption set (optional)')}</option>
                {assumptionSets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {!form.assumptionSetId ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
                    placeholder={tt('New assumption set name')}
                    value={form.assumptionName}
                    onChange={(e) => setField({ assumptionName: e.target.value })}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
                    placeholder={tt('Growth %')}
                    value={form.assumptionGrowth}
                    onChange={(e) => setField({ assumptionGrowth: e.target.value })}
                  />
                </div>
              ) : null}
              {departments.length > 0 ? (
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
                  value={form.departmentId}
                  onChange={(e) => setField({ departmentId: e.target.value })}
                >
                  <option value="">{tt('Department (optional)')}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name || d.label}
                    </option>
                  ))}
                </select>
              ) : null}
              <BfPrimaryButton type="submit" success className="w-full" disabled={creating}>
                {creating ? tt('Creating…') : tt('Create')}
              </BfPrimaryButton>
            </form>
          </PosStylePanel>
        </div>
      </BfShell>
    </PermissionGuard>
  );
}
