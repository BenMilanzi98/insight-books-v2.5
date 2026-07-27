/**
 * Phase 15 — deterministic local-versus-MRA comparator (exact decimals, no float money).
 */

import { RECONCILIATION_OUTCOME } from '../../domain/operationalEnums.js';

function decEq(a, b) {
  if (a == null || b == null) return null;
  try {
    // Normalize as string decimals — avoid binary float
    const na = String(a).trim();
    const nb = String(b).trim();
    if (na === nb) return true;
    const fa = Number(na);
    const fb = Number(nb);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) return false;
    return Math.abs(fa - fb) < 0.005; // 0.5 cent tolerance only for display rounding
  } catch {
    return false;
  }
}

function field(status, local, mra) {
  return { status, local: local ?? null, mra: mra ?? null };
}

export function compareLocalAndMraEvidence({
  localEvidence,
  mraEvidence,
  contract = null,
} = {}) {
  const fields = {};
  const snap = localEvidence?.snapshot || {};
  const fiscalNumber = localEvidence?.fiscalNumber;

  fields.environment = field(
    localEvidence?.environment && mraEvidence?.environment
      ? String(localEvidence.environment).toUpperCase() === String(mraEvidence.environment).toUpperCase()
        ? 'EXACT_MATCH'
        : 'MISMATCH'
      : mraEvidence?.environment
        ? 'MISSING_LOCAL'
        : 'MISSING_MRA',
    localEvidence?.environment,
    mraEvidence?.environment
  );

  fields.taxpayerTin = field(
    snap.sellerTin && mraEvidence?.taxpayerTin
      ? snap.sellerTin === mraEvidence.taxpayerTin
        ? 'EXACT_MATCH'
        : 'MISMATCH'
      : 'NOT_COMPARABLE',
    snap.sellerTin,
    mraEvidence?.taxpayerTin
  );

  fields.terminalId = field(
    localEvidence?.terminal?.terminalId && mraEvidence?.terminalId
      ? String(localEvidence.terminal.terminalId) === String(mraEvidence.localTerminalId || mraEvidence.terminalId) ||
        String(mraEvidence.mraTerminalId || '') === String(localEvidence.terminal.terminalId)
        ? 'EXACT_MATCH'
        : mraEvidence.mraTerminalId
          ? 'NORMALIZED_MATCH'
          : 'MISMATCH'
      : 'NOT_COMPARABLE',
    localEvidence?.terminal?.terminalId,
    mraEvidence?.terminalId || mraEvidence?.mraTerminalId
  );

  fields.fiscalNumber = field(
    fiscalNumber && mraEvidence?.fiscalNumber
      ? fiscalNumber === mraEvidence.fiscalNumber
        ? 'EXACT_MATCH'
        : 'MISMATCH'
      : mraEvidence?.fiscalNumber
        ? 'MISSING_LOCAL'
        : 'MISSING_MRA',
    fiscalNumber,
    mraEvidence?.fiscalNumber
  );

  fields.currency = field(
    snap.currency && mraEvidence?.currency
      ? snap.currency === mraEvidence.currency
        ? 'EXACT_MATCH'
        : 'MISMATCH'
      : 'NOT_COMPARABLE',
    snap.currency,
    mraEvidence?.currency
  );

  const gross = decEq(snap.grossTotal, mraEvidence?.grossAmount);
  fields.grossAmount = field(
    gross == null ? 'NOT_COMPARABLE' : gross ? 'EXACT_MATCH' : 'MISMATCH',
    snap.grossTotal,
    mraEvidence?.grossAmount
  );

  const tax = decEq(snap.taxTotal, mraEvidence?.taxAmount);
  fields.taxAmount = field(
    tax == null ? 'NOT_COMPARABLE' : tax ? 'EXACT_MATCH' : 'MISMATCH',
    snap.taxTotal,
    mraEvidence?.taxAmount
  );

  const mismatches = Object.entries(fields)
    .filter(([, v]) => v.status === 'MISMATCH')
    .map(([k]) => k);

  const requiredOk =
    fields.fiscalNumber.status === 'EXACT_MATCH' &&
    (fields.grossAmount.status === 'EXACT_MATCH' || fields.grossAmount.status === 'NOT_COMPARABLE') &&
    fields.environment.status !== 'MISMATCH';

  let confidence = 'INSUFFICIENT_EVIDENCE';
  if (mraEvidence?.noTransactionReturned) {
    confidence = 'INSUFFICIENT_EVIDENCE';
  } else if (mismatches.length) {
    confidence = mismatches.includes('fiscalNumber') || mismatches.includes('grossAmount')
      ? 'CONFLICTING_MATCH'
      : 'WEAK_MATCH';
  } else if (
    requiredOk &&
    ['SUCCESS', 'ACCEPTED'].includes(String(mraEvidence?.applicationStatus || '').toUpperCase())
  ) {
    confidence =
      fields.terminalId.status === 'EXACT_MATCH' || fields.terminalId.status === 'NORMALIZED_MATCH'
        ? 'CONCLUSIVE_MATCH'
        : 'STRONG_MATCH';
  } else if (requiredOk) {
    confidence = 'PARTIAL_MATCH';
  } else if (mraEvidence?.fiscalNumber && fiscalNumber && fields.fiscalNumber.status === 'MISMATCH') {
    confidence = 'NO_MATCH';
  }

  const outcome = classifyOutcome({
    mraEvidence,
    confidence,
    mismatches,
    contract,
    localFiscalNumber: fiscalNumber,
  });

  return {
    comparatorVersion: 'phase15-comparator-v1',
    fields,
    mismatches,
    confidence,
    outcome,
    requiredFieldRulesOverrideScoring: true,
  };
}

