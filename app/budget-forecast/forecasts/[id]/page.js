'use client';
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import PermissionGuard from '@/components/PermissionGuard';
import BfShell, {
  StatusBadge,
  SummaryCard,
  BfPrimaryButton,
  BfSecondaryButton,
  BfTableShell,
  BF_THEAD_CLASS,
} from '@/components/budget-forecast/BfShell';
import PosStylePanel from '@/components/shell/PosStylePanel';
import { formatCurrency } from '@/lib/currencyUtils';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const METHODS = [
  'CURRENT_RUN_RATE',
  'HISTORICAL_AVERAGE',
  'BUDGET_REMAINDER',
  'RECURRING',
  'OPEN_RECEIVABLES',
  'OPEN_PAYABLES',
  'INVENTORY_DEMAND',
  'MANUAL',
];

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
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    guard += 1;
  }
  return keys;
}

function periodKeyFromRow(p) {
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

export default function ForecastDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [forecast, setForecast] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [assumptionSets, setAssumptionSets] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [periodEdits, setPeriodEdits] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [demand, setDemand] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [regen, setRegen] = useState({
    method: 'CURRENT_RUN_RATE',
    growthPercent: '0',
    sourceBudgetId: '',
    scenarioType: 'BASE_CASE',
    recurringAmount: '',
    assumptionSetId: '',
  });

  const monthKeys = useMemo(() => {
    if (!forecast?.startDate || !forecast?.endDate) return [];
    return buildMonthKeys(forecast.startDate, forecast.endDate);
  }, [forecast?.startDate, forecast?.endDate]);

  function seedEdits(data, months) {
    const edits = {};
    const ids = (data.lines || []).map((l) => l.accountId);
    for (const line of data.lines || []) {
      const monthsMap = emptyMonths(months);
      for (const p of line.periodAmounts || []) {
        const key = periodKeyFromRow(p);
        if (key in monthsMap) monthsMap[key] = String(p.forecastAmount ?? 0);
      }
      if (!(line.periodAmounts || []).length && line.projectedAmount != null) {
        Object.assign(monthsMap, spreadAnnual(line.projectedAmount, months));
      }
      edits[line.accountId] = monthsMap;
    }
    setPeriodEdits(edits);
    setSelectedAccountIds(ids);
  }

  async function load() {
    setError('');
    const res = await fetch(`/api/budget-forecast/forecasts/${id}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Failed to load');
      return;
    }
    setForecast(json.data);
    const months = buildMonthKeys(json.data.startDate, json.data.endDate);
    seedEdits(json.data, months);
    setRegen((prev) => ({
      ...prev,
      method: json.data.lines?.[0]?.forecastMethod || prev.method,
      sourceBudgetId: json.data.sourceBudgetId || '',
      scenarioType: json.data.scenarioType || 'BASE_CASE',
      growthPercent: String(json.data.lines?.[0]?.growthRate ?? prev.growthPercent),
      assumptionSetId: json.data.assumptionSetId || '',
    }));
  }

  async function loadMeta() {
    const [budgetRes, accRes, assumRes, sugRes, demRes] = await Promise.all([
      fetch('/api/budget-forecast/budgets'),
      fetch('/api/chart-of-accounts/picker?postingOnly=1'),
      fetch('/api/budget-forecast/assumptions'),
      fetch(`/api/budget-forecast/ai/suggestions?forecastId=${id}`),
      fetch(`/api/budget-forecast/forecasts/${id}/demand?lookbackMonths=6&horizonMonths=3`),
    ]);
    const budgetJson = await budgetRes.json();
    if (budgetRes.ok) setBudgets(budgetJson.data || []);
    const accJson = await accRes.json();
    const rows = accJson.data || accJson.accounts || accJson || [];
    setAccounts(Array.isArray(rows) ? rows : []);
    const assumJson = await assumRes.json();
    if (assumRes.ok) setAssumptionSets(assumJson.data || []);
    const sugJson = await sugRes.json();
    if (sugRes.ok) setSuggestions(sugJson.data || []);
    const demJson = await demRes.json();
    if (demRes.ok) setDemand(demJson.data);
  }

  async function generateAi() {
    setAiBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/budget-forecast/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forecastId: id, enableAi: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'AI generate failed');
      setSuggestions([...(json.data.suggestions || []), ...suggestions]);
      setMessage(json.data.governance?.disclaimer || 'Suggestions ready for review.');
    } catch (err) {
      setError(err.message);
    } finally {
      setAiBusy(false);
    }
  }

  async function reviewSuggestion(suggestionId, decision, applyToAssumptionSet = false) {
    setAiBusy(true);
    setError('');
    try {
      const res = await fetch('/api/budget-forecast/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, decision, applyToAssumptionSet }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Review failed');
      setSuggestions((prev) =>
        prev.map((s) => (s.id === suggestionId ? json.data.suggestion : s))
      );
      if (json.data.assumptionSet) {
        setAssumptionSets((prev) => [json.data.assumptionSet, ...prev]);
        setRegen((r) => ({ ...r, assumptionSetId: json.data.assumptionSet.id }));
      }
      setMessage(json.data.note || `Suggestion ${decision}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setAiBusy(false);
    }
  }

  useEffect(() => {
    if (id) {
      load();
      loadMeta();
    }
  }, [id]);

  const totals = useMemo(() => {
    let rev = 0;
    let exp = 0;
    for (const accountId of selectedAccountIds) {
      const line = (forecast?.lines || []).find((l) => l.accountId === accountId);
      const acc = accounts.find((a) => (a.id || a.accountId) === accountId);
      const t = String(line?.accountTypeSnapshot || acc?.accountType || '').toLowerCase();
      const amt = sumMonths(periodEdits[accountId]);
      if (t.includes('income') || t.includes('revenue')) rev += amt;
      else exp += amt;
    }
    return { rev, exp, profit: rev - exp };
  }, [selectedAccountIds, periodEdits, forecast, accounts]);

  async function run(command, extra = {}) {
    setError('');
    setMessage('');
    const res = await fetch(`/api/budget-forecast/forecasts/${id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, ...extra }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Action failed');
      return;
    }
    setForecast(json.data);
    seedEdits(json.data, buildMonthKeys(json.data.startDate, json.data.endDate));
    setMessage(`Command “${command}” completed. No journals were created.`);
  }

  async function regenerate(e) {
    e.preventDefault();
    if (regen.method === 'BUDGET_REMAINDER' && !regen.sourceBudgetId) {
      setError('Select a source budget for budget remainder');
      return;
    }
    const body = {
      method: regen.method,
      growthPercent: Number(regen.growthPercent || 0),
      sourceBudgetId: regen.sourceBudgetId || undefined,
      scenarioType: regen.scenarioType,
      assumptionSetId: regen.assumptionSetId || undefined,
    };
    if (regen.method === 'RECURRING' && regen.recurringAmount !== '') {
      body.recurringAmount = Number(regen.recurringAmount);
    }
    await run('generate', body);
  }

  async function saveLines() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const lines = selectedAccountIds.map((accountId) => {
        const months = periodEdits[accountId] || emptyMonths(monthKeys);
        const projected = sumMonths(months);
        return {
          accountId,
          forecastMethod: 'MANUAL',
          projectedAmount: projected,
          periods: monthKeys.map((m) => ({
            periodStart: m.periodStart,
            periodEnd: m.periodEnd,
            forecastAmount: Number(months[m.key] || 0),
            sourceType: 'FORECAST',
          })),
        };
      });
      const res = await fetch(`/api/budget-forecast/forecasts/${id}/lines`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setForecast(json.data);
      seedEdits(json.data, monthKeys);
      setMessage('Forecast lines saved. Annual is the sum of months. No journals were created.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
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

  let notesCash = null;
  try {
    notesCash = forecast?.notes ? JSON.parse(forecast.notes) : null;
  } catch {
    notesCash = null;
  }
  const cashMonths = forecast?.cashFlow?.months || notesCash?.cashFlow?.months || notesCash?.months || [];

  if (!forecast && !error) {
    return (
      <PermissionGuard requiredPermission="budgets.view">
        <BfShell title="Forecast" subtitle="Loading…" />
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard requiredPermission="budgets.view">
      <BfShell
        title={forecast?.name || 'Forecast'}
        subtitle={`${forecast?.forecastType || ''} · ${forecast?.scenarioType || ''} · calc ${forecast?.calculationVersion || ''}`}
        actions={
          <>
            <BfSecondaryButton type="button" onClick={() => router.push('/budget-forecast/forecasts')}>
              {tt('Back')}
            </BfSecondaryButton>
            <Link
              href={`/budget-forecast/reports?reportId=BVF&forecastId=${id}`}
              className="inline-flex items-center rounded-lg bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-white"
            >
              {tt('BvF report')}
            </Link>
            <BfSecondaryButton type="button" onClick={() => run('submit')}>
              {tt('Submit')}
            </BfSecondaryButton>
            <BfSecondaryButton type="button" onClick={() => run('approve')}>
              {tt('Approve')}
            </BfSecondaryButton>
            <BfSecondaryButton type="button" onClick={() => run('lock')}>
              {tt('Lock')}
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
          <StatusBadge status={forecast?.status} />
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Projected revenue" value={formatCurrency(totals.rev)} />
          <SummaryCard label="Projected expenses" value={formatCurrency(totals.exp)} />
          <SummaryCard label="Projected profit" value={formatCurrency(totals.profit)} />
        </div>

        <PosStylePanel accent="default" className="mb-6 p-4">
          <h2 className="text-sm font-semibold text-slate-900">{tt('Regenerate')}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {tt('Rebuild lines from posted ledger actuals (and optional source budget). Does not post journals.')}
          </p>
          <form className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={regenerate}>
            <select
              className="rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
              value={regen.method}
              onChange={(e) => setRegen({ ...regen, method: e.target.value })}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
              value={regen.scenarioType}
              onChange={(e) => setRegen({ ...regen, scenarioType: e.target.value })}
            >
              <option value="BASE_CASE">{tt('Base case')}</option>
              <option value="BEST_CASE">{tt('Best case')}</option>
              <option value="WORST_CASE">{tt('Worst case')}</option>
            </select>
            <select
              className="rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
              value={regen.sourceBudgetId}
              onChange={(e) => setRegen({ ...regen, sourceBudgetId: e.target.value })}
            >
              <option value="">{tt('Source budget')}</option>
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
              value={regen.assumptionSetId}
              onChange={(e) => setRegen({ ...regen, assumptionSetId: e.target.value })}
            >
              <option value="">{tt('Assumption set')}</option>
              {assumptionSets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              className="rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
              placeholder={tt('Growth %')}
              value={regen.growthPercent}
              onChange={(e) => setRegen({ ...regen, growthPercent: e.target.value })}
            />
            {regen.method === 'RECURRING' ? (
              <input
                type="number"
                step="0.01"
                className="rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-sm"
                placeholder={tt('Monthly amount')}
                value={regen.recurringAmount}
                onChange={(e) => setRegen({ ...regen, recurringAmount: e.target.value })}
              />
            ) : null}
            <BfPrimaryButton type="submit" success>
              {tt('Generate')}
            </BfPrimaryButton>
          </form>
        </PosStylePanel>

        {cashMonths.length > 0 ? (
          <BfTableShell className="mb-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className={BF_THEAD_CLASS}>
                  <th className="px-3 py-2.5">{tt('Month')}</th>
                  <th className="px-3 py-2.5">{tt('Opening')}</th>
                  <th className="px-3 py-2.5">{tt('Receipts')}</th>
                  <th className="px-3 py-2.5">{tt('Payments')}</th>
                  <th className="px-3 py-2.5">{tt('Closing')}</th>
                </tr>
              </thead>
              <tbody>
                {cashMonths.map((m) => (
                  <tr key={m.key || m.periodStart} className="border-b border-slate-100/80">
                    <td className="px-3 py-2">{m.key || String(m.periodStart).slice(0, 7)}</td>
                    <td className="px-3 py-2">{formatCurrency(m.openingCash || 0)}</td>
                    <td className="px-3 py-2">{formatCurrency(m.expectedReceipts || 0)}</td>
                    <td className="px-3 py-2">{formatCurrency(m.expectedPayments || 0)}</td>
                    <td className="px-3 py-2">{formatCurrency(m.closingCash || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </BfTableShell>
        ) : null}

        <PosStylePanel accent="default" className="mb-6 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{tt('AI suggestions (review-only)')}</h2>
              <p className="text-xs text-slate-500">
                {tt('Deterministic heuristics. Never auto-applies or posts journals. Opt-in generate.')}
              </p>
            </div>
            <BfPrimaryButton type="button" onClick={generateAi} disabled={aiBusy}>
              {aiBusy ? tt('Working…') : tt('Generate suggestions')}
            </BfPrimaryButton>
          </div>
          <ul className="mt-3 space-y-2">
            {suggestions.length === 0 ? (
              <li className="text-sm text-slate-500">{tt('No suggestions yet.')}</li>
            ) : (
              suggestions.map((s) => (
                <li
                  key={s.id}
                  className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">
                        {s.suggestionKey} · {s.confidence} · {s.status}
                      </p>
                      <p className="text-xs text-slate-600">{s.reason}</p>
                      <p className="mt-1 font-mono text-xs text-slate-700">
                        {JSON.stringify(s.proposedValue)}
                      </p>
                    </div>
                    {s.status === 'PENDING_REVIEW' ? (
                      <div className="flex flex-wrap gap-2">
                        <BfSecondaryButton
                          type="button"
                          onClick={() => reviewSuggestion(s.id, 'ACCEPT')}
                        >
                          {tt('Accept')}
                        </BfSecondaryButton>
                        <BfSecondaryButton
                          type="button"
                          onClick={() => reviewSuggestion(s.id, 'ACCEPT', true)}
                        >
                          {tt('Accept → assumption')}
                        </BfSecondaryButton>
                        <BfSecondaryButton
                          type="button"
                          onClick={() => reviewSuggestion(s.id, 'REJECT')}
                        >
                          {tt('Reject')}
                        </BfSecondaryButton>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))
            )}
          </ul>
        </PosStylePanel>

        <PosStylePanel accent="default" className="mb-6 p-4">
          <h2 className="text-sm font-semibold text-slate-900">{tt('Product demand hints')}</h2>
          <p className="text-xs text-slate-500">
            {tt('From invoice quantities. Read-only — does not create POs or stock moves.')}
            {demand?.totals?.purchaseAmount != null
              ? ` · ${tt('Suggested purchase')} ${formatCurrency(demand.totals.purchaseAmount)}`
              : ''}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className={BF_THEAD_CLASS}>
                  <th className="px-2 py-2">{tt('Product')}</th>
                  <th className="px-2 py-2 text-right">{tt('Sold')}</th>
                  <th className="px-2 py-2 text-right">{tt('Avg/mo')}</th>
                  <th className="px-2 py-2 text-right">{tt('Demand')}</th>
                  <th className="px-2 py-2 text-right">{tt('Stock')}</th>
                  <th className="px-2 py-2 text-right">{tt('Gap')}</th>
                  <th className="px-2 py-2 text-right">{tt('Purchase $')}</th>
                </tr>
              </thead>
              <tbody>
                {(demand?.products || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-6 text-center text-slate-500">
                      {tt('No product sales in lookback window.')}
                    </td>
                  </tr>
                ) : (
                  (demand?.products || []).map((p) => (
                    <tr key={p.productId} className="border-b border-slate-100/80">
                      <td className="px-2 py-1.5">
                        <span className="font-mono text-xs text-slate-500">{p.sku}</span> {p.name}
                      </td>
                      <td className="px-2 py-1.5 text-right">{p.qtySold}</td>
                      <td className="px-2 py-1.5 text-right">{p.avgMonthlyQty}</td>
                      <td className="px-2 py-1.5 text-right">{p.demandQty}</td>
                      <td className="px-2 py-1.5 text-right">{p.stockLevel}</td>
                      <td className="px-2 py-1.5 text-right">{p.gapQty}</td>
                      <td className="px-2 py-1.5 text-right">{formatCurrency(p.purchaseAmount || 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </PosStylePanel>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{tt('Monthly projections')}</h2>
            <p className="text-xs text-slate-500">
              {tt('Edit months freely. Annual is the sum — or type Annual to spread evenly.')}
            </p>
          </div>
          <BfPrimaryButton type="button" onClick={saveLines} disabled={saving}>
            {saving ? tt('Saving…') : tt('Save lines')}
          </BfPrimaryButton>
        </div>

        <PosStylePanel accent="default" className="mb-4 p-3">
          <p className="mb-2 text-xs font-medium text-slate-600">{tt('Add account')}</p>
          <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
            {accounts.slice(0, 80).map((a) => {
              const aid = a.id || a.accountId;
              const on = selectedAccountIds.includes(aid);
              return (
                <button
                  key={aid}
                  type="button"
                  onClick={() => toggleAccount(aid)}
                  className={`rounded-md px-2 py-1 text-xs ${
                    on ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {a.accountCode || a.code} {a.accountName || a.name}
                </button>
              );
            })}
          </div>
        </PosStylePanel>

        <BfTableShell>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className={BF_THEAD_CLASS}>
                  <th className="sticky left-0 z-10 bg-gradient-to-r from-gray-50 to-gray-100 px-3 py-2.5 text-left">
                    {tt('Account')}
                  </th>
                  {monthKeys.map((m) => (
                    <th key={m.key} className="px-2 py-2.5 text-right">
                      {m.label}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right">{tt('Annual')}</th>
                </tr>
              </thead>
              <tbody>
                {selectedAccountIds.map((accountId) => {
                  const line = (forecast?.lines || []).find((l) => l.accountId === accountId);
                  const acc = accounts.find((a) => (a.id || a.accountId) === accountId);
                  const label =
                    line?.accountNameSnapshot ||
                    acc?.accountName ||
                    acc?.name ||
                    accountId;
                  const code = line?.accountCodeSnapshot || acc?.accountCode || acc?.code || '';
                  const months = periodEdits[accountId] || emptyMonths(monthKeys);
                  const annual = sumMonths(months);
                  return (
                    <tr key={accountId} className="border-b border-slate-100/80">
                      <td className="sticky left-0 z-10 bg-white/95 px-3 py-1.5">
                        <span className="font-mono text-xs text-slate-500">{code}</span>{' '}
                        {label}
                      </td>
                      {monthKeys.map((m) => (
                        <td key={m.key} className="px-1 py-1">
                          <input
                            type="number"
                            step="0.01"
                            className="w-24 rounded border border-slate-200 bg-white px-1.5 py-1 text-right text-xs"
                            value={months[m.key] ?? '0'}
                            onChange={(e) => setMonthAmount(accountId, m.key, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          step="0.01"
                          className="w-28 rounded border border-indigo-200 bg-indigo-50/50 px-1.5 py-1 text-right text-xs font-medium"
                          value={String(Math.round(annual * 100) / 100)}
                          onChange={(e) => setAnnualAmount(accountId, e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
                {selectedAccountIds.length === 0 ? (
                  <tr>
                    <td colSpan={monthKeys.length + 2} className="px-3 py-8 text-center text-slate-500">
                      {tt('No lines yet. Run Generate or add accounts above.')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </BfTableShell>
      </BfShell>
    </PermissionGuard>
  );
}
