/**
 * Reconciliation adjustments — Posting Engine only (never mutate JE lines).
 */

import { AdjustmentType, StatementMatchingStatus, StatementClassification } from '../domain/enums.js';
import { fromSignedMinor } from '../domain/signedAmount.js';
import { AccountingValidationError } from '../../accountingV2/domain/errors.js';
import { postBankChargeAccounting, postInterestIncomeAccounting } from '../../accountingV2/adapters/bankingAdapter.js';
import { createManualJournalDraft } from '../../accountingV2/application/manualJournalService.js';

/**
 * Classify an unmatched statement row and optionally post an adjustment.
 */
export async function classifyAndAdjust(db, context, input, { hasPermission } = {}) {
  const recon = await db.bankRecReconciliation.findFirst({
    where: { id: input.reconciliationId, tenantId: context.businessId },
  });
  if (!recon) throw new AccountingValidationError('Reconciliation not found.');
  if (['COMPLETED', 'REVERSED'].includes(recon.status)) {
    throw new AccountingValidationError('Cannot adjust a completed reconciliation.');
  }

  const stmt = await db.bankRecStatementTransaction.findFirst({
    where: { id: input.statementTransactionId, tenantId: context.businessId },
  });
  if (!stmt) throw new AccountingValidationError('Statement transaction not found.');

  const classification = input.classification || StatementClassification.UNKNOWN;
  await db.bankRecStatementTransaction.update({
    where: { id: stmt.id },
    data: {
      classification,
      matchingStatus: StatementMatchingStatus.CLASSIFIED,
      reconciliationId: recon.id,
    },
  });

  if (!input.postAdjustment) {
    return { statement: stmt, classification, posted: null };
  }

  const amount = Math.abs(Number(stmt.signedAmountMinor));
  const amountDecimal = fromSignedMinor(amount);
  let posted = null;
  let adjustmentType = AdjustmentType.MANUAL_JOURNAL;

  if (classification === StatementClassification.BANK_CHARGE || classification === 'BANK_CHARGE') {
    adjustmentType = AdjustmentType.BANK_CHARGE;
    // Prefer Payment-backed adapter when paymentId supplied; else manual journal
    if (input.paymentId) {
      posted = await postBankChargeAccounting({
        db,
        tenantId: context.businessId,
        userId: context.userId,
        paymentId: input.paymentId,
        hasPermission: hasPermission || (() => true),
        currency: recon.currency || 'MWK',
      });
    } else {
      posted = await postManualBankAdjustment(db, context, {
        recon,
        stmt,
        description: input.description || stmt.description || 'Bank charge',
        expenseAccountId: input.offsetAccountId,
        bankAccountId: recon.coaAccountId,
        amountDecimal,
        direction: 'charge',
        hasPermission,
      });
    }
  } else if (classification === StatementClassification.INTEREST || classification === 'INTEREST') {
    adjustmentType = AdjustmentType.INTEREST_INCOME;
    if (input.paymentId) {
      posted = await postInterestIncomeAccounting({
        db,
        tenantId: context.businessId,
        userId: context.userId,
        paymentId: input.paymentId,
        hasPermission: hasPermission || (() => true),
        currency: recon.currency || 'MWK',
      });
    } else {
      posted = await postManualBankAdjustment(db, context, {
        recon,
        stmt,
        description: input.description || stmt.description || 'Interest income',
        incomeAccountId: input.offsetAccountId,
        bankAccountId: recon.coaAccountId,
        amountDecimal,
        direction: 'interest',
        hasPermission,
      });
    }
  } else if (input.offsetAccountId) {
    posted = await postManualBankAdjustment(db, context, {
      recon,
      stmt,
      description: input.description || stmt.description || 'Bank reconciliation adjustment',
      offsetAccountId: input.offsetAccountId,
      bankAccountId: recon.coaAccountId,
      amountDecimal,
      direction: stmt.signedAmountMinor < 0 ? 'charge' : 'interest',
      hasPermission,
    });
  } else {
    throw new AccountingValidationError('postAdjustment requires paymentId or offsetAccountId.');
  }

  const link = await db.bankRecAdjustmentLink.create({
    data: {
      tenantId: context.businessId,
      reconciliationId: recon.id,
      statementTransactionId: stmt.id,
      adjustmentType,
      eventRegistryId: posted?.eventId || posted?.registryId || null,
      journalEntryId: posted?.journalEntryId || posted?.journal?.id || null,
      amountMinor: stmt.signedAmountMinor,
      description: input.description || stmt.description,
      createdBy: context.userId || null,
    },
  });

  // Mark statement remaining cleared when adjustment posted for full amount
  await db.bankRecStatementTransaction.update({
    where: { id: stmt.id },
    data: {
      remainingAmountMinor: 0,
      matchingStatus: StatementMatchingStatus.MATCHED,
    },
  });

  return { classification, posted, link };
}

async function postManualBankAdjustment(db, context, opts) {
  const { recon, stmt, amountDecimal, direction, hasPermission } = opts;
  const bankId = opts.bankAccountId;
  const offsetId = opts.expenseAccountId || opts.incomeAccountId || opts.offsetAccountId;
  if (!offsetId) {
    throw new AccountingValidationError('offsetAccountId is required for manual bank adjustment.');
  }

  // Bank asset: charge (out) = credit bank; interest (in) = debit bank
  const lines =
    direction === 'charge'
      ? [
          { accountId: offsetId, debit: amountDecimal, credit: '0.00', description: opts.description },
          { accountId: bankId, debit: '0.00', credit: amountDecimal, description: opts.description },
        ]
      : [
          { accountId: bankId, debit: amountDecimal, credit: '0.00', description: opts.description },
          { accountId: offsetId, debit: '0.00', credit: amountDecimal, description: opts.description },
        ];

  const journal = await createManualJournalDraft(
    context,
    {
      description: opts.description,
      entryDate: stmt.transactionDate.toISOString?.() || String(stmt.transactionDate),
      currency: recon.currency || 'MWK',
      lines,
      adjustment: {
        category: 'CORRECTION',
        reason: `BANK_RECONCILIATION_ADJUSTMENT recon=${recon.id} stmt=${stmt.id}`,
      },
    },
    { hasPermission: hasPermission || (() => true) },
    db
  );

  return { journal, journalEntryId: journal?.id };
}
