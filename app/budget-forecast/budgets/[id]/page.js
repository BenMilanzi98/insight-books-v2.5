'use client';

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

export default function BudgetDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [budget, setBudget] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [lineEdits, setLineEdits] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setError('');
    const res = await fetch(`/api/budget-forecast/budgets/${id}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Failed to load budget');
      return;
    }
    setBudget(json.data);
    const edits = {};
    for (const line of json.data.lines || []) {
      edits[line.accountId] = String(line.annualAmount ?? 0);
    }
    setLineEdits(edits);
    setSelectedAccountIds((json.data.lines || []).map((l) => l.accountId));
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
    for (const line of budget?.lines || []) {
      const t = String(line.accountTypeSnapshot || '').toLowerCase();
      const amt = Number(line.annualAmount || 0);
      if (t.includes('income') || t.includes('revenue')) rev += amt;
      else if (t.includes('expense')) exp += amt;
    }
    return { rev, exp, profit: rev - exp };
  }, [budget]);

  async function saveLines() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const lines = selectedAccountIds.map((accountId) => ({
        accountId,
        annualAmount: Number(lineEdits[accountId] || 0),
      }));
      const res = await fetch(`/api/budget-forecast/budgets/${id}/lines`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setBudget(json.data);
      setMessage('Budget lines saved. No journals were created.');
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
    setSelectedAccountIds((prev) =>
      prev.includes(accountId) ? prev.filter((x) => x !== accountId) : [...prev, accountId]
    );
    setLineEdits((prev) => ({ ...prev, [accountId]: prev[accountId] || '0' }));
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
              Back
            </BfSecondaryButton>
            <BfSecondaryButton type="button" onClick={() => runCommand('submit')}>
              Submit
            </BfSecondaryButton>
            <BfSecondaryButton type="button" onClick={() => runCommand('approve')}>
              Approve
            </BfSecondaryButton>
            <BfSecondaryButton type="button" onClick={() => runCommand('activate')}>
              Activate
            </BfSecondaryButton>
            <BfSecondaryButton type="button" onClick={() => runCommand('lock')}>
              Lock
            </BfSecondaryButton>
            <BfSecondaryButton type="button" onClick={() => runCommand('revise')}>
              Revise
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

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <PosStylePanel accent="default" className="p-4">
            <h2 className="text-sm font-semibold text-slate-900">Chart of Accounts</h2>
            <p className="mt-1 text-xs text-slate-500">
              Select posting accounts. Parent + child together is rejected.
            </p>
            <div className="mt-3 max-h-80 overflow-y-auto divide-y divide-slate-100/80">
              {accounts.slice(0, 200).map((a) => {
                const aid = a.id || a.accountId;
                const checked = selectedAccountIds.includes(aid);
                return (
                  <label key={aid} className="flex items-center gap-2 py-2 text-sm">
                    <input type="checkbox" checked={checked} onChange={() => toggleAccount(aid)} />
                    <span className="font-mono text-xs text-slate-500">{a.accountCode || a.code}</span>
                    <span>{a.accountName || a.name}</span>
                  </label>
                );
              })}
            </div>
          </PosStylePanel>

          <PosStylePanel accent="green" className="overflow-x-auto p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Annual planner</h2>
              <BfPrimaryButton type="button" success disabled={saving} onClick={saveLines}>
                {saving ? 'Saving…' : 'Save lines'}
              </BfPrimaryButton>
            </div>
            <table className="mt-3 w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className={BF_THEAD_CLASS}>
                  <th className="py-2.5 pr-2">Code</th>
                  <th className="py-2.5 pr-2">Account</th>
                  <th className="py-2.5">Annual amount</th>
                </tr>
              </thead>
              <tbody>
                {selectedAccountIds.map((accountId) => {
                  const acc = accounts.find((a) => (a.id || a.accountId) === accountId);
                  const line = (budget?.lines || []).find((l) => l.accountId === accountId);
                  return (
                    <tr key={accountId} className="border-b border-slate-100/80">
                      <td className="py-2 pr-2 font-mono text-xs">
                        {line?.accountCodeSnapshot || acc?.accountCode || acc?.code}
                      </td>
                      <td className="py-2 pr-2">{line?.accountNameSnapshot || acc?.accountName || acc?.name}</td>
                      <td className="py-2">
                        <input
                          className="w-36 rounded border border-slate-300 bg-white/90 px-2 py-1"
                          value={lineEdits[accountId] ?? '0'}
                          onChange={(e) => setLineEdits({ ...lineEdits, [accountId]: e.target.value })}
                          inputMode="decimal"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </PosStylePanel>
        </div>
      </BfShell>
    </PermissionGuard>
  );
}
