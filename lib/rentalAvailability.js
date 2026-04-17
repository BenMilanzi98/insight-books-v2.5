/** Statuses that still block the calendar / capacity */
export const ACTIVE_RENTAL_STATUSES = ['booked', 'active', 'overdue'];

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} rentalAssetId
 * @param {Date} startAt
 * @param {Date} endAt
 * @param {{ excludeTransactionId?: string }} [opts]
 */
export async function sumBookedQuantityForWindow(tx, rentalAssetId, startAt, endAt, opts = {}) {
  const { excludeTransactionId } = opts;
  const result = await tx.rentalAssetAvailability.aggregate({
    where: {
      rentalAssetId,
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      rentalTransaction: {
        status: { in: ACTIVE_RENTAL_STATUSES },
        ...(excludeTransactionId ? { id: { not: excludeTransactionId } } : {}),
      },
    },
    _sum: { quantity: true },
  });
  return Number(result._sum.quantity || 0);
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {{ id: string, kind: string, totalQuantity: number }} asset
 * @param {Date} startAt
 * @param {Date} endAt
 * @param {number} requestedQty
 * @param {{ excludeTransactionId?: string }} [opts]
 */
export async function assertCanBook(tx, asset, startAt, endAt, requestedQty, opts = {}) {
  const qty = Math.max(1, Math.floor(Number(requestedQty) || 1));
  const sum = await sumBookedQuantityForWindow(tx, asset.id, startAt, endAt, opts);

  if (asset.kind === 'rental') {
    if (sum > 0) {
      const err = new Error('This resource is already booked for part of the selected period.');
      err.code = 'DOUBLE_BOOK';
      throw err;
    }
    return;
  }

  if (asset.kind === 'hiring') {
    const cap = Math.max(1, Math.floor(Number(asset.totalQuantity) || 1));
    if (sum + qty > cap) {
      const available = Math.max(0, cap - sum);
      const err = new Error(
        `Insufficient quantity in this period: ${available} available, ${qty} requested.`
      );
      err.code = 'OVERBOOK_QTY';
      err.available = available;
      throw err;
    }
    return;
  }

  const err = new Error(`Unknown rental asset kind: ${asset.kind}`);
  err.code = 'INVALID_KIND';
  throw err;
}
