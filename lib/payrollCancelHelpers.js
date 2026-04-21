/**
 * Shared helpers for cancelling / reversing payroll rows without duplicating logic.
 */

import prisma from '@/lib/prisma';

/**
 * Count non-reversal `Transaction` rows for this tenant whose `sourceId` is this payroll.
 * Includes main payroll journals, Tax-Payroll, and any other sourceType that reuses `sourceId`.
 */
export async function countTransactionsLinkedToPayroll(tenantId, payrollId) {
  if (!tenantId || !payrollId) return 0;
  return prisma.transaction.count({
    where: {
      tenantId,
      sourceId: payrollId,
      isReversal: false,
    },
  });
}

/** Mark payroll `Reversed` if not already. Returns number of rows updated (0 or 1). */
export async function markPayrollReversedIfNotAlready(tenantId, payrollId) {
  const r = await prisma.payroll.updateMany({
    where: { id: payrollId, tenantId, status: { not: 'Reversed' } },
    data: { status: 'Reversed' },
  });
  return r.count;
}
