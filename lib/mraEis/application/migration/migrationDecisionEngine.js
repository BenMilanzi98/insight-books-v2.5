/**
 * Phase 19 — Migration Decision Engine.
 * Default for ambiguous data: QUARANTINE AND REVIEW — DO NOT GUESS.
 */

import { resolveTenantOwnership, resolveBusinessOwnership, classifyEnvironment } from './ownershipAndEnvironment.js';
import { scoreIntegrity, detectOrphans } from './duplicateAndIntegrity.js';
import { MigrationErrors } from './migrationErrors.js';

export const MIGRATION_DECISION = Object.freeze({
  MIGRATE_AS_AUTHORITATIVE: 'MIGRATE_AS_AUTHORITATIVE',
  MIGRATE_AS_HISTORICAL_READ_ONLY: 'MIGRATE_AS_HISTORICAL_READ_ONLY',
  LINK_TO_EXISTING_CANONICAL_RECORD: 'LINK_TO_EXISTING_CANONICAL_RECORD',
  MIGRATE_AS_PROVISIONAL_REFERENCE: 'MIGRATE_AS_PROVISIONAL_REFERENCE',
  QUARANTINE: 'QUARANTINE',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  IGNORE_CONFIRMED_TEST_DATA: 'IGNORE_CONFIRMED_TEST_DATA',
  BLOCKED_SECURITY: 'BLOCKED_SECURITY',
  BLOCKED_CROSS_TENANT: 'BLOCKED_CROSS_TENANT',
  BLOCKED_FISCAL_CONFLICT: 'BLOCKED_FISCAL_CONFLICT',
  BLOCKED_ENVIRONMENT_CONFLICT: 'BLOCKED_ENVIRONMENT_CONFLICT',
});

