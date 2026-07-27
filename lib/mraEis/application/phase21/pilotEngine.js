/**
 * Phase 21 — Pilot selection, entry criteria, controlled transaction validation, Go/No-Go.
 */

import crypto from 'crypto';
import { Phase21Errors } from './phase21Errors.js';
import { assertProductionChangeApproved } from './productionProvisioning.js';
import { assertCertificationAllowsProduction } from './certificationReview.js';

export const PILOT_DECISION = Object.freeze({
  GO_TO_LIMITED_ROLLOUT: 'GO_TO_LIMITED_ROLLOUT',
  GO_WITH_CONDITIONS: 'GO_WITH_CONDITIONS',
  EXTEND_PILOT: 'EXTEND_PILOT',
  PAUSE_AND_REMEDIATE: 'PAUSE_AND_REMEDIATE',
  ROLLBACK_PILOT: 'ROLLBACK_PILOT',
  NO_GO: 'NO_GO',
  BLOCKED: 'BLOCKED',
});

const PILOTS = new Map();

export function __resetPilotsForTests() {
  PILOTS.clear();
}

export function definePilotScope({
  tenantId,
  businessId,
  branchId,
  siteId,
  terminalId,
  agentId = null,
  deviceId = null,
  userIds = [],
  productIds = [],
  serviceIds = [],
  transactionTypes = ['CASH_SALE'],
  maxTransactionValue = '1000.00',
  maxDailyVolume = 50,
  observationWindowHours = 72,
  currency = 'MWK',
  offlineIncluded = false,
} = {}) {
  if (!tenantId || !businessId || !branchId || !siteId || !terminalId) {
    throw Phase21Errors.pilotScope({ message: 'Tenant, Business, Branch, Site and Terminal are required.' });
  }
  if (!userIds.length || (!productIds.length && !serviceIds.length)) {
    throw Phase21Errors.pilotScope({ message: 'Pilot users and Product/Service set must be explicit.' });
  }
  if (tenantId !== businessId) {
    // InsightBooks alias common; allow multi-business only when both set explicitly
  }
  return Object.freeze({
    tenantId,
    businessId,
    branchId,
    siteId,
    terminalId,
    agentId,
    deviceId,
    userIds: [...userIds],
    productIds: [...productIds],
    serviceIds: [...serviceIds],
    transactionTypes: [...transactionTypes],
    maxTransactionValue,
    maxDailyVolume,
    observationWindowHours,
    currency,
    offlineIncluded,
    autoEnableTenants: false,
    autoEnableBusinesses: false,
  });
}

export function evaluatePilotEntryCriteria({
  changeId,
  certificationOutcome,
  scope,
  productId,
  productVersion,
  monitoringActive = false,
  alertsTested = false,
  backupVerified = false,
  rollbackReady = false,
  usersTrained = false,
  supportAvailable = false,
  incidentCommanderAssigned = false,
  terminalActivated = false,
  configurationCurrent = false,
  catalogueCurrent = false,
  mappingsComplete = false,
  sequenceHealthy = false,
  noActiveRestrictions = false,
  credentialsProvisioned = false,
  releaseGatePassed = false,
} = {}) {
  assertProductionChangeApproved(changeId);
  assertCertificationAllowsProduction({
    outcome: certificationOutcome,
    productId,
    productVersion,
    environment: 'PRODUCTION',
    offlineRequired: Boolean(scope?.offlineIncluded),
  });

  const checks = {
    releaseGatePassed,
    changeApproved: true,
    certificationApproved: true,
    credentialsProvisioned,
    terminalActivated,
    configurationCurrent,
    catalogueCurrent,
    mappingsComplete,
    sequenceHealthy,
    noActiveRestrictions,
    monitoringActive,
    alertsTested,
    backupVerified,
    rollbackReady,
    usersTrained,
    supportAvailable,
    incidentCommanderAssigned,
    scopeExplicit: Boolean(scope?.tenantId && scope?.terminalId),
  };

  const failed = Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (failed.length) {
    throw Phase21Errors.pilotReadiness({
      message: `Pilot entry criteria failed: ${failed.join(', ')}`,
      details: { failed },
    });
  }

  const id = crypto.randomUUID();
  const pilot = {
    id,
    changeId,
    scope,
    productId,
    productVersion,
    state: 'READY',
    entryChecks: checks,
    transactions: [],
    createdAt: new Date().toISOString(),
  };
  PILOTS.set(id, pilot);
  return pilot;
}

/**
 * Record a controlled pilot fiscal transaction result (validation only — does not post).
 */
