/**
 * Phase 21 — MRA Certification Review Case + evidence package (no credentials).
 * Never self-mark APPROVED without verified evidence.
 */

import crypto from 'crypto';
import { Phase21Errors } from './phase21Errors.js';
import { scanObjectForSecrets } from '../phase20/secretLeakScanner.js';

export const CERTIFICATION_REVIEW_STATE = Object.freeze({
  PREPARING: 'PREPARING',
  SUBMITTED: 'SUBMITTED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  INFORMATION_REQUESTED: 'INFORMATION_REQUESTED',
  RETEST_REQUIRED: 'RETEST_REQUIRED',
  CONDITIONALLY_APPROVED: 'CONDITIONALLY_APPROVED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
  EXPIRED: 'EXPIRED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

const CASES = new Map();
const OUTCOMES = new Map();

export function __resetCertificationForTests() {
  CASES.clear();
  OUTCOMES.clear();
}

export function buildCertificationEvidencePackage({
  productName = 'InsightBooks',
  productId,
  productVersion,
  agentVersion = null,
  environment = 'SANDBOX',
  contractVersions = {},
  sandboxResults = {},
  securityResults = {},
  performanceResults = {},
  knownLimitations = [],
  openClarifications = [],
  attachments = [],
} = {}) {
  if (!productId || !productVersion) {
    throw Phase21Errors.certificationNotApproved({
      message: 'Evidence package requires productId and productVersion.',
    });
  }

  const packageBody = {
    productName,
    productId,
    productVersion,
    agentVersion,
    environment,
    contractVersions,
    architectureSummary: 'MRA EIS bounded context; accounting/Inventory remain authoritative.',
    sandboxResults,
    securityResults,
    performanceResults,
    knownLimitations,
    openClarifications,
    attachmentRefs: attachments.map((a) => ({
      name: a.name,
      checksum: a.checksum,
      mediaType: a.mediaType,
    })),
    credentialsExcluded: true,
    privateKeysExcluded: true,
    buyerAuthorizationExcluded: true,
    tacExcluded: true,
    createdAt: new Date().toISOString(),
  };

  const leaks = scanObjectForSecrets(packageBody);
  if (leaks.length) {
    throw Phase21Errors.credentialProvisioning({
      message: 'Certification evidence package contains sensitive fields.',
      details: { leaks },
    });
  }

  const checksum = crypto.createHash('sha256').update(JSON.stringify(packageBody)).digest('hex');
  return {
    id: crypto.randomUUID(),
    checksum,
    packageBody,
    version: 'phase21-cert-evidence-v1',
  };
}

export function createCertificationReviewCase({
  productId,
  productVersion,
  agentVersion = null,
  environment = 'SANDBOX',
  evidencePackageId,
  evidenceChecksum,
  preparedBy,
} = {}) {
  const id = crypto.randomUUID();
  const row = {
    id,
    productId,
    productVersion,
    agentVersion,
    environment,
    evidencePackageId,
    evidenceChecksum,
    state: CERTIFICATION_REVIEW_STATE.PREPARING,
    preparedBy,
    selfApprovedForbidden: true,
    conditions: [],
    informationRequests: [],
    mraReference: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  CASES.set(id, row);
  return row;
}

export function transitionCertificationReview({ caseId, toState, actorId, note = null, mraEvidence = null } = {}) {
  const row = CASES.get(caseId);
  if (!row) throw Phase21Errors.certificationNotApproved({ message: 'Review case not found.' });

  // Never allow self-declaration of APPROVED without mraEvidence
  if (
    [CERTIFICATION_REVIEW_STATE.APPROVED, CERTIFICATION_REVIEW_STATE.CONDITIONALLY_APPROVED].includes(toState)
  ) {
    if (!mraEvidence?.mraReference || !mraEvidence?.verified) {
      throw Phase21Errors.certificationNotApproved({
        message: 'Cannot mark certification APPROVED without verified MRA evidence.',
      });
    }
    if (mraEvidence.selfDeclared) {
      throw Phase21Errors.certificationNotApproved({
        message: 'Self-declared MRA certification is prohibited.',
      });
    }
  }

  row.state = toState;
  row.updatedAt = new Date().toISOString();
  row.lastActorId = actorId;
  row.lastNote = note;
  if (mraEvidence?.mraReference) row.mraReference = mraEvidence.mraReference;
  if (mraEvidence?.conditions) row.conditions = mraEvidence.conditions;
  return row;
}

export function recordCertificationOutcome({
  caseId,
  authority = 'MRA',
  environment,
  productId,
  productVersion,
  agentVersion = null,
  effectiveDate,
  expiry = null,
  conditions = [],
  mraReference,
  evidenceChecksum,
  approvalState,
} = {}) {
  if (
    ![CERTIFICATION_REVIEW_STATE.APPROVED, CERTIFICATION_REVIEW_STATE.CONDITIONALLY_APPROVED].includes(
      approvalState
    )
  ) {
    throw Phase21Errors.certificationNotApproved();
  }
  const review = CASES.get(caseId);
  if (!review || review.state !== approvalState) {
    throw Phase21Errors.certificationNotApproved({
      message: 'Outcome must match verified review case state.',
    });
  }

  const id = crypto.randomUUID();
  const outcome = {
    id,
    caseId,
    authority,
    environment,
    productId: productId || review.productId,
    productVersion: productVersion || review.productVersion,
    agentVersion: agentVersion || review.agentVersion,
    effectiveDate: effectiveDate || new Date().toISOString(),
    expiry,
    conditions,
    mraReference,
    evidenceChecksum,
    approvalState,
    productionEnablementAllowed: false, // still requires change approval
    createdAt: new Date().toISOString(),
  };
  OUTCOMES.set(id, outcome);
  return outcome;
}

export function getCertificationReview(caseId) {
  return CASES.get(caseId) || null;
}

export function getCertificationOutcome(id) {
  return OUTCOMES.get(id) || null;
}

export function assertCertificationAllowsProduction({
  outcome,
  productId,
  productVersion,
  environment = 'PRODUCTION',
  offlineRequired = false,
} = {}) {
  if (!outcome) throw Phase21Errors.certificationNotApproved();
  if (outcome.environment !== environment && outcome.environment !== 'PRODUCTION') {
    // Sandbox certification does not authorize Production
    if (environment === 'PRODUCTION' && outcome.environment === 'SANDBOX') {
      throw Phase21Errors.certificationNotApproved({
        message: 'Sandbox certification is not Production certification.',
      });
    }
  }
  if (outcome.productId !== productId || outcome.productVersion !== productVersion) {
    throw Phase21Errors.certificationCondition({
      message: 'Product ID/version must match certification.',
    });
  }
  if (
    ![CERTIFICATION_REVIEW_STATE.APPROVED, CERTIFICATION_REVIEW_STATE.CONDITIONALLY_APPROVED].includes(
      outcome.approvalState
    )
  ) {
    throw Phase21Errors.certificationNotApproved();
  }
  if (offlineRequired && outcome.conditions?.includes('OFFLINE_NOT_CERTIFIED')) {
    throw Phase21Errors.certificationCondition({ message: 'Offline not certified.' });
  }
  return true;
}
