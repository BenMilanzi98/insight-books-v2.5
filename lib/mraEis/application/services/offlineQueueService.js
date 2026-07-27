import prisma from '@/lib/prisma.js';
import { assertOfflineCreationAllowed } from '../../domain/operationalStateMachines.js';
import { OFFLINE_QUEUE_STATUS } from '../../domain/operationalEnums.js';
import { EisErrors } from '../../domain/errors.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';

/**
 * Offline queue foundation — blocked unless terminal.offlineCertified.
 * No signatures generated in Phase 5.
 */
export async function createOfflineQueueEntry({
  tenantId,
  businessId = tenantId,
  terminalId,
  snapshotId,
  cumulativeAmountAtCreation = 0,
  maximumCumulativeAmount = 0,
  originalTransactionDate = new Date(),
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);

  const terminal = await db.mraEisTerminal.findFirst({
    where: { id: terminalId, tenantId, businessId },
  });
  if (!terminal) throw EisErrors.terminalNotFound({ tenantId, businessId });
  assertOfflineCreationAllowed({ offlineCertified: terminal.offlineCertified });

  const snapshot = await db.mraEisSnapshot.findFirst({
    where: { id: snapshotId, tenantId, businessId },
  });
  if (!snapshot) throw EisErrors.validation({ message: 'Snapshot not found.', httpStatus: 404 });

  try {
    return await db.mraEisOfflineQueueEntry.create({
      data: {
        tenantId,
        businessId,
        terminalId,
        snapshotId,
        status: OFFLINE_QUEUE_STATUS.ELIGIBILITY_CHECKED,
        snapshotChecksum: snapshot.snapshotChecksum,
        originalTransactionDate,
        cumulativeAmountAtCreation,
        maximumCumulativeAmount,
        version: 1,
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      throw EisErrors.idempotencyConflict({
        tenantId,
        businessId,
        message: 'Offline entry already exists for snapshot.',
      });
    }
    throw err;
  }
}
