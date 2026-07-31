/**
 * Phase 9 Stage 1 — Expense → Posting Engine cutover.
 */

import { AccountingEventType, AccountingSourceModule } from '../domain/enums.js';
import {
  amountString,
  contextFromSession,
  resolveCashAccountIdForEngine,
  submitViaCutover,
  toIsoDate,
} from './baseAdapter.js';
import { normalizeExpenseAmountsForGl } from '../../expenseGlPosting.js';
import { getTaxOutflowAccount } from '../../transactionJournalHelpers.js';

async function enrichExpenseForDraft(db, context, tenantId, expense, base, tax) {
  const ps = String(expense.paymentStatus || '').trim();
  const isAp = Boolean(expense.supplierId && ps === 'Pending');
  let _creditAccountId = null;
  if (!isAp) {
    _creditAccountId = await resolveCashAccountIdForEngine({
      db,
      context,
      tenantId,
      paymentMethod: expense.paymentMethod,
      purpose: 'CASH_ON_HAND',
    });
  }
  let _taxAccountId = null;
  if (tax > 0) {
    const taxAcct = await getTaxOutflowAccount(tenantId, db);
    _taxAccountId = taxAcct?.id ?? null;
  }
  return {
    ...expense,
    _glBase: amountString(base),
    _glTax: amountString(tax),
    _creditAccountId,
    _taxAccountId,
  };
}

/**
 * Post an approved expense through cutover (NEW_ENGINE / SHADOW / LEGACY).
 */
export async function postExpenseAccounting({
  db,
  tenantId,
  userId,
  expense,
  hasPermission = () => true,
  currency = 'MWK',
}) {
  const { base, tax } = normalizeExpenseAmountsForGl(expense.amount, expense.taxAmount ?? 0);
  const context = contextFromSession({ tenantId, userId, currency, branchId: expense.branchId });
  const expenseDate = expense.historicalDate || expense.date;

  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.EXPENSES,
    eventType: AccountingEventType.EXPENSE_POSTED,
    hasPermission,
    buildEngineInput: async () => {
      const enriched = await enrichExpenseForDraft(db, context, tenantId, expense, base, tax);
      // Stash on a side channel the engine's source validator will reload from DB;
      // we pass amounts via command totalAmount and metadata for the template.
      return {
        sourceReference: {
          sourceModule: AccountingSourceModule.EXPENSES,
          sourceType: 'Expense',
          sourceId: expense.id,
          sourceNumber: expense.originalReference || expense.id,
          eventType: AccountingEventType.EXPENSE_POSTED,
        },
        transactionDate: toIsoDate(expenseDate),
        requestedPostingDate: toIsoDate(expenseDate),
        currency,
        totalAmount: amountString(base + tax),
        taxAmount: amountString(tax),
        description: expense.description || `Expense ${expense.category || ''}`.trim(),
        dimensions: {
          supplierId: expense.supplierId ?? undefined,
          branchId: expense.branchId ?? undefined,
        },
        metadata: {
          glBase: enriched._glBase,
          glTax: enriched._glTax,
          creditAccountId: enriched._creditAccountId,
          taxAccountId: enriched._taxAccountId,
        },
        payload: null,
      };
    },
  });
}
