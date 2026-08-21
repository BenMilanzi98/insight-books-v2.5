'use client';
import { tt } from '@/lib/i18n/runtime';

/**
 * Loan Readiness Centre — simple advisory: enter terms → run once.
 * Proposed facilities never create Journal Entries or liabilities.
 */

import { useCallback, useEffect, useState } from 'react';
import { Landmark, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import PosStylePageHeader, { PosStyleHeaderButton } from '@/components/shell/PosStylePageHeader';
import PosStylePanel from '@/components/shell/PosStylePanel';

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

export default function LoanReadinessPage() {
  const [config, setConfig] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [activeVersion, setActiveVersion] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    requestedAmount: '500000.00',
    termMonths: 36,
    rateBps: 1800,
    graceMonths: 0,
    balloon: '0',
    purpose: 'WORKING_CAPITAL',
  });

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [c, a] = await Promise.all([
        api('/api/loan-readiness/config'),
        api('/api/loan-readiness/assessments'),
      ]);
      setConfig(c.configuration);
      setCycles(a.cycles || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAssessment = async () => {
    setBusy(true);
    setSuccess('');
    setError('');
    try {
      const amount = String(form.requestedAmount || '').trim();
      if (!amount || Number(amount) <= 0) throw new Error('Enter a positive loan amount.');

      const data = await api('/api/loan-readiness/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run',
          purpose: form.purpose,
          requestedAmount: amount,
          requestedTermMonths: Number(form.termMonths),
          expectedInterestRateBps: Number(form.rateBps),
          gracePeriodMonths: Number(form.graceMonths),
          balloonAmount: form.balloon,
        }),
      });

      setActiveVersion(data.version);
      setPreview(data.result || data.version?.resultPayload);
      setSuccess('Assessment calculated (advisory only — does not post to the ledger).');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openHistoryVersion = (version) => {
    setActiveVersion(version);
    setPreview(version.resultPayload || null);
  };

  const score = preview?.score;
  const capacity = preview?.debtCapacity;

  return (
    <div className="w-full space-y-6">
      <PosStylePageHeader
        title={tt('Loan Readiness Centre')}
        description="Internal advisory financing preparation. Scores are not lender decisions and do not guarantee funding. Proposed facilities never post to the General Ledger."
        actions={
          <PosStyleHeaderButton type="button" onClick={load} disabled={busy}>
            <RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            {tt('Refresh')}
          </PosStyleHeaderButton>
        }
      />

      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          {success}
        </div>
      ) : null}

      <section className="grid md:grid-cols-3 gap-4">
        <StatCard label="Configuration" value={config?.status || 'Ready'} helper="Auto-managed" />
        <StatCard
          label="Internal readiness score"
          value={score?.totalReadinessScore ?? activeVersion?.totalReadinessScore ?? '—'}
          helper={score?.band || 'Not calculated'}
          icon={Landmark}
        >
          <p className="mt-1 text-xs text-amber-700">{tt('Not a lender approval or credit bureau score.')}</p>
        </StatCard>
        <StatCard
          label="Integrity / confidence"
          value={preview?.integrityStatus || activeVersion?.integrityStatus || 'NOT_CALCULATED'}
          helper={`Confidence: ${score?.confidence || preview?.dataQuality?.confidence || '—'}`}
          icon={CheckCircle2}
        />
      </section>

      <PosStylePanel className="space-y-4 p-4" as="section">
        <h2 className="font-medium">{tt('Loan request')}</h2>
        <p className="text-xs text-slate-500">
          Proposed facility only — running an assessment does not create a loan or journal entry.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            {tt('Amount')}
            <input
              className="block mt-1 border rounded px-2 py-1"
              value={form.requestedAmount}
              onChange={(e) => setForm({ ...form, requestedAmount: e.target.value })}
            />
          </label>
          <label className="text-sm">
            Term (months)
            <input
              type="number"
              className="block mt-1 border rounded px-2 py-1 w-24"
              value={form.termMonths}
              onChange={(e) => setForm({ ...form, termMonths: e.target.value })}
            />
          </label>
          <label className="text-sm">
            Rate (bps)
            <input
              type="number"
              className="block mt-1 border rounded px-2 py-1 w-24"
              value={form.rateBps}
              onChange={(e) => setForm({ ...form, rateBps: e.target.value })}
            />
          </label>
          <label className="text-sm">
            Grace (months)
            <input
              type="number"
              className="block mt-1 border rounded px-2 py-1 w-24"
              value={form.graceMonths}
              onChange={(e) => setForm({ ...form, graceMonths: e.target.value })}
            />
          </label>
          <label className="text-sm">
            {tt('Purpose')}
            <select
              className="block mt-1 border rounded px-2 py-1"
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            >
              <option value="WORKING_CAPITAL">{tt('Working capital')}</option>
              <option value="ASSET_FINANCE">{tt('Asset finance')}</option>
              <option value="BUSINESS_EXPANSION">{tt('Business expansion')}</option>
              <option value="OVERDRAFT">{tt('Overdraft')}</option>
              <option value="REFINANCING">{tt('Refinancing')}</option>
            </select>
          </label>
          <button
            type="button"
            onClick={runAssessment}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium rounded bg-teal-700 text-white disabled:opacity-50"
          >
            {tt('Run assessment')}
          </button>
        </div>
      </PosStylePanel>

      {preview ? (
        <PosStylePanel className="space-y-3 p-4" as="section">
          <h2 className="font-medium">{tt('Results')}</h2>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <div className="text-xs text-slate-500">Band</div>
              <div className="font-medium">{score?.band || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Debt capacity (indicative)</div>
              <div className="font-medium">
                {capacity?.maxSustainablePrincipal?.decimal ||
                  capacity?.indicativeCapacity?.decimal ||
                  capacity?.summary ||
                  '—'}
              </div>
            </div>
            <div className="sm:col-span-2 text-xs text-amber-800 rounded border border-amber-200 bg-amber-50 p-2">
              Advisory only. Not a credit decision. Does not create liabilities or GL postings.
            </div>
          </div>
          {Array.isArray(preview.findings) && preview.findings.length > 0 ? (
            <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1">
              {preview.findings.slice(0, 8).map((f, i) => (
                <li key={i}>
                  {f.code ? `${f.code}: ` : ''}
                  {f.message || f.detail || JSON.stringify(f)}
                </li>
              ))}
            </ul>
          ) : null}
        </PosStylePanel>
      ) : null}

      <PosStylePanel className="p-4" as="section">
        <h2 className="font-medium mb-2">{tt('History')}</h2>
        <ul className="divide-y text-sm max-h-80 overflow-auto">
          {cycles.length === 0 ? (
            <li className="py-3 text-slate-500">No assessments yet.</li>
          ) : (
            cycles.map((c) => {
              const v = c.versions?.[0];
              return (
                <li key={c.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{c.name || c.assessmentNumber}</div>
                    <div className="text-xs text-slate-500">
                      {c.assessmentDate
                        ? new Date(c.assessmentDate).toISOString().slice(0, 10)
                        : '—'}
                      {v
                        ? ` · score ${v.totalReadinessScore ?? '—'} · ${v.integrityStatus || v.status}`
                        : ''}
                    </div>
                  </div>
                  {v ? (
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded border"
                      onClick={() => openHistoryVersion(v)}
                    >
                      View
                    </button>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </PosStylePanel>
    </div>
  );
}
