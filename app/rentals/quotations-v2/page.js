'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PermissionGuard from '@/components/PermissionGuard';

function money(n) {
  if (n == null) return '—';
  return `MWK ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function QuotationsV2Page() {
  const [quotations, setQuotations] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [unitRate, setUnitRate] = useState('');

  const load = useCallback(async () => {
    const [qRes, rRes] = await Promise.all([
      fetch('/api/rentals-v2/quotations'),
      fetch('/api/rentals-v2/reservations'),
    ]);
    const qData = await qRes.json().catch(() => ({}));
    const rData = await rRes.json().catch(() => ({}));
    if (!qRes.ok) throw new Error(qData.error || 'Failed quotations');
    if (!rRes.ok) throw new Error(rData.error || 'Failed reservations');
    setQuotations(qData.quotations || []);
    setReservations(rData.reservations || []);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  const createQuote = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/rentals-v2/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          startAt,
          endAt,
          lines: [{ rentalAssetId: assetId, unitRate: Number(unitRate) || 0, quantity: 1 }],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Create failed');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const quoteAction = async (id, action) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/rentals-v2/quotations/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reservationAction = async (id, action) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/rentals-v2/reservations/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      await load();
      if (action === 'convert' && data.contract?.id) {
        window.location.href = `/rentals/contracts-v2`;
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PermissionGuard permissions={['rentals.view']}>
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-4 text-sm text-gray-500">
          <Link href="/rentals" className="text-blue-600 hover:underline">
            Rental &amp; Hiring
          </Link>
          <span className="mx-2">/</span>
          Quotations &amp; reservations
        </div>
        <h1 className="text-2xl font-semibold">Quotations &amp; reservations</h1>
        <p className="mt-1 text-sm text-gray-600">
          No journals on quote/hold. Convert reservation → draft contract on{' '}
          <Link href="/rentals/contracts-v2" className="text-blue-600 underline">
            Contracts V2
          </Link>
          .
        </p>
        {error ? (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase text-gray-500">New quotation</h2>
            <input
              className="w-full rounded border px-2 py-1.5 text-sm"
              placeholder="Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            <input
              className="w-full rounded border px-2 py-1.5 text-sm"
              placeholder="Asset ID"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="datetime-local"
                className="rounded border px-2 py-1.5 text-sm"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
              <input
                type="datetime-local"
                className="rounded border px-2 py-1.5 text-sm"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
            <input
              className="w-full rounded border px-2 py-1.5 text-sm"
              placeholder="Unit rate"
              value={unitRate}
              onChange={(e) => setUnitRate(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={createQuote}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Create quotation
            </button>

            <h2 className="pt-4 text-sm font-semibold uppercase text-gray-500">Quotations</h2>
            <ul className="divide-y rounded border">
              {quotations.map((q) => (
                <li key={q.id} className="px-3 py-2 text-sm">
                  <div className="font-medium">
                    {q.quotationNumber} · {q.status}
                  </div>
                  <div className="text-xs text-gray-500">{money(q.totalEstimate)}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {['send', 'accept', 'reserve', 'reject'].map((a) => (
                      <button
                        key={a}
                        type="button"
                        disabled={busy}
                        onClick={() => quoteAction(q.id, a)}
                        className="rounded border px-2 py-0.5 text-xs capitalize"
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">Reservations</h2>
            <ul className="divide-y rounded border">
              {reservations.map((r) => (
                <li key={r.id} className="px-3 py-2 text-sm">
                  <div className="font-medium">
                    {r.reservationNumber} · {r.status}
                  </div>
                  <div className="mt-1 flex gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => reservationAction(r.id, 'convert')}
                      className="rounded border px-2 py-0.5 text-xs"
                    >
                      convert → contract
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => reservationAction(r.id, 'release')}
                      className="rounded border px-2 py-0.5 text-xs"
                    >
                      release
                    </button>
                  </div>
                </li>
              ))}
              {!reservations.length ? (
                <li className="px-3 py-4 text-sm text-gray-500">No reservations</li>
              ) : null}
            </ul>
          </section>
        </div>
      </div>
    </PermissionGuard>
  );
}
