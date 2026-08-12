'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PermissionGuard from '@/components/PermissionGuard';

function money(n) {
  if (n == null) return '—';
  return `MWK ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InboundHiringPanel({ embedded = false }) {
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [selectedAgreementId, setSelectedAgreementId] = useState('');
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [description, setDescription] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [hireRequestId, setHireRequestId] = useState('');
  const [accountingPolicy, setAccountingPolicy] = useState('DIRECT_BILL');
  const [usageHours, setUsageHours] = useState('');
  const [accrualAmount, setAccrualAmount] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [accruedLiabilityAccountId, setAccruedLiabilityAccountId] = useState('');
  const [accrualId, setAccrualId] = useState('');
  const [supplierBillId, setSupplierBillId] = useState('');

  const loadRequests = useCallback(async () => {
    const res = await fetch('/api/hiring-v2/requests');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list requests');
    setRequests(data.requests || []);
  }, []);

  const loadAgreements = useCallback(async () => {
    const res = await fetch('/api/hiring-v2/agreements');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list agreements');
    setAgreements(data.agreements || []);
  }, []);

  const loadAgreement = useCallback(async (id) => {
    if (!id) {
      setDetail(null);
      return;
    }
    const res = await fetch(`/api/hiring-v2/agreements/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load');
    setDetail(data);
  }, []);

  useEffect(() => {
    Promise.all([loadRequests(), loadAgreements()]).catch((e) => setError(e.message));
  }, [loadRequests, loadAgreements]);

  useEffect(() => {
    if (selectedAgreementId) {
      loadAgreement(selectedAgreementId).catch((e) => setError(e.message));
    }
  }, [selectedAgreementId, loadAgreement]);

  const createRequest = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/hiring-v2/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          startAt,
          endAt,
          estimatedCost: Number(estimatedCost) || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Create failed');
      await loadRequests();
      setHireRequestId(data.request.id);
      setTab('agreements');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const requestAction = async (id, action) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/hiring-v2/requests/${id}/${action}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      await loadRequests();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const createAgreement = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/hiring-v2/agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          hireRequestId: hireRequestId || undefined,
          startAt,
          endAt,
          estimatedValue: Number(estimatedCost) || 0,
          accountingPolicy,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Create failed');
      await loadAgreements();
      setSelectedAgreementId(data.agreement.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const agreementAction = async (action, body = {}) => {
    if (!selectedAgreementId) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/hiring-v2/agreements/${selectedAgreementId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `${action} failed`);
      await loadAgreement(selectedAgreementId);
      await loadAgreements();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const a = detail?.agreement;

  return (
    <PermissionGuard permissions={['rentals.view', 'invoices.view', 'purchases.view']}>
      <div className={embedded ? 'w-full' : 'mx-auto max-w-6xl p-6'}>
        {!embedded && (
          <>
            <div className="mb-4 text-sm text-gray-500">
              <Link href="/rentals" className="text-blue-600 hover:underline">
                Rental &amp; Hiring
              </Link>
              <span className="mx-2">/</span>
              Supplier hiring
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">Supplier hiring (inbound)</h1>
            <p className="mt-2 text-sm text-gray-600">
              Cost / AP path — not customer rental revenue. Separate from{' '}
              <Link href="/rentals/hirings?tab=customer" className="text-blue-600 underline">
                Customer hire
              </Link>{' '}
              and{' '}
              <Link href="/rentals/contracts-v2" className="text-blue-600 underline">
                Contracts V2
              </Link>
              . Order/agreement creates no expense until approved usage accrual or supplier bill.
            </p>
          </>
        )}

        {error ? (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setTab('requests')}
            className={`rounded px-3 py-1.5 ${tab === 'requests' ? 'bg-blue-600 text-white' : 'border'}`}
          >
            Hire requests
          </button>
          <button
            type="button"
            onClick={() => setTab('agreements')}
            className={`rounded px-3 py-1.5 ${tab === 'agreements' ? 'bg-blue-600 text-white' : 'border'}`}
          >
            Agreements
          </button>
        </div>

        {tab === 'requests' ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase text-gray-500">New request</h2>
              <label className="block text-sm">
                Description
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">
                  Start
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  End
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                  />
                </label>
              </div>
              <label className="block text-sm">
                Estimated cost
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={createRequest}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                Create request
              </button>
            </section>
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">Requests</h2>
              <ul className="divide-y rounded border">
                {requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">{r.requestNumber}</div>
                      <div className="text-xs text-gray-500">
                        {r.status} · {r.description}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded border px-2 py-0.5 text-xs"
                        onClick={() => requestAction(r.id, 'submit')}
                      >
                        submit
                      </button>
                      <button
                        type="button"
                        className="rounded border px-2 py-0.5 text-xs"
                        onClick={() => requestAction(r.id, 'approve')}
                      >
                        approve
                      </button>
                      <button
                        type="button"
                        className="rounded border px-2 py-0.5 text-xs"
                        onClick={() => {
                          setHireRequestId(r.id);
                          setDescription(r.description);
                          setTab('agreements');
                        }}
                      >
                        use
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase text-gray-500">New agreement</h2>
              <p className="text-xs text-amber-800">
                Creating an agreement does not post hire expense or AP.
              </p>
              <label className="block text-sm">
                Supplier ID
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Hire request ID (optional)
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={hireRequestId}
                  onChange={(e) => setHireRequestId(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Accounting policy
                <select
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={accountingPolicy}
                  onChange={(e) => setAccountingPolicy(e.target.value)}
                >
                  <option value="DIRECT_BILL">DIRECT_BILL (expense on supplier bill)</option>
                  <option value="ACCRUE">ACCRUE (usage → accrual journal)</option>
                </select>
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={createAgreement}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                Create agreement
              </button>

              <h2 className="pt-4 text-sm font-semibold uppercase text-gray-500">Agreements</h2>
              <ul className="max-h-64 divide-y overflow-auto rounded border">
                {agreements.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedAgreementId(row.id)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                        selectedAgreementId === row.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="font-medium">{row.agreementNumber}</div>
                      <div className="text-xs text-gray-500">
                        {row.status} · {row.accountingPolicy} · {money(row.estimatedValue)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase text-gray-500">Selected</h2>
              {!a ? (
                <p className="text-sm text-gray-500">Select an agreement</p>
              ) : (
                <>
                  <div className="rounded border p-3 text-sm">
                    <div className="font-semibold">{a.agreementNumber}</div>
                    <div>Status: {a.status}</div>
                    <div>Policy: {a.accountingPolicy}</div>
                    {detail?.reconcile ? (
                      <div className="mt-2 text-xs text-gray-500">
                        Accrued {money(detail.reconcile.accrued)} · approved usage{' '}
                        {detail.reconcile.approvedUsageCount}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['approve', 'activate', 'delivery', 'complete', 'cancel'].map((act) => (
                      <button
                        key={act}
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          agreementAction(
                            act,
                            act === 'delivery' ? { description: 'Equipment received' } : {}
                          )
                        }
                        className="rounded border px-2 py-1 text-xs capitalize disabled:opacity-50"
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-sm">
                      Usage hours
                      <input
                        className="mt-1 w-full rounded border px-2 py-1.5"
                        value={usageHours}
                        onChange={(e) => setUsageHours(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        agreementAction('usage', {
                          hours: Number(usageHours) || 0,
                          approved: true,
                        })
                      }
                      className="self-end rounded border px-2 py-1.5 text-xs"
                    >
                      Record approved usage
                    </button>
                  </div>
                  <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-amber-950">
                      Accrual posts Dr Expense / Cr Accrued liability (ACCRUE policy only).
                    </p>
                    <label className="block text-sm">
                      Amount
                      <input
                        className="mt-1 w-full rounded border px-2 py-1.5"
                        value={accrualAmount}
                        onChange={(e) => setAccrualAmount(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm">
                      Expense account
                      <input
                        className="mt-1 w-full rounded border px-2 py-1.5"
                        value={expenseAccountId}
                        onChange={(e) => setExpenseAccountId(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm">
                      Accrued liability account
                      <input
                        className="mt-1 w-full rounded border px-2 py-1.5"
                        value={accruedLiabilityAccountId}
                        onChange={(e) => setAccruedLiabilityAccountId(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        agreementAction('accrue', {
                          periodStart: a.startAt,
                          periodEnd: a.endAt,
                          amount: Number(accrualAmount) || 0,
                          expenseAccountId,
                          accruedLiabilityAccountId,
                        })
                      }
                      className="rounded bg-amber-700 px-3 py-1.5 text-xs text-white disabled:opacity-50"
                    >
                      Post accrual
                    </button>
                  </div>
                  <div className="space-y-2 rounded border border-slate-200 p-3">
                    <p className="text-xs text-gray-600">
                      Clear accrual vs supplier bill (Dr Accrued / Cr Expense) before/with bill expense —
                      expense recognised once.
                    </p>
                    <label className="block text-sm">
                      Accrual ID
                      <input
                        className="mt-1 w-full rounded border px-2 py-1.5"
                        value={accrualId}
                        onChange={(e) => setAccrualId(e.target.value)}
                        placeholder={a.accruals?.[0]?.id || ''}
                      />
                    </label>
                    <label className="block text-sm">
                      Supplier bill ID
                      <input
                        className="mt-1 w-full rounded border px-2 py-1.5"
                        value={supplierBillId}
                        onChange={(e) => setSupplierBillId(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        agreementAction('clear-accrual', {
                          accrualId: accrualId || a.accruals?.[0]?.id,
                          supplierBillId,
                          expenseAccountId,
                          accruedLiabilityAccountId,
                        })
                      }
                      className="rounded border px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      Clear accrual vs bill
                    </button>
                    {(a.accruals || []).length ? (
                      <ul className="text-xs text-gray-500">
                        {a.accruals.map((ac) => (
                          <li key={ac.id}>
                            {ac.id.slice(0, 8)}… {ac.status} {money(ac.amount)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
