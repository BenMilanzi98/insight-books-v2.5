'use client';

import { useEffect, useState } from 'react';
import { Loader, Lock, Unlock, X } from 'lucide-react';

function formatCurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'MK 0.00';
  return `MK ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Hard-gate modals for POS till open / close.
 */
export default function PosTillGateModals({
  cashDayState,
  loadingState,
  actionLoading,
  onOpenTill,
  onCloseTill,
  showClosePrompt,
  onDismissClosePrompt,
  formatMoney = formatCurrency,
}) {
  const suggested = Number(
    cashDayState?.fundingPreview?.cashAvailable ??
      cashDayState?.suggestedOpeningBalance ??
      cashDayState?.liveCashBalance ??
      0
  );
  const [openingBalance, setOpeningBalance] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (cashDayState?.requiresTillOpen) {
      setOpeningBalance('');
      setError(null);
    }
  }, [cashDayState?.requiresTillOpen, cashDayState?.businessDate]);

  const requiresOpen = Boolean(cashDayState?.requiresTillOpen);
  const registerOpen = Boolean(cashDayState?.tillOpen);

  const handleOpen = async () => {
    setError(null);
    const trimmed = String(openingBalance).trim();
    if (trimmed === '') {
      try {
        await onOpenTill(0);
      } catch (e) {
        setError(e?.message || 'Could not open till');
      }
      return;
    }
    const n = Number(trimmed.replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 0) {
      setError('Enter a valid non-negative opening balance.');
      return;
    }
    try {
      await onOpenTill(n);
    } catch (e) {
      setError(e?.message || 'Could not open till');
    }
  };

  if (loadingState && !cashDayState) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
        <div className="rounded-2xl bg-white px-6 py-5 shadow-xl flex items-center gap-3 text-slate-700">
          <Loader className="h-5 w-5 animate-spin text-blue-600" />
          Checking till status…
        </div>
      </div>
    );
  }

  return (
    <>
      {requiresOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-till-open-title"
          >
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <Unlock className="h-5 w-5" />
                <h2 id="pos-till-open-title" className="text-lg font-semibold">
                  Open till to start selling
                </h2>
              </div>
              <p className="mt-1 text-sm text-blue-100">
                Business date {cashDayState?.businessDate || 'today'} · Sales are blocked until the till is open.
              </p>
            </div>
            <div className="px-5 py-5 space-y-4">
              {cashDayState?.tillClosed && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Today&apos;s till was closed. You can reopen it and optionally fund float again.
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Opening balance (cash float)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0 (optional)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Optional. Suggested from Cash: {formatMoney(suggested)}. Funded from Cash first;
                  shortfall from Owner Capital.
                </p>
              </div>
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <button
                type="button"
                onClick={handleOpen}
                disabled={actionLoading}
                className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5"
              >
                {actionLoading ? 'Opening…' : cashDayState?.tillClosed ? 'Reopen till' : 'Open till'}
              </button>
            </div>
          </div>
        </div>
      )}

      {registerOpen && showClosePrompt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-till-close-title"
          >
            <div className="flex items-start justify-between bg-slate-800 px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                <h2 id="pos-till-close-title" className="text-lg font-semibold">
                  Close till for the day
                </h2>
              </div>
              <button
                type="button"
                onClick={onDismissClosePrompt}
                className="rounded-full p-1 hover:bg-white/10"
                aria-label="Dismiss"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-3 text-sm text-slate-700">
              <p>
                Closing sweeps the Till Float balance back to Cash and records the day.
                If you leave the till open, it will <strong>auto-close after midnight</strong> (Africa/Blantyre).
              </p>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-slate-500">Opening</p>
                  <p className="font-semibold">{formatMoney(cashDayState?.metrics?.openingBalance)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total sales</p>
                  <p className="font-semibold">{formatMoney(cashDayState?.metrics?.totalSales)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Cash sales</p>
                  <p className="font-semibold">{formatMoney(cashDayState?.metrics?.totalCashSales)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Closing (est.)</p>
                  <p className="font-semibold">{formatMoney(cashDayState?.metrics?.closingBalance)}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onDismissClosePrompt}
                  className="flex-1 rounded-lg border border-slate-300 py-2.5 font-medium hover:bg-slate-50"
                >
                  Keep open
                </button>
                <button
                  type="button"
                  onClick={onCloseTill}
                  disabled={actionLoading}
                  className="flex-1 rounded-lg bg-slate-900 text-white py-2.5 font-semibold disabled:opacity-50"
                >
                  {actionLoading ? 'Closing…' : 'Close till now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
