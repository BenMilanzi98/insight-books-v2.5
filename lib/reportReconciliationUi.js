/**
 * UI helpers — extract reconciliation metadata from report API responses.
 */

export function extractReportReconciliationMeta(data) {
  if (!data || typeof data !== 'object') return null;

  const reconciliation =
    data.metadata?.reconciliation ??
    data.reconciliation ??
    data.profitAnalysis?.reconciliation ??
    null;

  const ledgerSource =
    data.metadata?.ledgerSource ??
    data.source ??
    (data.metadata?.fromGeneralLedger ? 'general_ledger' : null);

  const fromGeneralLedger =
    data.metadata?.fromGeneralLedger ??
    data.fromGeneralLedger ??
    data.collectedTaxes?.fromGeneralLedger ??
    null;

  if (!reconciliation && !ledgerSource && !fromGeneralLedger) {
    return null;
  }

  return {
    reconciliation,
    ledgerSource,
    fromGeneralLedger,
  };
}

export function isGlBackedReport(meta) {
  if (!meta) return false;
  if (meta.ledgerSource === 'general_ledger') return true;
  if (meta.fromGeneralLedger === true) return true;
  if (typeof meta.fromGeneralLedger === 'object') {
    return Object.values(meta.fromGeneralLedger).some(Boolean);
  }
  return false;
}
