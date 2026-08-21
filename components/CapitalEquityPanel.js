'use client';
import { tt } from '@/lib/i18n/runtime';

/**
 * Capital Account — equity core (owners, direct-post, history) + transfers link.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Landmark, Users, Plus, RefreshCw, AlertCircle, CheckCircle2, ArrowRightLeft } from 'lucide-react';
import PosStylePageHeader, { PosStyleHeaderButton } from '@/components/shell/PosStylePageHeader';
import PosStylePanel from '@/components/shell/PosStylePanel';

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

const RECORD_TYPES = [
  { value: 'CAPITAL_CONTRIBUTION', label: 'Capital contribution', needsBank: true, needsOwner: true },
  { value: 'OWNER_DRAWING', label: 'Owner drawing', needsBank: true, needsOwner: true },
  { value: 'DECLARE_DIVIDEND', label: 'Declare dividend', needsBank: false, needsOwner: true },
  { value: 'PAY_DIVIDEND', label: 'Pay dividend', needsBank: true, needsOwner: false },
];

export default function CapitalEquityPanel({ onboarding = false }) {
  const [owners, setOwners] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [declarations, setDeclarations] = useState([]);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [ownerForm, setOwnerForm] = useState({
    partyName: '',
    relationshipType: 'OWNER',
  });
  const [txForm, setTxForm] = useState({
    recordType: 'CAPITAL_CONTRIBUTION',
    relationshipId: '',
    amount: '',
    transactionDate: new Date().toISOString().slice(0, 10),
    bankAccountId: '',
    declarationId: '',
    description: '',
  });

  const recordMeta = useMemo(
    () => RECORD_TYPES.find((t) => t.value === txForm.recordType) || RECORD_TYPES[0],
    [txForm.recordType]
  );

  const bankOptions = useMemo(
    () => (paymentAccounts || []).filter((a) => a.isActive !== false && a.coaAccountId),
    [paymentAccounts]
  );

  const unpaidDeclarations = useMemo(
    () =>
      (declarations || []).filter((d) => {
        if (!d.journalEntryId) return false;
        return (d.allocations || []).some((a) => (a.netAmountMinor || 0) > (a.paidAmountMinor || 0));
      }),
    [declarations]
  );

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [, o, t, d, pa] = await Promise.all([
        api('/api/equity-management/config').catch(() => null),
        api('/api/equity-management/owners'),
        api('/api/equity-management/transactions'),
        api('/api/equity-management/dividends').catch(() => ({ declarations: [] })),
        api('/api/payment-accounts').catch(() => ({ paymentAccounts: [] })),
      ]);
      setOwners(o.owners || []);
      setTransactions(t.transactions || []);
      setDeclarations(d.declarations || []);
      setPaymentAccounts(pa.paymentAccounts || pa.accounts || []);
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

  const createOwner = async () => {
    setBusy(true);
    setSuccess('');
    try {
      await api('/api/equity-management/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ownerForm),
      });
      setOwnerForm({ partyName: '', relationshipType: 'OWNER' });
      setSuccess('Owner created.');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const postRecord = async () => {
    setBusy(true);
    setSuccess('');
    setError('');
    try {
      const type = txForm.recordType;
      if (recordMeta.needsOwner && !txForm.relationshipId && type !== 'PAY_DIVIDEND') {
        throw new Error('Select an owner.');
      }
      if (!txForm.amount && type !== 'PAY_DIVIDEND') {
        throw new Error('Enter an amount.');
      }
      if (recordMeta.needsBank && !txForm.bankAccountId) {
        throw new Error('Select a bank / cash account.');
      }

      if (type === 'DECLARE_DIVIDEND') {
        await api('/api/equity-management/dividends', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'declare',
            totalAmount: txForm.amount,
            declarationDate: txForm.transactionDate,
            relationshipId: txForm.relationshipId,
            description: txForm.description,
          }),
        });
        setSuccess('Dividend declared and posted.');
      } else if (type === 'PAY_DIVIDEND') {
        if (!txForm.declarationId) throw new Error('Select a dividend to pay.');
        await api('/api/equity-management/dividends', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'payDeclaration',
            declarationId: txForm.declarationId,
            bankAccountId: txForm.bankAccountId,
            paymentDate: txForm.transactionDate,
          }),
        });
        setSuccess('Dividend payment posted.');
      } else {
        await api('/api/equity-management/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionType: type,
            relationshipId: txForm.relationshipId,
            amount: txForm.amount,
            transactionDate: txForm.transactionDate,
            bankAccountId: txForm.bankAccountId,
            description: txForm.description || undefined,
            post: true,
          }),
        });
        setSuccess(type === 'OWNER_DRAWING' ? 'Drawing posted.' : 'Contribution posted.');
      }

      setTxForm((f) => ({
        ...f,
        amount: '',
        description: '',
        declarationId: '',
      }));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mx-auto max-w-5xl space-y-6">
        <PosStylePageHeader
          title={tt('Capital Account')}
          description="Owners, capital contributions, drawings, and dividends. Posts to the ledger immediately. Use Transfers to move funds between payment accounts."
          actions={
            <PosStyleHeaderButton type="button" onClick={load} disabled={busy}>
              <RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
              {tt('Refresh')}
            </PosStyleHeaderButton>
          }
        />

        {onboarding ? (
          <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            {tt('Add an owner and post an opening capital contribution to finish setup.')}
          </div>
        ) : null}

        {error ? (
          <div className="flex gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        ) : null}
        {success ? (
          <div className="flex gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
          </div>
        ) : null}

        <PosStylePanel className="flex flex-wrap items-center justify-between gap-3 p-4" as="section">
          <div className="flex items-start gap-3">
            <ArrowRightLeft className="mt-0.5 h-5 w-5 text-slate-600" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold">{tt('Transfers')}</h2>
              <p className="text-xs text-slate-500">
                Move funds between bank/cash accounts and view transfer history.
              </p>
            </div>
          </div>
          <Link
            href="/capital-account/transfers"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            {tt('Open transfers')}
          </Link>
        </PosStylePanel>

        <section className="grid gap-4 lg:grid-cols-2">
          <PosStylePanel className="p-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" /> {tt('Owners')}
            </h2>
            <div className="mt-3 space-y-2">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder={tt('Name')}
                value={ownerForm.partyName}
                onChange={(e) => setOwnerForm((f) => ({ ...f, partyName: e.target.value }))}
              />
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={ownerForm.relationshipType}
                onChange={(e) => setOwnerForm((f) => ({ ...f, relationshipType: e.target.value }))}
              >
                <option value="OWNER">{tt('Owner')}</option>
                <option value="PARTNER">{tt('Partner')}</option>
                <option value="SHAREHOLDER">{tt('Shareholder')}</option>
              </select>
              <button
                type="button"
                onClick={createOwner}
                disabled={busy || !ownerForm.partyName.trim()}
                className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                <Plus className="mr-1 h-4 w-4" /> {tt('Add owner')}
              </button>
            </div>
          </PosStylePanel>
          <PosStylePanel className="p-4">
            <h2 className="text-sm font-semibold">{tt('Register')}</h2>
            <ul className="mt-2 max-h-56 overflow-auto text-sm divide-y">
              {owners.length === 0 ? (
                <li className="py-3 text-slate-500">{tt('No owners yet.')}</li>
              ) : (
                owners.map((o) => (
                  <li key={o.id} className="py-2 flex justify-between gap-2">
                    <span>
                      {o.partyName}{' '}
                      <span className="text-xs text-slate-500">({o.relationshipType})</span>
                    </span>
                    <span className="text-xs font-medium text-slate-600">{o.ownershipStatus}</span>
                  </li>
                ))
              )}
            </ul>
          </PosStylePanel>
        </section>

        <PosStylePanel className="space-y-3 p-4" as="section">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Landmark className="h-4 w-4" /> {tt('Record')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-slate-500">
              {tt('Type')}
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={txForm.recordType}
                onChange={(e) => setTxForm((f) => ({ ...f, recordType: e.target.value }))}
              >
                {RECORD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {tt(t.label)}
                  </option>
                ))}
              </select>
            </label>

            {txForm.recordType === 'PAY_DIVIDEND' ? (
              <label className="block text-xs text-slate-500">
                {tt('Dividend')}
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={txForm.declarationId}
                  onChange={(e) => setTxForm((f) => ({ ...f, declarationId: e.target.value }))}
                >
                  <option value="">{tt('Select unpaid dividend…')}</option>
                  {unpaidDeclarations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.declarationNumber} · {d.totalAmount}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block text-xs text-slate-500">
                {tt('Owner')}
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={txForm.relationshipId}
                  onChange={(e) => setTxForm((f) => ({ ...f, relationshipId: e.target.value }))}
                >
                  <option value="">{tt('Select owner…')}</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.partyName}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {txForm.recordType !== 'PAY_DIVIDEND' ? (
              <label className="block text-xs text-slate-500">
                {tt('Amount')}
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={txForm.amount}
                  onChange={(e) => setTxForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </label>
            ) : null}

            <label className="block text-xs text-slate-500">
              {tt('Date')}
              <input
                type="date"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={txForm.transactionDate}
                onChange={(e) => setTxForm((f) => ({ ...f, transactionDate: e.target.value }))}
              />
            </label>

            {recordMeta.needsBank ? (
              <label className="block text-xs text-slate-500 sm:col-span-2">
                {tt('Bank / cash account')}
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={txForm.bankAccountId}
                  onChange={(e) => setTxForm((f) => ({ ...f, bankAccountId: e.target.value }))}
                >
                  <option value="">{tt('Select account…')}</option>
                  {bankOptions.map((a) => (
                    <option key={a.id} value={a.coaAccountId}>
                      {a.name || a.accountName || a.type}
                      {a.bankName ? ` · ${a.bankName}` : ''}
                    </option>
                  ))}
                </select>
                {bankOptions.length === 0 ? (
                  <span className="mt-1 block text-amber-700">
                    {tt('No payment accounts linked to Chart of Accounts. Add one under Payment Accounts first.')}
                  </span>
                ) : null}
              </label>
            ) : null}

            <label className="block text-xs text-slate-500 sm:col-span-2">
              {tt('Description (optional)')}
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={txForm.description}
                onChange={(e) => setTxForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={postRecord}
            disabled={busy}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {tt('Post')}
          </button>
        </PosStylePanel>

        <PosStylePanel className="p-4" as="section">
          <h2 className="text-sm font-semibold">{tt('History')}</h2>
          <ul className="mt-2 max-h-96 overflow-auto text-sm divide-y">
            {transactions.length === 0 ? (
              <li className="py-3 text-slate-500">{tt('No transactions yet.')}</li>
            ) : (
              transactions.map((t) => (
                <li key={t.id} className="py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {t.transactionNumber} · {t.transactionType.replace(/_/g, ' ')}
                    </span>
                    <span className="tabular-nums">{t.amount}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {t.transactionDate
                      ? new Date(t.transactionDate).toISOString().slice(0, 10)
                      : '—'}{' '}
                    · {t.accountingStatus || t.status}
                    {t.journalEntryId ? ` · JE ${t.journalEntryId}` : ''}
                  </div>
                </li>
              ))
            )}
          </ul>
        </PosStylePanel>
      </div>
    </div>
  );
}
