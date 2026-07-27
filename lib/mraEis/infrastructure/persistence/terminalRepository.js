import prisma from '@/lib/prisma.js';
import { EisErrors } from '../../domain/errors.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';

export async function findByIdForBusiness({ tenantId, businessId = tenantId, terminalId, db = prisma }) {
  assertTenantBusinessMatch(tenantId, businessId);
  return db.mraEisTerminal.findFirst({ where: { id: terminalId, tenantId, businessId } });
}

export async function findByLabelForBusiness({
  tenantId,
  businessId = tenantId,
  environment,
  terminalLabel,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  return db.mraEisTerminal.findFirst({
    where: { tenantId, businessId, environment, terminalLabel },
  });
}

export async function saveWithExpectedVersion({
  tenantId,
  businessId = tenantId,
  terminalId,
  expectedVersion,
  data,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const result = await db.mraEisTerminal.updateMany({
    where: { id: terminalId, tenantId, businessId, version: expectedVersion },
    data: { ...data, version: { increment: 1 } },
  });
  if (result.count === 0) {
    throw EisErrors.versionConflict({
      tenantId,
      businessId,
      details: { terminalId, expectedVersion },
    });
  }
  return findByIdForBusiness({ tenantId, businessId, terminalId, db });
}
