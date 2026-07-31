import { roundMoney, subtractMoney } from '@/lib/money';

/** Match GL reads elsewhere in the app (Transaction + JournalEntry casing drift) */
export const GL_POSTED_STATUSES = { in: ['posted', 'Posted', 'POSTED'] };

/**
 * Expense.amount is stored as gross (incl. tax when tax is split).
 * Journal posts base to expense account and tax to tax account.
 */
export function normalizeExpenseAmountsForGl(grossAmount, taxAmount) {
  const gross = roundMoney(grossAmount);
  const tax = Math.max(0, roundMoney(taxAmount));
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
  return { base: subtractMoney(gross, tax), tax };
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
  // V2 SoT: JournalEntry (sourceType Expense / sourceId)
  const row = await tx.journalEntry.findFirst({
    where: {
      tenantId,
      sourceType: 'Expense',
      sourceId: expenseId,
      status: GL_POSTED_STATUSES,
      OR: [{ reversalStatus: null }, { reversalStatus: 'NOT_REVERSED' }],
    },
    select: { id: true },
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
  // Dynamic import avoids circular dependency with expenseAdapter → normalizeExpenseAmountsForGl
  const { postExpenseAccounting } = await import('@/lib/accountingV2/adapters/expenseAdapter.js');
  return postExpenseAccounting({
    db: tx,
    tenantId,
    userId,
    expense,
  });
}
