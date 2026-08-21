'use client';
import { tt } from '@/lib/i18n/runtime';
import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Toast from '@/components/ui/Toast';
import FormField, { Input, Select } from '@/components/ui/FormField';
import { guidedOutstandingLabel, guidedStatementStatusLabel } from '@/lib/bankReconciliation/domain/guidedLabels.js';
import {
  buildAdjustBody,
  canCreateTransactionForStatement,
  formatMinorAsAmount,
  listOffsetAccounts,
  offsetAccountTypeForResolveType,
  postReconAdjustment,
  unmatchedStatementLines,
  resolveUnmatchedEmptyCopy,
} from './reconApi.js';

function dateParam(value) {
  if (!value) return undefined;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function formatDate(value) {
  return dateParam(value) || '';
}

function formatStatementAmount(row) {
  if (row?.signedAmount != null && row.signedAmount !== '') return String(row.signedAmount);
  if (row?.signedAmountMinor != null) return formatMinorAsAmount(row.signedAmountMinor);
  return '';
}

function formatBookAmount(row) {
  if (row?.amount != null && row.amount !== '') return String(row.amount);
  if (row?.amountMinor != null) return formatMinorAsAmount(row.amountMinor);
  return '';
}

function accountLabel(account) {
  const code = account?.accountCode || account?.code || '';
  const name = account?.accountName || account?.name || '';
  return [code, name].filter(Boolean).join(' ') || account?.id || '';
}

function emptyForm(statement) {
  return {
    resolveType: 'EXPENSE',
    offsetAccountId: '',
    description: statement?.description ? String(statement.description) : '',
  };
}

export default function ResolveStep({ reconciliationId, workspace, onRefresh, readOnly = false }) {
  const statements = unmatchedStatementLines(workspace?.statements);
  const outstanding = Array.isArray(workspace?.outstanding) ? workspace.outstanding : [];

  const [creatingId, setCreatingId] = useState(null);
  const [form, setForm] = useState(() => emptyForm(null));
  const [accounts, setAccounts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const creatingStatement = useMemo(
    () => statements.find((row) => row.id === creatingId) || null,
    [statements, creatingId]
  );

  const coaType = offsetAccountTypeForResolveType(form.resolveType);

  useEffect(() => {
    if (!creatingId) {
      setAccounts([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await listOffsetAccounts(coaType);
        if (cancelled) return;
        setAccounts(Array.isArray(data?.accounts) ? data.accounts : []);
      } catch (err) {
        if (!cancelled) {
          setAccounts([]);
          setError(err.message || 'Could not load offset accounts.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [creatingId, coaType]);

  const openForm = (statement) => {
    if (readOnly) return;
    setError('');
    setCreatingId(statement.id);
    setForm(emptyForm(statement));
  };

  const closeForm = () => {
    setCreatingId(null);
    setForm(emptyForm(null));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (readOnly) return;
    setError('');
    if (!reconciliationId) {
      setError('Start a reconciliation before creating a transaction.');
      return;
    }
    if (!creatingStatement || !canCreateTransactionForStatement(creatingStatement)) {
      setError('Select an unmatched bank line.');
      return;
    }
    if (!form.offsetAccountId) {
      setError('Choose an offset account.');
      return;
    }
    setBusy(true);
    try {
      await postReconAdjustment(
        buildAdjustBody({
          reconciliationId,
          statement: creatingStatement,
          resolveType: form.resolveType,
          offsetAccountId: form.offsetAccountId,
          description: form.description.trim() || creatingStatement.description,
        })
      );
      closeForm();
      if (reconciliationId) await onRefresh?.(reconciliationId);
      setToast(tt('Transaction created.'));
    } catch (err) {
      setError(err.message || 'Could not create the transaction.');
    } finally {
      setBusy(false);
    }
  };

  if (!reconciliationId) {
    return (
      <p className="text-sm text-gray-600">
        {tt('Start or continue a reconciliation on the Statement step before resolving unmatched lines.')}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="recon-resolve-unmatched-heading" className="min-w-0">
        <h2 id="recon-resolve-unmatched-heading" className="mb-2 text-sm font-semibold text-gray-900">
          {tt('Unmatched bank')}
        </h2>
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">{tt('Unmatched bank statement lines')}</caption>
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">{tt('Date')}</th>
                <th className="px-3 py-2 font-medium">{tt('Description')}</th>
                <th className="px-3 py-2 font-medium text-right">{tt('Amount')}</th>
                <th className="px-3 py-2 font-medium">{tt('Status')}</th>
                <th className="px-3 py-2 font-medium">{tt('Action')}</th>
              </tr>
            </thead>
            <tbody>
              {statements.length ? (
                statements.map((row) => {
                  const label = guidedStatementStatusLabel(row.matchingStatus);
                  const open = creatingId === row.id;
                  return (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="whitespace-nowrap px-3 py-2">{formatDate(row.transactionDate)}</td>
                      <td className="px-3 py-2">
                        {row.description || ''}
                        {row.reference ? ` · ${row.reference}` : ''}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {formatStatementAmount(row)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950">
                          {tt(label)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          size="compact"
                          variant={open ? 'secondary' : 'primary'}
                          disabled={busy || readOnly}
                          onClick={() => (open ? closeForm() : openForm(row))}
                        >
                          {tt('Create Transaction')}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-gray-500">
                    {tt(resolveUnmatchedEmptyCopy(workspace?.statements))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {creatingStatement ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4"
          aria-labelledby="recon-resolve-form-heading"
        >
          <h3 id="recon-resolve-form-heading" className="text-sm font-semibold text-gray-900">
            {tt('Create Transaction')}
          </h3>
          <p className="text-sm text-gray-600">
            {creatingStatement.description || creatingStatement.id} · {formatStatementAmount(creatingStatement)}
          </p>
          <FormField label="Type" htmlFor="recon-resolve-type" required>
            {({ id, ...a11y }) => (
              <Select
                id={id}
                value={form.resolveType}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    resolveType: event.target.value,
                    offsetAccountId: '',
                  }))
                }
                disabled={busy || readOnly}
                {...a11y}
              >
                <option value="EXPENSE">{tt('Expense (Bank charge)')}</option>
                <option value="MONEY_IN">{tt('Money in (Interest / other income)')}</option>
              </Select>
            )}
          </FormField>
          <FormField label="Offset account" htmlFor="recon-resolve-offset" required>
            {({ id, ...a11y }) => (
              <Select
                id={id}
                value={form.offsetAccountId}
                onChange={(event) => setForm((prev) => ({ ...prev, offsetAccountId: event.target.value }))}
                disabled={busy || readOnly}
                {...a11y}
              >
                <option value="">{tt('Select account')}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {accountLabel(account)}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Description" htmlFor="recon-resolve-description">
            {({ id, ...a11y }) => (
              <Input
                id={id}
                type="text"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                disabled={busy || readOnly}
                {...a11y}
              />
            )}
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={busy} disabled={!form.offsetAccountId || readOnly}>
              {tt('Create Transaction')}
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={closeForm}>
              {tt('Cancel')}
            </Button>
          </div>
        </form>
      ) : null}

      <section aria-labelledby="recon-resolve-outstanding-heading" className="min-w-0">
        <h2 id="recon-resolve-outstanding-heading" className="mb-2 text-sm font-semibold text-gray-900">
          {tt(guidedOutstandingLabel())}
        </h2>
        <p className="mb-2 text-sm text-gray-600">
          {tt('Leave as-is is OK. Outstanding books can remain unmatched until a later period.')}
        </p>
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">{tt('Outstanding book items')}</caption>
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">{tt('Date')}</th>
                <th className="px-3 py-2 font-medium">{tt('Description')}</th>
                <th className="px-3 py-2 font-medium">{tt('Type')}</th>
                <th className="px-3 py-2 font-medium text-right">{tt('Amount')}</th>
              </tr>
            </thead>
            <tbody>
              {outstanding.length ? (
                outstanding.map((row) => (
                  <tr key={row.id || row.journalEntryLineId} className="border-t border-gray-100">
                    <td className="whitespace-nowrap px-3 py-2">{formatDate(row.itemDate || row.transactionDate)}</td>
                    <td className="px-3 py-2">{row.description || ''}</td>
                    <td className="whitespace-nowrap px-3 py-2">{row.itemType || ''}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatBookAmount(row)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-gray-500">
                    {tt('No outstanding book items.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Toast show={Boolean(toast)} type="success" message={toast} onClose={() => setToast('')} />
    </div>
  );
}
