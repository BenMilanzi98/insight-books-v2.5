/**
 * Phase 19 — Focused assessment helpers (Terminal, Configuration, Receipt, Offline).
 */

export function assessTerminal(record = {}) {
  const issues = [];
  if (!record.tenantId) issues.push('MISSING_TENANT');
  if (!record.businessId) issues.push('MISSING_BUSINESS');
  if (!record.environment) issues.push('MISSING_ENVIRONMENT');
  if (record.usedByMultipleBusinesses) issues.push('BUSINESS_CONFLICT');
  if (record.environmentConflict) issues.push('ENVIRONMENT_CONFLICT');
  if (record.plaintextCredentialPresent) issues.push('CREDENTIAL_REMEDIATION_REQUIRED');

  let classification = 'VERIFIED_INACTIVE';
  if (issues.includes('BUSINESS_CONFLICT') || issues.includes('ENVIRONMENT_CONFLICT')) {
    classification = 'MANUAL_REVIEW';
  } else if (issues.includes('CREDENTIAL_REMEDIATION_REQUIRED')) {
    classification = 'CREDENTIAL_REMEDIATION_REQUIRED';
  } else if (record.active) {
    classification = 'VERIFIED_ACTIVE';
  } else if (record.legacyOnly) {
    classification = 'LEGACY_HISTORICAL';
  }

  return {
    classification,
    issues,
    mustNotActivate: true,
    migrateAsHistorical: classification === 'LEGACY_HISTORICAL' || classification === 'VERIFIED_INACTIVE',
  };
}

export function assessConfiguration(record = {}) {
  return {
    decision: record.conflict
      ? 'QUARANTINE_CONFLICT'
      : record.linkToActive
        ? 'LINK_TO_EXISTING_ACTIVE_CONFIGURATION'
        : 'MIGRATE_AS_HISTORICAL_SNAPSHOT',
    mustNotActivateUnverified: true,
  };
}

export function assessReceipt(record = {}) {
  if (record.hasAcceptedResponseEvidence && record.artifactChecksumOk) {
    return { classification: 'VALID_ACCEPTED_RECEIPT', acceptBecauseReceiptExists: false };
  }
  if (record.hasReceipt && !record.hasAcceptedResponseEvidence) {
    return {
      classification: 'RECEIPT_WITHOUT_ACCEPTANCE_EVIDENCE',
      acceptBecauseReceiptExists: false,
      quarantine: true,
      doNotFabricateMraId: true,
    };
  }
  if (record.legacyEfd) return { classification: 'LEGACY_EFD_RECEIPT', quarantine: true };
  return { classification: 'MANUAL_REVIEW', quarantine: true };
}

export function assessOffline(record = {}) {
  if (!record.certified || !record.signatureVerified) {
    return {
      classification: 'LEGACY_UNCERTIFIED_OFFLINE_DATA',
      quarantine: true,
      mustNotAutoUpload: true,
      mustNotGenerateSignature: true,
    };
  }
  if (record.queueIntegrityFailure) {
    return { classification: 'QUEUE_INTEGRITY_FAILURE', quarantine: true, mustNotAutoUpload: true };
  }
  if (record.acceptedProven) {
    return { classification: 'ACCEPTED_OFFLINE_PROVEN', mustNotAutoUpload: true };
  }
  return { classification: 'VALID_CERTIFIED_OFFLINE_EVIDENCE', mustNotAutoUpload: true };
}

export function assessFiscalNumber(record = {}, peers = []) {
  const sameNumberDifferentTx = peers.filter(
    (p) => p.fiscalNumber === record.fiscalNumber && p.sourceNaturalKey !== record.sourceNaturalKey
  );
  if (sameNumberDifferentTx.length) {
    return {
      classification: 'DUPLICATE_NUMBER',
      quarantine: true,
      mustNotChangeNumber: true,
      mustNotRenumber: true,
    };
  }
  if (record.accepted) return { classification: 'VALID_ACCEPTED', mustNotChangeNumber: true };
  if (record.rejected) return { classification: 'VALID_REJECTED', mustNotChangeNumber: true };
  if (record.unknown) return { classification: 'VALID_UNKNOWN_OUTCOME', mustNotChangeNumber: true };
  return { classification: 'VALID_ASSIGNED', mustNotChangeNumber: true };
}
