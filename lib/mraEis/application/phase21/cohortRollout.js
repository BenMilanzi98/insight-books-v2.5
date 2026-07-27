/**
 * Phase 21 — Cohort-based Tenant rollout (no automatic enable-all).
 * Enablement is policy-mediated and idempotent.
 */

import crypto from 'crypto';
import { Phase21Errors } from './phase21Errors.js';
import { PILOT_DECISION } from './pilotEngine.js';

export const DEFAULT_COHORTS = Object.freeze([
  { id: 'COHORT_0', label: 'Internal technical validation', autoEnable: false },
  { id: 'COHORT_1', label: 'Pilot Tenant/Business', autoEnable: false },
  { id: 'COHORT_2', label: 'Small low-volume Businesses', autoEnable: false },
  { id: 'COHORT_3', label: 'Medium-volume multi-Branch', autoEnable: false },
  { id: 'COHORT_4', label: 'High-volume complex Catalogue', autoEnable: false },
  { id: 'COHORT_5', label: 'Certified Offline Sites', autoEnable: false },
  { id: 'COHORT_6', label: 'Remaining approved Tenants', autoEnable: false },
]);

const COHORTS = new Map();
const ENABLEMENTS = new Map();

export function __resetCohortsForTests() {
  COHORTS.clear();
  ENABLEMENTS.clear();
}

export function createRolloutPlan({ pilotDecision, cohorts = DEFAULT_COHORTS } = {}) {
  if (
    ![PILOT_DECISION.GO_TO_LIMITED_ROLLOUT, PILOT_DECISION.GO_WITH_CONDITIONS].includes(pilotDecision)
  ) {
    throw Phase21Errors.cohortEnablement({
      message: 'Rollout plan requires a Pilot GO decision.',
    });
  }
  const planId = crypto.randomUUID();
  for (const c of cohorts) {
    COHORTS.set(`${planId}:${c.id}`, {
      planId,
      ...c,
      state: c.id === 'COHORT_0' || c.id === 'COHORT_1' ? 'ELIGIBLE' : 'PENDING',
      enabledTenants: [],
      enabledBusinesses: [],
      paused: false,
      verified: false,
    });
  }
  return { planId, cohorts: [...cohorts], autoEnableAllForbidden: true };
}

export function evaluateCohortReadiness({
  planId,
  cohortId,
  entitlement = false,
  participation = false,
  certificationValid = false,
  terminalReady = false,
  configurationCurrent = false,
  mappingsComplete = false,
  sequenceHealthy = false,
  trainingComplete = false,
  supportCoverage = false,
  monitoringActive = false,
  backupVerified = false,
  rollbackReady = false,
  noActiveRestrictions = false,
  communicationSent = false,
  offlineCertifiedIfRequired = true,
} = {}) {
  const key = `${planId}:${cohortId}`;
  const cohort = COHORTS.get(key);
  if (!cohort) throw Phase21Errors.cohortReadiness({ message: 'Unknown cohort.' });
  if (cohort.paused) throw Phase21Errors.cohortReadiness({ message: 'Cohort is paused.' });

  const checks = {
    entitlement,
    participation,
    certificationValid,
    terminalReady,
    configurationCurrent,
    mappingsComplete,
    sequenceHealthy,
    trainingComplete,
    supportCoverage,
    monitoringActive,
    backupVerified,
    rollbackReady,
    noActiveRestrictions,
    communicationSent,
    offlineCertifiedIfRequired,
  };
  const failed = Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (failed.length) {
    throw Phase21Errors.cohortReadiness({
      message: `Cohort readiness failed: ${failed.join(', ')}`,
      details: { failed },
    });
  }
  cohort.state = 'READY';
  cohort.readiness = checks;
  return cohort;
}

/**
 * Enable a single Tenant/Business through explicit call — never bulk auto.
 */
export function enableCohortMember({
  planId,
  cohortId,
  tenantId,
  businessId,
  operatorId,
  idempotencyKey,
  usePolicyControls = true,
} = {}) {
  const key = `${planId}:${cohortId}`;
  const cohort = COHORTS.get(key);
  if (!cohort) {
    throw Phase21Errors.cohortEnablement({ message: 'Unknown cohort.' });
  }
  if (cohort.paused) {
    throw Phase21Errors.cohortEnablement({ message: 'Cohort is paused.' });
  }
  if (cohort.state !== 'READY' && !cohort.readiness) {
    throw Phase21Errors.cohortEnablement({
      message: 'Cohort must be READY (run evaluateCohortReadiness first).',
    });
  }
  if (cohort.readiness && cohort.state !== 'READY') {
    cohort.state = 'READY';
  }
  if (!usePolicyControls) {
    throw Phase21Errors.cohortEnablement({
      message: 'Enablement must use Phase 4 policy controls — direct status updates forbidden.',
    });
  }
  if (!tenantId || !businessId) throw Phase21Errors.cohortEnablement();
  if (!idempotencyKey) {
    throw Phase21Errors.cohortEnablement({ message: 'Idempotency key required.' });
  }

  if (ENABLEMENTS.has(idempotencyKey)) {
    return { ...ENABLEMENTS.get(idempotencyKey), duplicate: true };
  }

  const enablement = {
    id: crypto.randomUUID(),
    planId,
    cohortId,
    tenantId,
    businessId,
    operatorId,
    idempotencyKey,
    enabledAt: new Date().toISOString(),
    fiscalEffects: 0,
  };
  ENABLEMENTS.set(idempotencyKey, enablement);
  if (!cohort.enabledTenants.includes(tenantId)) cohort.enabledTenants.push(tenantId);
  if (!cohort.enabledBusinesses.includes(businessId)) cohort.enabledBusinesses.push(businessId);
  cohort.state = 'ENABLED_PARTIAL';
  return { ...enablement, duplicate: false };
}

export function verifyCohortPostEnable({
  planId,
  cohortId,
  accountingOk = false,
  inventoryOk = false,
  fiscalOk = false,
  reportsOk = false,
  noRegressionPriorCohorts = false,
} = {}) {
  const cohort = COHORTS.get(`${planId}:${cohortId}`);
  if (!cohort) throw Phase21Errors.cohortEnablement();
  if (!(accountingOk && inventoryOk && fiscalOk && reportsOk && noRegressionPriorCohorts)) {
    throw Phase21Errors.cohortEnablement({
      message: 'Post-enable verification failed — hold progression.',
    });
  }
  cohort.verified = true;
  cohort.state = 'VERIFIED';
  return cohort;
}

export function pauseRollout({ planId, cohortId = null, reason } = {}) {
  const blocking = [
    'CRITICAL_INCIDENT',
    'DUPLICATE_FISCAL_NUMBER',
    'CROSS_TENANT',
    'CREDENTIAL_EXPOSURE',
    'SEQUENCE_BACKWARDS',
    'MRA_INSTRUCTION',
  ];
  if (!reason) throw Phase21Errors.cohortEnablement({ message: 'Pause reason required.' });
  for (const [k, c] of COHORTS) {
    if (!k.startsWith(`${planId}:`)) continue;
    if (cohortId && c.id !== cohortId) continue;
    c.paused = true;
    c.state = 'PAUSED';
    c.pauseReason = reason;
  }
  return { planId, cohortId, reason, blockingReasons: blocking, paused: true };
}

export function listCohorts(planId) {
  return [...COHORTS.values()].filter((c) => c.planId === planId);
}
