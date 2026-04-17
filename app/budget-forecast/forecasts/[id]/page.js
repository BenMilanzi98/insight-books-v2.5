'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import PermissionGuard from '@/components/PermissionGuard';
import { Loader2, Save, Trash2 } from 'lucide-react';

function cellKey(accountId, period) {
  return `${accountId}::${period}`;
}

async function fetchIncomeRevenueAccounts() {
  const [r1, r2] = await Promise.all([
    fetch('/api/accounts?forSelect=true&type=Income&limit=5000'),
    fetch('/api/accounts?forSelect=true&type=Revenue&limit=5000'),
  ]);
  const j1 = await r1.json();
  const j2 = await r2.json();
  const a1 = r1.ok && Array.isArray(j1.accounts) ? j1.accounts : [];
  const a2 = r2.ok && Array.isArray(j2.accounts) ? j2.accounts : [];
  const byId = new Map();
  for (const a of [...a1, ...a2]) {
    byId.set(a.id, a);
  }
  return [...byId.values()].sort((a, b) =>
    String(a.accountCode || a.code || '').localeCompare(String(b.accountCode || b.code || ''), undefined, {
      numeric: true,
    })
  );
}

export default function BfForecastDetailPage() {
  const params = useParams();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [header, setHeader] = useState(null);
  const [periodKeys, setPeriodKeys] = useState([]);
  const [accountOptions, setAccountOptions] = useState([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [matrix, setMatrix] = useState({});

  const loadAccounts = useCallback(async () => {
    const list = await fetchIncomeRevenueAccounts();
    setAccountOptions(list);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bf/revenue-forecasts/${id}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to load');
      const h = j.data;
      const keys = j.periodKeys || [];
      setHeader(h);
      setPeriodKeys(keys);
      const m = {};
      const accSet = new Set();
      for (const line of h.lines || []) {
        accSet.add(line.accountId);
        m[cellKey(line.accountId, line.period)] = String(line.plannedAmount ?? 0);
      }
      setSelectedAccountIds([...accSet]);
      setMatrix(m);
      await loadAccounts();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, loadAccounts]);

  useEffect(() => {
    load();
  }, [load]);

  const accountLabel = useMemo(() => {
    const map = new Map();
    for (const a of accountOptions) {
      map.set(a.id, `${a.accountCode || a.code || ''} — ${a.accountName || a.name || a.id}`);
    }
    return (aid) => map.get(aid) || aid;
  }, [accountOptions]);

  const addAccount = (e) => {
    const aid = e.target.value;
    if (!aid) return;
    if (selectedAccountIds.includes(aid)) return;
    setSelectedAccountIds((s) => [...s, aid]);
    e.target.value = '';
  };

  const removeAccount = (aid) => {
    setSelectedAccountIds((s) => s.filter((x) => x !== aid));
    setMatrix((prev) => {
      const next = { ...prev };
      for (const pk of periodKeys) {
        delete next[cellKey(aid, pk)];
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const lines = [];
      for (const aid of selectedAccountIds) {
        for (const p of periodKeys) {
          const raw = matrix[cellKey(aid, p)];
          const plannedAmount = raw === '' || raw == null ? 0 : Number(raw);
          if (Number.isNaN(plannedAmount) || plannedAmount < 0) {
            throw new Error('All amounts must be non-negative numbers.');
          }
          lines.push({ accountId: aid, period: p, plannedAmount });
        }
      }
      const res = await fetch(`/api/bf/revenue-forecasts/${id}/lines`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Save failed');
      setHeader(j.data);
      setPeriodKeys(j.periodKeys || periodKeys);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!window.confirm('Delete this revenue forecast?')) return;
    const res = await fetch(`/api/bf/revenue-forecasts/${id}`, { method: 'DELETE' });
    if (res.ok) window.location.href = '/budget-forecast/forecasts';
    else {
      const j = await res.json();
      setError(j.error || 'Delete failed');
    }
  };

  return (
    <PermissionGuard permission="budgets.view">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/budget-forecast/forecasts" className="text-sm font-semibold text-emerald-700 hover:underline">
              ← Back to forecasts
            </Link>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">{header?.name || 'Revenue forecast'}</h2>
            {header && (
              <p className="mt-1 text-sm text-slate-600">
                {header.version} · {header.periodType} · {new Date(header.startDate).toLocaleDateString()} –{' '}
                {new Date(header.endDate).toLocaleDateString()} ·{' '}
                <span className="font-semibold capitalize">{header.status}</span>
              </p>
            )}
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Forecast only <strong>income / revenue</strong> accounts. Save the full grid when you are done.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save lines
            </button>
            <Link
              href="/budget-forecast/reports"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              View reports
            </Link>
            <button
              type="button"
              onClick={del}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Add income / revenue account
              </label>
              <select
                className="mt-2 max-w-xl rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm"
                defaultValue=""
                onChange={addAccount}
              >
                <option value="">Choose from chart of accounts…</option>
                {accountOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountCode || a.code} — {a.accountName || a.name}
                  </option>
                ))}
              </select>
            </section>

            <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3">Account</th>
                    {periodKeys.map((pk) => (
                      <th key={pk} className="whitespace-nowrap px-2 py-3">
                        {pk}
                      </th>
                    ))}
                    <th className="px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {selectedAccountIds.map((aid) => (
                    <tr key={aid} className="border-t border-slate-100">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium text-slate-900">
                        {accountLabel(aid)}
                      </td>
                      {periodKeys.map((pk) => (
                        <td key={pk} className="px-1 py-1">
                          <input
                            className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm shadow-sm"
                            inputMode="decimal"
                            value={matrix[cellKey(aid, pk)] ?? ''}
                            onChange={(e) =>
                              setMatrix((prev) => ({
                                ...prev,
                                [cellKey(aid, pk)]: e.target.value,
                              }))
                            }
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="text-xs font-semibold text-rose-600 hover:underline"
                          onClick={() => removeAccount(aid)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedAccountIds.length === 0 && (
                <p className="p-6 text-sm text-slate-600">Add at least one income or revenue account.</p>
              )}
            </section>
          </>
        )}
      </div>
    </PermissionGuard>
  );
}
