/**
 * Expense posting preview — prefers V2 previewPosting; falls back to CASH_EXPENSE mirror.
 */

import prisma from '@/lib/prisma';
import { AccountingEventType, AccountingSourceModule } from '@/lib/accountingV2/domain/enums.js';
import {
  amountString,
  contextFromSession,
  resolveCashAccountIdForEngine,
  toIsoDate,
} from '@/lib/accountingV2/adapters/baseAdapter.js';
import { previewPosting } from '@/lib/accountingV2/engine/postingEngine.js';
import { normalizeExpenseAmountsForGl } from '@/lib/expenseGlPosting.js';
import { getTaxOutflowAccount } from '@/lib/transactionJournalHelpers.js';
import { findAccountsPayableGlAccount } from '@/lib/coaPostingCodes.js';

async function enrichExpenseForPreview(db, context, tenantId, expense, base, tax) {
  const ps = String(expense.paymentStatus || '').trim();
  const isAp = Boolean(expense.supplierId && ps === 'Pending');
  let creditAccountId = null;
  if (!isAp) {
    creditAccountId = await resolveCashAccountIdForEngine({
      db,
      context,
      tenantId,
      paymentMethod: expense.paymentMethod,
      purpose: 'CASH_ON_HAND',
    });
  }
  let taxAccountId = null;
  if (tax > 0) {
    const taxAcct = await getTaxOutflowAccount(tenantId, db);
    taxAccountId = taxAcct?.id ?? null;
  }
  return { isAp, creditAccountId, taxAccountId, glBase: amountString(base), glTax: amountString(tax) };
}

function sumLines(lines) {
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lines) {
    totalDebit += Number(line.debit || 0);
    totalCredit += Number(line.credit || 0);
  }
  return {
    totalDebit: totalDebit.toFixed(2),
    totalCredit: totalCredit.toFixed(2),
  };
}

/**
 * Mirror CASH_EXPENSE template lines from expense fields (no engine / no DB source load).
 */
export async function buildMirrorExpensePreviewLines({
  db = prisma,
  tenantId,
  userId,
  expense,
  currency = 'MWK',
}) {
  const { base, tax } = normalizeExpenseAmountsForGl(expense.amount, expense.taxAmount ?? 0);
  const context = contextFromSession({ tenantId, userId, currency, branchId: expense.branchId });
  const enriched = await enrichExpenseForPreview(db, context, tenantId, expense, base, tax);

  const lines = [];
  const warnings = [];
  const errors = [];

  if (!expense.expenseAccountId) {
    errors.push({ path: 'expenseAccountId', message: 'Expense account is required for posting preview' });
  } else if (base > 0) {
    lines.push({
      accountId: expense.expenseAccountId,
      debit: enriched.glBase,
      credit: null,
      description: `Expense: ${expense.category || expense.description || 'Expense'}`,
    });
  }

  if (tax > 0) {
    if (enriched.taxAccountId) {
      lines.push({
        accountId: enriched.taxAccountId,
        debit: enriched.glTax,
        credit: null,
        description: 'VAT input — expense',
      });
    } else {
      warnings.push({ path: 'taxAccountId', message: 'VAT input account could not be resolved' });
    }
  }

  let creditId = enriched.creditAccountId;
  if (enriched.isAp) {
    const ap = await findAccountsPayableGlAccount(tenantId, db);
    creditId = ap?.id ?? null;
    if (!creditId) {
      errors.push({ path: 'creditAccountId', message: 'Accounts Payable account not found' });
    }
  } else if (!creditId) {
    warnings.push({
      path: 'creditAccountId',
      message: 'Cash/bank credit account could not be resolved from payment method',
    });
  }

  const creditAmount = (base + tax).toFixed(2);
  if (creditId) {
    lines.push({
      accountId: creditId,
      debit: null,
      credit: creditAmount,
      description: enriched.isAp ? 'Accounts Payable' : 'Payment for expense',
    });
  }

  const totals = sumLines(lines);
  return {
    preview: true,
    posted: false,
    source: 'mirror',
    templateId: 'CASH_EXPENSE',
    currency,
    lines,
    ...totals,
    warnings,
    errors,
    valid: errors.length === 0 && lines.length > 0,
  };
}

async function tryEnginePreview({ db, tenantId, userId, expense, currency, hasPermission }) {
  const { base, tax } = normalizeExpenseAmountsForGl(expense.amount, expense.taxAmount ?? 0);
  const context = contextFromSession({ tenantId, userId, currency, branchId: expense.branchId });
  const enriched = await enrichExpenseForPreview(db, context, tenantId, expense, base, tax);
  const expenseDate = expense.historicalDate || expense.date;

  const engineResult = await previewPosting(
    {
      context,
      hasPermission,
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
        glBase: enriched.glBase,
        glTax: enriched.glTax,
        creditAccountId: enriched.creditAccountId,
        taxAccountId: enriched.taxAccountId,
      },
    },
    db
  );

  const lines = (engineResult.lines || []).map((line) => ({
    accountId: line.accountId,
    accountCode: line.accountCode ?? null,
    accountName: line.accountName ?? null,
    debit: line.debit != null ? String(line.debit) : null,
    credit: line.credit != null ? String(line.credit) : null,
    description: line.description ?? null,
  }));

  return {
    preview: true,
    posted: false,
    source: 'previewPosting',
    templateId: engineResult.template?.templateId ?? 'CASH_EXPENSE',
    currency: engineResult.currency ?? currency,
    lines,
    totalDebit: engineResult.totalDebit,
    totalCredit: engineResult.totalCredit,
    periodId: engineResult.accountingPeriodId ?? null,
    periodName: engineResult.periodName ?? null,
    warnings: engineResult.warnings ?? [],
    errors: engineResult.validationErrors ?? [],
    valid: Boolean(engineResult.valid),
  };
}

/**
 * Preview expense GL lines without posting.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @param {object} params.expense — persisted or draft fields
 * @param {import('@prisma/client').PrismaClient} [params.db]
 * @param {string} [params.currency]
 * @param {(p: string) => boolean} [params.hasPermission]
 */
export async function previewExpensePosting({
  tenantId,
  userId,
  expense,
  db = prisma,
  currency = 'MWK',
  hasPermission = () => true,
}) {
  if (!expense) {
    const err = new Error('expense is required');
    err.code = 'EXPENSE_PREVIEW_MISSING';
    throw err;
  }

  if (expense.id) {
    try {
      return await tryEnginePreview({
        db,
        tenantId,
        userId,
        expense,
        currency,
        hasPermission,
      });
    } catch {
      // Engine preview can fail for drafts / missing period — fall back to mirror.
    }
  }

  return buildMirrorExpensePreviewLines({ db, tenantId, userId, expense, currency });
}
