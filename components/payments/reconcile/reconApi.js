import { OPEN_RECON_STATUSES } from '@/lib/bankReconciliation/domain/enums.js';

export const WIZARD_STEPS = ['statement', 'import', 'match', 'resolve', 'complete'];

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
