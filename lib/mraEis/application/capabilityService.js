import prisma from '@/lib/prisma.js';
import {
  EIS_OPERATION,
  EIS_ENVIRONMENT,
  EIS_FEATURE_FLAGS,
  POLICY_VERSION,
  CERTIFICATION_TYPE,
} from '../domain/constants.js';
import { evaluateMraEisCapability } from '../policies/effectiveCapability.js';
import {
  buildCapabilityCacheKey,
  cacheGet,
  cacheSet,
} from '../infrastructure/capabilityCache.js';
import { getPlatformEisSetting } from './platformService.js';
import { getCurrentEntitlement } from './entitlementService.js';
import { getParticipation } from './participationService.js';
import { getBusinessEisSetting } from './businessSettingService.js';
import { getLatestCertification } from './certificationService.js';

/**
 * Canonical server-side capability evaluation. All later phases must use this.
 * In InsightBooks V2, businessId defaults to tenantId (Tenant = Business).
 */
export async function evaluateTenantEisCapability({
  tenantId,
  businessId = tenantId,
  requestedOperation = EIS_OPERATION.VIEW_EIS,
  environment,
  actorContext = null,
  useCache = true,
  db = prisma,
} = {}) {
  if (!tenantId) {
    return evaluateMraEisCapability({
      tenantId: null,
      requestedOperation,
      platform: { status: 'DISABLED' },
    });
  }

  if (businessId && businessId !== tenantId) {
    // Reject foreign business ids in Phase 4 hierarchy
    return evaluateMraEisCapability({
      tenantId,
      businessId,
      requestedOperation,
      platform: { status: 'DISABLED' },
      entitlement: { status: 'NOT_ENTITLED' },
    });
  }

  const platform = await getPlatformEisSetting(db);
  const entitlement = await getCurrentEntitlement(tenantId, db);
  const participation = await getParticipation(tenantId, db);
  const businessSetting = await getBusinessEisSetting(tenantId, tenantId, db);
  const certification = await getLatestCertification(
    { tenantId, certificationType: CERTIFICATION_TYPE.ONLINE },
    db
  );
  const offlineCertification = await getLatestCertification(
    { tenantId, certificationType: CERTIFICATION_TYPE.OFFLINE },
    db
  );

  const env =
    environment ||
    businessSetting?.selectedEnvironment ||
    (entitlement?.productionAllowed ? EIS_ENVIRONMENT.SANDBOX : EIS_ENVIRONMENT.SANDBOX);

  const cacheKey = buildCapabilityCacheKey({
    tenantId,
    businessId: tenantId,
    requestedOperation,
    environment: env,
    platformVersion: platform.version || 0,
    entitlementVersion: entitlement?.version || 0,
    participationVersion: participation?.version || 0,
    businessVersion: businessSetting?.version || 0,
    certVersion: certification?.version || 0,
    policyVersion: POLICY_VERSION,
  });

  if (useCache) {
    const cached = cacheGet(cacheKey);
    if (cached) return { ...cached, cacheHit: true };
  }

  const result = evaluateMraEisCapability({
    tenantId,
    businessId: tenantId,
    requestedOperation,
    environment: env,
    platform: {
      status: platform.status,
      sandboxGloballyAllowed: platform.sandboxGloballyAllowed,
      productionGloballyAllowed: platform.productionGloballyAllowed,
    },
    entitlement,
    participation,
    businessSetting,
    certification,
    offlineCertification,
    futureRuntime: {
      // Phase 4 placeholders — never fabricate active terminals
      terminalActive: false,
      configurationCurrent: false,
      siteMappingComplete: false,
      productMappingComplete: false,
      taxMappingComplete: false,
      paymentMappingComplete: false,
      terminalBlocked: false,
      terminalStatus: 'NOT_IMPLEMENTED',
      configurationStatus: 'NOT_IMPLEMENTED',
    },
    featureFlags: {
      sandbox: platform.sandboxGloballyAllowed !== false,
      production: platform.productionGloballyAllowed === true,
      tenantOptIn: true,
      [EIS_FEATURE_FLAGS.OFFLINE_MODE]: false,
    },
    actorContext,
  });

  if (useCache) cacheSet(cacheKey, result);
  return { ...result, cacheHit: false };
}

export async function getEisReadinessSummary(tenantId, db = prisma) {
  const capability = await evaluateTenantEisCapability({
    tenantId,
    requestedOperation: EIS_OPERATION.VIEW_EIS,
    db,
  });
  const transmit = await evaluateTenantEisCapability({
    tenantId,
    requestedOperation: EIS_OPERATION.TRANSMIT_SALE,
    useCache: false,
    db,
  });

  return {
    tenantId,
    businessId: tenantId,
    entitlement: capability.tenantEntitlementStatus,
    participation: capability.tenantParticipationStatus,
    businessOperationalStatus: capability.businessOperationalStatus,
    environment: capability.requestedEnvironment,
    effectiveAvailable: capability.effectiveAvailable,
    effectiveSetupAllowed: capability.effectiveSetupAllowed,
    effectiveOperational: capability.effectiveOperational,
    canTransmit: transmit.operationAllowed,
    blockers: transmit.blockers,
    warnings: capability.warnings,
    requiredActions: transmit.requiredActions,
    futureDependencies: {
      terminal: capability.terminalStatus,
      configuration: capability.configurationStatus,
      siteMapping: capability.siteMappingStatus,
      productMapping: capability.productMappingStatus,
      taxMapping: capability.taxMappingStatus,
      paymentMapping: capability.paymentMappingStatus,
    },
    policyVersion: capability.policyVersion,
    evaluatedAt: capability.evaluatedAt,
  };
}

/**
 * Gate for legacy submit paths — never calls MRA; returns whether fiscalization may proceed.
 * Phase 4 always returns false for transmit until later phases clear futureRuntime blockers.
 */
export async function canPerformEisOperation(tenantId, operation = EIS_OPERATION.TRANSMIT_SALE) {
  const result = await evaluateTenantEisCapability({
    tenantId,
    requestedOperation: operation,
    useCache: true,
  });
  return {
    allowed: Boolean(result.operationAllowed && result.effectiveOperational),
    result,
  };
}
