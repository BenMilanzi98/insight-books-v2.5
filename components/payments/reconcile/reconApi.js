import { OPEN_RECON_STATUSES } from '@/lib/bankReconciliation/domain/enums.js';

export const WIZARD_STEPS = ['statement', 'import', 'match', 'resolve', 'complete'];
export const GUIDED_IMPORT_ACCEPT = '.csv,.xlsx,.xls';
const GUIDED_IMPORT_EXTENSIONS = new Set(['.csv', '.xlsx', '.xls']);

function statementFileExtension(fileName = '') {
  const i = String(fileName).lastIndexOf('.');
  return i >= 0 ? String(fileName).slice(i).toLowerCase() : '';
}

export function isAllowedGuidedStatementFile(fileName) {
  return GUIDED_IMPORT_EXTENSIONS.has(statementFileExtension(fileName));
}

export function assertAllowedGuidedStatementFile(fileName) {
  if (!isAllowedGuidedStatementFile(fileName)) {
    throw new Error('Only CSV and Excel files (.csv, .xlsx, .xls) are accepted. OFX is not supported in this wizard.');
  }
}

function appendIfPresent(form, key, value) {
  if (value == null || value === '') return;
  form.append(key, String(value));
}

export function buildPreviewImportFormData({
  file,
  paymentAccountId,
  statementOpening,
  statementClosing,
  profileId,
}) {
  const form = new FormData();
  form.append('file', file);
  form.append('paymentAccountId', paymentAccountId);
  appendIfPresent(form, 'statementOpening', statementOpening);
  appendIfPresent(form, 'statementClosing', statementClosing);
  appendIfPresent(form, 'profileId', profileId);
  return form;
}

export function buildConfirmImportFormData({ file, batchId, reconciliationId }) {
  const form = new FormData();
  form.append('file', file);
  form.append('batchId', batchId);
  appendIfPresent(form, 'reconciliationId', reconciliationId);
  return form;
}

export function previewStatementImport(formData) {
  return reconFetch('/api/bank-reconciliation/import/preview', {
    method: 'POST',
    body: formData,
  });
}

export function confirmStatementImport(formData) {
  return reconFetch('/api/bank-reconciliation/import/confirm', {
    method: 'POST',
    body: formData,
  });
}

export function canConfirmGuidedImportPreview(preview, file) {
  if (!file || !preview?.batch?.id) return false;
  return Number(preview.totalRows) > 0;
}

export async function reconFetch(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

export function listReconciliations(paymentAccountId) {
  return reconFetch(
    `/api/bank-reconciliation/reconciliations?paymentAccountId=${encodeURIComponent(paymentAccountId)}`
  );
}

export function createReconciliation(body) {
  return reconFetch('/api/bank-reconciliation/reconciliations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function listReconcilableAccounts() {
  return reconFetch('/api/bank-reconciliation/accounts');
}

export function getReconciliationWorkspace(reconciliationId) {
  return reconFetch(
    `/api/bank-reconciliation/reconciliations/${encodeURIComponent(reconciliationId)}`
  );
}

export function findOpenReconciliation(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.reconciliations || [];
  return rows.find((row) => OPEN_RECON_STATUSES.includes(row?.status)) || null;
}

export function buildCreateReconciliationBody({
  paymentAccountId,
  periodStart,
  periodEnd,
  statementOpeningBalance,
  statementClosingBalance,
}) {
  return {
    paymentAccountId,
    statementDate: periodEnd,
    periodStart,
    periodEnd,
    statementOpeningBalance: toOptionalNumber(statementOpeningBalance),
    statementClosingBalance: toOptionalNumber(statementClosingBalance),
  };
}

function toOptionalNumber(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Absolute bank amount in minor units (`signedAmountMinor` on statement rows). */
export function statementBankAbsMinor(statement) {
  return Math.abs(toFiniteNumber(statement?.signedAmountMinor));
}

/** Book amount in minor units: remainingAmountMinor (candidates) or amountMinor (outstanding). */
export function bookCandidateAmountMinor(book) {
  if (book?.remainingAmountMinor != null && book.remainingAmountMinor !== '') {
    return toFiniteNumber(book.remainingAmountMinor);
  }
  if (book?.amountMinor != null && book.amountMinor !== '') {
    return toFiniteNumber(book.amountMinor);
  }
  return 0;
}

export function selectedBookSumMinor(books) {
  return (books || []).reduce((sum, book) => sum + Math.abs(bookCandidateAmountMinor(book)), 0);
}

export function canPostManualMatch(statement, books) {
  if (!statement || !Array.isArray(books) || books.length === 0) return false;
  return statementBankAbsMinor(statement) === selectedBookSumMinor(books);
}

export function formatMinorAsAmount(minor) {
  return (toFiniteNumber(minor) / 100).toFixed(2);
}

export function manualMatchAmountError(statement, books) {
  const bank = statementBankAbsMinor(statement);
  const book = selectedBookSumMinor(books);
  return `Amounts do not match. Bank total: ${formatMinorAsAmount(bank)} · Book total: ${formatMinorAsAmount(book)}`;
}

export function buildManualMatchBody({ reconciliationId, statement, books, notes }) {
  const body = {
    reconciliationId,
    statementIds: statement?.id ? [statement.id] : [],
    bookLinks: (books || []).map((book) => {
      const amountMinor = bookCandidateAmountMinor(book);
      return {
        journalEntryLineId: book.journalEntryLineId,
        amountMinor,
        allocatedAmountMinor: amountMinor,
      };
    }),
  };
  if (notes) body.notes = notes;
  return body;
}

export function autoMatchReconciliation(reconciliationId) {
  return reconFetch(
    `/api/bank-reconciliation/reconciliations/${encodeURIComponent(reconciliationId)}/auto-match`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }
  );
}

export function listMatchCandidates({ paymentAccountId, reconciliationId, startDate, endDate } = {}) {
  const params = [];
  if (paymentAccountId) params.push(`paymentAccountId=${encodeURIComponent(paymentAccountId)}`);
  if (reconciliationId) params.push(`reconciliationId=${encodeURIComponent(reconciliationId)}`);
  if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
  if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);
  return reconFetch(`/api/bank-reconciliation/candidates?${params.join('&')}`);
}

export function postManualMatch(body) {
  return reconFetch('/api/bank-reconciliation/matches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function acceptSuggestedMatch(matchId) {
  return reconFetch(
    `/api/bank-reconciliation/matches/${encodeURIComponent(matchId)}/accept`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }
  );
}

export function rejectSuggestedMatch(matchId) {
  return reconFetch(
    `/api/bank-reconciliation/matches/${encodeURIComponent(matchId)}/reject`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }
  );
}
