'use client';
import { tt } from '@/lib/i18n/runtime';

/**
 * Phase 12 — Year-End Close Workspace.
 * Period-end close remains on Financial Calendar.
 * Totals are server-authoritative; closing journals post via Posting Engine.
 */

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import PosStylePageHeader, { PosStyleHeaderButton } from '@/components/shell/PosStylePageHeader';
import PosStylePanel from '@/components/shell/PosStylePanel';


async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

export default function AccountingClosePage() {
  const [financialYearId, setFinancialYearId] = useState('');
  const [years, setYears] = useState([]);
  const [config, setConfig] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [run, setRun] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cfgForm, setCfgForm] = useState({
    closeMethod: 'INCOME_SUMMARY_TO_RETAINED_EARNINGS',
    incomeSummaryAccountId: '',
    retainedEarningsAccountId: '',
    ownerCapitalAccountId: '',
  });

  const loadYears = useCallback(async () => {
    try {
      const data = await api('/api/accounting-v2/periods/financial-years').catch(() => ({ years: [] }));
      const list = data.years || data.financialYears || [];
      setYears(list);
      if (!financialYearId && list[0]) setFinancialYearId(list[0].id);
    } catch {
      /* calendar may be flag-gated */
    }
  }, [financialYearId]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const c = await api('/api/accounting-close/config');
      setConfig(c.configuration);
      if (c.configuration) {
        setCfgForm({
          closeMethod: c.configuration.closeMethod,
          incomeSummaryAccountId: c.configuration.incomeSummaryAccountId || '',
          retainedEarningsAccountId: c.configuration.retainedEarningsAccountId || '',
          ownerCapitalAccountId: c.configuration.ownerCapitalAccountId || '',
        });
      }
      if (financialYearId) {
        const r = await api(`/api/accounting-close/readiness?financialYearId=${financialYearId}`);
        setReadiness(r);
        const runs = await api(`/api/accounting-close/runs?financialYearId=${financialYearId}`);
        const latest = (runs.runs || [])[0];
        if (latest) {
          const detail = await api(`/api/accounting-close/runs/${latest.id}`);
          setRun(detail.run);
        } else {
          setRun(null);
        }
      }
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [financialYearId]);

  useEffect(() => {
    loadYears();
  }, [loadYears]);

  useEffect(() => {
    load();
  }, [load]);

  const saveConfig = async () => {
    setBusy(true);
    try {
      await api('/api/accounting-close/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfgForm),
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const approveConfig = async () => {
    setBusy(true);
    try {
      await api('/api/accounting-close/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const createRun = async () => {
    setBusy(true);
    try {
      const res = await api('/api/accounting-close/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financialYearId }),
      });
      setRun(res.run);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (action, body = {}) => {
    if (!run?.id) return;
    setBusy(true);
    try {
      const res = await api(`/api/accounting-close/runs/${run.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.run) setRun(res.run);
      if (res.preview) setPreview(res.preview);
      if (res.batch?.previewPayload) setPreview(res.batch.previewPayload);
      if (action === 'close-year') {
        setError('');
        alert('Financial year closed. Continuous ledger carry-forward — no opening journal created.');
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const completeTask = async (taskKey) => {
    await act('complete-task', { taskKey, comment: 'Reviewed and evidenced in workspace' });
  };

  return (
    <div className="w-full">
      <div className="mx-auto max-w-6xl space-y-6">
        <PosStylePageHeader
          title={tt('Year-End Close')}
          description="Period-end close stays on Financial Calendar. This workspace owns year-end closing journals, profit transfer, post-closing trial balance, and FY lock."
          actions={
            <PosStyleHeaderButton type="button" onClick={load} disabled={busy}>
              <RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
              {tt('Refresh')}
            </PosStyleHeaderButton>
          }
        />

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <PosStylePanel className="space-y-3 p-4" as="section">
          <h2 className="font-medium text-slate-900">{tt('1. Financial year')}</h2>
          <select
            className="w-full max-w-md rounded border border-slate-300 px-3 py-2 text-sm"
            value={financialYearId}
            onChange={(e) => setFinancialYearId(e.target.value)}
          >
            <option value="">{tt('Select financial year…')}</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.code || y.name} ({y.status})
              </option>
            ))}
          </select>
          {!years.length && (
            <p className="text-xs text-slate-500">
              {tt('Paste a financial year id if calendar API is unavailable, or open Financial Calendar first.')}
            </p>
          )}
          <input
            className="w-full max-w-md rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder={tt('Or paste financialYearId')}
            value={financialYearId}
            onChange={(e) => setFinancialYearId(e.target.value)}
          />
        </PosStylePanel>

        <PosStylePanel className="space-y-3 p-4" as="section">
          <h2 className="font-medium text-slate-900">{tt('2. Closing configuration')}</h2>
          <p className="text-xs text-slate-500">
            CYE model: calculated reporting line (MODEL A). Profit transfers once via Closing Journals.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              {tt('Close method')}
              <select
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={cfgForm.closeMethod}
                onChange={(e) => setCfgForm({ ...cfgForm, closeMethod: e.target.value })}
              >
                <option value="INCOME_SUMMARY_TO_RETAINED_EARNINGS">{tt('Income Summary → Retained Earnings')}</option>
                <option value="DIRECT_TO_RETAINED_EARNINGS">{tt('Direct → Retained Earnings')}</option>
                <option value="OWNER_CAPITAL_CLOSE">{tt('Owner Capital close')}</option>
                <option value="PARTNER_CAPITAL_ALLOCATION">{tt('Partner capital allocation')}</option>
                <option value="FUND_BALANCE_CLOSE">{tt('Fund balance close')}</option>
              </select>
            </label>
            <label className="text-sm">
              {tt('Income Summary account id')}
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={cfgForm.incomeSummaryAccountId}
                onChange={(e) => setCfgForm({ ...cfgForm, incomeSummaryAccountId: e.target.value })}
              />
            </label>
            <label className="text-sm">
              {tt('Retained Earnings account id')}
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={cfgForm.retainedEarningsAccountId}
                onChange={(e) => setCfgForm({ ...cfgForm, retainedEarningsAccountId: e.target.value })}
              />
            </label>
            <label className="text-sm">
              {tt('Owner Capital account id')}
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={cfgForm.ownerCapitalAccountId}
                onChange={(e) => setCfgForm({ ...cfgForm, ownerCapitalAccountId: e.target.value })}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveConfig} className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white">
              {tt('Save draft')}
            </button>
            <button type="button" onClick={approveConfig} className="rounded bg-teal-700 px-3 py-1.5 text-sm text-white">
              {tt('Approve configuration')}
            </button>
            {config && (
              <span className="text-sm text-slate-600 self-center">Status: {config.status}</span>
            )}
          </div>
        </PosStylePanel>

        <PosStylePanel className="space-y-3 p-4" as="section">
          <h2 className="font-medium text-slate-900">{tt('3. Close readiness')}</h2>
          {readiness ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                {readiness.status === 'READY' || readiness.status === 'READY_WITH_WARNINGS' ? (
                  <CheckCircle2 className="h-4 w-4 text-teal-600" />
                ) : (
                  <Lock className="h-4 w-4 text-amber-600" />
                )}
                <strong>{readiness.status}</strong>
                <span className="text-slate-500">
                  {readiness.summary?.passed}/{readiness.summary?.total} passed · {readiness.summary?.blocking} blocking
                </span>
              </div>
              <ul className="max-h-48 overflow-auto text-xs space-y-1">
                {(readiness.checks || []).map((c) => (
                  <li key={c.code} className="flex gap-2 border-b border-slate-100 py-1">
                    <span className="w-40 shrink-0 font-mono">{c.code}</span>
                    <span className="w-24 shrink-0">{c.status}</span>
                    <span>{c.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-500">{tt('Select a financial year to assess readiness.')}</p>
          )}
        </PosStylePanel>

        <PosStylePanel className="space-y-3 p-4" as="section">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium text-slate-900">{tt('4. Year-end close run')}</h2>
            <button
              type="button"
              onClick={createRun}
              disabled={!financialYearId || busy}
              className="rounded bg-teal-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {tt('Create close run')}
            </button>
          </div>
          {run ? (
            <div className="space-y-3 text-sm">
              <p>
                Version {run.closeVersion} · <strong>{run.status}</strong> · method {run.closingMethod}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded border px-2 py-1" onClick={() => act('run-checklist')}>
                  {tt('Run checklist')}
                </button>
                <button type="button" className="rounded border px-2 py-1" onClick={() => act('approve-closing')}>
                  {tt('Approve for closing')}
                </button>
                <button type="button" className="rounded border px-2 py-1" onClick={() => act('generate-closing-preview')}>
                  {tt('Preview closing journals')}
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1"
                  onClick={() => act('approve-closing-batch', { batchId: run.batches?.[0]?.id })}
                  disabled={!run.batches?.[0]?.id}
                >
                  {tt('Approve batch')}
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1"
                  onClick={() => act('post-closing-batch', { batchId: run.batches?.[0]?.id })}
                  disabled={!run.batches?.[0]?.id}
                >
                  {tt('Post via Posting Engine')}
                </button>
                <button type="button" className="rounded border px-2 py-1" onClick={() => act('generate-pctb')}>
                  {tt('Post-closing TB')}
                </button>
                <button type="button" className="rounded border px-2 py-1" onClick={() => act('generate-snapshots')}>
                  {tt('Annual snapshots')}
                </button>
                <button
                  type="button"
                  className="rounded bg-slate-900 px-2 py-1 text-white"
                  onClick={() => act('close-year', { reason: 'Year-end close approved' })}
                >
                  {tt('Close financial year')}
                </button>
                <a
                  className="rounded border px-2 py-1 text-teal-800"
                  href={run?.id ? `/api/accounting-close/runs/${run.id}/close-pack?format=xlsx` : '#'}
                >
                  Download Close Pack (Excel)
                </a>
                <button
                  type="button"
                  className="rounded border px-2 py-1"
                  onClick={() => act('close-pack')}
                >
                  View Close Pack (JSON)
                </button>
              </div>
              <ul className="max-h-56 overflow-auto text-xs space-y-1">
                {(run.tasks || []).map((t) => (
                  <li key={t.taskKey} className="flex items-center gap-2 border-b border-slate-100 py-1">
                    <span className="w-48 font-mono shrink-0">{t.taskKey}</span>
                    <span className="w-28 shrink-0">{t.status}</span>
                    <span className="flex-1">{t.name}</span>
                    {t.kind === 'MANUAL' && t.status === 'NOT_STARTED' && (
                      <button type="button" className="text-teal-700 underline" onClick={() => completeTask(t.taskKey)}>
                        {tt('Complete')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-500">{tt('No close run yet for this year.')}</p>
          )}
        </PosStylePanel>

        {preview && (
          <PosStylePanel className="space-y-2 p-4" as="section">
            <h2 className="font-medium text-slate-900">{tt('Closing journal preview')}</h2>
            <p className="text-sm">
              Profit/(loss): {preview.calculatedProfitOrLoss} · Dr {preview.totalDebitMinor} / Cr{' '}
              {preview.totalCreditMinor} (minor) · checksum {String(preview.previewChecksum || '').slice(0, 12)}…
            </p>
            <ul className="max-h-64 overflow-auto text-xs font-mono">
              {(preview.lines || []).map((l) => (
                <li key={l.sequence}>
                  {l.sequence}. {l.accountCode || l.accountId} {l.lineRole} Dr {l.debitMinor} Cr {l.creditMinor}
                </li>
              ))}
            </ul>
          </PosStylePanel>
        )}
      </div>
    </div>
  );
}
