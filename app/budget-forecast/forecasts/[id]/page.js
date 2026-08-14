'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PermissionGuard from '@/components/PermissionGuard';
import BfShell, {
  StatusBadge,
  BfSecondaryButton,
  BfTableShell,
  BF_THEAD_CLASS,
} from '@/components/budget-forecast/BfShell';
import { formatCurrency } from '@/lib/currencyUtils';

export default function ForecastDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const res = await fetch(`/api/budget-forecast/forecasts/${id}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Failed to load');
      return;
    }
    setForecast(json.data);
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function run(command) {
    setError('');
    setMessage('');
    const res = await fetch(`/api/budget-forecast/forecasts/${id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, method: 'CURRENT_RUN_RATE' }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Action failed');
      return;
    }
    setForecast(json.data);
    setMessage(`Command “${command}” completed. No journals created.`);
  }

  const cashFlow = forecast?.cashFlow;
  let notesCash = null;
  try {
    notesCash = forecast?.notes ? JSON.parse(forecast.notes) : null;
  } catch {
    notesCash = null;
  }
  const months = cashFlow?.months || notesCash?.months || [];

  return (
    <PermissionGuard requiredPermission="budgets.view">
      <BfShell
        title={forecast?.name || 'Forecast'}
        subtitle={`${forecast?.forecastType || ''} · ${forecast?.scenarioType || ''} · calc ${forecast?.calculationVersion || ''}`}
        actions={
          <>
            <BfSecondaryButton type="button" onClick={() => router.push('/budget-forecast/forecasts')}>
              Back
            </BfSecondaryButton>
            <BfSecondaryButton type="button" onClick={() => run('generate')}>
              Generate
            </BfSecondaryButton>
            <BfSecondaryButton type="button" onClick={() => run('submit')}>
              Submit
            </BfSecondaryButton>
            <BfSecondaryButton type="button" onClick={() => run('approve')}>
              Approve
            </BfSecondaryButton>
            <BfSecondaryButton type="button" onClick={() => run('lock')}>
              Lock
            </BfSecondaryButton>
          </>
        }
      >
        {error ? <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
        {message ? (
          <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>
        ) : null}

        <div className="mb-4">
          <StatusBadge status={forecast?.status} />
        </div>

        {months.length > 0 ? (
          <BfTableShell className="mb-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className={BF_THEAD_CLASS}>
                  <th className="px-3 py-2.5">Month</th>
                  <th className="px-3 py-2.5">Opening</th>
                  <th className="px-3 py-2.5">Receipts</th>
                  <th className="px-3 py-2.5">Payments</th>
                  <th className="px-3 py-2.5">Closing</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.key || m.periodStart} className="border-b border-slate-100/80">
                    <td className="px-3 py-2">{m.key || String(m.periodStart).slice(0, 7)}</td>
                    <td className="px-3 py-2">{formatCurrency(m.openingCash || 0)}</td>
                    <td className="px-3 py-2">{formatCurrency(m.expectedReceipts || 0)}</td>
                    <td className="px-3 py-2">{formatCurrency(m.expectedPayments || 0)}</td>
                    <td className="px-3 py-2">{formatCurrency(m.closingCash || 0)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={m.warning || m.sourceType || 'OK'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </BfTableShell>
        ) : null}

        <BfTableShell>
          <table className="min-w-full text-sm">
            <thead>
              <tr className={BF_THEAD_CLASS}>
                <th className="px-3 py-2.5">Code</th>
                <th className="px-3 py-2.5">Account</th>
                <th className="px-3 py-2.5">Method</th>
                <th className="px-3 py-2.5">Historical</th>
                <th className="px-3 py-2.5">Budget</th>
                <th className="px-3 py-2.5">Projected</th>
              </tr>
            </thead>
            <tbody>
              {(forecast?.lines || []).map((line) => (
                <tr key={line.id} className="border-b border-slate-100/80">
                  <td className="px-3 py-2 font-mono text-xs">{line.accountCodeSnapshot}</td>
                  <td className="px-3 py-2">{line.accountNameSnapshot}</td>
                  <td className="px-3 py-2">{line.forecastMethod}</td>
                  <td className="px-3 py-2">{formatCurrency(line.historicalActual || 0)}</td>
                  <td className="px-3 py-2">{formatCurrency(line.budgetAmount || 0)}</td>
                  <td className="px-3 py-2">{formatCurrency(line.projectedAmount || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(forecast?.lines || []).length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No lines yet. Run Generate to build from posted actuals.</p>
          ) : null}
        </BfTableShell>
      </BfShell>
    </PermissionGuard>
  );
}
