'use client';
import { tt } from '@/lib/i18n/runtime';

/**
 * Loan Readiness Centre — advisory financing preparation.
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

const DEMO_OPENING = {
  cash: '80000.00',
  receivables: '60000.00',
  inventory: '40000.00',
  payables: '35000.00',
  shortTermDebt: '20000.00',
  longTermDebt: '100000.00',
  equity: '150000.00',
  retainedEarnings: '75000.00',
  taxPayable: '5000.00',
};

export default function LoanReadinessPage() {
  const [config, setConfig] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [activeVersion, setActiveVersion] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    requestedAmount: '50000000',
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

  const saveConfig = async () => {
    setBusy(true);
    try {
      await api('/api/loan-readiness/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiCommentaryEnabled: false }),
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
      await api('/api/loan-readiness/config', {
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

  const runPreview = async () => {
    setBusy(true);
    try {
      const periods = Array.from({ length: Number(form.termMonths) || 36 }, (_, i) => ({
        label: `M${i + 1}`,
        pnl: {
          ebitda: { minor: String(Math.round(12000000 * (1 + i * 0.002))), decimal: '0' },
          tax: { minor: '1000000', decimal: '0' },
          interest: { minor: '500000', decimal: '0' },
          depreciation: { minor: '800000', decimal: '0' },
        },
        cashFlow: { netCashMovement: { minor: '2000000', decimal: '0' } },
        balanceSheet: {
          cash: { minor: '8000000', decimal: '0' },
          receivables: { minor: '6000000', decimal: '0' },
          inventory: { minor: '4000000', decimal: '0' },
          shortTermDebt: { minor: '2000000', decimal: '0' },
          longTermDebt: { minor: '10000000', decimal: '0' },
          totalEquity: { minor: '22500000', decimal: '0' },
        },
      }));

      const data = await api('/api/loan-readiness/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanRequest: {
            purpose: form.purpose,
            requestedAmount: form.requestedAmount,
            requestedTermMonths: Number(form.termMonths),
            expectedInterestRateBps: Number(form.rateBps),
            gracePeriodMonths: Number(form.graceMonths),
            balloonAmount: form.balloon,
            rateType: 'FIXED',
            amortizationMethod: 'EQUAL_INSTALMENT',
          },
          forecast: { periods, integrityStatus: 'VALID' },
          openingBalances: DEMO_OPENING,
          existingDebt: [
            { currentBalance: '100000.00', interestRate: 18, principalAmount: '100000.00' },
          ],
          bankReconciled: true,
          closedPeriodsAvailable: true,
          sourceActualsVersion: 'pilot-preview',
          lenderCriteria: {
            minimumDSCR: 1.25,
            minimumCurrentRatio: 1.1,
            maximumDebtToEquity: 2.5,
            sourceReference: 'INTERNAL_DEFAULT',
            label: 'Internal criteria — not lender-issued',
          },
        }),
      });
      setPreview(data.result);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const createAndCalculate = async () => {
    setBusy(true);
    try {
      const lr = await api('/api/loan-readiness/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createLoanRequest',
          purpose: form.purpose,
          requestedAmount: form.requestedAmount,
          requestedTermMonths: Number(form.termMonths),
          expectedInterestRateBps: Number(form.rateBps),
          gracePeriodMonths: Number(form.graceMonths),
          balloonAmount: form.balloon,
        }),
      });
      const cycle = await api('/api/loan-readiness/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createCycle',
          name: `Assessment ${form.purpose}`,
          assessmentDate: new Date().toISOString().slice(0, 10),
        }),
      });
      const ver = await api('/api/loan-readiness/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createVersion',
          assessmentCycleId: cycle.cycle.id,
          loanRequestId: lr.loanRequest.id,
        }),
      });
      const calc = await api(`/api/loan-readiness/assessments/${ver.version.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'calculate',
          loanRequestId: lr.loanRequest.id,
          openingBalances: DEMO_OPENING,
          bankReconciled: true,
          closedPeriodsAvailable: true,
          sourceActualsVersion: 'pilot',
          baseEbitdaMinor: 12000000,
          loanRequest: {
            purpose: form.purpose,
            requestedAmount: Math.round(Number(form.requestedAmount) * 100),
            requestedTermMonths: Number(form.termMonths),
            expectedInterestRateBps: Number(form.rateBps),
            gracePeriodMonths: Number(form.graceMonths),
            balloonAmount: Math.round(Number(form.balloon || 0) * 100),
          },
        }),
      });
      setActiveVersion(calc.version);
      setPreview(calc.version.resultPayload);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reviewAssessment = async () => {
    if (!activeVersion?.id) return;
    setBusy(true);
    try {
      const data = await api(`/api/loan-readiness/assessments/${activeVersion.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review' }),
      });
      setActiveVersion(data.version);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const approveAssessment = async () => {
    if (!activeVersion?.id) return;
    setBusy(true);
    try {
      const data = await api(`/api/loan-readiness/assessments/${activeVersion.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      setActiveVersion(data.version);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const score = preview?.score;
  const capacity = preview?.debtCapacity;

  return (
    <div className="w-full space-y-6">
      <PosStylePageHeader
        title={tt('Loan Readiness Centre')}
        description="Internal advisory financing preparation. Scores and capacity estimates are not lender decisions and do not guarantee funding. Proposed facilities never post to the General Ledger."
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

      <section className="grid md:grid-cols-3 gap-4">
        <StatCard
          label="Configuration"
          value={config?.status || 'Not saved'}
        >
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={saveConfig} className="px-2 py-1 text-xs rounded border">
              {tt('Save draft')}
            </button>
            <button
              type="button"
              onClick={approveConfig}
              className="px-2 py-1 text-xs rounded bg-teal-700 text-white"
            >
              {tt('Approve')}
            </button>
          </div>
        </StatCard>
        <StatCard
          label="Internal readiness score"
          value={score?.totalReadinessScore ?? '—'}
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
        <h2 className="font-medium">Loan request (proposed — not actual)</h2>
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
            onClick={runPreview}
            disabled={busy}
            className="px-3 py-2 text-sm rounded bg-slate-800 text-white"
          >
            {tt('Preview assessment')}
          </button>
          <button
            type="button"
            onClick={createAndCalculate}
            disabled={busy}
            className="px-3 py-2 text-sm rounded bg-teal-700 text-white"
          >
            Create &amp; calculate
          </button>
          <button
            type="button"
            onClick={reviewAssessment}
            disabled={busy || !activeVersion?.id}
            className="px-3 py-2 text-sm rounded border border-slate-400 text-slate-800"
            title={tt('Must be a different user than the preparer')}
          >
            {tt('Mark reviewed')}
          </button>
          <button
            type="button"
            onClick={approveAssessment}
            disabled={busy || !activeVersion?.id}
            className="px-3 py-2 text-sm rounded border border-teal-700 text-teal-800"
            title="Requires a different reviewer; preparer cannot approve"
          >
            {tt('Approve assessment')}
          </button>
          <a
            href={
              activeVersion?.id
                ? `/api/loan-readiness/export?assessmentVersionId=${activeVersion.id}&format=xlsx`
                : undefined
            }
            className={`px-3 py-2 text-sm rounded border ${
              activeVersion?.id ? '' : 'pointer-events-none opacity-40'
            }`}
          >
            {tt('Export lender pack')}
          </a>
          <a
            href={
              activeVersion?.id
                ? `/api/loan-readiness/export?assessmentVersionId=${activeVersion.id}&format=xlsx&pack=board`
                : undefined
            }
            className={`px-3 py-2 text-sm rounded border ${
              activeVersion?.id ? '' : 'pointer-events-none opacity-40'
            }`}
          >
            {tt('Export board pack')}
          </a>
        </div>
        <p className="text-xs text-slate-500">
          {tt('Separation of duties: the preparer cannot review or approve. A different user must mark reviewed before approval.')}
        </p>
      </PosStylePanel>

      {preview?.proposedFacilityProjection ? (
        <PosStylePanel className="p-4 text-sm" as="section">
          <h2 className="font-medium mb-1">Proposed facility three-statement (advisory)</h2>
          <p className="text-xs text-slate-500 mb-2">
            {preview.proposedFacilityProjection.integration?.note}
          </p>
          <div className="grid sm:grid-cols-3 gap-2 text-xs">
            <div>
              Integrity: {preview.proposedFacilityProjection.integrityStatus || '—'}
            </div>
            <div>
              Proceeds as revenue:{' '}
              {String(
                preview.proposedFacilityProjection.integration?.loanProceedsClassifiedAsRevenue
              )}
            </div>
            <div>
              Interest in P&amp;L:{' '}
              {String(preview.proposedFacilityProjection.integration?.interestInPnl)}
            </div>
          </div>
        </PosStylePanel>
      ) : null}

      {capacity ? (
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Indicative max principal', capacity.indicativeMaximumPrincipal?.decimal],
            ['Binding max debt service', capacity.bindingMaximumPeriodicDebtService?.decimal],
            ['Affordability', capacity.affordabilityStatus],
            ['Min DSCR (projected)', preview?.dscr?.summary?.minimumDscrObserved],
          ].map(([label, value]) => (
            <StatCard key={label} label={label} value={value ?? '—'} />
          ))}
          <p className="sm:col-span-2 lg:col-span-4 text-xs text-slate-500">
            {capacity.label || capacity.disclaimer}
          </p>
        </section>
      ) : null}

      {score?.dimensions?.length ? (
        <PosStylePanel className="overflow-x-auto p-4" as="section">
          <h2 className="font-medium mb-2">Score dimensions (weights transparent)</h2>
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-1 pr-2">{tt('Dimension')}</th>
                <th className="py-1 pr-2">{tt('Weight %')}</th>
                <th className="py-1 pr-2">{tt('Score')}</th>
                <th className="py-1">{tt('Contribution')}</th>
              </tr>
            </thead>
            <tbody>
              {score.dimensions.map((d) => (
                <tr key={d.key} className="border-b border-slate-100">
                  <td className="py-1 pr-2 font-mono">{d.key}</td>
                  <td className="py-1 pr-2">{d.weightPercent}</td>
                  <td className="py-1 pr-2">{d.appliedScore}</td>
                  <td className="py-1">{Number(d.contribution).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PosStylePanel>
      ) : null}

      {preview?.risks?.length ? (
        <PosStylePanel className="p-4" as="section">
          <h2 className="font-medium mb-2">{tt('Risk findings')}</h2>
          <ul className="space-y-2 text-sm">
            {preview.risks.map((r, i) => (
              <li key={i} className="flex gap-2">
                {r.severity === 'CRITICAL' || r.severity === 'HIGH' ? (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-medium">
                    [{r.severity}] {r.title}
                  </div>
                  <div className="text-slate-600 text-xs">{r.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </PosStylePanel>
      ) : null}

      <PosStylePanel className="p-4" as="section">
        <h2 className="font-medium mb-2">{tt('Assessment cycles')}</h2>
        {(cycles || []).length === 0 ? (
          <p className="text-sm text-slate-500">{tt('No assessments yet.')}</p>
        ) : (
          <ul className="text-sm space-y-2">
            {cycles.map((c) => (
              <li key={c.id} className="border-b border-slate-100 pb-2">
                <span className="font-medium">{c.name}</span>
                <div className="text-xs text-slate-500 mt-1">
                  {(c.versions || [])
                    .map(
                      (v) =>
                        `v${v.version} [${v.status}/${v.integrityStatus}] score=${v.totalReadinessScore ?? '—'}`
                    )
                    .join('; ') || 'no versions'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PosStylePanel>

      <p className="text-xs text-slate-500">{preview?.disclaimer}</p>
    </div>
  );
}
