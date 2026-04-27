import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getInventoryExpiryCutoffDate } from '@/lib/fifoCosting';

function toNum(v, d = 0) {
  if (v == null) return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function calendarDaysBetween(fromDate, toDate) {
  const a = new Date(fromDate);
  const b = new Date(toDate);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * @param {object} opts
 * @param {string|null} [opts.branchId] — optional branch scope (matches batch.branchId or null branch-wide)
 */
export async function fetchExpiryAlerts({
  tenantId,
  branchId = null,
  earlyDays = 30,
  urgentDays = 7,
}) {
  const todayStart = getInventoryExpiryCutoffDate();

  const branchClause =
    branchId === null || branchId === undefined || branchId === ''
      ? {}
      : {
          OR: [{ branchId }, { branchId: null }],
        };

  const batches = await prisma.inventoryBatch.findMany({
    where: {
      tenantId,
      qtyRemaining: { gt: new Prisma.Decimal(0) },
      expiryDate: { not: null },
      ...branchClause,
    },
    include: {
      product: {
        select: { id: true, name: true, sku: true },
      },
      branch: { select: { id: true, name: true } },
    },
    orderBy: [{ expiryDate: 'asc' }],
  });

  const rows = [];
  for (const b of batches) {
    const exp = new Date(b.expiryDate);
    exp.setHours(0, 0, 0, 0);
    const daysRemaining = calendarDaysRemaining(exp, todayStart);

    /** @type {'expired' | 'urgent' | 'early'} */
    let status;
    if (daysRemaining < 0) status = 'expired';
    else if (daysRemaining <= urgentDays) status = 'urgent';
    else if (daysRemaining <= earlyDays) status = 'early';
    else continue;

    const qty = toNum(b.qtyRemaining);
    const unitCost = toNum(b.unitCost);
    const lineValue = qty * unitCost;

    rows.push({
      batchId: b.id,
      productId: b.productId,
      productName: b.product?.name ?? '',
      sku: b.product?.sku ?? '',
      branchId: b.branchId,
      branchName: b.branch?.name ?? null,
      expiryDate: b.expiryDate?.toISOString?.() ?? b.expiryDate,
      qtyRemaining: qty,
      unitCost,
      lineValue,
      daysRemaining,
      status,
      purchaseDate: b.purchaseDate?.toISOString?.() ?? b.purchaseDate,
      sourceType: b.sourceType,
      sourceId: b.sourceId,
    });
  }

  const summary = rows.reduce(
    (acc, r) => {
      acc.totalLineValue += r.lineValue;
      if (r.status === 'expired') acc.expired++;
      else if (r.status === 'urgent') acc.urgent++;
      else if (r.status === 'early') acc.early++;
      return acc;
    },
    { expired: 0, urgent: 0, early: 0, totalLineValue: 0 }
  );

  return {
    thresholds: { earlyDays, urgentDays },
    summary,
    rows,
  };
}

function calendarDaysRemaining(expiryMidnight, todayStart) {
  return calendarDaysBetween(todayStart, expiryMidnight);
}
