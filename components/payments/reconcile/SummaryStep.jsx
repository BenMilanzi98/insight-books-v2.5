'use client';
import { tt } from '@/lib/i18n/runtime';
import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import {
  canCompleteFromWorkspace,
  completeReconciliation,
  summaryFromWorkspace,
} from './reconApi.js';

function moneyOrDash(value) {
  return value != null && value !== '' ? String(value) : '—';
}

export function ReconSummaryStrip({ workspace }) {
  const summary = summaryFromWorkspace(workspace);
  const items = [
    { label: tt('Bank opening'), value: moneyOrDash(summary.opening) },
    { label: tt('Bank closing'), value: moneyOrDash(summary.closing) },
    { label: tt('InsightBooks balance'), value: moneyOrDash(summary.bookBalance) },
    { label: tt('Matched'), value: String(summary.matchedCount) },
    { label: tt('Unmatched'), value: String(summary.unmatchedCount) },
    { label: tt('Outstanding'), value: String(summary.outstandingCount) },
    { label: tt('Difference'), value: moneyOrDash(summary.difference) },
  ];

  return (
    <div
      className="sticky top-0 z-20 rounded-md border border-gray-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur"
      role="region"
      aria-label={tt('Reconciliation summary')}
    >
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {items.map((item) => (
          <div key={item.label} className="min-w-[7rem]">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{item.label}</dt>
            <dd className="font-semibold tabular-nums text-gray-900">{item.value}</dd>
          </div>
        ))}
        {summary.statusText ? (
          <div className="min-w-[7rem]">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{tt('Status')}</dt>
            <dd className="font-semibold text-emerald-800">{tt(summary.statusText)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export default function SummaryStep({ reconciliationId, workspace, onRefresh }) {
  const summary = summaryFromWorkspace(workspace);
  const canComplete = canCompleteFromWorkspace(workspace) && !summary.isComplete;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleComplete = async () => {
    if (!reconciliationId || !canComplete) return;
    setError('');
    setBusy(true);
    try {
      await completeReconciliation(reconciliationId);
      await onRefresh?.(reconciliationId);
    } catch (err) {
      setError(err.message || tt('Could not complete reconciliation.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-900">{tt('Summary')}</h2>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-gray-500">{tt('Bank opening')}</dt>
          <dd className="font-medium tabular-nums">{moneyOrDash(summary.opening)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">{tt('Bank closing')}</dt>
          <dd className="font-medium tabular-nums">{moneyOrDash(summary.closing)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">{tt('InsightBooks balance')}</dt>
          <dd className="font-medium tabular-nums">{moneyOrDash(summary.bookBalance)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">{tt('Matched')}</dt>
          <dd className="font-medium tabular-nums">{summary.matchedCount}</dd>
        </div>
        <div>
          <dt className="text-gray-500">{tt('Unmatched')}</dt>
          <dd className="font-medium tabular-nums">{summary.unmatchedCount}</dd>
        </div>
        <div>
          <dt className="text-gray-500">{tt('Outstanding')}</dt>
          <dd className="font-medium tabular-nums">{summary.outstandingCount}</dd>
        </div>
        <div>
          <dt className="text-gray-500">{tt('Difference')}</dt>
          <dd className="font-medium tabular-nums">{moneyOrDash(summary.difference)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">{tt('Status')}</dt>
          <dd className="font-medium">{summary.statusText ? tt(summary.statusText) : tt('Open')}</dd>
        </div>
      </dl>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {summary.isComplete ? (
        <div className="space-y-2">
          <p className="text-sm text-emerald-800">{tt('This period is reconciled and read-only.')}</p>
          <Link href="/payments" className="text-sm font-medium text-indigo-700 underline-offset-2 hover:underline">
            {tt('Back to Accounts')}
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {!canComplete ? (
            <p className="text-sm text-amber-800">
              {tt('Complete is blocked until Difference is 0.')} {tt('Difference')}: {moneyOrDash(summary.difference)}
            </p>
          ) : null}
          <Button
            type="button"
            onClick={handleComplete}
            disabled={!canComplete}
            loading={busy}
          >
            {tt('Complete Reconciliation')}
          </Button>
        </div>
      )}
    </div>
  );
}
