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
