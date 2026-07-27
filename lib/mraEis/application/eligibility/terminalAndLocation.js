/**
 * Terminal, Branch, Site, Warehouse resolution helpers for eligibility — Phase 11.
 */
import prisma from '@/lib/prisma.js';
import { TERMINAL_STATUS } from '../../domain/operationalEnums.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { evaluateConfigurationFreshness } from '../configuration/stalenessService.js';
import { resolveMraSiteForTransaction } from '../mapping/resolutionServices.js';
import { evaluateWarehouseMappingRequirement } from '../mapping/warehouseMapping.js';

export const TERMINAL_RESOLUTION_VERSION = 'phase11-terminal-resolution-v1';

/**
 * Deterministic terminal resolution — exactly one authorized terminal or block.
 */
export async function resolveMraTerminalForLocalSale({
  tenantId,
  businessId = tenantId,
  branchId,
  sourceType,
  sourceId = null,
  transactionDate = new Date(),
  environment = 'SANDBOX',
  preferredTerminalId = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();
  const blockers = [];
  const warnings = [];

  if (preferredTerminalId) {
    const preferred = await db.mraEisTerminal.findFirst({
      where: { id: preferredTerminalId, tenantId, businessId, environment: env },
    });
    if (!preferred) {
      return {
        resolved: false,
        terminalId: null,
        blockers: ['TERMINAL_SELECTION_INVALID'],
        warnings,
        resolutionVersion: TERMINAL_RESOLUTION_VERSION,
      };
    }
    return finalizeTerminal(preferred, { branchId, blockers, warnings, env, db, tenantId, businessId });
  }

  const where = {
    tenantId,
    businessId,
    environment: env,
    status: { in: [TERMINAL_STATUS.ACTIVE, 'ACTIVE'] },
  };
  if (branchId) where.OR = [{ branchId }, { branchId: null }];

  const terminals = await db.mraEisTerminal.findMany({ where });
  const scoped = branchId
    ? terminals.filter((t) => !t.branchId || t.branchId === branchId)
    : terminals;

  if (scoped.length === 0) {
    return {
      resolved: false,
      terminalId: null,
      terminalStatus: null,
      environment: env,
      blockers: ['NO_ACTIVE_TERMINAL'],
      warnings,
      resolutionVersion: TERMINAL_RESOLUTION_VERSION,
      sourceType,
      sourceId,
      transactionDate,
    };
  }
  if (scoped.length > 1) {
    return {
      resolved: false,
      terminalId: null,
      terminalStatus: null,
      environment: env,
      blockers: ['TERMINAL_AMBIGUOUS'],
      warnings,
      resolutionVersion: TERMINAL_RESOLUTION_VERSION,
    };
  }

  return finalizeTerminal(scoped[0], { branchId, blockers, warnings, env, db, tenantId, businessId });
}

async function finalizeTerminal(terminal, { branchId, blockers, warnings, env, db, tenantId, businessId }) {
  if (terminal.blockedAt || terminal.status === TERMINAL_STATUS.BLOCKED || terminal.status === 'BLOCKED') {
    blockers.push('TERMINAL_BLOCKED');
  }
  if (String(terminal.environment).toUpperCase() !== env) {
    blockers.push('TERMINAL_ENVIRONMENT_MISMATCH');
  }
  if (terminal.branchId && branchId && terminal.branchId !== branchId) {
    blockers.push('TERMINAL_BRANCH_MISMATCH');
  }

  const freshness = await evaluateConfigurationFreshness({
    tenantId,
    businessId,
    terminalId: terminal.id,
    db,
  });
  if (!freshness.allowNewFiscalSnapshots) {
    blockers.push(...(freshness.blockers || ['CONFIGURATION_NOT_CURRENT']));
  } else if (freshness.warnings?.length) {
    warnings.push(...freshness.warnings);
  }

  return {
    resolved: blockers.length === 0,
    terminalId: terminal.id,
    terminalStatus: terminal.status,
    environment: env,
    terminalScope: terminal.branchId ? 'BRANCH' : 'BUSINESS',
    terminalPosition: terminal.terminalPosition || null,
    siteConsistency: !terminal.branchId || !branchId || terminal.branchId === branchId,
    configurationHealth: freshness.status,
    credentialHealth: terminal.currentCredentialReferenceId ? 'REFERENCE_PRESENT' : 'MISSING_REFERENCE',
    configurationSetChecksum: freshness.checksum || null,
    blockers,
    warnings,
    resolutionVersion: TERMINAL_RESOLUTION_VERSION,
  };
}

export async function resolveBranchForSale({
  tenantId,
  businessId = tenantId,
  branchId,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (!branchId) {
    return { resolved: false, branchId: null, blockers: ['BRANCH_REQUIRED'], warnings: [] };
  }
  const branch = await db.branch.findFirst({
    where: { id: branchId, tenantId },
  }).catch(() => null);

  // Some schemas use businessId on branch
  if (!branch) {
    const alt = await db.branch.findFirst({ where: { id: branchId } }).catch(() => null);
    if (!alt || (alt.tenantId && alt.tenantId !== tenantId) || (alt.businessId && alt.businessId !== businessId)) {
      return { resolved: false, branchId, blockers: ['FOREIGN_OR_MISSING_BRANCH'], warnings: [] };
    }
    if (alt.isArchived || alt.status === 'ARCHIVED') {
      return { resolved: false, branchId, blockers: ['BRANCH_ARCHIVED'], warnings: [] };
    }
    return { resolved: true, branchId, blockers: [], warnings: [], branch };
  }
  if (branch.isArchived || branch.status === 'ARCHIVED') {
    return { resolved: false, branchId, blockers: ['BRANCH_ARCHIVED'], warnings: [] };
  }
  return { resolved: true, branchId, blockers: [], warnings: [], branch };
}

export async function resolveSiteAndWarehouseForSale({
  tenantId,
  businessId,
  branchId,
  warehouseId = null,
  terminalId = null,
  transactionDate,
  environment,
  hasProductLines = true,
  db = prisma,
}) {
  const site = await resolveMraSiteForTransaction({
    tenantId,
    businessId,
    branchId,
    warehouseId,
    terminalId,
    transactionDate,
    environment,
    db,
  });

  const warehouseReq = await evaluateWarehouseMappingRequirement({
    tenantId,
    businessId,
    isProductBased: hasProductLines,
  });
  const warehouse = {
    required: warehouseReq.required,
    ready: !warehouseReq.required || Boolean(warehouseId) || Boolean(site.warehouseMappingId),
    virtualWarehouseBlocked: warehouseReq.virtualWarehouseBlocked,
    blockers:
      warehouseReq.required && warehouseReq.virtualWarehouseBlocked && !site.warehouseMappingId
        ? ['VIRTUAL_WAREHOUSE_MAPPING_UNVERIFIED']
        : [],
    warnings: warehouseReq.message ? [warehouseReq.message] : [],
  };

  return { site, warehouse };
}
