'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PosStylePageHeader from '@/components/shell/PosStylePageHeader';
import PosStylePanel from '@/components/shell/PosStylePanel';

const ACTIONS = ['load', 'calculate', 'submit', 'approve', 'post', 'pay', 'reverse'];

function money(n) {
  if (n == null) return '—';
  return `MWK ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PayrollWorkbenchV2Page() {
  const [runs, setRuns] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [run, setRun] = useState(null);
  const [reconcile, setReconcile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [mappingJson, setMappingJson] = useState('{\n  "salaryExpenseId": "",\n  "salariesPayableId": "",\n  "payePayableId": "",\n  "npsEmployeePayableId": "",\n  "npsEmployerPayableId": "",\n  "npsEmployerExpenseId": "",\n  "otherDeductionsPayableId": "",\n  "advancesReceivableId": "",\n  "paymentAccountId": ""\n}');

  const loadRuns = useCallback(async () => {
    const res = await fetch('/api/payroll-v2/runs');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list runs');
    setRuns(data.runs || []);
  }, []);

  const loadRun = useCallback(async (id) => {
    if (!id) {
      setRun(null);
      return;
    }
    const res = await fetch(`/api/payroll-v2/runs/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load run');
    setRun(data.run);
    if (data.run?.mappingSnapshot) {
      setMappingJson(JSON.stringify(data.run.mappingSnapshot, null, 2));
    }
  }, []);

  useEffect(() => {
    loadRuns().catch((e) => setError(e.message));
  }, [loadRuns]);

  useEffect(() => {
    if (selectedId) {
      loadRun(selectedId).catch((e) => setError(e.message));
    }
  }, [selectedId, loadRun]);

  const createRun = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/payroll-v2/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodStart, periodEnd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Create failed');
      await loadRuns();
      setSelectedId(data.run.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action) => {
    if (!selectedId) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/payroll-v2/runs/${selectedId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `${action} failed`);
      setRun(data.run);
      await loadRuns();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveMappings = async () => {
    if (!selectedId) return;
    setBusy(true);
    setError('');
    try {
      const mappingSnapshot = JSON.parse(mappingJson);
      const res = await fetch(`/api/payroll-v2/runs/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappingSnapshot }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save mappings failed');
      setRun(data.run);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const loadReconcile = async () => {
    setError('');
    try {
      const q = selectedId ? `?runId=${selectedId}` : '';
      const res = await fetch(`/api/payroll-v2/reconcile${q}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Reconcile failed');
      setReconcile(data);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PosStylePageHeader
        title="Payroll Workbench (V2)"
        description={
          <>
            Command-driven runs: load → calculate → submit → approve → post → pay.
            Legacy create flow remains at{' '}
            <Link className="text-blue-600 underline" href="/hr/payroll">
              Payroll Processing
            </Link>
            .
          </>
        }
      />

      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <PosStylePanel className="mb-6 grid gap-4 p-4 md:grid-cols-3">
        <label className="text-sm text-gray-700">
          Period start
          <input
            type="date"
            className="mt-1 w-full rounded border px-2 py-1.5"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
          />
        </label>
        <label className="text-sm text-gray-700">
          Period end
          <input
            type="date"
            className="mt-1 w-full rounded border px-2 py-1.5"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            disabled={busy || !periodStart || !periodEnd}
            onClick={createRun}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Create run
          </button>
        </div>
      </PosStylePanel>

      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700">Select run</label>
        <select
          className="mt-1 w-full rounded border px-2 py-2"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">—</option>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.runNumber || r.id} · {r.status} · {String(r.periodEnd).slice(0, 10)}
            </option>
          ))}
        </select>
      </div>

      {run ? (
        <div className="space-y-4">
          <PosStylePanel className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-lg font-medium">{run.runNumber}</div>
                <div className="text-sm text-gray-600">
                  Status: <span className="font-semibold">{run.status}</span>
                  {run.checksum ? ` · checksum ${String(run.checksum).slice(0, 12)}…` : ''}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {ACTIONS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    disabled={busy}
                    onClick={() => runAction(a)}
                    className="rounded border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs capitalize hover:bg-gray-100 disabled:opacity-50"
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            {run.totals ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <div>Gross: {money(run.totals.grossPay)}</div>
                <div>Net: {money(run.totals.netPay)}</div>
                <div>PAYE: {money(run.totals.payeAmount)}</div>
                <div>NPS EE: {money(run.totals.npsEmployee)}</div>
              </div>
            ) : null}
            {Array.isArray(run.exceptions) && run.exceptions.length ? (
              <div className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Exceptions: {run.exceptions.length}
                <ul className="mt-1 list-disc pl-5">
                  {run.exceptions.slice(0, 8).map((ex, i) => (
                    <li key={i}>
                      {ex.code}: {ex.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </PosStylePanel>

          <PosStylePanel className="p-4">
            <h2 className="mb-2 font-medium">Account mappings (required before Post/Pay)</h2>
            <textarea
              className="h-48 w-full rounded border font-mono text-xs"
              value={mappingJson}
              onChange={(e) => setMappingJson(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={saveMappings}
              className="mt-2 rounded bg-emerald-600 px-3 py-1.5 text-sm text-white"
            >
              Save mappings
            </button>
          </PosStylePanel>

          <PosStylePanel className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-medium">Employee results</h2>
              <button
                type="button"
                onClick={loadReconcile}
                className="text-sm text-blue-600 underline"
              >
                Run reconciliation
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-gray-500">
                    <th className="py-2 pr-3">Employee</th>
                    <th className="py-2 pr-3">Gross</th>
                    <th className="py-2 pr-3">PAYE</th>
                    <th className="py-2 pr-3">NPS</th>
                    <th className="py-2 pr-3">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {(run.results || []).map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="py-2 pr-3">{r.employeeId}</td>
                      <td className="py-2 pr-3">{money(r.grossPay)}</td>
                      <td className="py-2 pr-3">{money(r.payeAmount)}</td>
                      <td className="py-2 pr-3">{money(r.npsEmployee)}</td>
                      <td className="py-2 pr-3">{money(r.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!run.results?.length ? (
                <p className="text-sm text-gray-500">No results yet — run Calculate.</p>
              ) : null}
            </div>
          </PosStylePanel>

          {reconcile ? (
            <PosStylePanel className="p-4">
              <h2 className="mb-2 font-medium">Reconciliation</h2>
              <p className="mb-2 text-sm text-gray-600">
                {reconcile.summary?.runs} run(s), {reconcile.summary?.unbalanced} unbalanced
              </p>
              <ul className="space-y-1 text-sm">
                {(reconcile.items || []).map((i) => (
                  <li key={i.runId}>
                    {i.runNumber}: {i.balanced ? 'OK' : i.issues.join(', ')}
                  </li>
                ))}
              </ul>
            </PosStylePanel>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
