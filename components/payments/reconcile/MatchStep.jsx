'use client';
import { tt } from '@/lib/i18n/runtime';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Toast from '@/components/ui/Toast';
import FormField, { Input } from '@/components/ui/FormField';
import { MatchStatus, StatementMatchingStatus } from '@/lib/bankReconciliation/domain/enums.js';
import {
  guidedOutstandingLabel,
  guidedStatementStatusLabel,
} from '@/lib/bankReconciliation/domain/guidedLabels.js';
import {
  acceptSuggestedMatch,
  autoMatchReconciliation,
  buildManualMatchBody,
  canPostManualMatch,
  formatMinorAsAmount,
  listMatchCandidates,
  manualMatchAmountError,
  postManualMatch,
  rejectSuggestedMatch,
  selectedBookSumMinor,
  statementBankAbsMinor,
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
  if (row?.signedAmount != null && row.signedAmount !== '') return String(row.signedAmount);
  if (row?.remainingAmount != null && row.remainingAmount !== '') return String(row.remainingAmount);
  if (row?.amount != null && row.amount !== '') return String(row.amount);
  if (row?.remainingAmountMinor != null) return formatMinorAsAmount(row.remainingAmountMinor);
  if (row?.amountMinor != null) return formatMinorAsAmount(row.amountMinor);
  return '';
}

function isStatementSelectable(row) {
  const status = row?.matchingStatus;
  return (
    status !== StatementMatchingStatus.MATCHED &&
    status !== StatementMatchingStatus.CLASSIFIED &&
    status !== StatementMatchingStatus.EXCLUDED
  );
}

function statusBadgeClass(matchingStatus) {
  const label = guidedStatementStatusLabel(matchingStatus);
  if (label === 'Matched') return 'bg-emerald-100 text-emerald-900';
  return 'bg-amber-100 text-amber-950';
}

function mergeBookRows(candidates, outstanding) {
  const map = new Map();
  for (const row of outstanding || []) {
    if (row?.journalEntryLineId) map.set(row.journalEntryLineId, row);
  }
  for (const row of candidates || []) {
    if (row?.journalEntryLineId) map.set(row.journalEntryLineId, row);
  }
  return [...map.values()];
}

