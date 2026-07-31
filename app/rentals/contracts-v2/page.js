'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PermissionGuard from '@/components/PermissionGuard';

const ACTIONS = ['submit', 'approve', 'dispatch', 'return', 'invoice', 'cancel'];

function money(n) {
  if (n == null) return '—';
  return `MWK ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function RentalContractsV2Page() {
  const [contracts, setContracts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [unitRate, setUnitRate] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [cashAccountId, setCashAccountId] = useState('');
  const [depositLiabilityAccountId, setDepositLiabilityAccountId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');

  const loadContracts = useCallback(async () => {
    const res = await fetch('/api/rentals-v2/contracts');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to list contracts');
    setContracts(data.contracts || []);
  }, []);

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setDetail(null);
      return;
    }
    const res = await fetch(`/api/rentals-v2/contracts/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load');
    setDetail(data);
  }, []);

  useEffect(() => {
    loadContracts().catch((e) => setError(e.message));
  }, [loadContracts]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId).catch((e) => setError(e.message));
  }, [selectedId, loadDetail]);

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/rentals-v2/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          startAt,
          endAt,
          lines: [
            {
              rentalAssetId: assetId,
              unitRate: Number(unitRate) || 0,
              quantity: Number(quantity) || 1,
              depositAmount: Number(depositAmount) || 0,
            },
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Create failed');
      await loadContracts();
      setSelectedId(data.contract.id);
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
      let body = {};
      if (action === 'deposit') {
        body = {
          amount: Number(depositAmount) || 0,
          receive: true,
          cashAccountId,
          depositLiabilityAccountId,
        };
      }
      const res = await fetch(`/api/rentals-v2/contracts/${selectedId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `${action} failed`);
      await loadDetail(selectedId);
      await loadContracts();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const c = detail?.contract;

  return (
    <PermissionGuard permissions={['rentals.view', 'invoices.view']}>
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-4 text-sm text-gray-500">
          <Link href="/rentals" className="text-indigo-600 hover:underline">
            Rental &amp; Hiring
          </Link>
          <span className="mx-2">/</span>
          Contracts V2
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Outbound rental contracts</h1>
        <p className="mt-1 text-sm text-gray-600">
          Draft → approve → deposit (liability) → dispatch → return → bill. Legacy bookings remain on{' '}
          <Link href="/rentals" className="text-indigo-600 underline">
            Rentals
          </Link>
          .
        </p>

        {error ? (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              New draft
            </h2>
            <label className="block text-sm">
              Client ID
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Rental asset ID
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
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
            <div className="grid grid-cols-3 gap-2">
              <label className="block text-sm">
                Rate
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={unitRate}
                  onChange={(e) => setUnitRate(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Qty
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Deposit
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={create}
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Create draft
            </button>

            <h2 className="pt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Contracts
            </h2>
            <ul className="max-h-80 divide-y overflow-auto rounded border">
              {contracts.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                      selectedId === row.id ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <div className="font-medium">{row.contractNumber}</div>
                    <div className="text-xs text-gray-500">
                      {row.status} · {money(row.totalEstimate)}
                    </div>
                  </button>
                </li>
              ))}
              {!contracts.length ? (
                <li className="px-3 py-4 text-sm text-gray-500">No contracts yet</li>
              ) : null}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Selected
            </h2>
            {!c ? (
              <p className="text-sm text-gray-500">Select a contract</p>
            ) : (
              <>
                <div className="rounded border p-3 text-sm">
                  <div className="font-semibold">{c.contractNumber}</div>
                  <div className="mt-1 text-gray-600">Status: {c.status}</div>
                  <div>Estimate: {money(c.totalEstimate)}</div>
                  <div>Deposit req / recv: {money(c.depositRequired)} / {money(c.depositReceived)}</div>
                  {detail?.reconcile ? (
                    <div className="mt-2 text-xs text-gray-500">
                      Billed {money(detail.reconcile.billed)} · charges{' '}
                      {money(detail.reconcile.approvedCharges)}
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-sm">
                    Cash account ID
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={cashAccountId}
                      onChange={(e) => setCashAccountId(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    Deposit liability ID
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={depositLiabilityAccountId}
                      onChange={(e) => setDepositLiabilityAccountId(e.target.value)}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  {ACTIONS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      disabled={busy}
                      onClick={() => runAction(a)}
                      className="rounded border px-2 py-1 text-xs capitalize hover:bg-gray-50 disabled:opacity-50"
                    >
                      {a}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction('deposit')}
                    className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs hover:bg-amber-100 disabled:opacity-50"
                  >
                    receive deposit
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </PermissionGuard>
  );
}
