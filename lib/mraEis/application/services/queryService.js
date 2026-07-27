import prisma from '@/lib/prisma.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { CONFIGURATION_STATUS, MAPPING_STATUS } from '../../domain/operationalEnums.js';

function page({ take = 50, cursor = null }) {
  const limit = Math.min(Math.max(Number(take) || 50, 1), 200);
  return {
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { id: 'asc' },
  };
}

export async function listBusinessTerminals({
  tenantId,
  businessId = tenantId,
  status = null,
  take,
  cursor,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  return db.mraEisTerminal.findMany({
    where: { tenantId, businessId, ...(status ? { status } : {}) },
    ...page({ take, cursor }),
  });
}

export async function getTerminalByBusiness({
  tenantId,
  businessId = tenantId,
  terminalId,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  return db.mraEisTerminal.findFirst({ where: { id: terminalId, tenantId, businessId } });
}

export async function getActiveConfigurations({
  tenantId,
  businessId = tenantId,
  terminalId,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  return db.mraEisConfigurationSnapshot.findMany({
    where: {
      tenantId,
      businessId,
      terminalId,
      status: CONFIGURATION_STATUS.ACTIVE,
    },
  });
}

export async function getMappingCompleteness({
  tenantId,
  businessId = tenantId,
  environment = 'SANDBOX',
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  // Phase 9 authoritative completeness (Product/Service remain placeholders)
  try {
    const { calculateMraEisMappingCompleteness } = await import(
      '../mapping/mappingCompleteness.js'
    );
    return calculateMraEisMappingCompleteness({ tenantId, businessId, environment, db });
  } catch {
    const [sites, products, taxes, payments] = await Promise.all([
      db.mraEisSiteMapping.count({
        where: { tenantId, businessId, status: { in: [MAPPING_STATUS.ACTIVE, MAPPING_STATUS.VERIFIED] } },
      }),
      db.mraEisProductMapping.count({
        where: { tenantId, businessId, status: { in: [MAPPING_STATUS.ACTIVE, MAPPING_STATUS.VERIFIED] } },
      }),
      db.mraEisTaxMapping.count({
        where: { tenantId, businessId, status: { in: [MAPPING_STATUS.ACTIVE, MAPPING_STATUS.VERIFIED] } },
      }),
      db.mraEisPaymentMethodMapping.count({
        where: { tenantId, businessId, status: { in: [MAPPING_STATUS.ACTIVE, MAPPING_STATUS.VERIFIED] } },
      }),
    ]);
    return {
      activeSiteMappings: sites,
      activeProductMappings: products,
      activeTaxMappings: taxes,
      activePaymentMappings: payments,
    };
  }
}

export async function getSnapshotBySourceIdentity({
  tenantId,
  businessId = tenantId,
  sourceType,
  sourceId,
  sourceVersion,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  return db.mraEisSnapshot.findFirst({
    where: { tenantId, businessId, sourceType, sourceId, sourceVersion },
    include: { /* lines loaded separately to avoid N+1 patterns in callers */ },
  });
}

export async function getTransmissionBySnapshot({
  tenantId,
  businessId = tenantId,
  snapshotId,
  mode = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  return db.mraEisTransmission.findMany({
    where: { tenantId, businessId, snapshotId, ...(mode ? { mode } : {}) },
  });
}

export async function listPendingTransmissions({
  tenantId,
  businessId = tenantId,
  take,
  cursor,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  return db.mraEisTransmission.findMany({
    where: {
      tenantId,
      businessId,
      status: { in: ['QUEUED', 'RETRY_SCHEDULED'] },
    },
    ...page({ take, cursor }),
  });
}

export async function listUnknownOutcomes({
  tenantId,
  businessId = tenantId,
  take,
  cursor,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  return db.mraEisTransmission.findMany({
    where: { tenantId, businessId, status: 'UNKNOWN_OUTCOME' },
    ...page({ take, cursor }),
  });
}

export async function getOutboxHealth({ tenantId, businessId = tenantId, db = prisma }) {
  assertTenantBusinessMatch(tenantId, businessId);
  const [pending, claimed, dead] = await Promise.all([
    db.mraEisOutbox.count({ where: { tenantId, businessId, status: 'PENDING' } }),
    db.mraEisOutbox.count({ where: { tenantId, businessId, status: 'CLAIMED' } }),
    db.mraEisOutbox.count({ where: { tenantId, businessId, status: 'DEAD_LETTER' } }),
  ]);
  return { pending, claimed, deadLetter: dead };
}
