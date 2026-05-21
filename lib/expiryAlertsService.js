import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getInventoryExpiryCutoffDate } from '@/lib/fifoCosting';

function toNum(v, d = 0) {
  if (v == null) return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function normalizeThresholds(earlyDays, urgentDays) {
  // Defaults: warn two months before expiry unless the tenant customizes it.
  const DEFAULT_EARLY = 60;
  const DEFAULT_URGENT = 7;

  let early = Number.isFinite(Number(earlyDays)) ? Number(earlyDays) : DEFAULT_EARLY;
  let urgent = Number.isFinite(Number(urgentDays)) ? Number(urgentDays) : DEFAULT_URGENT;

  // Guard impossible/accidental values from settings
  if (early <= 0) early = DEFAULT_EARLY;
  if (urgent <= 0) urgent = DEFAULT_URGENT;

  // Reasonable bounds
  early = Math.min(Math.round(early), 365);
  urgent = Math.min(Math.round(urgent), 365);

  // Ensure urgent window is not wider than early window
  if (urgent > early) urgent = Math.max(1, Math.min(DEFAULT_URGENT, early));

  return { early, urgent };
}

function calendarDaysBetween(fromDate, toDate) {
  const a = new Date(fromDate);
  const b = new Date(toDate);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function isMissingSchemaError(error) {
  const msg = String(error?.message || '');
  return (
    error?.code === 'P2021' ||
    error?.code === 'P2022' ||
    msg.includes('column') ||
    msg.includes('does not exist') ||
    msg.includes('Unknown field') ||
    msg.includes('Unknown arg')
  );
}

/**
 * @param {object} opts
 * @param {string|null} [opts.branchId] — optional branch scope (matches batch.branchId or null branch-wide)
 */
export async function fetchExpiryAlerts({
  tenantId,
  branchId = null,
  earlyDays = 60,
  urgentDays = 7,
}) {
  const normalized = normalizeThresholds(earlyDays, urgentDays);
  const effectiveEarlyDays = normalized.early;
  const effectiveUrgentDays = normalized.urgent;
  const todayStart = getInventoryExpiryCutoffDate();

  const branchClause =
    branchId === null || branchId === undefined || branchId === ''
      ? {}
      : {
          OR: [{ branchId }, { branchId: null }],
        };

  let batches = [];
  try {
    batches = await prisma.inventoryBatch.findMany({
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
  } catch (error) {
    // Migration not yet applied: return empty state instead of 500.
    if (!isMissingSchemaError(error)) throw error;
    return {
      thresholds: { earlyDays: effectiveEarlyDays, urgentDays: effectiveUrgentDays },
      summary: { expired: 0, urgent: 0, early: 0, totalLineValue: 0 },
      rows: [],
      migrationPending: true,
    };
  }

  const rows = [];
  for (const b of batches) {
    const exp = new Date(b.expiryDate);
    exp.setHours(0, 0, 0, 0);
    const daysRemaining = calendarDaysRemaining(exp, todayStart);

    /** @type {'expired' | 'urgent' | 'early'} */
    let status;
    if (daysRemaining < 0) status = 'expired';
    else if (daysRemaining <= effectiveUrgentDays) status = 'urgent';
    else if (daysRemaining <= effectiveEarlyDays) status = 'early';
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
    thresholds: { earlyDays: effectiveEarlyDays, urgentDays: effectiveUrgentDays },
    summary,
    rows,
  };
}

function calendarDaysRemaining(expiryMidnight, todayStart) {
  return calendarDaysBetween(todayStart, expiryMidnight);
}
