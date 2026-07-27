/**
 * EIS applicability + go-live boundary — Phase 11.
 * Server-authoritative. Disabled/non-entitled businesses keep existing workflows.
 * Applicability uses control-plane gates only (not full transmit readiness).
 */
import prisma from '@/lib/prisma.js';
import { EIS_OPERATION, PLATFORM_STATUS, ENTITLEMENT_STATUS, PARTICIPATION_STATUS } from '../../domain/constants.js';
import { evaluateTenantEisCapability } from '../capabilityService.js';
import { getBusinessEisSetting } from '../businessSettingService.js';
import {
  getSalesTransactionTypeDefinition,
  isQualifyingSalesSourceType,
  SALES_TRANSACTION_TYPE_REGISTRY_VERSION,
} from './salesTransactionTypeRegistry.js';

export const APPLICABILITY_RESULT = Object.freeze({
  NOT_APPLICABLE_PLATFORM_DISABLED: 'NOT_APPLICABLE_PLATFORM_DISABLED',
  NOT_APPLICABLE_TENANT_NOT_ENTITLED: 'NOT_APPLICABLE_TENANT_NOT_ENTITLED',
  NOT_APPLICABLE_TENANT_NOT_PARTICIPATING: 'NOT_APPLICABLE_TENANT_NOT_PARTICIPATING',
  NOT_APPLICABLE_BUSINESS_DISABLED: 'NOT_APPLICABLE_BUSINESS_DISABLED',
  NOT_APPLICABLE_TRANSACTION_TYPE: 'NOT_APPLICABLE_TRANSACTION_TYPE',
  NOT_APPLICABLE_DRAFT: 'NOT_APPLICABLE_DRAFT',
  NOT_APPLICABLE_BEFORE_GO_LIVE: 'NOT_APPLICABLE_BEFORE_GO_LIVE',
  APPLICABLE: 'APPLICABLE',
  APPLICABLE_WITH_WARNING: 'APPLICABLE_WITH_WARNING',
  BLOCKED_UNSUPPORTED_TRANSACTION_TYPE: 'BLOCKED_UNSUPPORTED_TRANSACTION_TYPE',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

export const APPLICABILITY_POLICY_VERSION = 'phase11-applicability-v1';
export const GO_LIVE_POLICY_VERSION = 'phase11-go-live-v1';

const DRAFT_STATES = new Set([
  'DRAFT',
  'SUSPENDED',
  'ABANDONED',
  'CART',
  'QUOTE',
  'QUOTATION',
  'ESTIMATE',
  'PROFORMA',
  'PENDING_APPROVAL',
]);

/**
 * Resolve Business go-live boundary (environment-scoped).
 * Backdating does not create bridge records; only gates new finalizations.
 */
export async function resolveEisGoLiveBoundary({
  tenantId,
  businessId = tenantId,
  environment = 'SANDBOX',
  db = prisma,
}) {
  const setting = await getBusinessEisSetting(tenantId, businessId, db);
  const env = String(environment || setting?.selectedEnvironment || 'SANDBOX').toUpperCase();
  const goLiveAt = setting?.eisGoLiveAt
    ? new Date(setting.eisGoLiveAt)
    : setting?.enabledAt
      ? new Date(setting.enabledAt)
      : null;

  return {
    environment: env,
    eisGoLiveAt: goLiveAt,
    businessTimezone: setting?.businessTimezone || 'Africa/Blantyre',
    firstEligibleBusinessDate: goLiveAt,
    enabledTransactionTypes: ['POS_SALE', 'SALES_INVOICE'],
    activationSource: setting?.enabledBy ? 'BUSINESS_ENABLE' : 'NONE',
    approvedBy: setting?.enabledBy || null,
    policyVersion: GO_LIVE_POLICY_VERSION,
    settingVersion: setting?.version || 0,
  };
}

export function isBeforeGoLive({ transactionFinalizedAt, goLiveAt }) {
  if (!goLiveAt) return false;
  if (!transactionFinalizedAt) return false;
  return new Date(transactionFinalizedAt).getTime() < new Date(goLiveAt).getTime();
}

/**
 * evaluateEisApplicability — Stage 1 gate.
 */
export async function evaluateEisApplicability({
  tenantId,
  businessId = tenantId,
  sourceType,
  sourceId = null,
  sourceState = null,
  environment = null,
  transactionFinalizedAt = null,
  historicalTransaction = false,
  actorContext = null,
  db = prisma,
} = {}) {
  const blockers = [];
  const warnings = [];
  const typeDef = getSalesTransactionTypeDefinition(sourceType);

  const capability = await evaluateTenantEisCapability({
    tenantId,
    businessId,
    requestedOperation: EIS_OPERATION.VIEW_EIS,
    environment,
    actorContext,
    useCache: true,
    db,
  });

  const env = String(environment || capability.requestedEnvironment || 'SANDBOX').toUpperCase();
  const goLive = await resolveEisGoLiveBoundary({ tenantId, businessId, environment: env, db });

  const platformAvailable =
    Boolean(capability.platformEnabled) &&
    capability.platformStatus === PLATFORM_STATUS.ENABLED &&
    !capability.emergencyPaused;

  const tenantEntitled =
    Boolean(capability.tenantEntitled) &&
    capability.tenantEntitlementStatus !== ENTITLEMENT_STATUS.NOT_ENTITLED &&
    capability.tenantEntitlementStatus !== ENTITLEMENT_STATUS.REVOKED &&
    capability.tenantEntitlementStatus !== ENTITLEMENT_STATUS.EXPIRED;

  const tenantParticipating =
    Boolean(capability.tenantParticipating) &&
    capability.tenantParticipationStatus !== PARTICIPATION_STATUS.OPTED_OUT &&
    capability.tenantParticipationStatus !== PARTICIPATION_STATUS.NOT_PARTICIPATING;

  const businessEnabled = Boolean(capability.businessOperationallyEnabled);
  const environmentAuthorized = Boolean(capability.environmentAllowed);

  const base = {
    applicable: false,
    reason: null,
    platformAvailable,
    tenantEntitled,
    tenantParticipating,
    businessEnabled,
    environmentAuthorized,
    sourceTypeSupported: isQualifyingSalesSourceType(sourceType),
    sourceStateQualifying: true,
    featureFlagState: 'PHASE_11_ENABLED',
    goLiveBoundary: goLive,
    historicalTransaction: Boolean(historicalTransaction),
    blockers,
    warnings,
    applicabilityPolicyVersion: APPLICABILITY_POLICY_VERSION,
    typeRegistryVersion: SALES_TRANSACTION_TYPE_REGISTRY_VERSION,
    sourceId,
    sourceType: typeDef.sourceType,
    environment: env,
  };

  if (!platformAvailable) {
    return { ...base, reason: APPLICABILITY_RESULT.NOT_APPLICABLE_PLATFORM_DISABLED };
  }
  if (!tenantEntitled) {
    return { ...base, reason: APPLICABILITY_RESULT.NOT_APPLICABLE_TENANT_NOT_ENTITLED };
  }
  if (!tenantParticipating) {
    return { ...base, reason: APPLICABILITY_RESULT.NOT_APPLICABLE_TENANT_NOT_PARTICIPATING };
  }
  if (!businessEnabled || !environmentAuthorized) {
    return { ...base, reason: APPLICABILITY_RESULT.NOT_APPLICABLE_BUSINESS_DISABLED };
  }

  if (typeDef.eisApplicability === 'CORRECTION_FUTURE') {
    blockers.push('CORRECTION_WORKFLOW_NOT_IMPLEMENTED');
    return {
      ...base,
      reason: APPLICABILITY_RESULT.BLOCKED_UNSUPPORTED_TRANSACTION_TYPE,
      sourceTypeSupported: false,
      blockers,
    };
  }

  if (typeDef.eisApplicability === 'EXCLUDED') {
    return {
      ...base,
      reason: APPLICABILITY_RESULT.NOT_APPLICABLE_TRANSACTION_TYPE,
      sourceTypeSupported: false,
    };
  }

  if (typeDef.eisApplicability === 'UNKNOWN') {
    return {
      ...base,
      reason: APPLICABILITY_RESULT.MANUAL_REVIEW,
      sourceTypeSupported: false,
    };
  }

  const state = String(sourceState || '').toUpperCase();
  if (state && DRAFT_STATES.has(state)) {
    return {
      ...base,
      reason: APPLICABILITY_RESULT.NOT_APPLICABLE_DRAFT,
      sourceStateQualifying: false,
    };
  }

  if (historicalTransaction || isBeforeGoLive({ transactionFinalizedAt, goLiveAt: goLive.eisGoLiveAt })) {
    return {
      ...base,
      reason: APPLICABILITY_RESULT.NOT_APPLICABLE_BEFORE_GO_LIVE,
      historicalTransaction: true,
    };
  }

  for (const w of capability.warnings || []) {
    warnings.push(typeof w === 'string' ? w : w.code || w.message);
  }

  return {
    ...base,
    applicable: true,
    reason: warnings.length ? APPLICABILITY_RESULT.APPLICABLE_WITH_WARNING : APPLICABILITY_RESULT.APPLICABLE,
    sourceTypeSupported: true,
    sourceStateQualifying: true,
    warnings,
  };
}
