'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PermissionGuard from '@/components/PermissionGuard';

function money(n) {
  if (n == null) return '—';
  return `MWK ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function RentalReconcilePage() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/rentals-v2/reconcile');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed');
    setReport(data);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  const s = report?.summary;

  return (
    <PermissionGuard permissions={['rentals.view', 'accounting.view', 'invoices.view']}>
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-4 text-sm text-gray-500">
          <Link href="/rentals" className="text-blue-600 hover:underline">
            Rental &amp; Hiring
          </Link>
          <span className="mx-2">/</span>
          Reconciliation
        </div>
        <h1 className="text-2xl font-semibold">Rental &amp; hiring reconciliation</h1>
        <p className="mt-1 text-sm text-gray-600">
          Open deposit liabilities, unbilled charges, hire accruals awaiting supplier bill clear.
        </p>
        {error ? (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {s ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded border p-3 text-sm">
              <div className="text-xs uppercase text-gray-500">Contracts</div>
              <div className="text-xl font-semibold">{s.contractCount}</div>
            </div>
            <div className="rounded border p-3 text-sm">
              <div className="text-xs uppercase text-gray-500">Deposit liability open</div>
              <div className="text-xl font-semibold">{money(s.depositLiabilityOpen)}</div>
            </div>
            <div className="rounded border p-3 text-sm">
              <div className="text-xs uppercase text-gray-500">Unbilled charges</div>
              <div className="text-xl font-semibold">{money(s.unbilledChargeTotal)}</div>
            </div>
            <div className="rounded border p-3 text-sm">
              <div className="text-xs uppercase text-gray-500">Hire accruals open</div>
              <div className="text-xl font-semibold">{money(s.accruedHireOpen)}</div>
            </div>
            <div className="rounded border p-3 text-sm">
              <div className="text-xs uppercase text-gray-500">Invoiced periods</div>
              <div className="text-xl font-semibold">{s.invoicedPeriodCount}</div>
            </div>
            <div className="rounded border p-3 text-sm">
              <div className="text-xs uppercase text-gray-500">Issues</div>
              <div className="text-xl font-semibold">{s.issueCount}</div>
            </div>
          </div>
        ) : null}

        <h2 className="mt-8 text-sm font-semibold uppercase text-gray-500">Issues</h2>
        <ul className="mt-2 divide-y rounded border">
          {(report?.issues || []).map((issue) => (
            <li key={`${issue.type}-${issue.id}`} className="px-3 py-2 text-sm">
              <span
                className={`mr-2 rounded px-1.5 py-0.5 text-xs uppercase ${
                  issue.severity === 'high'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {issue.severity}
              </span>
              {issue.message}
            </li>
          ))}
          {report && !report.issues?.length ? (
            <li className="px-3 py-4 text-sm text-gray-500">No open issues</li>
          ) : null}
        </ul>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link href="/rentals/contracts-v2" className="text-blue-600 underline">
            Contracts V2
          </Link>
          <Link href="/rentals/inbound-hiring" className="text-blue-600 underline">
            Supplier hiring
          </Link>
          <Link href="/rentals/quotations-v2" className="text-blue-600 underline">
            Quotations
          </Link>
        </div>
      </div>
    </PermissionGuard>
  );
}
