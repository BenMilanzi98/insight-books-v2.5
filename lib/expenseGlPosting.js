import { createExpenseJournalEntry } from '@/lib/transactionJournalHelpers';

/** Match GL reads elsewhere in the app */
export const GL_POSTED_STATUSES = { in: ['posted', 'Posted'] };

/**
 * Expense.amount is stored as gross (incl. tax when tax is split).
 * Journal posts base to expense account and tax to tax account.
 */
export function normalizeExpenseAmountsForGl(grossAmount, taxAmount) {
  const gross = Number(grossAmount) || 0;
  const tax = Math.max(0, Number(taxAmount) || 0);
  if (tax <= 1e-9) {
    return { base: gross, tax: 0 };
  }
  if (tax > gross + 1e-6) {
    const err = new Error(
      'Tax amount cannot exceed the expense amount. Adjust amount or tax before posting to the general ledger.'
    );
    err.code = 'EXPENSE_TAX_EXCEEDS_GROSS';
    throw err;
  }
  return { base: gross - tax, tax };
}

/**
 * Whether this expense can receive an initial expense GL entry (Transaction).
 */
export function assertExpenseEligibleForGlPosting(expense) {
  const ps = String(expense.paymentStatus || '').trim();
  const supplierId = expense.supplierId || null;
  if (ps === 'Pending' && !supplierId) {
    const err = new Error(
      'This expense is unpaid and has no supplier, so it cannot be posted to the ledger. Add a supplier for Accounts Payable, record payment (payment status), or leave approval until payment is known.'
    );
    err.code = 'EXPENSE_GL_PENDING_NO_SUPPLIER';
    throw err;
  }
  if (!expense.expenseAccountId) {
    const err = new Error('Expense account is required before posting to the general ledger.');
    err.code = 'EXPENSE_GL_NO_ACCOUNT';
    throw err;
  }
  const pm = expense.paymentMethod != null ? String(expense.paymentMethod).trim() : '';
  if (ps !== 'Pending' && !pm) {
    const err = new Error(
      'Payment method is required to post a paid or partially paid expense to the general ledger.'
    );
    err.code = 'EXPENSE_GL_NO_PAYMENT_METHOD';
    throw err;
  }
}

export async function hasPostedExpenseGlTransaction(tx, tenantId, expenseId) {
  const row = await tx.transaction.findFirst({
    where: {
      tenantId,
      sourceType: 'Expense',
      sourceId: expenseId,
      status: GL_POSTED_STATUSES,
      isReversal: false
    },
    select: { id: true }
  });
  return Boolean(row);
}

/**
 * Creates the primary expense Transaction when status is Approved and none exists.
 * Caller should run inside prisma.$transaction when atomicity with status update is required.
 */
export async function postApprovedExpenseJournalIfMissing({
  tx,
  tenantId,
  userId,
  expense
}) {
  if (String(expense.status || '').trim() !== 'Approved') {
    return null;
  }
  if (await hasPostedExpenseGlTransaction(tx, tenantId, expense.id)) {
    return null;
  }
  assertExpenseEligibleForGlPosting(expense);
  const { base, tax } = normalizeExpenseAmountsForGl(expense.amount, expense.taxAmount ?? 0);
  const expenseDate = expense.historicalDate || expense.date;
  const category = expense.category || 'Expense';
  const ps = String(expense.paymentStatus || '').trim();
  const paymentMethodForGl =
    ps === 'Pending' && expense.supplierId
      ? null
      : String(expense.paymentMethod || '').trim();
  return createExpenseJournalEntry({
    tenantId,
    userId,
    expenseId: expense.id,
    expenseDate,
    amount: base,
    taxAmount: tax,
    taxTypeId: expense.taxTypeId || null,
    category,
    expenseAccountId: expense.expenseAccountId,
    paymentMethod: paymentMethodForGl,
    supplierId: expense.supplierId || null,
    paymentStatus: expense.paymentStatus || 'Fully paid',
    tx
  });
}
