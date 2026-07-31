import prisma from '@/lib/prisma';
import { isQuantityPoolKind } from '@/lib/rentalKinds';
import { makeDocNumber } from './numbering.js';
import { assertPoolCapacity, assertUnitAvailable } from './allocation.js';
import { getQuotation } from './quotationService.js';
import { createContract } from './contractService.js';

export async function listReservations({ tenantId, status, clientId, take = 50 }) {
  return prisma.rentalReservation.findMany({
    where: {
      tenantId,
      ...(status ? { status } : {}),
      ...(clientId ? { clientId } : {}),
    },
    include: { allocations: true, contracts: true },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function getReservation({ tenantId, reservationId }) {
  const r = await prisma.rentalReservation.findFirst({
    where: { id: reservationId, tenantId },
    include: { allocations: true, quotation: { include: { lines: true } }, contracts: true },
  });
  if (!r) throw new Error('Reservation not found');
  return r;
}

/**
 * Create reservation with soft holds (no journals).
 */
export async function createReservation({
  tenantId,
  userId,
  clientId,
  quotationId,
  startAt,
  endAt,
  holdUntil,
  expiresAt,
  notes,
  lines = [],
}) {
  if (!clientId) throw new Error('clientId is required');
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (!(end > start)) throw new Error('endAt must be after startAt');

  let quoteLines = lines;
  if (quotationId && !lines.length) {
    const q = await getQuotation({ tenantId, quotationId });
    quoteLines = q.lines.map((l) => ({
      rentalAssetId: l.rentalAssetId,
      quantity: l.quantity,
      unitRate: l.unitRate,
      rentalUnitId: null,
    }));
  }
  if (!quoteLines.length) throw new Error('lines or quotationId with lines required');

  return prisma.$transaction(async (tx) => {
    for (const raw of quoteLines) {
      const asset = await tx.rentalAsset.findFirst({ where: { id: raw.rentalAssetId, tenantId } });
      if (!asset) throw new Error(`Rental asset ${raw.rentalAssetId} not found`);
      const qty = Math.max(1, Math.floor(Number(raw.quantity) || 1));
      if (raw.rentalUnitId) {
        await assertUnitAvailable(tx, {
          rentalUnitId: raw.rentalUnitId,
          startAt: start,
          endAt: end,
        });
      } else if (isQuantityPoolKind(asset.kind)) {
        await assertPoolCapacity(tx, {
          rentalAssetId: asset.id,
          startAt: start,
          endAt: end,
          quantity: qty,
          capacity: asset.totalQuantity,
        });
      }
    }

    const reservation = await tx.rentalReservation.create({
      data: {
        tenantId,
        reservationNumber: makeDocNumber('RS'),
        clientId,
        quotationId: quotationId || null,
        status: 'HELD',
        startAt: start,
        endAt: end,
        holdUntil: holdUntil ? new Date(holdUntil) : new Date(Date.now() + 48 * 3600 * 1000),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        notes: notes || null,
        createdById: userId || null,
      },
    });

    for (const raw of quoteLines) {
      await tx.rentalUnitAllocation.create({
        data: {
          tenantId,
          rentalUnitId: raw.rentalUnitId || null,
          rentalAssetId: raw.rentalAssetId,
          reservationId: reservation.id,
          startAt: start,
          endAt: end,
          quantity: Math.max(1, Math.floor(Number(raw.quantity) || 1)),
          status: 'HELD',
        },
      });
    }

    if (quotationId) {
      await tx.rentalQuotation.updateMany({
        where: { id: quotationId, tenantId, status: { in: ['DRAFT', 'SENT', 'ACCEPTED'] } },
        data: { status: 'ACCEPTED' },
      });
    }

    return tx.rentalReservation.findFirst({
      where: { id: reservation.id },
      include: { allocations: true },
    });
  });
}

export async function releaseReservation({ tenantId, reservationId }) {
  const r = await getReservation({ tenantId, reservationId });
  if (['RELEASED', 'CONVERTED', 'EXPIRED'].includes(r.status)) return r;
  return prisma.$transaction(async (tx) => {
    await tx.rentalUnitAllocation.updateMany({
      where: { reservationId, tenantId, status: 'HELD' },
      data: { status: 'RELEASED' },
    });
    return tx.rentalReservation.update({
      where: { id: reservationId },
      data: { status: 'RELEASED' },
      include: { allocations: true },
    });
  });
}

/**
 * Convert held reservation → draft contract (releases reservation holds; contract takes allocations).
 */
export async function convertReservationToContract({ tenantId, userId, reservationId }) {
  const r = await getReservation({ tenantId, reservationId });
  if (r.status !== 'HELD' && r.status !== 'CONFIRMED') {
    throw new Error(`Cannot convert reservation in status ${r.status}`);
  }
  if (r.contracts?.length) {
    throw new Error('Reservation already has a contract');
  }

  const lines =
    r.quotation?.lines?.map((l) => {
      const alloc = r.allocations.find((a) => a.rentalAssetId === l.rentalAssetId);
      return {
        rentalAssetId: l.rentalAssetId,
        quantity: l.quantity,
        unitRate: l.unitRate,
        rentalUnitId: alloc?.rentalUnitId || null,
      };
    }) ||
    r.allocations.map((a) => ({
      rentalAssetId: a.rentalAssetId,
      quantity: a.quantity,
      rentalUnitId: a.rentalUnitId,
    }));

  // Release reservation holds before contract allocates (avoid double-book).
  await prisma.$transaction(async (tx) => {
    await tx.rentalUnitAllocation.updateMany({
      where: { reservationId: r.id, tenantId, status: 'HELD' },
      data: { status: 'RELEASED' },
    });
    await tx.rentalReservation.update({
      where: { id: r.id },
      data: { status: 'CONVERTED' },
    });
  });

  try {
    return await createContract({
      tenantId,
      userId,
      clientId: r.clientId,
      startAt: r.startAt,
      endAt: r.endAt,
      quotationId: r.quotationId,
      reservationId: r.id,
      lines,
      notes: r.notes,
    });
  } catch (e) {
    await prisma.rentalReservation.update({
      where: { id: r.id },
      data: { status: 'HELD' },
    });
    throw e;
  }
}
