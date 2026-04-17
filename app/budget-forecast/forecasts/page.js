'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PermissionGuard from '@/components/PermissionGuard';
import { LineChart, Loader2, Plus, RefreshCw } from 'lucide-react';

export default function BfForecastsListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    version: 'v1',
    periodType: 'monthly',
    startDate: '',
    endDate: '',
    status: 'draft',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bf/revenue-forecasts');
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to load');
      setRows(j.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/bf/revenue-forecasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Create failed');
      setForm({ name: '', version: 'v1', periodType: 'monthly', startDate: '', endDate: '', status: 'draft' });
      await load();
      if (j.data?.id) {
        window.location.href = `/budget-forecast/forecasts/${j.data.id}`;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <PermissionGuard permission="budgets.view">
      <div className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Revenue forecasts</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Use <strong>versions</strong> (v1, v2, …) for revised outlooks. Accounts must be income or revenue in
              your chart of accounts.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Plus className="h-5 w-5 text-emerald-600" />
            New revenue forecast
          </h3>
          <form onSubmit={create} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <label className="text-xs font-semibold text-slate-600">
                Name
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Version
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm"
                  value={form.version}
                  onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                  placeholder="v1"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Period type
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm"
                  value={form.periodType}
                  onChange={(e) => setForm((f) => ({ ...f, periodType: e.target.value }))}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Start
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  required
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                End
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  required
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Status
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                </select>
              </label>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LineChart className="h-4 w-4" />}
              Create and edit grid
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <h3 className="font-bold text-slate-900">Your forecasts</h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <p className="px-5 py-10 text-sm text-slate-600">No revenue forecasts yet.</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Version</th>
                  <th className="px-5 py-3">Period</th>
                  <th className="px-5 py-3">Range</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Lines</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-3 font-semibold text-slate-900">{r.name}</td>
                    <td className="px-5 py-3 text-slate-600">{r.version}</td>
                    <td className="px-5 py-3 text-slate-600">{r.periodType}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{r._count?.lines ?? 0}</td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/budget-forecast/forecasts/${r.id}`}
                        className="font-semibold text-emerald-700 hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </PermissionGuard>
  );
}