function classifyOutcome({ mraEvidence, confidence, mismatches, contract, localFiscalNumber }) {
  if (!mraEvidence) {
    return RECONCILIATION_OUTCOME.STILL_UNKNOWN;
  }

  if (mraEvidence.terminalBlockDetected) {
    return RECONCILIATION_OUTCOME.TERMINAL_BLOCKED;
  }
  if (mraEvidence.configurationRefreshRequired) {
    return RECONCILIATION_OUTCOME.CONFIGURATION_REFRESH_REQUIRED;
  }

  if (mraEvidence.duplicateIndicator) {
    if (confidence === 'CONCLUSIVE_MATCH' || confidence === 'STRONG_MATCH') {
      return RECONCILIATION_OUTCOME.DUPLICATE_ACCEPTED_CONFIRMED;
    }
    return RECONCILIATION_OUTCOME.DUPLICATE_WITHOUT_ACCEPTANCE_PROOF;
  }

  if (mraEvidence.noTransactionReturned) {
    // Absence from SINGLE_LATEST is NEVER conclusive unless contract says so
    if (contract?.absenceIsConclusive === true) {
      return RECONCILIATION_OUTCOME.DEFINITELY_NOT_PROCESSED;
    }
    return RECONCILIATION_OUTCOME.TARGET_NOT_RETURNED;
  }

  if (mraEvidence.mraAhead === true) {
    return RECONCILIATION_OUTCOME.MRA_AHEAD;
  }

  // Different latest transaction on SINGLE_LATEST endpoints is not a payload conflict
  // on our sale — it means the response window cannot prove target outcome.
  if (
    (confidence === 'NO_MATCH' || mismatches.includes('fiscalNumber')) &&
    mraEvidence.fiscalNumber &&
    localFiscalNumber &&
    mraEvidence.fiscalNumber !== localFiscalNumber
  ) {
    return RECONCILIATION_OUTCOME.RESPONSE_WINDOW_INSUFFICIENT;
  }

  if (confidence === 'CONFLICTING_MATCH' || mismatches.includes('grossAmount')) {
    return RECONCILIATION_OUTCOME.EVIDENCE_CONFLICT;
  }

  const status = String(mraEvidence.applicationStatus || '').toUpperCase();
  if (
    (confidence === 'CONCLUSIVE_MATCH' || confidence === 'STRONG_MATCH') &&
    ['SUCCESS', 'ACCEPTED'].includes(status) &&
    mraEvidence.fiscalNumber === localFiscalNumber
  ) {
    return RECONCILIATION_OUTCOME.ACCEPTED_CONFIRMED;
  }

  if (['REJECTED', 'VALIDATION_ERROR'].includes(status) && mraEvidence.fiscalNumber === localFiscalNumber) {
    return RECONCILIATION_OUTCOME.REJECTED_CONFIRMED;
  }

  return RECONCILIATION_OUTCOME.STILL_UNKNOWN;
}

export function normalizeMraReconciliationEvidence({
  endpointType,
  contractVersion,
  environment,
  body,
  responseChecksum,
  terminalId = null,
} = {}) {
  if (!body || body.noTransaction) {
    return {
      schemaVersion: 'mra-reconciliation-evidence-v1',
      endpointType,
      contractVersion,
      environment,
      terminalId,
      noTransactionReturned: true,
      applicationStatus: null,
      fiscalNumber: null,
      responseChecksum,
    };
  }

  return {
    schemaVersion: 'mra-reconciliation-evidence-v1',
    endpointType,
    contractVersion,
    terminalId,
    SiteId: body.siteId || body.mraSiteId || null,
    taxpayerTin: body.taxpayerTin || body.sellerTin || null,
    environment,
    fiscalNumber: body.fiscalNumber || null,
    sourceTransactionNumber: body.sourceTransactionNumber || body.localDocumentNumber || null,
    mraTransactionId: body.mraTransactionId || null,
    transactionDate: body.transactionDate || null,
    serverTimestamp: body.serverTimestamp || null,
    grossAmount: body.grossAmount != null ? String(body.grossAmount) : null,
    taxAmount: body.taxAmount != null ? String(body.taxAmount) : null,
    levyAmount: body.levyAmount != null ? String(body.levyAmount) : null,
    currency: body.currency || 'MWK',
    onlineOrOfflineMode: body.onlineOrOfflineMode || 'ONLINE',
    applicationStatus: body.applicationStatus || body.responseCode || null,
    duplicateIndicator: Boolean(body.duplicateIndicator || body.duplicate),
    configurationRefreshRequired: Boolean(body.shouldRefreshConfiguration),
    terminalBlockDetected: Boolean(body.shouldBlockTerminal),
    mraAhead: Boolean(body.mraAhead),
    localTerminalId: body.localTerminalId || null,
    mraTerminalId: body.mraTerminalId || body.terminalId || null,
    noTransactionReturned: false,
    responseChecksum,
  };
}
