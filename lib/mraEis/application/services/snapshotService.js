import prisma from '@/lib/prisma.js';
import { SNAPSHOT_STATUS, SNAPSHOT_SOURCE_TYPE } from '../../domain/operationalEnums.js';
import { transitionSnapshot } from '../../domain/operationalStateMachines.js';
import { EisErrors } from '../../domain/errors.js';
import {
  assertTenantBusinessMatch,
  createChecksum,
  createMoney,
} from '../../domain/valueObjects/index.js';
import { appendEisOutboxEvent } from '../../infrastructure/outbox/outboxService.js';
import { EIS_OUTBOX_EVENT } from '../../domain/operationalEnums.js';

/**
 * Create a synthetic/foundation snapshot. Phase 11/12 will populate from live sales.
 * No secrets allowed in canonicalSnapshot.
 */
export async function createFiscalSnapshot({
  tenantId,
  businessId = tenantId,
  terminalId,
  sourceType = SNAPSHOT_SOURCE_TYPE.POS_SALE,
  sourceId,
  sourceVersion = '1',
  policyVersion = 'mra-eis-capability-v1',
  journalEntryId = null,
  environment,
  businessDate,
  transactionDate = new Date(),
  postingDate = new Date(),
  totals,
  lines = [],
  payments = [],
  canonicalSnapshot,
  createdByService = 'phase5-snapshot',
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const text = JSON.stringify(canonicalSnapshot ?? {});
  if (/(jwt|secretKey|authorization|tac\b)/i.test(text)) {
    throw EisErrors.validation({ message: 'Snapshot cannot contain credentials.' });
  }

  const subtotal = createMoney(totals.subtotal, 'subtotal').value;
  const invoiceTotal = createMoney(totals.invoiceTotal, 'invoiceTotal').value;
  const taxTotal = createMoney(totals.taxTotal ?? 0, 'taxTotal').value;
  const discountTotal = createMoney(totals.discountTotal ?? 0, 'discountTotal').value;
  const levyTotal = createMoney(totals.levyTotal ?? 0, 'levyTotal').value;

  const lineGross = lines.reduce((s, l) => s + Number(l.grossAmount || 0), 0);
  if (Math.abs(lineGross - Number(invoiceTotal)) > 0.009 && lines.length) {
    throw EisErrors.validation({
      message: 'Snapshot line totals do not reconcile to invoiceTotal.',
      details: { lineGross, invoiceTotal },
    });
  }

  const snapshotChecksum = createChecksum({
    sourceType,
    sourceId,
    sourceVersion,
    policyVersion,
    canonicalSnapshot,
    totals: { subtotal, invoiceTotal, taxTotal },
  }).value;

  try {
    return await db.$transaction(async (tx) => {
      const header = await tx.mraEisSnapshot.create({
        data: {
          tenantId,
          businessId,
          terminalId,
          sourceType,
          sourceId,
          sourceVersion,
          journalEntryId,
          transactionDate,
          postingDate,
          businessDate: new Date(businessDate),
          environment,
          status: SNAPSHOT_STATUS.CREATED,
          policyVersion,
          subtotal,
          discountTotal,
          taxTotal,
          levyTotal,
          invoiceTotal,
          snapshotChecksum,
          canonicalSnapshot,
          createdByService,
          version: 1,
          lines: {
            create: lines.map((l, idx) => ({
              tenantId,
              businessId,
              sequence: l.sequence ?? idx + 1,
              localSourceLineId: l.localSourceLineId ?? `L${idx + 1}`,
              localItemId: l.localItemId ?? null,
              localServiceId: l.localServiceId ?? null,
              description: l.description,
              isProduct: Boolean(l.isProduct),
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountAmount: l.discountAmount ?? 0,
              netAmount: l.netAmount,
              taxAmount: l.taxAmount ?? 0,
              levyAmount: l.levyAmount ?? 0,
              grossAmount: l.grossAmount,
              lineChecksum: createChecksum(l).value,
            })),
          },
          payments: {
            create: payments.map((p, idx) => ({
              tenantId,
              businessId,
              sequence: p.sequence ?? idx + 1,
              amount: p.amount,
              isCreditComponent: Boolean(p.isCreditComponent),
              mraPaymentMethodCode: p.mraPaymentMethodCode ?? null,
              paymentChecksum: createChecksum(p).value,
            })),
          },
        },
        include: { lines: true, payments: true },
      });

      await appendEisOutboxEvent({
        tenantId,
        businessId,
        aggregateType: 'MraEisSnapshot',
        aggregateId: header.id,
        eventType: EIS_OUTBOX_EVENT.SNAPSHOT_CREATED,
        payload: {
          snapshotId: header.id,
          sourceType,
          sourceId,
          sourceVersion,
          snapshotChecksum,
        },
        idempotencyKey: `snapshot-created:${sourceType}:${sourceId}:${sourceVersion}:${policyVersion}`,
        db: tx,
      });

      return header;
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      const existing = await db.mraEisSnapshot.findFirst({
        where: { sourceType, sourceId, sourceVersion, policyVersion },
      });
      if (existing && existing.snapshotChecksum === snapshotChecksum) return existing;
      throw EisErrors.snapshotConflict({
        tenantId,
        businessId,
        details: { sourceType, sourceId, sourceVersion },
      });
    }
    throw err;
  }
}

export async function queueFiscalSnapshot({
  tenantId,
  businessId = tenantId,
  snapshotId,
  expectedVersion,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const current = await db.mraEisSnapshot.findFirst({
    where: { id: snapshotId, tenantId, businessId },
  });
  if (!current) throw EisErrors.validation({ message: 'Snapshot not found.', httpStatus: 404 });
  if (expectedVersion != null && current.version !== expectedVersion) {
    throw EisErrors.versionConflict({ tenantId, businessId });
  }
  if (current.immutableAt || current.status === SNAPSHOT_STATUS.QUEUED) {
    throw EisErrors.snapshotImmutable({ tenantId, businessId });
  }
  transitionSnapshot(current.status, SNAPSHOT_STATUS.QUEUED);

  const updated = await db.mraEisSnapshot.update({
    where: { id: snapshotId },
    data: {
      status: SNAPSHOT_STATUS.QUEUED,
      queuedAt: new Date(),
      immutableAt: new Date(),
      version: { increment: 1 },
    },
  });

  await appendEisOutboxEvent({
    tenantId,
    businessId,
    aggregateType: 'MraEisSnapshot',
    aggregateId: snapshotId,
    eventType: EIS_OUTBOX_EVENT.TRANSMISSION_QUEUED,
    payload: { snapshotId, status: SNAPSHOT_STATUS.QUEUED },
    idempotencyKey: `snapshot-queued:${snapshotId}:${current.version}`,
    db,
  });

  return updated;
}

export async function assertSnapshotMutable(snapshot) {
  if (snapshot.immutableAt || snapshot.status === SNAPSHOT_STATUS.QUEUED) {
    throw EisErrors.snapshotImmutable();
  }
}
