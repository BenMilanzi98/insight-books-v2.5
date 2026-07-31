'use client';

import { useEffect, useState } from 'react';
import PermissionGuard from '@/components/PermissionGuard';
import BfShell, { StatusBadge, SummaryCard } from '@/components/budget-forecast/BfShell';
import { formatCurrency } from '@/lib/currencyUtils';

export default function BudgetForecastReportsPage() {
  const [definitions, setDefinitions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [reportId, setReportId] = useState('BUDGET_VS_ACTUAL');
  const [budgetId, setBudgetId] = useState('');
  const [forecastId, setForecastId] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [d, b, f] = await Promise.all([
        fetch('/api/budget-forecast/reports').then((r) => r.json()),
        fetch('/api/budget-forecast/budgets').then((r) => r.json()),
        fetch('/api/budget-forecast/forecasts').then((r) => r.json()),
      ]);
      setDefinitions(d.data || []);
      setBudgets(b.data || []);
      setForecasts(f.data || []);
      if (b.data?.[0]) setBudgetId(b.data[0].id);
      if (f.data?.[0]) setForecastId(f.data[0].id);
    })();
  }, []);

  async function run(format) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/budget-forecast/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, budgetId, forecastId, format }),
      });
      if (format === 'csv') {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || 'Export failed');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportId.toLowerCase()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Report failed');
      setReport(json.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PermissionGuard requiredPermission="budgets.view">
      <BfShell
        title="Reports"
        subtitle="Budget versus Actual and forecast comparisons. Actuals from posted Accounting V2 journals only."
      >
        {error ? <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-sm">
              <span className="text-slate-600">Report</span>
              <select className="mt-1 w-full rounded-lg border px-3 py-2" value={reportId} onChange={(e) => setReportId(e.target.value)}>
                {(definitions.length ? definitions : [{ id: 'BUDGET_VS_ACTUAL', name: 'Budget versus Actual' }]).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Budget</span>
              <select className="mt-1 w-full rounded-lg border px-3 py-2" value={budgetId} onChange={(e) => setBudgetId(e.target.value)}>
                <option value="">Select…</option>
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} (v{b.versionNumber})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Forecast</span>
              <select className="mt-1 w-full rounded-lg border px-3 py-2" value={forecastId} onChange={(e) => setForecastId(e.target.value)}>
                <option value="">Select…</option>
                {forecasts.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => run()}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                {loading ? 'Running…' : 'Run report'}
              </button>
              <button type="button" disabled={loading} onClick={() => run('csv')} className="rounded-lg border px-3 py-2 text-sm">
                CSV
              </button>
            </div>
          </div>
        </div>

        {report ? (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <SummaryCard label="Budget total" value={formatCurrency(report.totals?.budget || 0)} hint={`v${report.budget?.versionNumber || ''}`} />
              <SummaryCard label="Actual / Forecast total" value={formatCurrency(report.totals?.actual || 0)} hint={report.freshness ? `As of ${new Date(report.freshness).toLocaleString()}` : ''} />
              <SummaryCard label="Raw variance" value={formatCurrency(report.totals?.rawVariance || 0)} hint={report.currency} />
            </div>

            <div className="mt-6 overflow-x-auto rounded-xl border bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Budget</th>
                    <th className="px-3 py-2">Actual</th>
                    <th className="px-3 py-2">Favourable var.</th>
                    <th className="px-3 py-2">%</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.lines || []).map((line) => (
                    <tr key={line.accountId} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs">{line.accountCode}</td>
                      <td className="px-3 py-2">{line.accountName}</td>
                      <td className="px-3 py-2">{formatCurrency(line.budget || 0)}</td>
                      <td className="px-3 py-2">{formatCurrency(line.actual ?? line.forecast ?? 0)}</td>
                      <td className="px-3 py-2">
                        {formatCurrency((line.favourableVarianceMinor || 0) / 100)}
                      </td>
                      <td className="px-3 py-2">
                        {line.variancePercent == null ? line.percentState || '—' : `${line.variancePercent.toFixed(1)}%`}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={line.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">{report.sourceNotes}</p>
          </>
        ) : null}
      </BfShell>
    </PermissionGuard>
  );
}