export function recordPilotTransactionResult({
  pilotId,
  approved = false,
  journalCount = 0,
  stockMovementCount = 0,
  snapshotCount = 0,
  fiscalNumberAssignedOnce = false,
  submissionCount = 0,
  acceptanceBasedOnApplicationEvidence = false,
  receiptBasedOnAcceptedEvidence = false,
  qrFollowsContract = false,
  httpSuccessAloneAccepted = false,
  historicalSale = false,
  accountingBalanced = false,
  reconciled = false,
  unknownBlindRetried = false,
  acceptedRetransmitted = false,
  serviceOnly = false,
} = {}) {
  const pilot = PILOTS.get(pilotId);
  if (!pilot) throw Phase21Errors.pilotReadiness({ message: 'Pilot not found.' });
  if (!approved) throw Phase21Errors.pilotReadiness({ message: 'Pilot transaction requires approval.' });
  if (historicalSale) throw Phase21Errors.historicalTransmissionBlocked();
  if (httpSuccessAloneAccepted) {
    throw Phase21Errors.pilotGoNoGo({ message: 'HTTP success alone must not be treated as acceptance.' });
  }
  if (journalCount !== 1) {
    throw Phase21Errors.pilotGoNoGo({ message: 'Pilot Journal must post exactly once.' });
  }
  if (!serviceOnly && stockMovementCount !== 1) {
    throw Phase21Errors.pilotGoNoGo({ message: 'Pilot Product Stock Movement must post exactly once.' });
  }
  if (serviceOnly && stockMovementCount !== 0) {
    throw Phase21Errors.pilotGoNoGo({ message: 'Service Sale must not create Product Stock Movement.' });
  }
  if (snapshotCount !== 1 || !fiscalNumberAssignedOnce || submissionCount !== 1) {
    throw Phase21Errors.pilotGoNoGo({ message: 'Snapshot/number/submission must occur once.' });
  }
  if (!acceptanceBasedOnApplicationEvidence || !receiptBasedOnAcceptedEvidence || !qrFollowsContract) {
    throw Phase21Errors.pilotGoNoGo({ message: 'Acceptance/Receipt/QR evidence rules failed.' });
  }
  if (!accountingBalanced || !reconciled) {
    throw Phase21Errors.pilotGoNoGo({ message: 'Pilot accounting/reconciliation failed.' });
  }
  if (unknownBlindRetried || acceptedRetransmitted) {
    throw Phase21Errors.pilotGoNoGo({ message: 'Retry/retransmission invariants violated.' });
  }

  const tx = {
    id: crypto.randomUUID(),
    journalCount,
    stockMovementCount,
    snapshotCount,
    fiscalNumberAssignedOnce,
    submissionCount,
    reconciled,
    createdAt: new Date().toISOString(),
  };
  pilot.transactions.push(tx);
  pilot.state = 'OBSERVING';
  return { pilot, transaction: tx };
}

export function evaluatePilotOutcome({
  pilotId,
  criticalIncidents = 0,
  highIncidents = 0,
  crossTenantIssue = false,
  environmentMix = false,
  duplicateJournal = false,
  duplicateStock = false,
  duplicateFiscalNumber = false,
  sequenceMovedBackwards = false,
  acceptedRetransmitted = false,
  unknownBlindRetried = false,
  credentialLeak = false,
  terminalBlockBypass = false,
  observationComplete = false,
  acceptanceRate = 1,
  supportWorking = true,
  monitoringWorking = true,
  conditions = [],
} = {}) {
  const pilot = PILOTS.get(pilotId);
  if (!pilot) throw Phase21Errors.pilotGoNoGo({ message: 'Pilot not found.' });

  const failed = [];
  if (!observationComplete) failed.push('OBSERVATION_INCOMPLETE');
  if (!pilot.transactions.length) failed.push('NO_PILOT_TRANSACTION');
  if (criticalIncidents > 0) failed.push('CRITICAL_INCIDENT');
  if (highIncidents > 0) failed.push('HIGH_INCIDENT');
  if (crossTenantIssue) failed.push('CROSS_TENANT');
  if (environmentMix) failed.push('ENVIRONMENT_MIX');
  if (duplicateJournal) failed.push('DUPLICATE_JOURNAL');
  if (duplicateStock) failed.push('DUPLICATE_STOCK');
  if (duplicateFiscalNumber) failed.push('DUPLICATE_FISCAL_NUMBER');
  if (sequenceMovedBackwards) failed.push('SEQUENCE_BACKWARDS');
  if (acceptedRetransmitted) failed.push('ACCEPTED_RETRANSMIT');
  if (unknownBlindRetried) failed.push('BLIND_RETRY');
  if (credentialLeak) failed.push('CREDENTIAL_LEAK');
  if (terminalBlockBypass) failed.push('TERMINAL_BLOCK_BYPASS');
  if (acceptanceRate < 0.95) failed.push('ACCEPTANCE_RATE');
  if (!supportWorking || !monitoringWorking) failed.push('OPS_SUPPORT');

  let decision;
  if (failed.some((f) => ['CROSS_TENANT', 'CREDENTIAL_LEAK', 'DUPLICATE_FISCAL_NUMBER'].includes(f))) {
    decision = PILOT_DECISION.ROLLBACK_PILOT;
  } else if (failed.includes('CRITICAL_INCIDENT') || failed.includes('DUPLICATE_JOURNAL')) {
    decision = PILOT_DECISION.PAUSE_AND_REMEDIATE;
  } else if (failed.length && failed.every((f) => f === 'OBSERVATION_INCOMPLETE')) {
    decision = PILOT_DECISION.EXTEND_PILOT;
  } else if (failed.length) {
    decision = PILOT_DECISION.NO_GO;
  } else if (conditions.length) {
    decision = PILOT_DECISION.GO_WITH_CONDITIONS;
  } else {
    decision = PILOT_DECISION.GO_TO_LIMITED_ROLLOUT;
  }

  const result = {
    pilotId,
    decision,
    passedCriteria: decision.startsWith('GO'),
    failedCriteria: failed,
    conditions,
    evidence: {
      transactionCount: pilot.transactions.length,
      acceptanceRate,
    },
    informalApprovalForbidden: true,
    decisionTimestamp: new Date().toISOString(),
    decisionVersion: 'phase21-pilot-gonogo-v1',
  };
  pilot.goNoGo = result;
  pilot.state = decision;
  return result;
}

export function getPilot(id) {
  return PILOTS.get(id) || null;
}
