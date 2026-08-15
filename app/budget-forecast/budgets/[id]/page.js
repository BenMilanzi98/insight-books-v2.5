'use client';
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PermissionGuard from '@/components/PermissionGuard';
import BfShell, {
  StatusBadge,
  SummaryCard,
  BfPrimaryButton,
  BfSecondaryButton,
  BF_THEAD_CLASS,
} from '@/components/budget-forecast/BfShell';
import PosStylePanel from '@/components/shell/PosStylePanel';
import { formatCurrency } from '@/lib/currencyUtils';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildMonthKeys(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const keys = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  let guard = 0;
  while (cursor <= endMonth && guard < 120) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    keys.push({
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${MONTH_SHORT[m]} ${String(y).slice(2)}`,
      periodStart: new Date(Date.UTC(y, m, 1)).toISOString(),
      periodEnd: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)).toISOString(),
      monthNumber: m + 1,
      quarterNumber: Math.floor(m / 3) + 1,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    guard += 1;
  }
  return keys;
}

function periodKeyFromRow(p) {
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

  const monthKeys = useMemo(() => {
    if (!budget?.startDate || !budget?.endDate) return [];
    return buildMonthKeys(budget.startDate, budget.endDate);
  }, [budget?.startDate, budget?.endDate]);

  function seedEdits(data, months) {
    const edits = {};
    const ids = (data.lines || []).map((l) => l.accountId);
    for (const line of data.lines || []) {
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
    const months = buildMonthKeys(json.data.startDate, json.data.endDate);
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
      const amt = sumMonths(periodEdits[accountId]);
      if (t.includes('income') || t.includes('revenue')) rev += amt;
      else exp += amt;
    }
    return { rev, exp, profit: rev - exp };
  }, [selectedAccountIds, periodEdits, budget, accounts]);

  async function saveLines() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const lines = selectedAccountIds.map((accountId) => {
        const months = periodEdits[accountId] || emptyMonths(monthKeys);
        return {
          accountId,
          periods: monthKeys.map((m) => ({
            periodStart: m.periodStart,
            periodEnd: m.periodEnd,
            monthNumber: m.monthNumber,
            quarterNumber: m.quarterNumber,
            amount: Number(months[m.key] || 0),
            sourceMethod: 'MANUAL',
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

  function toggleAccount(accountId) {
    setSelectedAccountIds((prev) => {
      if (prev.includes(accountId)) return prev.filter((x) => x !== accountId);
      setPeriodEdits((edits) => ({
        ...edits,
        [accountId]: edits[accountId] || emptyMonths(monthKeys),
      }));
      return [...prev, accountId];
    });
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
        <BfShell title="Budget" subtitle="Loading…" />
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

        <div className="mt-8 grid gap-6 lg:grid-cols-4">
          <PosStylePanel accent="default" className="p-4 lg:col-span-1">
            <h2 className="text-sm font-semibold text-slate-900">{tt('Chart of Accounts')}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {tt('Select posting accounts. Parent + child together is rejected.')}
            </p>
            <div className="mt-3 max-h-[28rem] overflow-y-auto divide-y divide-slate-100/80">
              {accounts.slice(0, 300).map((a) => {
                const aid = a.id || a.accountId;
                const checked = selectedAccountIds.includes(aid);
                return (
                  <label key={aid} className="flex items-center gap-2 py-2 text-sm">
                    <input type="checkbox" checked={checked} onChange={() => toggleAccount(aid)} />
                    <span className="font-mono text-xs text-slate-500">{a.accountCode || a.code}</span>
                    <span className="truncate">{a.accountName || a.name}</span>
                  </label>
                );
              })}
            </div>
          </PosStylePanel>

          <PosStylePanel accent="green" className="overflow-x-auto p-4 lg:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{tt('Monthly planner')}</h2>
                <p className="text-xs text-slate-500">
                  Edit months freely (seasonality). Annual is the sum — or type Annual to spread evenly.
                </p>
              </div>
              <BfPrimaryButton type="button" success disabled={saving} onClick={saveLines}>
                {saving ? 'Saving…' : 'Save lines'}
              </BfPrimaryButton>
            </div>
            <table className="mt-3 w-full min-w-[56rem] text-left text-sm">
              <thead>
                <tr className={BF_THEAD_CLASS}>
                  <th className="sticky left-0 z-10 bg-inherit py-2.5 pr-2">{tt('Account')}</th>
                  {monthKeys.map((m) => (
                    <th key={m.key} className="px-1 py-2.5 text-right font-medium">
                      {m.label}
                    </th>
                  ))}
                  <th className="py-2.5 pl-2 text-right">{tt('Annual')}</th>
                </tr>
              </thead>
              <tbody>
                {selectedAccountIds.map((accountId) => {
                  const acc = accounts.find((a) => (a.id || a.accountId) === accountId);
                  const line = (budget?.lines || []).find((l) => l.accountId === accountId);
                  const months = periodEdits[accountId] || emptyMonths(monthKeys);
                  const annual = sumMonths(months);
                  const label =
                    line?.accountNameSnapshot ||
                    acc?.accountName ||
                    acc?.name ||
                    accountId;
                  const code = line?.accountCodeSnapshot || acc?.accountCode || acc?.code || '';
                  return (
                    <tr key={accountId} className="border-b border-slate-100/80">
                      <td className="sticky left-0 z-10 bg-white/95 py-2 pr-2 backdrop-blur-sm">
                        <div className="font-mono text-[11px] text-slate-500">{code}</div>
                        <div className="max-w-[10rem] truncate font-medium text-slate-800">{label}</div>
                      </td>
                      {monthKeys.map((m) => (
                        <td key={m.key} className="px-0.5 py-1">
                          <input
                            className="w-[4.5rem] rounded border border-slate-300 bg-white/90 px-1 py-1 text-right text-xs"
                            value={months[m.key] ?? '0'}
                            onChange={(e) => setMonthAmount(accountId, m.key, e.target.value)}
                            inputMode="decimal"
                            aria-label={`${label} ${m.label}`}
                          />
                        </td>
                      ))}
                      <td className="py-1 pl-2">
                        <input
                          className="w-24 rounded border border-slate-300 bg-slate-50 px-2 py-1 text-right text-xs font-semibold"
                          value={String(Math.round(annual * 100) / 100)}
                          onChange={(e) => setAnnualAmount(accountId, e.target.value)}
                          inputMode="decimal"
                          title="Edit to re-spread evenly across months"
                          aria-label={`${label} annual`}
                        />
                      </td>
                    </tr>
                  );
                })}
                {selectedAccountIds.length === 0 ? (
                  <tr>
                    <td colSpan={monthKeys.length + 2} className="py-8 text-center text-slate-500">
                      Select accounts on the left to plan monthly amounts.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </PosStylePanel>
        </div>
      </BfShell>
    </PermissionGuard>
  );
}
