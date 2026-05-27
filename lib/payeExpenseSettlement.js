import {
  getExpenseGrossAmount,
  getExpenseOutstandingAmount,
} from '@/lib/expenseAmounts';

export function isPayeTaxType(taxType) {
  const id = String(taxType?.taxId || '').trim().toUpperCase();
  const name = String(taxType?.taxName || '').trim().toUpperCase();
  const code = String(taxType?.taxCode || '').trim().toUpperCase();
  return id === 'PAYE' || code.includes('PAYE') || name.includes('PAYE');
}

/** Total payable (gross). Expense.amount already includes tax when tax is split. */
export function getExpenseTotalDue(expense) {
  return getExpenseGrossAmount(expense);
}

export { getExpenseOutstandingAmount };

export function parseTaxPeriodRange(taxPeriod) {
  if (!taxPeriod || typeof taxPeriod !== 'string') return null;
  const parts = taxPeriod.split(/\s+to\s+/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) return null;

  const start = new Date(parts[0]);
  const end = new Date(parts[1]);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function payeExpenseBaseWhere(tenantId, taxTypeId) {
  return {
    tenantId,
    taxTypeId,
    isDeleted: false,
    isReversal: false,
  };
}

function isExpenseSettled(expense) {
  return getExpenseOutstandingAmount(expense) <= 0.005;
}

async function fetchOutstandingPayeExpenses(tx, { tenantId, taxTypeId, dateFilter, excludeIds = [] }) {
  return tx.expense.findMany({
    where: {
      ...payeExpenseBaseWhere(tenantId, taxTypeId),
      ...(dateFilter ? { date: dateFilter } : {}),
      ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      OR: [
        { paymentStatus: { in: ['Pending', 'Partially', 'Unpaid'] } },
        { paidAmount: null },
      ],
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      amount: true,
      taxAmount: true,
      paidAmount: true,
      paymentStatus: true,
      date: true,
      paymentReference: true,
    },
  });
}

export async function applyPayeSettlementToExpenses(
  tx,
  { tenantId, taxTypeId, amount, settlementDate, paymentMethod, reference, taxPeriod }
) {
  const settlementAmount = Number(amount || 0);
  if (!tenantId || !taxTypeId || settlementAmount <= 0) {
    return { appliedAmount: 0, updatedCount: 0, updates: [], unappliedAmount: settlementAmount };
  }

  const periodRange = parseTaxPeriodRange(taxPeriod);
  const settlementDateValue =
    settlementDate instanceof Date && !Number.isNaN(settlementDate.getTime())
      ? settlementDate
      : new Date(settlementDate || Date.now());

  const periodExpenses = periodRange
    ? await fetchOutstandingPayeExpenses(tx, {
        tenantId,
        taxTypeId,
        dateFilter: { gte: periodRange.start, lte: periodRange.end },
      })
    : [];

  const periodIds = periodExpenses.map((expense) => expense.id);
  const fallbackExpenses = await fetchOutstandingPayeExpenses(tx, {
    tenantId,
    taxTypeId,
    dateFilter: { lte: settlementDateValue },
    excludeIds: periodIds,
  });

  const expenses = [...periodExpenses, ...fallbackExpenses];
  let remaining = settlementAmount;
  const updates = [];

  for (const expense of expenses) {
    if (remaining <= 0.005) break;
    const outstanding = getExpenseOutstandingAmount(expense);
    if (outstanding <= 0.005) continue;

    const applied = Math.min(outstanding, remaining);
    const newPaidAmount = Number(expense.paidAmount || 0) + applied;
    const totalDue = getExpenseTotalDue(expense);
    const nextExpense = { ...expense, paidAmount: newPaidAmount };
    const paymentStatus = isExpenseSettled(nextExpense) ? 'Fully paid' : 'Partially';

    await tx.expense.update({
      where: { id: expense.id },
      data: {
        paidAmount: Number(newPaidAmount.toFixed(2)),
        paymentStatus,
        paymentMethod: paymentMethod || expense.paymentMethod || null,
        paymentReference: reference || expense.paymentReference || null,
      },
    });

    updates.push({
      expenseId: expense.id,
      appliedAmount: Number(applied.toFixed(2)),
      paidAmount: Number(newPaidAmount.toFixed(2)),
      totalDue: Number(totalDue.toFixed(2)),
      paymentStatus,
    });
    remaining -= applied;
  }

  const appliedAmount = settlementAmount - Math.max(0, remaining);
  return {
    appliedAmount: Number(appliedAmount.toFixed(2)),
    updatedCount: updates.length,
    updates,
    unappliedAmount: Number(Math.max(0, remaining).toFixed(2)),
  };
}

export async function sumPaidPayeExpenses(tx, { tenantId, taxTypeId, dateFilter, branchId = null }) {
  if (!tenantId || !taxTypeId) return { total: 0, rows: [] };

  const expenses = await tx.expense.findMany({
    where: {
      ...payeExpenseBaseWhere(tenantId, taxTypeId),
      paidAmount: { gt: 0 },
      ...(dateFilter ? { date: dateFilter } : {}),
      ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
    },
    select: {
      id: true,
      description: true,
      date: true,
      paidAmount: true,
      amount: true,
      taxAmount: true,
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  const rows = expenses.map((expense) => {
    const paid = Number(expense.paidAmount || 0);
    const totalDue = getExpenseTotalDue(expense);
    const amount = Math.max(0, Math.min(paid, totalDue));
    return {
      id: expense.id,
      description: expense.description,
      date: expense.date,
      amount,
    };
  }).filter((row) => row.amount > 0);

  return {
    total: rows.reduce((sum, row) => sum + row.amount, 0),
    rows,
  };
}
