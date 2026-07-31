/**
 * Tax payment register — dual-writes alongside /api/tax/settle (V2 GL path unchanged).
 */

import prisma from '../prisma.js';
import { TAX_PAYMENT_STATUS, modelsAvailable } from './periodStatuses.js';
import { findOpenPeriodForDate } from './taxPeriodService.js';

export async function recordTaxPaymentFromSettlement({
  tenantId,
  userId,
  amount,
  paymentDate,
  paymentMethod,
  paymentAccountId = null,
  taxTypeId = null,
  taxPeriodId = null,
  expenseId = null,
  paymentId = null,
  journalEntryId = null,
  description = null,
  notes = null,
  allocationJson = null,
  db = prisma,
}) {
  if (!modelsAvailable(db, 'taxPayment')) {
    return null;
  }

  let periodId = taxPeriodId || null;
  if (!periodId) {
    const open = await findOpenPeriodForDate({
      tenantId,
      date: paymentDate,
      db,
    });
    periodId = open?.id || null;
  }

  return db.taxPayment.create({
    data: {
      tenantId,
      taxPeriodId: periodId,
      taxTypeId,
      status: TAX_PAYMENT_STATUS.POSTED,
      amount,
      paymentDate: new Date(paymentDate),
      paymentMethod: paymentMethod || null,
      paymentAccountId,
      expenseId,
      paymentId,
      journalEntryId,
      description,
      notes,
      allocationJson,
      createdById: userId || null,
    },
  });
}

export async function listTaxPayments({ tenantId, taxPeriodId = null, db = prisma }) {
  if (!modelsAvailable(db, 'taxPayment')) return [];
  return db.taxPayment.findMany({
    where: {
      tenantId,
      ...(taxPeriodId ? { taxPeriodId } : {}),
    },
    include: {
      taxPeriod: { select: { id: true, code: true, label: true } },
    },
    orderBy: { paymentDate: 'desc' },
    take: 200,
  });
}

export async function markTaxPaymentReversed({
  tenantId,
  taxPaymentId,
  userId,
  reversalPaymentId = null,
  db = prisma,
}) {
  if (!modelsAvailable(db, 'taxPayment')) return null;
  const row = await db.taxPayment.findFirst({ where: { id: taxPaymentId, tenantId } });
  if (!row) {
    const err = new Error('Tax payment not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (row.status === TAX_PAYMENT_STATUS.REVERSED) return row;
  return db.taxPayment.update({
    where: { id: row.id },
    data: {
      status: TAX_PAYMENT_STATUS.REVERSED,
      reversedAt: new Date(),
      reversedById: userId || null,
      reversalPaymentId,
    },
  });
}
