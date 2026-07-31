'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, RefreshCw } from 'lucide-react';

function formatMoney(n) {
  if (n == null || n === '') return '—';
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `MWK ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB');
  } catch {
    return '—';
  }
}

/**
 * Compact contract list + activate form for employee detail drawer.
 */
export default function EmploymentContractsPanel({ employeeId, formatCurrency }) {
  const money = formatCurrency || formatMoney;
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    basicSalary: '',
    hourlyRate: '',
    payBasis: 'MONTHLY_SALARY',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    activate: true,
    notes: '',
  });

  const load = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/employees/${employeeId}/contracts`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load contracts');
      setContracts(Array.isArray(data.contracts) ? data.contracts : []);
    } catch (e) {
      setError(e.message || 'Failed to load contracts');
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const createContract = async (e) => {
    e.preventDefault();
    if (!employeeId) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/employees/${employeeId}/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basicSalary: form.basicSalary === '' ? undefined : Number(form.basicSalary),
          hourlyRate: form.hourlyRate === '' ? undefined : Number(form.hourlyRate),
          payBasis: form.payBasis,
          effectiveFrom: form.effectiveFrom,
          activate: !!form.activate,
          notes: form.notes || undefined,
          status: form.activate ? 'ACTIVE' : 'DRAFT',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || 'Failed to create contract');
      setShowForm(false);
      setForm((f) => ({ ...f, notes: '', basicSalary: '', hourlyRate: '' }));
      await load();
    } catch (err) {
      setError(err.message || 'Failed to create contract');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText size={20} />
          Employment Contracts
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700"
          >
            <Plus size={12} /> {showForm ? 'Cancel' : 'New contract'}
          </button>
        </div>
      </div>

      <p className="mb-3 text-xs text-gray-600">
        Payroll uses the Active contract effective for the pay period. Creating an Active contract
        supersedes prior Active contracts.
      </p>

      {error ? (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {showForm ? (
        <form onSubmit={createContract} className="mb-4 space-y-3 rounded border border-gray-200 bg-white p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs text-gray-600">
              Pay basis
              <select
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={form.payBasis}
                onChange={(ev) => setForm((f) => ({ ...f, payBasis: ev.target.value }))}
              >
                <option value="MONTHLY_SALARY">Monthly salary</option>
                <option value="HOURLY_RATE">Hourly rate</option>
                <option value="DAILY_RATE">Daily rate</option>
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Effective from
              <input
                type="date"
                required
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={form.effectiveFrom}
                onChange={(ev) => setForm((f) => ({ ...f, effectiveFrom: ev.target.value }))}
              />
            </label>
            <label className="text-xs text-gray-600">
              Basic / monthly salary
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={form.basicSalary}
                onChange={(ev) => setForm((f) => ({ ...f, basicSalary: ev.target.value }))}
                placeholder="Uses employee gross if blank"
              />
            </label>
            <label className="text-xs text-gray-600">
              Hourly rate
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={form.hourlyRate}
                onChange={(ev) => setForm((f) => ({ ...f, hourlyRate: ev.target.value }))}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.activate}
              onChange={(ev) => setForm((f) => ({ ...f, activate: ev.target.checked }))}
            />
            Activate immediately (supersede prior Active)
          </label>
          <label className="block text-xs text-gray-600">
            Notes
            <textarea
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              rows={2}
              value={form.notes}
              onChange={(ev) => setForm((f) => ({ ...f, notes: ev.target.value }))}
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save contract'}
          </button>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500">Loading contracts…</p>
      ) : contracts.length === 0 ? (
        <p className="text-sm text-gray-500">No contracts yet. Payroll will use the employee salary fields until one is activated.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-gray-500">
                <th className="py-2 pr-3">Ver</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Basis</th>
                <th className="py-2 pr-3">Basic</th>
                <th className="py-2 pr-3">From</th>
                <th className="py-2 pr-3">To</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className="border-b border-gray-200">
                  <td className="py-2 pr-3">v{c.version}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        c.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.status === 'SUPERSEDED'
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{c.payBasis}</td>
                  <td className="py-2 pr-3">{money(c.basicSalary)}</td>
                  <td className="py-2 pr-3">{formatDate(c.effectiveFrom)}</td>
                  <td className="py-2 pr-3">{formatDate(c.effectiveTo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