export default function MatchStep({
  paymentAccountId,
  reconciliationId,
  workspace,
  onRefresh,
}) {
  const recon = workspace?.reconciliation;
  const statements = Array.isArray(workspace?.statements) ? workspace.statements : [];
  const matches = Array.isArray(workspace?.matches) ? workspace.matches : [];
  const accountId = paymentAccountId || recon?.paymentAccountId || null;

  const [candidates, setCandidates] = useState([]);
  const [selectedStatementId, setSelectedStatementId] = useState(null);
  const [selectedBookIds, setSelectedBookIds] = useState(() => new Set());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const loadCandidates = useCallback(async () => {
    if (!accountId) return [];
    const data = await listMatchCandidates({
      paymentAccountId: accountId,
      reconciliationId: reconciliationId || undefined,
      startDate: dateParam(recon?.periodStart),
      endDate: dateParam(recon?.periodEnd || recon?.statementDate),
    });
    return Array.isArray(data?.candidates) ? data.candidates : [];
  }, [accountId, reconciliationId, recon?.periodStart, recon?.periodEnd, recon?.statementDate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await loadCandidates();
        if (!cancelled) setCandidates(rows);
      } catch (err) {
        if (!cancelled) {
          setCandidates([]);
          setError(err.message || 'Could not load book candidates.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCandidates]);

  const books = useMemo(() => {
    const outstanding = Array.isArray(workspace?.outstanding) ? workspace.outstanding : [];
    return mergeBookRows(candidates, outstanding);
  }, [candidates, workspace?.outstanding]);

  const selectedStatement = statements.find((row) => row.id === selectedStatementId) || null;
  const selectedBooks = books.filter((row) => selectedBookIds.has(row.journalEntryLineId));
  const selectionReady = Boolean(selectedStatement) && selectedBooks.length > 0;
  const amountsMatch = canPostManualMatch(selectedStatement, selectedBooks);
  const mismatchMessage =
    selectionReady && !amountsMatch ? manualMatchAmountError(selectedStatement, selectedBooks) : '';

  const suggestions = matches.filter((match) => match.status === MatchStatus.SUGGESTED);

  const refreshAll = async () => {
    if (reconciliationId) await onRefresh?.(reconciliationId);
    const rows = await loadCandidates();
    setCandidates(rows);
  };

  const toggleBook = (journalEntryLineId) => {
    setSelectedBookIds((prev) => {
      const next = new Set(prev);
      if (next.has(journalEntryLineId)) next.delete(journalEntryLineId);
      else next.add(journalEntryLineId);
      return next;
    });
  };

  const handleAutoMatch = async () => {
    setError('');
    setBusy(true);
    try {
      if (!reconciliationId) throw new Error('Start a reconciliation before matching.');
      const result = await autoMatchReconciliation(reconciliationId);
      await refreshAll();
      if (result && Object.prototype.hasOwnProperty.call(result, 'matchesCreated')) {
        setToast(`${tt('Auto match created')} ${result.matchesCreated} ${tt('match(es).')}`);
      }
    } catch (err) {
      setError(err.message || 'Auto match failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleManualMatch = async () => {
    setError('');
    if (!reconciliationId) {
      setError('Start a reconciliation before matching.');
      return;
    }
    if (!selectedStatement) {
      setError('Select one statement line.');
      return;
    }
    if (!selectedBooks.length) {
      setError('Select one or more outstanding book lines.');
      return;
    }
    if (!canPostManualMatch(selectedStatement, selectedBooks)) {
      setError(manualMatchAmountError(selectedStatement, selectedBooks));
      return;
    }
    setBusy(true);
    try {
      await postManualMatch(
        buildManualMatchBody({
          reconciliationId,
          statement: selectedStatement,
          books: selectedBooks,
          notes: notes.trim() || undefined,
        })
      );
      setSelectedStatementId(null);
      setSelectedBookIds(new Set());
      setNotes('');
      await refreshAll();
    } catch (err) {
      setError(err.message || 'Match failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSuggestion = async (matchId, action) => {
    setError('');
    setBusy(true);
    try {
      if (action === 'accept') await acceptSuggestedMatch(matchId);
      else await rejectSuggestedMatch(matchId);
      await refreshAll();
    } catch (err) {
      setError(err.message || 'Could not update the suggestion.');
    } finally {
      setBusy(false);
    }
  };

  if (!reconciliationId) {
    return (
      <p className="text-sm text-gray-600">
        {tt('Start or continue a reconciliation on the Statement step before matching.')}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" loading={busy} onClick={handleAutoMatch}>
          {tt('Auto Match')}
        </Button>
        <p className="text-sm text-gray-600">
          {tt('Select one bank line and one or more outstanding books, then Match. Amounts must sum.')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-labelledby="recon-match-statements-heading" className="min-w-0">
          <h2 id="recon-match-statements-heading" className="mb-2 text-sm font-semibold text-gray-900">
            {tt('Statement lines')}
          </h2>
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">{tt('Bank statement lines with matching status')}</caption>
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">{tt('Select')}</th>
                  <th className="px-3 py-2 font-medium">{tt('Date')}</th>
                  <th className="px-3 py-2 font-medium">{tt('Description')}</th>
                  <th className="px-3 py-2 font-medium text-right">{tt('Amount')}</th>
                  <th className="px-3 py-2 font-medium">{tt('Status')}</th>
                </tr>
              </thead>
              <tbody>
                {statements.length ? (
                  statements.map((row) => {
                    const selectable = isStatementSelectable(row);
                    const label = guidedStatementStatusLabel(row.matchingStatus);
                    return (
                      <tr key={row.id} className="border-t border-gray-100">
                        <td className="px-3 py-2">
                          <input
                            type="radio"
                            name="recon-match-statement"
                            value={row.id}
                            checked={selectedStatementId === row.id}
                            disabled={!selectable || busy}
                            onChange={() => setSelectedStatementId(row.id)}
                            aria-label={`${tt('Select statement')} ${row.description || row.id}`}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">{formatDate(row.transactionDate)}</td>
                        <td className="px-3 py-2">{row.description || ''}{row.reference ? ` · ${row.reference}` : ''}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                          {formatStatementAmount(row)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.matchingStatus)}`}
                          >
                            {tt(label)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-gray-500">
                      {tt('No statement lines yet. Import a CSV or Excel file first.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="recon-match-outstanding-heading" className="min-w-0">
          <h2 id="recon-match-outstanding-heading" className="mb-2 text-sm font-semibold text-gray-900">
            {tt(guidedOutstandingLabel())}
          </h2>
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">{tt('Outstanding book lines to match')}</caption>
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">{tt('Select')}</th>
                  <th className="px-3 py-2 font-medium">{tt('Date')}</th>
                  <th className="px-3 py-2 font-medium">{tt('Description')}</th>
                  <th className="px-3 py-2 font-medium text-right">{tt('Amount')}</th>
                </tr>
              </thead>
              <tbody>
                {books.length ? (
                  books.map((row) => {
                    const id = row.journalEntryLineId;
                    return (
                      <tr key={id} className="border-t border-gray-100">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedBookIds.has(id)}
                            disabled={busy || !id}
                            onChange={() => toggleBook(id)}
                            aria-label={`${tt('Select outstanding')} ${row.description || id}`}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {formatDate(row.transactionDate || row.itemDate)}
                        </td>
                        <td className="px-3 py-2">
                          {row.description || ''}
                          {row.reference ? ` · ${row.reference}` : ''}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                          {formatBookAmount(row)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-gray-500">
                      {tt('No outstanding book lines for this period.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectionReady ? (
        <p className="text-sm text-gray-700" role="status">
          {tt('Bank total')}: {formatMinorAsAmount(statementBankAbsMinor(selectedStatement))}
          {' · '}
          {tt('Book total')}: {formatMinorAsAmount(selectedBookSumMinor(selectedBooks))}
        </p>
      ) : null}

      {mismatchMessage ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {mismatchMessage}
        </p>
      ) : null}

      <FormField label="Notes" htmlFor="recon-match-notes" hint="Optional">
        {({ id, ...a11y }) => (
          <Input
            id={id}
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={busy}
            {...a11y}
          />
        )}
      </FormField>

      <Button
        type="button"
        variant="secondary"
        loading={busy}
        disabled={!selectionReady}
        onClick={handleManualMatch}
      >
        {tt('Match')}
      </Button>

      {suggestions.length ? (
        <section aria-labelledby="recon-match-suggestions-heading" className="space-y-2">
          <h2 id="recon-match-suggestions-heading" className="text-sm font-semibold text-gray-900">
            {tt('Suggestions to review')}
          </h2>
          <ul className="space-y-2">
            {suggestions.map((match) => (
              <li
                key={match.id}
                className="flex flex-col gap-2 rounded-md border border-gray-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm text-gray-700">
                  {tt('Suggested')} · {match.confidence || ''} · {match.matchType || ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="compact"
                    loading={busy}
                    onClick={() => handleSuggestion(match.id, 'accept')}
                  >
                    {tt('Accept')}
                  </Button>
                  <Button
                    type="button"
                    size="compact"
                    variant="secondary"
                    loading={busy}
                    onClick={() => handleSuggestion(match.id, 'reject')}
                  >
                    {tt('Reject')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Toast
        show={Boolean(toast)}
        type="success"
        message={toast}
        onClose={() => setToast('')}
      />
    </div>
  );
}
