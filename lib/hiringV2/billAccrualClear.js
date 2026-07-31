import prisma from '@/lib/prisma';
import { parseMoney } from '@/lib/money';
import { clearHireAccrualAgainstBill } from './hireService.js';

/**
 * After an expense supplier bill posts, clear matching ACCRUED hire accruals
 * so expense is not double-counted (Dr Accrued / Cr Expense, then bill Dr Expense / Cr AP).
 *
 * Matching order:
 * 1. Explicit hireAccrualIds
 * 2. Else open accruals for same supplier whose amounts fit within bill total
 */
export async function clearHireAccrualsForSupplierBill({
  tenantId,
  userId,
  billId,
  hireAccrualIds,
  hasPermission,
}) {
  const bill = await prisma.supplierBill.findFirst({
    where: { id: billId, tenantId },
  });
  if (!bill || bill.billType !== 'expense') {
    return { cleared: [], skipped: 'not_expense_bill' };
  }

  let candidates = [];
  const explicit = Array.isArray(hireAccrualIds)
    ? hireAccrualIds.filter(Boolean)
    : [];

  if (explicit.length) {
    candidates = await prisma.hireAccrual.findMany({
      where: {
        tenantId,
        id: { in: explicit },
        status: 'ACCRUED',
        agreement: { supplierId: bill.supplierId },
      },
      include: { agreement: true },
    });
  } else {
    const open = await prisma.hireAccrual.findMany({
      where: {
        tenantId,
        status: 'ACCRUED',
        agreement: { supplierId: bill.supplierId },
        expenseAccountId: { not: null },
        accruedLiabilityAccountId: { not: null },
      },
      include: { agreement: true },
      orderBy: { createdAt: 'asc' },
    });
    let remaining = parseMoney(bill.totalAmount);
    for (const a of open) {
      const amt = parseMoney(a.amount);
      if (amt <= remaining + 0.001) {
        candidates.push(a);
        remaining -= amt;
      }
    }
  }

  const cleared = [];
  const errors = [];
  for (const a of candidates) {
    try {
      const result = await clearHireAccrualAgainstBill({
        tenantId,
        userId,
        accrualId: a.id,
        supplierBillId: bill.id,
        expenseAccountId: a.expenseAccountId,
        accruedLiabilityAccountId: a.accruedLiabilityAccountId,
        hasPermission,
      });
      if (!result.duplicate) cleared.push(result.accrual);
    } catch (e) {
      errors.push({ accrualId: a.id, error: e.message });
    }
  }

  if (cleared.length && userId) {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'HIRE_ACCRUAL_CLEARED_ON_BILL',
          entityType: 'SupplierBill',
          entityId: bill.id,
          userId,
          tenantId,
          details: JSON.stringify({
            billNumber: bill.billNumber,
            clearedIds: cleared.map((c) => c.id),
          }),
        },
      });
    } catch {
      /* audit optional */
    }
  }

  return { cleared, errors, matched: candidates.length };
}