export const SALE_CLASSIFICATION = Object.freeze({
  NON_EIS_HISTORICAL: 'NON_EIS_HISTORICAL',
  EIS_ELIGIBLE_NOT_SUBMITTED: 'EIS_ELIGIBLE_NOT_SUBMITTED',
  LEGACY_EFD_PROCESSED: 'LEGACY_EFD_PROCESSED',
  EIS_ACCEPTED_PROVEN: 'EIS_ACCEPTED_PROVEN',
  EIS_REJECTED_PROVEN: 'EIS_REJECTED_PROVEN',
  EIS_UNKNOWN_OUTCOME: 'EIS_UNKNOWN_OUTCOME',
  STATUS_WITHOUT_EVIDENCE: 'STATUS_WITHOUT_EVIDENCE',
  RECEIPT_WITHOUT_RESPONSE: 'RECEIPT_WITHOUT_RESPONSE',
  RESPONSE_WITHOUT_SOURCE: 'RESPONSE_WITHOUT_SOURCE',
  DUPLICATE_SOURCE: 'DUPLICATE_SOURCE',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

/** Forbidden secret field names in candidate payloads */
const SECRET_PATTERNS = [
  /jwt/i,
  /terminalSecret/i,
  /privateKey/i,
  /authorizationHeader/i,
  /buyerAuthorization/i,
  /\btac\b/i,
  /password/i,
];

export function detectCredentialLeak(candidateData = {}) {
  const leaked = [];
  for (const [k, v] of Object.entries(candidateData)) {
    if (SECRET_PATTERNS.some((p) => p.test(k)) && v != null && v !== '') {
      leaked.push(k);
    }
    if (typeof v === 'string' && /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(v)) {
      leaked.push(`${k}:jwt-shaped`);
    }
  }
  return { leaked: leaked.length > 0, fields: leaked };
}

/**
 * Classify a POS/Invoice source document for EIS migration.
 * Receipt alone ≠ acceptance.
 */
export function classifySaleOrInvoice(candidate = {}) {
  if (candidate.duplicateSource) return SALE_CLASSIFICATION.DUPLICATE_SOURCE;
  if (candidate.hasAcceptedResponseEvidence && candidate.mraTransactionId) {
    return SALE_CLASSIFICATION.EIS_ACCEPTED_PROVEN;
  }
  if (candidate.hasRejectedResponseEvidence) return SALE_CLASSIFICATION.EIS_REJECTED_PROVEN;
  if (candidate.hasUnknownOutcome) return SALE_CLASSIFICATION.EIS_UNKNOWN_OUTCOME;
  if (candidate.hasReceipt && !candidate.hasAcceptedResponseEvidence) {
    return SALE_CLASSIFICATION.RECEIPT_WITHOUT_RESPONSE;
  }
  if (candidate.localStatusSaysAccepted && !candidate.hasAcceptedResponseEvidence) {
    return SALE_CLASSIFICATION.STATUS_WITHOUT_EVIDENCE;
  }
  if (candidate.hasResponse && !candidate.sourceRecordId) {
    return SALE_CLASSIFICATION.RESPONSE_WITHOUT_SOURCE;
  }
  if (candidate.legacyEfd) return SALE_CLASSIFICATION.LEGACY_EFD_PROCESSED;
  if (candidate.eisEligible && !candidate.hasAnyMraEvidence) {
    return SALE_CLASSIFICATION.EIS_ELIGIBLE_NOT_SUBMITTED;
  }
  if (!candidate.eisEligible) return SALE_CLASSIFICATION.NON_EIS_HISTORICAL;
  return SALE_CLASSIFICATION.MANUAL_REVIEW;
}

export function evaluateMigrationCandidate({
  sourceSystemId,
  sourceEntityType,
  sourceRecordId,
  candidateData = {},
  expectedTenantId = null,
  expectedBusinessId = null,
  sourceEnvironmentHint = null,
  existingCanonicalId = null,
  hasFiscalDuplicateConflict = false,
  confirmedTestData = false,
} = {}) {
  const leak = detectCredentialLeak(candidateData);
  if (leak.leaked) {
    return {
      decision: MIGRATION_DECISION.BLOCKED_SECURITY,
      confidence: 1,
      blockers: ['CREDENTIAL_LEAKAGE', ...leak.fields],
      warnings: [],
      requiredApprovals: ['SECURITY'],
      saleClassification: null,
      ownership: null,
      environment: null,
      integrity: null,
      historicalTransmissionForbidden: true,
      journalCreationForbidden: true,
      stockMovementCreationForbidden: true,
      fabricateEvidenceForbidden: true,
      targetOwnership: null,
      targetEnvironment: null,
      rollbackPolicy: 'NONE',
      transformationVersion: 'migration-decision-v1',
    };
  }

  const ownershipT = resolveTenantOwnership({
    record: candidateData,
    expectedTenantId,
    terminalTenantId: candidateData.terminalTenantId,
  });
  const ownershipB = resolveBusinessOwnership({
    record: candidateData,
    expectedBusinessId,
    tenantId: ownershipT.tenantId,
  });
  const env = classifyEnvironment({
    sourceEnvironmentHint,
    recordEnvironment: candidateData.environment,
    endpointHostname: candidateData.endpointHostname,
    receiptWording: candidateData.receiptWording,
    databaseName: candidateData.databaseName,
  });

  if (ownershipT.outcome === 'CROSS_TENANT_CONFLICT' || ownershipT.blocked) {
    return baseResult({
      decision: MIGRATION_DECISION.BLOCKED_CROSS_TENANT,
      blockers: ['CROSS_TENANT_CONFLICT'],
      ownershipT,
      ownershipB,
      env,
      candidateData,
      hasFiscalDuplicateConflict,
    });
  }

  if (env.productionSandboxMixed || env.environment === 'CONFLICTING') {
    return baseResult({
      decision: MIGRATION_DECISION.BLOCKED_ENVIRONMENT_CONFLICT,
      blockers: ['ENVIRONMENT_CONFLICT'],
      ownershipT,
      ownershipB,
      env,
      candidateData,
      hasFiscalDuplicateConflict,
    });
  }

  if (hasFiscalDuplicateConflict) {
    return baseResult({
      decision: MIGRATION_DECISION.BLOCKED_FISCAL_CONFLICT,
      blockers: ['DUPLICATE_FISCAL_NUMBER_CONFLICT'],
      ownershipT,
      ownershipB,
      env,
      candidateData,
      hasFiscalDuplicateConflict: true,
    });
  }

  if (confirmedTestData || ['TEST', 'DEMO', 'TRAINING'].includes(env.environment)) {
    return baseResult({
      decision: MIGRATION_DECISION.IGNORE_CONFIRMED_TEST_DATA,
      blockers: [],
      warnings: ['TEST_OR_DEMO_DATA'],
      ownershipT,
      ownershipB,
      env,
      candidateData,
    });
  }

  const saleClassification = ['POS_SALE', 'SALES_INVOICE', 'EIS_INVOICE'].includes(sourceEntityType)
    ? classifySaleOrInvoice(candidateData)
    : null;

  const orphans = detectOrphans({
    ...candidateData,
    tenantId: ownershipT.tenantId,
    businessId: ownershipB.businessId,
  });

  const integrity = scoreIntegrity({
    ownershipOutcome: ownershipT.outcome,
    environment: env.environment,
    hasCrossTenantConflict: false,
    hasFiscalDuplicateConflict,
    hasCredentialLeak: false,
    hasAcceptedEvidence: Boolean(candidateData.hasAcceptedResponseEvidence),
    hasReceiptOnly: Boolean(candidateData.hasReceipt && !candidateData.hasAcceptedResponseEvidence),
    accountingLinked: Boolean(candidateData.accountingLinked),
    inventoryLinked: candidateData.inventoryLinked,
    sourceIntegrityOk: !orphans.isOrphan || saleClassification === SALE_CLASSIFICATION.NON_EIS_HISTORICAL,
  });

  // Historical eligible not submitted — never auto-submit
  if (saleClassification === SALE_CLASSIFICATION.EIS_ELIGIBLE_NOT_SUBMITTED) {
    return baseResult({
      decision: MIGRATION_DECISION.MIGRATE_AS_HISTORICAL_READ_ONLY,
      blockers: [],
      warnings: ['MUST_NOT_AUTO_SUBMIT'],
      ownershipT,
      ownershipB,
      env,
      candidateData,
      saleClassification,
      integrity,
      dispatchable: false,
    });
  }

  if (
    saleClassification === SALE_CLASSIFICATION.RECEIPT_WITHOUT_RESPONSE ||
    saleClassification === SALE_CLASSIFICATION.STATUS_WITHOUT_EVIDENCE
  ) {
    return baseResult({
      decision: MIGRATION_DECISION.QUARANTINE,
      blockers: ['RECEIPT_OR_STATUS_WITHOUT_ACCEPTANCE_EVIDENCE'],
      warnings: ['DO_NOT_FABRICATE_MRA_EVIDENCE'],
      ownershipT,
      ownershipB,
      env,
      candidateData,
      saleClassification,
      integrity,
    });
  }

  if (
    ownershipT.quarantine ||
    ownershipB.quarantine ||
    env.quarantine ||
    integrity.band === 'QUARANTINE' ||
    orphans.isOrphan
  ) {
    return baseResult({
      decision:
        ownershipT.outcome === 'AMBIGUOUS' || ownershipB.outcome === 'AMBIGUOUS'
          ? MIGRATION_DECISION.MANUAL_REVIEW
          : MIGRATION_DECISION.QUARANTINE,
      blockers: integrity.blockers,
      warnings: orphans.orphans,
      ownershipT,
      ownershipB,
      env,
      candidateData,
      saleClassification,
      integrity,
    });
  }

  if (existingCanonicalId) {
    return baseResult({
      decision: MIGRATION_DECISION.LINK_TO_EXISTING_CANONICAL_RECORD,
      blockers: [],
      ownershipT,
      ownershipB,
      env,
      candidateData,
      saleClassification,
      integrity,
      targetRecordId: existingCanonicalId,
    });
  }

  if (
    saleClassification === SALE_CLASSIFICATION.EIS_ACCEPTED_PROVEN ||
    saleClassification === SALE_CLASSIFICATION.EIS_REJECTED_PROVEN ||
    saleClassification === SALE_CLASSIFICATION.EIS_UNKNOWN_OUTCOME
  ) {
    return baseResult({
      decision: MIGRATION_DECISION.MIGRATE_AS_HISTORICAL_READ_ONLY,
      blockers: [],
      warnings:
        saleClassification === SALE_CLASSIFICATION.EIS_UNKNOWN_OUTCOME
          ? ['UNKNOWN_REMAINS_UNKNOWN']
          : [],
      ownershipT,
      ownershipB,
      env,
      candidateData,
      saleClassification,
      integrity,
      dispatchable: false,
    });
  }

  if (integrity.band === 'HIGH_CONFIDENCE_HISTORICAL' || integrity.band === 'AUTHORITATIVE_READY') {
    return baseResult({
      decision: MIGRATION_DECISION.MIGRATE_AS_HISTORICAL_READ_ONLY,
      blockers: [],
      ownershipT,
      ownershipB,
      env,
      candidateData,
      saleClassification,
      integrity,
      dispatchable: false,
    });
  }

  // Default: do not guess
  return baseResult({
    decision: MIGRATION_DECISION.QUARANTINE,
    blockers: ['AMBIGUOUS_DEFAULT_QUARANTINE'],
    warnings: ['DO_NOT_GUESS'],
    ownershipT,
    ownershipB,
    env,
    candidateData,
    saleClassification,
    integrity,
  });
}

function baseResult({
  decision,
  blockers = [],
  warnings = [],
  ownershipT,
  ownershipB,
  env,
  candidateData,
  saleClassification = null,
  integrity = null,
  hasFiscalDuplicateConflict = false,
  targetRecordId = null,
  dispatchable = false,
}) {
  const scored =
    integrity ||
    scoreIntegrity({
      ownershipOutcome: ownershipT?.outcome,
      environment: env?.environment,
      hasFiscalDuplicateConflict,
      hasAcceptedEvidence: Boolean(candidateData?.hasAcceptedResponseEvidence),
      hasReceiptOnly: Boolean(candidateData?.hasReceipt && !candidateData?.hasAcceptedResponseEvidence),
      accountingLinked: Boolean(candidateData?.accountingLinked),
    });

  return {
    decision,
    confidence: scored.score / 100,
    blockers,
    warnings,
    requiredApprovals:
      decision === MIGRATION_DECISION.MIGRATE_AS_AUTHORITATIVE ||
      decision === MIGRATION_DECISION.MIGRATE_AS_HISTORICAL_READ_ONLY
        ? ['MIGRATION_APPROVER']
        : decision.startsWith('BLOCKED')
          ? ['SECURITY_OR_COMPLIANCE']
          : [],
    saleClassification,
    ownership: { tenant: ownershipT, business: ownershipB },
    environment: env,
    integrity: scored,
    targetEntityType: candidateData?.targetEntityType || null,
    targetRecordId,
    targetOwnership: {
      tenantId: ownershipT?.tenantId || null,
      businessId: ownershipB?.businessId || null,
    },
    targetEnvironment: env?.environment || null,
    rollbackPolicy: 'MIGRATION_CREATED_ONLY',
    transformationVersion: 'migration-decision-v1',
    historicalTransmissionForbidden: true,
    historicalOfflineUploadForbidden: true,
    journalCreationForbidden: true,
    stockMovementCreationForbidden: true,
    fiscalNumberAllocationForbidden: true,
    fiscalNumberMutationForbidden: true,
    fabricateEvidenceForbidden: true,
    dispatchable: Boolean(dispatchable),
    defaultWasQuarantine: decision === MIGRATION_DECISION.QUARANTINE,
  };
}

/** Hard guard — never call transmission from migration */
export function assertHistoricalTransmissionBlocked() {
  throw MigrationErrors.historicalTransmissionBlocked();
}
