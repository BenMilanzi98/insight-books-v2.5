const ACTIVE_ALLOCATION = ['HELD', 'CONFIRMED', 'DISPATCHED'];

/** Pure overlap check for allocation windows (half-open: start < otherEnd && end > otherStart). */
export function rangesOverlap(startAt, endAt, otherStart, otherEnd) {
  const a0 = new Date(startAt).getTime();
  const a1 = new Date(endAt).getTime();
  const b0 = new Date(otherStart).getTime();
  const b1 = new Date(otherEnd).getTime();
  return a0 < b1 && a1 > b0;
}

/**
 * Lock a serialised unit row for allocation.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
export async function lockRentalUnit(tx, rentalUnitId) {
  const rows = await tx.$queryRaw`
    SELECT id, "availabilityStatus", version FROM "RentalUnit" WHERE id = ${rentalUnitId} FOR UPDATE
  `;
  if (!rows?.length) {
    const err = new Error('Rental unit not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return rows[0];
}

/**
 * Overlap query for unit-level allocations (serialised).
 */
export async function findOverlappingUnitAllocations(
  tx,
  { rentalUnitId, startAt, endAt, excludeId }
) {
  return tx.rentalUnitAllocation.findMany({
    where: {
      rentalUnitId,
      status: { in: ACTIVE_ALLOCATION },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

export async function assertUnitAvailable(tx, { rentalUnitId, startAt, endAt, excludeId }) {
  await lockRentalUnit(tx, rentalUnitId);
  const overlaps = await findOverlappingUnitAllocations(tx, {
    rentalUnitId,
    startAt,
    endAt,
    excludeId,
  });
  if (overlaps.length) {
    const err = new Error('Unit already allocated for part of the selected period');
    err.code = 'DOUBLE_BOOK';
    throw err;
  }
}

/**
 * Pool capacity check via RentalUnitAllocation quantities on asset.
 */
export async function assertPoolCapacity(
  tx,
  { rentalAssetId, startAt, endAt, quantity, capacity, excludeId }
) {
  const rows = await tx.rentalUnitAllocation.findMany({
    where: {
      rentalAssetId,
      status: { in: ACTIVE_ALLOCATION },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  const booked = rows.reduce((s, r) => s + Number(r.quantity || 0), 0);
  const cap = Math.max(1, Math.floor(Number(capacity) || 1));
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  if (booked + qty > cap) {
    const err = new Error(
      `Insufficient pool capacity: ${Math.max(0, cap - booked)} available, ${qty} requested`
    );
    err.code = 'OVERBOOK_QTY';
    throw err;
  }
  return { booked, available: Math.max(0, cap - booked - qty) };
}
