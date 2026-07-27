import prisma from '@/lib/prisma.js';
import { TERMINAL_STATUS, MAPPING_STATUS, SYNC_STATUS } from '../../domain/operationalEnums.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { classifyBusinessEisType, BUSINESS_EIS_TYPE } from './businessTypeClassification.js';
import {
  getProductSyncContractDecision,
  getServiceSyncContractDecision,
} from './productSyncContract.js';
import { isMappingTypeBlocked } from '../mapping/mappingTypeRegistry.js';
import { evaluateConfigurationSyncReadiness } from '../configuration/syncReadinessService.js';

export const CATALOGUE_TYPES = Object.freeze({
  PRODUCTS: 'PRODUCTS',
  SERVICES: 'SERVICES',
  COMBINED: 'COMBINED',
});

/**
 * Server-authoritative catalogue sync readiness.
 */
export async function evaluateCatalogueSyncReadiness({
  tenantId,
  businessId = tenantId,
  terminalId,
  siteMappingId = null,
  environment = 'SANDBOX',
  catalogueType = CATALOGUE_TYPES.PRODUCTS,
  trigger = 'MANUAL',
  actorOrServiceContext = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();
  const blockers = [];
  const warnings = [];
  const requiredActions = [];

  const businessClass = await classifyBusinessEisType({ tenantId, businessId, environment: env, db });
  if (businessClass.businessType === BUSINESS_EIS_TYPE.UNKNOWN) {
    blockers.push('BUSINESS_TYPE_UNKNOWN');
  }
  if (catalogueType === CATALOGUE_TYPES.PRODUCTS && !businessClass.requiresProductMapping) {
    warnings.push('PRODUCT_CATALOGUE_NOT_APPLICABLE');
  }
  if (catalogueType === CATALOGUE_TYPES.SERVICES && !businessClass.requiresServiceMapping) {
    warnings.push('SERVICE_CATALOGUE_NOT_APPLICABLE');
  }

  let configReadiness = null;
  try {
    configReadiness = await evaluateConfigurationSyncReadiness({
      tenantId,
      businessId,
      terminalId,
      environment: env,
      trigger: 'MANUAL',
      db,
    });
  } catch {
    configReadiness = { syncAllowed: false, blockers: ['CONFIGURATION_NOT_CURRENT'] };
  }

  const platformEnabled = configReadiness?.platformEnabled !== false;
  const tenantEntitled = configReadiness?.tenantEntitled !== false;
  const tenantParticipating = configReadiness?.tenantParticipating !== false;
  const businessOperational = configReadiness?.businessOperational !== false;
  const configurationCurrent = Boolean(configReadiness?.configurationCurrent ?? configReadiness?.syncAllowed);

  if (!platformEnabled) blockers.push('PLATFORM_DISABLED');
  if (!tenantEntitled) blockers.push('TENANT_NOT_ENTITLED');
  if (!tenantParticipating) blockers.push('TENANT_NOT_PARTICIPATING');
  if (!configurationCurrent) {
    blockers.push('CONFIGURATION_NOT_CURRENT');
    requiredActions.push('SYNC_CONFIGURATION');
  }

  const terminal = terminalId
    ? await db.mraEisTerminal.findFirst({ where: { id: terminalId, tenantId, businessId } })
    : null;
  const terminalActive = terminal?.status === TERMINAL_STATUS.ACTIVE || terminal?.status === 'ACTIVE';
  const terminalBlocked = Boolean(terminal?.blocked || terminal?.status === TERMINAL_STATUS.BLOCKED);
  if (!terminal || !terminalActive) blockers.push('TERMINAL_NOT_ACTIVE');
  if (terminalBlocked) blockers.push('TERMINAL_BLOCKED');
  if (terminal?.environment && String(terminal.environment).toUpperCase() !== env) {
    blockers.push('ENVIRONMENT_MISMATCH');
  }

  const siteMapping = siteMappingId
    ? await db.mraEisSiteMapping.findFirst({
        where: { id: siteMappingId, tenantId, businessId, status: MAPPING_STATUS.ACTIVE },
      })
    : await db.mraEisSiteMapping.findFirst({
        where: {
          tenantId,
          businessId,
          environment: env,
          status: MAPPING_STATUS.ACTIVE,
          ...(terminal?.branchId ? { branchId: terminal.branchId } : {}),
        },
      });
  const siteMappingActive = Boolean(siteMapping);
  if (!siteMappingActive) {
    blockers.push('SITE_MAPPING_REQUIRED');
    requiredActions.push('MAP_BRANCH_TO_MRA_SITE');
  }

  let warehouseMappingStatus = 'NOT_REQUIRED';
  let virtualWarehouseStatus = 'NOT_REQUIRED';
  if (businessClass.requiresProductMapping) {
    warehouseMappingStatus = 'PROVISIONAL';
    if (isMappingTypeBlocked('WAREHOUSE_TO_MRA_VIRTUAL_WAREHOUSE')) {
      virtualWarehouseStatus = 'REQUIRES_MRA_CLARIFICATION';
      warnings.push('VIRTUAL_WAREHOUSE_MAPPING_REQUIRED');
    }
  }

  const productContract = getProductSyncContractDecision();
  const serviceContract = getServiceSyncContractDecision();
  const endpointVerified = false;
  const requestMethodVerified = false;
  const requestHashVerified = false;

  if (!productContract.productionCallsAllowed && env === 'PRODUCTION') {
    blockers.push('PRODUCT_SYNC_CONTRACT_UNVERIFIED');
  }
  if (catalogueType !== CATALOGUE_TYPES.SERVICES && productContract.status === 'REQUIRES_MRA_CLARIFICATION') {
    if (env === 'PRODUCTION') blockers.push('PRODUCT_SYNC_METHOD_CONFLICT');
    else warnings.push('PRODUCT_SYNC_CONTRACT_UNVERIFIED');
  }
  if (catalogueType !== CATALOGUE_TYPES.PRODUCTS && serviceContract.status === 'REQUIRES_MRA_CLARIFICATION') {
    if (env === 'PRODUCTION') blockers.push('SERVICE_SYNC_CONTRACT_UNVERIFIED');
    else warnings.push('SERVICE_SYNC_CONTRACT_UNVERIFIED');
  }
  blockers.push('REQUEST_HASH_UNVERIFIED'); // fail-closed outside verified hash (Phase 6/8 carry)

  const activeSync = await db.mraEisSyncRun.findFirst({
    where: {
      tenantId,
      businessId,
      terminalId: terminalId || undefined,
      syncType: { in: ['PRODUCTS', 'SERVICES'] },
      status: {
        in: [
          SYNC_STATUS.QUEUED,
          SYNC_STATUS.CLAIMED,
          SYNC_STATUS.FETCHING,
          'VALIDATING_READINESS',
          'REQUEST_MAPPING',
          'STORING_CATALOGUE',
        ],
      },
    },
  }).catch(() => null);
  if (activeSync) blockers.push('ACTIVE_CATALOGUE_SYNC_ALREADY_RUNNING');

  // MOCK sandbox may sync despite contract warning if terminal active + site mapped + config current
  const mockMode = String(process.env.MRA_EIS_ACTIVATION_MODE || 'MOCK').toUpperCase() === 'MOCK';
  const syncAllowed =
    mockMode
    && env !== 'PRODUCTION'
    && terminalActive
    && !terminalBlocked
    && siteMappingActive
    && configurationCurrent
    && !activeSync
    && businessClass.businessType !== BUSINESS_EIS_TYPE.UNKNOWN
    && !blockers.includes('ENVIRONMENT_MISMATCH');

  // Remove REQUEST_HASH from hard block for MOCK-only path (hash still unverified for live)
  const effectiveBlockers = syncAllowed
    ? blockers.filter((b) => b !== 'REQUEST_HASH_UNVERIFIED' && !b.includes('CONTRACT'))
    : [...new Set(blockers)];

  return {
    platformEnabled,
    tenantEntitled,
    tenantParticipating,
    businessOperational,
    businessType: businessClass.businessType,
    terminalActive,
    terminalBlocked,
    terminalEnvironment: terminal?.environment || null,
    configurationCurrent,
    siteMappingActive,
    warehouseMappingStatus,
    virtualWarehouseStatus,
    credentialAvailable: Boolean(terminal?.credentialReferenceId || terminal?.status === TERMINAL_STATUS.ACTIVE),
    tokenValid: terminalActive,
    endpointVerified,
    requestMethodVerified,
    requestHashVerified,
    certificationSatisfied: configReadiness?.certificationSatisfied !== false,
    activeSyncExists: Boolean(activeSync),
    syncAllowed: Boolean(syncAllowed),
    blockers: [...new Set(effectiveBlockers)],
    warnings: [...new Set(warnings)],
    requiredActions: [...new Set(requiredActions)],
    policyVersion: 'phase10-catalogue-sync-readiness-v1',
    evaluatedAt: new Date().toISOString(),
    catalogueType,
    trigger,
    productContractStatus: productContract.status,
    serviceContractStatus: serviceContract.status,
    mockMode,
    actorId: actorOrServiceContext?.actorId || null,
  };
}
