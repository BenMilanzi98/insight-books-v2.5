'use client';
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PermissionGuard from '@/components/PermissionGuard';
import BfShell, {
  StatusBadge,
  SummaryCard,
  BfSecondaryButton,
} from '@/components/budget-forecast/BfShell';
import PosStylePanel from '@/components/shell/PosStylePanel';
import PnlBudgetGrid from '@/components/budget-forecast/PnlBudgetGrid';
import { formatCurrency } from '@/lib/currencyUtils';
import { buildBudgetPeriodColumns } from '@/lib/budgetForecast/domain/periods.js';
import {
  BUDGET_GROWTH_MODES,
  applyGrowthToPeriodMap,
  parseLineGrowthAssumptions,
  serializeLineGrowthAssumptions,
} from '@/lib/budgetForecast/domain/budgetGrowth.js';

function periodKeyFromRow(p) {
  if (p.key) return p.key;
  if (p.quarterNumber && !p.monthNumber) {
    const d = new Date(p.periodStart);
    return `${d.getUTCFullYear()}-Q${p.quarterNumber}`;
  }
  if (!p.monthNumber && !p.quarterNumber) {
    const d = new Date(p.periodStart);
    return String(d.getUTCFullYear());
  }
  if (p.monthNumber && p.periodStart) {
    const d = new Date(p.periodStart);
    return `${d.getUTCFullYear()}-${String(p.monthNumber).padStart(2, '0')}`;
  }
  const d = new Date(p.periodStart);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function emptyMonths(monthKeys) {
  const o = {};
  for (const m of monthKeys) o[m.key] = '0';
  return o;
}

function sumMonths(months) {
  return Object.values(months || {}).reduce((s, v) => s + (Number(v) || 0), 0);
}

function spreadAnnual(annual, monthKeys) {
  const n = Math.max(1, monthKeys.length);
  const total = Number(annual) || 0;
  const base = Math.floor((total * 100) / n) / 100;
  const months = {};
  let allocated = 0;
  monthKeys.forEach((m, i) => {
    if (i === n - 1) {
      months[m.key] = String(Math.round((total - allocated) * 100) / 100);
    } else {
      months[m.key] = String(base);
      allocated += base;
    }
  });
  return months;
}

export default function BudgetDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [budget, setBudget] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [periodEdits, setPeriodEdits] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [growthSettings, setGrowthSettings] = useState({});

  const monthKeys = useMemo(() => {
    if (!budget?.startDate || !budget?.endDate) return [];
    return buildBudgetPeriodColumns(budget.frequency, budget.startDate, budget.endDate).map((p) => ({
      ...p,
      periodStart: p.periodStart.toISOString(),
      periodEnd: p.periodEnd.toISOString(),
    }));
  }, [budget?.startDate, budget?.endDate, budget?.frequency]);

  function seedEdits(data, months) {
    const edits = {};
    const growth = {};
    const ids = (data.lines || []).map((l) => l.accountId);
    for (const line of data.lines || []) {
      growth[line.accountId] = parseLineGrowthAssumptions(line.assumptions);
      const monthsMap = emptyMonths(months);
      for (const p of line.periodAmounts || []) {
        const key = periodKeyFromRow(p);
        if (key in monthsMap) monthsMap[key] = String(p.plannedAmount ?? 0);
      }
      if (!(line.periodAmounts || []).length && line.annualAmount != null) {
        Object.assign(monthsMap, spreadAnnual(line.annualAmount, months));
      }
      edits[line.accountId] = monthsMap;
    }
    setPeriodEdits(edits);
    setGrowthSettings(growth);
    setSelectedAccountIds(ids);
  }

  async function load() {
    setError('');
    const res = await fetch(`/api/budget-forecast/budgets/${id}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Failed to load budget');
      return;
    }
    setBudget(json.data);
    const months = buildBudgetPeriodColumns(json.data.frequency, json.data.startDate, json.data.endDate).map((p) => ({
      ...p,
      periodStart: p.periodStart.toISOString(),
      periodEnd: p.periodEnd.toISOString(),
    }));
    seedEdits(json.data, months);
  }

  async function loadAccounts() {
    const res = await fetch('/api/chart-of-accounts/picker?postingOnly=1');
    const json = await res.json();
    const rows = json.data || json.accounts || json || [];
    setAccounts(Array.isArray(rows) ? rows : []);
  }

  useEffect(() => {
    if (id) {
      load();
      loadAccounts();
    }
  }, [id]);

  const totals = useMemo(() => {
    let rev = 0;
    let exp = 0;
    for (const accountId of selectedAccountIds) {
      const line = (budget?.lines || []).find((l) => l.accountId === accountId);
      const acc = accounts.find((a) => (a.id || a.accountId) === accountId);
      const t = String(line?.accountTypeSnapshot || acc?.accountType || '').toLowerCase();
      const cat = String(line?.accountCategorySnapshot || acc?.coaV2Category || '').toUpperCase();
      const amt = sumMonths(periodEdits[accountId]);
      if (t.includes('income') || t.includes('revenue') || cat === 'REVENUE' || cat === 'OTHER_INCOME') {
        rev += amt;
      } else {
        exp += amt;
      }
    }
    return { rev, exp, profit: rev - exp };
  }, [selectedAccountIds, periodEdits, budget, accounts]);

  function setGrowthForAccount(accountId, patch) {
    setGrowthSettings((prev) => ({
      ...prev,
      [accountId]: { mode: BUDGET_GROWTH_MODES.MANUAL, growthPercent: 0, fixedIncrement: 0, ...prev[accountId], ...patch },
    }));
  }

  function applyGrowthForAccount(accountId) {
    const settings = growthSettings[accountId];
    if (!settings || settings.mode === BUDGET_GROWTH_MODES.MANUAL) return;
    const keys = monthKeys.map((m) => m.key);
    const existing = periodEdits[accountId] || emptyMonths(monthKeys);
    const next = applyGrowthToPeriodMap(keys, existing, settings);
    setPeriodEdits((prev) => ({ ...prev, [accountId]: next }));
  }

  function addAccount(accountId) {
    if (selectedAccountIds.includes(accountId)) return;
    setSelectedAccountIds((prev) => [...prev, accountId]);
    setPeriodEdits((edits) => ({
      ...edits,
      [accountId]: edits[accountId] || emptyMonths(monthKeys),
    }));
    setGrowthSettings((prev) => ({
      ...prev,
      [accountId]: prev[accountId] || { mode: BUDGET_GROWTH_MODES.MANUAL, growthPercent: 0, fixedIncrement: 0 },
    }));
  }

  function removeAccount(accountId) {
    setSelectedAccountIds((prev) => prev.filter((x) => x !== accountId));
  }

  async function saveLines() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const lines = selectedAccountIds.map((accountId) => {
        const months = periodEdits[accountId] || emptyMonths(monthKeys);
        const growth = growthSettings[accountId] || { mode: BUDGET_GROWTH_MODES.MANUAL };
        return {
          accountId,
          calculationMethod: growth.mode,
          assumptions: serializeLineGrowthAssumptions(growth),
          periods: monthKeys.map((m) => ({
            key: m.key,
            periodStart: m.periodStart,
            periodEnd: m.periodEnd,
            monthNumber: m.monthNumber,
            quarterNumber: m.quarterNumber,
            amount: Number(months[m.key] || 0),
            sourceMethod: growth.mode || 'MANUAL',
            growthRate: growth.mode === BUDGET_GROWTH_MODES.GROWTH_PERCENT ? growth.growthPercent : null,
          })),
        };
      });
      const res = await fetch(`/api/budget-forecast/budgets/${id}/lines`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setBudget(json.data);
      seedEdits(json.data, monthKeys);
      setMessage('Budget lines saved. Annual totals are the sum of monthly amounts. No journals were created.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function runCommand(command) {
    setError('');
    setMessage('');
    const res = await fetch(`/api/budget-forecast/budgets/${id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Action failed');
      return;
    }
    setBudget(json.data);
    setMessage(`Command “${command}” completed.`);
  }

  function setMonthAmount(accountId, key, value) {
    setPeriodEdits((prev) => ({
      ...prev,
      [accountId]: { ...(prev[accountId] || emptyMonths(monthKeys)), [key]: value },
    }));
  }

  function setAnnualAmount(accountId, annual) {
    setPeriodEdits((prev) => ({
      ...prev,
      [accountId]: spreadAnnual(annual, monthKeys),
    }));
  }

  if (!budget && !error) {
    return (
      <PermissionGuard requiredPermission="budgets.view">
        <BfShell title={tt('Budget')} subtitle={tt('Loading…')} />
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard requiredPermission="budgets.view">
      <BfShell
        title={budget?.name || 'Budget'}
        subtitle={`${budget?.currency || ''} · ${budget?.frequency || ''} · completion ${budget?.completion?.percent ?? 0}%`}
        actions={
          <>
            <BfSecondaryButton type="button" onClick={() => router.push('/budget-forecast/budgets')}>
              {tt('Back')}
            </BfSecondaryButton>
            <BfSecondaryButton type="button" onClick={() => runCommand('submit')}>
              {tt('Submit')}
            </BfSecondaryButton>
            <BfSecondaryButton type="button" onClick={() => runCommand('approve')}>
              {tt('Approve')}
            </BfSecondaryButton>
            <BfSecondaryButton type="button" onClick={() => runCommand('activate')}>
              {tt('Activate')}
            </BfSecondaryButton>
            <BfSecondaryButton type="button" onClick={() => runCommand('lock')}>
              {tt('Lock')}
            </BfSecondaryButton>
            <BfSecondaryButton type="button" onClick={() => runCommand('revise')}>
              {tt('Revise')}
            </BfSecondaryButton>
          </>
        }
      >
        {error ? (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <StatusBadge status={budget?.status} />
          <span className="text-sm text-slate-500">
            v{budget?.versionNumber}.{budget?.revisionNumber}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Revenue"
            value={formatCurrency(totals.rev)}
            barClassName="from-emerald-400 via-green-500 to-teal-500"
          />
          <SummaryCard
            label="Expenses"
            value={formatCurrency(totals.exp)}
            barClassName="from-rose-400 via-rose-500 to-orange-500"
          />
          <SummaryCard
            label="Profit"
            value={formatCurrency(totals.profit)}
            barClassName="from-blue-500 via-sky-500 to-indigo-500"
          />
          <SummaryCard
            label="Completion"
            value={`${budget?.completion?.percent ?? 0}%`}
            hint={(budget?.completion?.remaining || []).slice(0, 2).join(' · ') || 'Ready'}
          />
        </div>

        <PosStylePanel accent="green" className="overflow-x-auto p-4">
          <PnlBudgetGrid
            monthKeys={monthKeys}
            accounts={accounts}
            selectedAccountIds={selectedAccountIds}
            periodEdits={periodEdits}
            onAddAccount={addAccount}
            onRemoveAccount={removeAccount}
            onMonthChange={setMonthAmount}
            onAnnualChange={setAnnualAmount}
            onSave={saveLines}
            saving={saving}
            showAdvanced={showAdvanced}
            onShowAdvancedChange={setShowAdvanced}
            growthSettings={growthSettings}
            onGrowthChange={setGrowthForAccount}
            onApplyGrowth={applyGrowthForAccount}
          />
        </PosStylePanel>
      </BfShell>
    </PermissionGuard>
  );
}
