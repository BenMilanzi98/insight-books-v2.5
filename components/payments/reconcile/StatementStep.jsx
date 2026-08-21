'use client';
import { tt } from '@/lib/i18n/runtime';
import { useEffect, useState } from 'react';
import FormField, { Input } from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import {
  buildCreateReconciliationBody,
  createReconciliation,
  findOpenReconciliation,
  listReconciliations,
} from './reconApi.js';

function dateInput(value) {
  if (!value) return '';
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}

function moneyInput(value) {
  if (value == null || value === '') return '';
  return String(value);
}

export default function StatementStep({
  paymentAccountId,
  reconciliationId,
  workspace,
  onActivated,
}) {
  const recon = workspace?.reconciliation;
  const [periodStart, setPeriodStart] = useState(dateInput(recon?.periodStart));
  const [periodEnd, setPeriodEnd] = useState(dateInput(recon?.periodEnd || recon?.statementDate));
  const [opening, setOpening] = useState(moneyInput(recon?.statementOpeningBalance));
  const [closing, setClosing] = useState(moneyInput(recon?.statementClosingBalance));
  const [openDraft, setOpenDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!recon) return;
    setPeriodStart(dateInput(recon.periodStart));
    setPeriodEnd(dateInput(recon.periodEnd || recon.statementDate));
    setOpening(moneyInput(recon.statementOpeningBalance));
    setClosing(moneyInput(recon.statementClosingBalance));
  }, [recon]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!paymentAccountId) {
        setChecking(false);
        return;
      }
      setChecking(true);
      try {
        const data = await listReconciliations(paymentAccountId);
        const open = findOpenReconciliation(data);
        if (cancelled) return;
        setOpenDraft(open);
        if (open && !reconciliationId) {
          setPeriodStart(dateInput(open.periodStart));
          setPeriodEnd(dateInput(open.periodEnd || open.statementDate));
          setOpening(moneyInput(open.statementOpeningBalance));
          setClosing(moneyInput(open.statementClosingBalance));
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paymentAccountId, reconciliationId]);

  const continueDraft = (id) => {
    setError('');
    setNotice('');
    onActivated?.(id);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (!periodEnd) throw new Error('Period end is required.');
      if (closing === '' || closing == null) throw new Error('Closing balance is required.');

      const listed = await listReconciliations(paymentAccountId);
      const open = findOpenReconciliation(listed);
      if (open) {
        setOpenDraft(open);
        setNotice(
          'An open reconciliation already exists. Continue that draft instead of creating a parallel one.'
        );
        return;
      }

      const created = await createReconciliation(
        buildCreateReconciliationBody({
          paymentAccountId,
          periodStart: periodStart || undefined,
          periodEnd,
          statementOpeningBalance: opening,
          statementClosingBalance: closing,
        })
      );
      const id = created?.reconciliation?.id;
      if (!id) throw new Error('Reconciliation was created but no id was returned.');
      onActivated?.(id);
    } catch (err) {
      setError(err.message || 'Could not start reconciliation.');
    } finally {
      setBusy(false);
    }
  };

  const activeId = reconciliationId || null;
  const canContinue = Boolean(openDraft?.id) && !activeId;

  return (
    <div className="space-y-4">
      {checking ? (
        <p className="text-sm text-gray-500">{tt('Checking for an open draft…')}</p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
          {tt(notice)}
        </p>
      ) : null}

      {canContinue ? (
        <div className="flex flex-col gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-950">{tt('Open reconciliation found')}</p>
            <p className="text-sm text-indigo-900/80">
              {tt('Continue that draft. A second open reconciliation will not be created.')}
            </p>
          </div>
          <Button type="button" onClick={() => continueDraft(openDraft.id)}>
            {tt('Continue')}
          </Button>
        </div>
      ) : null}

      {activeId ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
          {tt('Using reconciliation')} {activeId}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <FormField label="Period start" htmlFor="recon-period-start">
          {({ id, ...a11y }) => (
            <Input
              id={id}
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              disabled={Boolean(activeId)}
              {...a11y}
            />
          )}
        </FormField>
        <FormField label="Period end" htmlFor="recon-period-end" required>
          {({ id, ...a11y }) => (
            <Input
              id={id}
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              required
              disabled={Boolean(activeId)}
              {...a11y}
            />
          )}
        </FormField>
        <FormField label="Opening balance" htmlFor="recon-opening">
          {({ id, ...a11y }) => (
            <Input
              id={id}
              type="number"
              step="0.01"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              disabled={Boolean(activeId)}
              {...a11y}
            />
          )}
        </FormField>
        <FormField label="Closing balance" htmlFor="recon-closing" required>
          {({ id, ...a11y }) => (
            <Input
              id={id}
              type="number"
              step="0.01"
              value={closing}
              onChange={(e) => setClosing(e.target.value)}
              required
              disabled={Boolean(activeId)}
              {...a11y}
            />
          )}
        </FormField>
        <div className="sm:col-span-2">
          <Button type="submit" loading={busy} disabled={Boolean(activeId) || checking}>
            {tt('Start reconciliation')}
          </Button>
        </div>
      </form>
    </div>
  );
}
