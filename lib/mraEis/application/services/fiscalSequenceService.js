import prisma from '@/lib/prisma.js';
import { FISCAL_ALLOCATION_STATUS } from '../../domain/operationalEnums.js';
import { EisErrors } from '../../domain/errors.js';
import {
  assertTenantBusinessMatch,
  createBusinessDate,
} from '../../domain/valueObjects/index.js';

/**
 * Atomic per-terminal daily sequence allocation.
 * Does NOT claim MRA-approved fiscal number encoding (algorithmVersion UNVERIFIED_PHASE5).
 */
export async function reserveFiscalSequence({
  tenantId,
  businessId = tenantId,
  terminalId,
  businessDate,
  allocatedByService = 'phase5-fiscal-sequence',
  correlationId = null,
  requestId = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const dateVo = createBusinessDate(businessDate);
  const date = dateVo.toDate();

  return db.$transaction(async (tx) => {
    // Lock sequence row (create if missing)
    let seq = await tx.mraEisFiscalSequence.findUnique({
      where: { terminalId_businessDate: { terminalId, businessDate: date } },
    });
    if (!seq) {
      try {
        seq = await tx.mraEisFiscalSequence.create({
          data: {
            tenantId,
            businessId,
            terminalId,
            businessDate: date,
            lastAllocatedSequence: 0,
            algorithmVersion: 'UNVERIFIED_PHASE5',
            timezone: 'Africa/Blantyre',
            version: 1,
          },
        });
      } catch (err) {
        if (err?.code !== 'P2002') throw err;
        seq = await tx.mraEisFiscalSequence.findUnique({
          where: { terminalId_businessDate: { terminalId, businessDate: date } },
        });
      }
    }

    // Row lock via raw update returning
    const locked = await tx.$queryRaw`
      SELECT id, "lastAllocatedSequence", version, "tenantId", "businessId"
      FROM "MraEisFiscalSequence"
      WHERE id = ${seq.id}
      FOR UPDATE
    `;
    const row = locked[0];
    if (!row) throw EisErrors.fiscalSequenceConflict({ tenantId, businessId });
    if (row.tenantId !== tenantId || row.businessId !== businessId) {
      throw EisErrors.crossTenant({ tenantId, businessId });
    }

    const next = Number(row.lastAllocatedSequence) + 1;
    await tx.mraEisFiscalSequence.update({
      where: { id: seq.id },
      data: {
        lastAllocatedSequence: next,
        version: { increment: 1 },
      },
    });

    // Placeholder encoding — NOT MRA-certified; Phase 12 replaces algorithm
    const generatedFiscalNumber = `P5-UNVERIFIED-${terminalId.slice(0, 8)}-${dateVo.value}-${String(next).padStart(6, '0')}`;

    try {
      const allocation = await tx.mraEisFiscalNumberAllocation.create({
        data: {
          tenantId,
          businessId,
          terminalId,
          businessDate: date,
          dailySequence: next,
          generatedFiscalNumber,
          algorithmVersion: 'UNVERIFIED_PHASE5',
          allocationStatus: FISCAL_ALLOCATION_STATUS.RESERVED,
          allocatedByService,
          correlationId,
          requestId,
        },
      });
      return { sequence: next, allocation, generatedFiscalNumber };
    } catch (err) {
      if (err?.code === 'P2002') {
        throw EisErrors.fiscalSequenceConflict({ tenantId, businessId, details: { terminalId, next } });
      }
      throw err;
    }
  });
}
