import prisma from '@/lib/prisma.js';
import { MAPPING_STATUS } from '../../domain/operationalEnums.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';

/**
 * Terminal ↔ Branch ↔ Site consistency. Never auto-moves terminals.
 */
export async function evaluateTerminalSiteConsistency({
  tenantId,
  businessId = tenantId,
  terminalId,
  environment = 'SANDBOX',
  transactionDate = new Date(),
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();

  const terminal = await db.mraEisTerminal.findFirst({
    where: { id: terminalId, tenantId, businessId },
  });
  if (!terminal) {
    return {
      status: 'MANUAL_REVIEW',
      blockers: ['TERMINAL_NOT_FOUND'],
      warnings: [],
      terminalId,
    };
  }

  if (terminal.environment && String(terminal.environment).toUpperCase() !== env) {
    return {
      status: 'ENVIRONMENT_MISMATCH',
      blockers: ['ENVIRONMENT_MISMATCH'],
      warnings: [],
      terminalId,
      branchId: terminal.branchId,
    };
  }

  if (!terminal.branchId) {
    return {
      status: 'SITE_MAPPING_MISSING',
      blockers: ['BRANCH_SITE_MAPPING_REQUIRED'],
      warnings: ['TERMINAL_BRANCH_MISSING'],
      terminalId,
    };
  }

  const mappings = await db.mraEisSiteMapping.findMany({
    where: {
      tenantId,
      businessId,
      branchId: terminal.branchId,
      environment: env,
      status: { in: [MAPPING_STATUS.ACTIVE, MAPPING_STATUS.STALE, MAPPING_STATUS.CONFLICT] },
    },
  });

  const at = new Date(transactionDate);
  const active = mappings.filter(
    (m) =>
      m.status === MAPPING_STATUS.ACTIVE
      && new Date(m.effectiveFrom) <= at
      && (!m.effectiveTo || at <= new Date(m.effectiveTo))
  );

  if (mappings.some((m) => m.status === MAPPING_STATUS.STALE) && !active.length) {
    return {
      status: 'STALE_MAPPING',
      blockers: ['MAPPING_STALE'],
      warnings: [],
      terminalId,
      branchId: terminal.branchId,
    };
  }

  if (!active.length) {
    return {
      status: 'SITE_MAPPING_MISSING',
      blockers: ['BRANCH_SITE_MAPPING_REQUIRED'],
      warnings: [],
      terminalId,
      branchId: terminal.branchId,
    };
  }

  if (active.length > 1) {
    return {
      status: 'BRANCH_SITE_MISMATCH',
      blockers: ['SITE_MAPPING_AMBIGUOUS'],
      warnings: [],
      terminalId,
      branchId: terminal.branchId,
    };
  }

  const mapping = active[0];
  const site = await db.mraEisSite.findFirst({
    where: { tenantId, businessId, mraSiteId: mapping.mraSiteId, environment: env },
  });
  if (site && site.active === false) {
    return {
      status: 'SITE_INACTIVE',
      blockers: ['SITE_INACTIVE'],
      warnings: [],
      terminalId,
      branchId: terminal.branchId,
      mraSiteId: mapping.mraSiteId,
      siteMappingId: mapping.id,
    };
  }

  // Optional terminal-level site pin
  if (terminal.mraSiteId && terminal.mraSiteId !== mapping.mraSiteId) {
    return {
      status: 'TERMINAL_SITE_MISMATCH',
      blockers: ['TERMINAL_SITE_MISMATCH'],
      warnings: [],
      terminalId,
      branchId: terminal.branchId,
      mraSiteId: mapping.mraSiteId,
      terminalMraSiteId: terminal.mraSiteId,
      siteMappingId: mapping.id,
    };
  }

  return {
    status: 'CONSISTENT',
    blockers: [],
    warnings: [],
    terminalId,
    branchId: terminal.branchId,
    mraSiteId: mapping.mraSiteId,
    siteMappingId: mapping.id,
    mappingVersion: mapping.mappingVersion,
  };
}
