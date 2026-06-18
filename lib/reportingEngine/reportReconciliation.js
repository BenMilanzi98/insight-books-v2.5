/**
 * Reconciliation helpers — compare GL totals to operational/sub-ledger totals.
 */

const EPS = 0.01;

export function buildReconciliationItem({ label, glAmount, operationalAmount, unit = 'currency' }) {
  const gl = Number(glAmount) || 0;
  const op = Number(operationalAmount) || 0;
  const variance = gl - op;
  const reconciled = Math.abs(variance) <= EPS;
  return {
    label,
    glAmount: gl,
    operationalAmount: op,
    variance,
    reconciled,
    unit,
  };
}

export function buildReconciliationSummary(items) {
  const list = Array.isArray(items) ? items : [];
  const unreconciled = list.filter((i) => !i.reconciled);
  return {
    items: list,
    allReconciled: unreconciled.length === 0,
    unreconciledCount: unreconciled.length,
    unreconciledLabels: unreconciled.map((i) => i.label),
  };
}
