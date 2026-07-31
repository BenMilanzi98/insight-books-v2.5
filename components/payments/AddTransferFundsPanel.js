'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRightLeft, Check, X } from 'lucide-react';
import { formatPaymentAccountOptionLabel } from '@/lib/paymentAccountFunds';

function formatMwk(amount) {
  const n = Math.max(0, Number(amount) || 0);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Inline panel to fund a payment account (capital → destination, or payment → payment).
 */
export default function AddTransferFundsPanel({
  destinationAccountId,
  destinationAccountName = '',
  shortfall = 0,
  requiredAmount = 0,
  availableAmount = 0,
  paymentAccounts = [],
  onSuccess,
  onCancel,
}) {
  const [sourceMode, setSourceMode] = useState('capital'); // capital | payment
  const [capitalAccount, setCapitalAccount] = useState(null);
  const [sourcePaymentAccountId, setSourcePaymentAccountId] = useState('');
  const [amount, setAmount] = useState(String(shortfall > 0 ? shortfall : ''));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [loadingCapital, setLoadingCapital] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setAmount(String(shortfall > 0 ? shortfall : ''));
  }, [shortfall, destinationAccountId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCapital(true);
      try {
        const res = await fetch('/api/capital-account', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to load capital account');
        if (!cancelled) setCapitalAccount(data.capitalAccount || data);
      } catch (err) {
        if (!cancelled) {
          setCapitalAccount(null);
          setError(err.message || 'Failed to load capital account');
        }
      } finally {
        if (!cancelled) setLoadingCapital(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const otherPaymentAccounts = paymentAccounts.filter(
    (a) => a.id !== destinationAccountId && a.isActive !== false
  );

  const sourceBalance =
    sourceMode === 'capital'
      ? Number(capitalAccount?.balance) || 0
      : Number(otherPaymentAccounts.find((a) => a.id === sourcePaymentAccountId)?.balance) || 0;

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError('');
    setSuccess('');

    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid transfer amount.');
      return;
    }
    if (!destinationAccountId) {
      setError('Destination payment account is missing.');
      return;
    }

    let sourceAccount = null;
    if (sourceMode === 'capital') {
      sourceAccount = capitalAccount?.id;
      if (!sourceAccount) {
        setError('Capital account not found. Add owner capital first from Capital Account.');
        return;
      }
    } else {
      sourceAccount = sourcePaymentAccountId;
      if (!sourceAccount) {
        setError('Select a source payment account.');
        return;
      }
    }

    if (amt > sourceBalance + 0.009) {
      setError(
        `Insufficient balance in source. Available: MWK ${formatMwk(sourceBalance)}, Required: MWK ${formatMwk(amt)}`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: amt,
          paymentDate: date,
          type: 'transfer',
          sourceAccount,
          destinationAccount: destinationAccountId,
          reference: `FUND-${Date.now()}`,
          notes:
            description ||
            `Fund ${destinationAccountName || 'payment account'} for expense/purchase (shortfall MWK ${formatMwk(shortfall)})`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Transfer failed');
      }
      setSuccess(`Transferred MWK ${formatMwk(amt)} to ${destinationAccountName || 'account'}.`);
      setTimeout(() => {
        onSuccess?.({ amount: amt, destinationAccountId });
      }, 700);
    } catch (err) {
      setError(err.message || 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/80 p-3 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-amber-950 flex items-center gap-1.5">
            <ArrowRightLeft className="h-4 w-4" />
            Insufficient funds — add / transfer
          </h4>
          <p className="mt-1 text-xs text-amber-900">
            {destinationAccountName || 'Selected account'} has MWK {formatMwk(availableAmount)} but
            this payment needs MWK {formatMwk(requiredAmount)} (shortfall MWK {formatMwk(shortfall)}
            ). Transfer funds in, then continue.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded p-1 text-amber-800 hover:bg-amber-100"
          disabled={submitting}
          aria-label="Close funding panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSourceMode('capital')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            sourceMode === 'capital'
              ? 'bg-amber-800 text-white'
              : 'bg-white text-amber-900 border border-amber-300'
          }`}
          disabled={submitting}
        >
          From capital account
        </button>
        <button
          type="button"
          onClick={() => setSourceMode('payment')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            sourceMode === 'payment'
              ? 'bg-amber-800 text-white'
              : 'bg-white text-amber-900 border border-amber-300'
          }`}
          disabled={submitting}
        >
          From another payment account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Destination (locked)</label>
          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
            {destinationAccountName || destinationAccountId}
          </div>
        </div>

        {sourceMode === 'capital' ? (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Source — Capital</label>
            <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
              {loadingCapital
                ? 'Loading capital account…'
                : capitalAccount
                  ? `${capitalAccount.code || capitalAccount.accountCode || ''} ${capitalAccount.name || 'Owners Capital'} — Bal: MWK ${formatMwk(capitalAccount.balance)}`
                  : 'Capital account unavailable'}
            </div>
            {!loadingCapital && capitalAccount && Number(capitalAccount.balance) <= 0 && (
              <p className="mt-1 text-xs text-red-700">
                Capital is empty.{' '}
                <a href="/capital-account" className="underline font-medium" target="_blank" rel="noreferrer">
                  Add owner capital
                </a>{' '}
                first, or transfer from another payment account.
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Source payment account</label>
            <select
              value={sourcePaymentAccountId}
              onChange={(e) => setSourcePaymentAccountId(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              disabled={submitting}
              required
            >
              <option value="">Select account with funds</option>
              {otherPaymentAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {formatPaymentAccountOptionLabel(acc)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Amount (MWK)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              disabled={submitting}
              required
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Suggested shortfall: MWK {formatMwk(shortfall)}. Source available: MWK {formatMwk(sourceBalance)}.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              disabled={submitting}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Note (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Why you are funding this account"
            disabled={submitting}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <Check className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || success}
            className="rounded-md bg-amber-800 px-3 py-2 text-sm font-medium text-white hover:bg-amber-900 disabled:opacity-50"
          >
            {submitting ? 'Transferring…' : 'Transfer funds'}
          </button>
        </div>
      </form>
    </div>
  );
}
