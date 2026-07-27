/**
 * Phase 19 — Duplicate detection + explainable data-integrity scoring.
 * Critical conflicts override numeric score → QUARANTINE / BLOCKED.
 */

export const DUPLICATE_CLASS = Object.freeze({
  EXACT_DUPLICATE: 'EXACT_DUPLICATE',
  SAME_FISCAL_NUMBER_SAME_TRANSACTION: 'SAME_FISCAL_NUMBER_SAME_TRANSACTION',
  SAME_FISCAL_NUMBER_DIFFERENT_TRANSACTION: 'SAME_FISCAL_NUMBER_DIFFERENT_TRANSACTION',
  SAME_MRA_ID_DIFFERENT_TRANSACTION: 'SAME_MRA_ID_DIFFERENT_TRANSACTION',
  SAME_RECEIPT_DIFFERENT_TRANSACTION: 'SAME_RECEIPT_DIFFERENT_TRANSACTION',
  POTENTIAL_DUPLICATE: 'POTENTIAL_DUPLICATE',
  NOT_DUPLICATE: 'NOT_DUPLICATE',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

export const INTEGRITY_BAND = Object.freeze({
  AUTHORITATIVE_READY: 'AUTHORITATIVE_READY',
  HIGH_CONFIDENCE_HISTORICAL: 'HIGH_CONFIDENCE_HISTORICAL',
  CONDITIONAL: 'CONDITIONAL',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  QUARANTINE: 'QUARANTINE',
  BLOCKED: 'BLOCKED',
});

/**
 * Detect duplicates across a candidate set (in-memory / staging).
 */
export function detectDuplicates(records = []) {
  const byFiscal = new Map();
  const byMra = new Map();
  const bySource = new Map();
  const byReceipt = new Map();
  const findings = [];

  for (const r of records) {
    const srcKey = r.sourceNaturalKey || `${r.sourceEntityType}:${r.sourceRecordId}`;
    if (bySource.has(srcKey)) {
      findings.push({
        class: DUPLICATE_CLASS.EXACT_DUPLICATE,
        a: bySource.get(srcKey),
        b: r.id || srcKey,
        dimension: 'SOURCE_NATURAL_KEY',
        critical: true,
      });
    } else {
      bySource.set(srcKey, r.id || srcKey);
    }

    if (r.fiscalNumber) {
      const prev = byFiscal.get(r.fiscalNumber);
      if (prev) {
        const sameTx = prev.sourceNaturalKey === srcKey;
        findings.push({
          class: sameTx
            ? DUPLICATE_CLASS.SAME_FISCAL_NUMBER_SAME_TRANSACTION
            : DUPLICATE_CLASS.SAME_FISCAL_NUMBER_DIFFERENT_TRANSACTION,
          a: prev.id,
          b: r.id || srcKey,
          fiscalNumber: r.fiscalNumber,
          critical: !sameTx,
        });
      } else {
        byFiscal.set(r.fiscalNumber, { id: r.id || srcKey, sourceNaturalKey: srcKey });
      }
    }

    if (r.mraTransactionId) {
      const prev = byMra.get(r.mraTransactionId);
      if (prev && prev.sourceNaturalKey !== srcKey) {
        findings.push({
          class: DUPLICATE_CLASS.SAME_MRA_ID_DIFFERENT_TRANSACTION,
          a: prev.id,
          b: r.id || srcKey,
          mraTransactionId: r.mraTransactionId,
          critical: true,
        });
      } else if (!prev) {
        byMra.set(r.mraTransactionId, { id: r.id || srcKey, sourceNaturalKey: srcKey });
      }
    }

    if (r.receiptChecksum) {
      const prev = byReceipt.get(r.receiptChecksum);
      if (prev && prev.sourceNaturalKey !== srcKey) {
        findings.push({
          class: DUPLICATE_CLASS.SAME_RECEIPT_DIFFERENT_TRANSACTION,
          a: prev.id,
          b: r.id || srcKey,
          critical: true,
        });
      } else if (!prev) {
        byReceipt.set(r.receiptChecksum, { id: r.id || srcKey, sourceNaturalKey: srcKey });
      }
    }
  }

  return {
    findings,
    criticalCount: findings.filter((f) => f.critical).length,
    neverMergeConflictingFiscalEvidence: true,
  };
}

export function detectOrphans(record = {}) {
  const orphans = [];
  if (!record.tenantId) orphans.push('Sale without Tenant');
  if (!record.businessId) orphans.push('Sale without Business');
  if (record.hasSnapshot === false && record.fiscalNumber) orphans.push('Fiscal number without Snapshot');
  if (record.hasResponse === false && record.claimsAccepted) orphans.push('Acceptance claim without Response');
  const accepted =
    Boolean(record.hasAcceptedResponse) || Boolean(record.hasAcceptedResponseEvidence);
  if (record.hasReceipt && !accepted) orphans.push('Receipt without accepted Response');
  if (record.hasAttempt && !record.hasTransmission) orphans.push('Attempt without Transmission');
  return { orphans, isOrphan: orphans.length > 0 };
}

/**
 * Explainable integrity score. Critical blockers override band.
 */
export function scoreIntegrity({
  ownershipOutcome,
  environment,
  hasCrossTenantConflict = false,
  hasFiscalDuplicateConflict = false,
  hasCredentialLeak = false,
  hasAcceptedEvidence = false,
  hasReceiptOnly = false,
  accountingLinked = false,
  inventoryLinked = null,
  sourceIntegrityOk = true,
} = {}) {
  const breakdown = [];
  let score = 0;
  const add = (name, pts, ok) => {
    if (ok) score += pts;
    breakdown.push({ input: name, weight: pts, passed: Boolean(ok) });
  };

  add('ownershipConclusive', 20, ['CONCLUSIVE', 'STRONG'].includes(ownershipOutcome));
  add('environmentKnown', 15, environment && !['UNKNOWN', 'CONFLICTING'].includes(environment));
  add('sourceIntegrity', 15, sourceIntegrityOk);
  add('acceptedEvidence', 15, hasAcceptedEvidence);
  add('accountingLinked', 15, accountingLinked);
  add('inventoryOk', 10, inventoryLinked !== false);
  add('noReceiptOnlyAcceptance', 10, !(hasReceiptOnly || hasAcceptedEvidence));

  const blockers = [];
  if (hasCrossTenantConflict) blockers.push('CROSS_TENANT_CONFLICT');
  if (hasFiscalDuplicateConflict) blockers.push('DUPLICATE_FISCAL_NUMBER_CONFLICT');
  if (hasCredentialLeak) blockers.push('CREDENTIAL_LEAKAGE');
  if (environment === 'CONFLICTING') blockers.push('ENVIRONMENT_CONFLICT');
  if (ownershipOutcome === 'ORPHANED' || ownershipOutcome === 'AMBIGUOUS') {
    blockers.push('OWNERSHIP_UNPROVEN');
  }
  if (hasReceiptOnly && !hasAcceptedEvidence) {
    blockers.push('RECEIPT_WITHOUT_ACCEPTANCE_EVIDENCE');
  }

  let band = INTEGRITY_BAND.AUTHORITATIVE_READY;
  if (blockers.some((b) =>
    ['CROSS_TENANT_CONFLICT', 'DUPLICATE_FISCAL_NUMBER_CONFLICT', 'CREDENTIAL_LEAKAGE', 'ENVIRONMENT_CONFLICT'].includes(b)
  )) {
    band = INTEGRITY_BAND.BLOCKED;
    score = Math.min(score, 10);
  } else if (blockers.includes('OWNERSHIP_UNPROVEN') || blockers.includes('RECEIPT_WITHOUT_ACCEPTANCE_EVIDENCE')) {
    band = INTEGRITY_BAND.QUARANTINE;
    score = Math.min(score, 35);
  } else if (score >= 85) band = INTEGRITY_BAND.HIGH_CONFIDENCE_HISTORICAL;
  else if (score >= 60) band = INTEGRITY_BAND.CONDITIONAL;
  else band = INTEGRITY_BAND.LOW_CONFIDENCE;

  return {
    score,
    band,
    breakdown,
    blockers,
    criticalOverridesNumericScore: true,
    receiptIsNotAcceptanceProof: true,
    evaluatedAt: new Date().toISOString(),
  };
}
