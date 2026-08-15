import prisma from '@/lib/prisma';
import { parseDecimalToMinor } from '@/lib/accountingV2/domain/money.js';

function safeMinor(value) {
  try {
    return parseDecimalToMinor(value ?? 0);
  } catch {
    return 0;
  }
}

function dayDiff(asOf, due) {
  return Math.floor((asOf.getTime() - new Date(due).getTime()) / 86400000);
}

function bucketFor(daysOverdue) {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return 'd1_30';
  if (daysOverdue <= 60) return 'd31_60';
  if (daysOverdue <= 90) return 'd61_90';
  if (daysOverdue <= 120) return 'd91_120';
  return 'd120_plus';
}

const EMPTY_BUCKETS = () => [
  { bucket: 'current', minor: 0, count: 0 },
  { bucket: 'd1_30', minor: 0, count: 0 },
  { bucket: 'd31_60', minor: 0, count: 0 },
  { bucket: 'd61_90', minor: 0, count: 0 },
  { bucket: 'd91_120', minor: 0, count: 0 },
  { bucket: 'd120_plus', minor: 0, count: 0 },
];

/**
 * Open customer invoices by aging bucket (read-only).
 */
export async function loadOpenReceivablesBuckets(tenantId, { asOfDate = new Date(), branchId = null } = {}) {
  const asOf = new Date(asOfDate);
  const where = {
    tenantId,
    isDeleted: false,
    status: { notIn: ['draft', 'void', 'voided', 'cancelled'] },
    issueDate: { lte: asOf },
  };
  if (branchId) where.branchId = branchId;

  const invoices = await prisma.invoice.findMany({ where });
  const map = new Map(EMPTY_BUCKETS().map((b) => [b.bucket, { ...b }]));
  for (const inv of invoices) {
    const outstanding = safeMinor(inv.remainingBalance ?? inv.total);
    if (outstanding <= 0) continue;
    const bucket = bucketFor(dayDiff(asOf, inv.dueDate));
    const row = map.get(bucket);
    row.minor += outstanding;
    row.count += 1;
  }
  return [...map.values()];
}

/**
 * Open supplier bills by aging bucket (read-only).
 */
export async function loadOpenPayablesBuckets(tenantId, { asOfDate = new Date() } = {}) {
  const asOf = new Date(asOfDate);
  const bills = await prisma.supplierBill.findMany({
    where: {
      tenantId,
      status: { notIn: ['Draft', 'draft', 'Void', 'void', 'Cancelled', 'cancelled'] },
      billDate: { lte: asOf },
    },
  });
  const map = new Map(EMPTY_BUCKETS().map((b) => [b.bucket, { ...b }]));
  for (const bill of bills) {
    const outstanding = safeMinor(bill.totalAmount) - safeMinor(bill.amountPaid);
    if (outstanding <= 0) continue;
    const bucket = bucketFor(dayDiff(asOf, bill.dueDate));
    const row = map.get(bucket);
    row.minor += outstanding;
    row.count += 1;
  }
  return [...map.values()];
}
