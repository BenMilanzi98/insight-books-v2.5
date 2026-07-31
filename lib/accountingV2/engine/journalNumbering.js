/**
 * Posting engine — concurrency-safe journal numbering (Phase 4).
 *
 * Numbers are allocated from `AcctV2JournalSequence` inside the posting
 * transaction. Allocation is an UPDATE with an atomic increment on a unique
 * (tenantId, scopeKey) row: under READ COMMITTED the row lock serializes
 * concurrent allocations, so two postings can never receive the same number.
 * Numbers are stable once allocated and are NOT reused after rollback (gaps
 * are permitted and auditable — never row-count based numbering).
 *
 * Format: {prefix}-{year}-{sequence, 6 digits}  e.g. MJ-2026-000042
 */

import { assertTransactionClient } from '../infrastructure/transactionBoundary.js';
import { AccountingEventType } from '../domain/enums.js';
import { AccountingConcurrencyError } from '../domain/errors.js';

/** Event-type → journal-number prefix. Default JE. */
export const JOURNAL_NUMBER_PREFIXES = Object.freeze({
  [AccountingEventType.MANUAL_JOURNAL_POSTED]: 'MJ',
  [AccountingEventType.ADJUSTMENT_POSTED]: 'ADJ',
  [AccountingEventType.OPENING_BALANCE_POSTED]: 'OB',
  [AccountingEventType.OPENING_STOCK_POSTED]: 'OB',
  [AccountingEventType.REVERSAL_POSTED]: 'REV',
  [AccountingEventType.HISTORICAL_REPAIR_POSTED]: 'HREP',
  [AccountingEventType.INVOICE_POSTED]: 'SALE',
  [AccountingEventType.CUSTOMER_PAYMENT_POSTED]: 'RCPT',
  [AccountingEventType.CUSTOMER_CREDIT_NOTE_POSTED]: 'CN',
  [AccountingEventType.CUSTOMER_REFUND_POSTED]: 'REF',
  [AccountingEventType.SUPPLIER_PAYMENT_POSTED]: 'PAY',
  [AccountingEventType.EXPENSE_POSTED]: 'EXP',
  [AccountingEventType.EXPENSE_PAYMENT_POSTED]: 'EXPAY',
  [AccountingEventType.INVENTORY_SOLD]: 'POS',
  [AccountingEventType.COST_OF_SALES_RECOGNIZED]: 'COGS',
  [AccountingEventType.INVENTORY_RECEIVED]: 'GR',
  [AccountingEventType.STOCK_ADJUSTMENT_POSTED]: 'STK',
  [AccountingEventType.PAYROLL_POSTED]: 'PR',
  [AccountingEventType.PAYROLL_PAYMENT_POSTED]: 'PRPAY',
  [AccountingEventType.SALARY_ADVANCE_DISBURSED]: 'ADV',
  [AccountingEventType.RENTAL_CUSTOMER_DEPOSIT]: 'RDEP',
  [AccountingEventType.HIRE_SUPPLIER_DEPOSIT]: 'HDEP',
  [AccountingEventType.HIRE_COST_ACCRUAL]: 'HACR',
  [AccountingEventType.HIRE_ACCRUAL_CLEARED]: 'HCLR',
  [AccountingEventType.DEPRECIATION_POSTED]: 'DEP',
  [AccountingEventType.BANK_TRANSFER_POSTED]: 'XFR',
  [AccountingEventType.TAX_SETTLEMENT_POSTED]: 'TAX',
  [AccountingEventType.LOAN_RECEIVED]: 'LN',
  [AccountingEventType.LOAN_REPAYMENT_POSTED]: 'LNR',
  [AccountingEventType.ASSET_ACQUIRED]: 'FA',
  [AccountingEventType.ASSET_DISPOSED]: 'FAD',
  [AccountingEventType.CAPITAL_CONTRIBUTION_POSTED]: 'CAP',
  [AccountingEventType.OWNER_DRAWING_POSTED]: 'DRW',
  [AccountingEventType.SUPPLIER_CREDIT_POSTED]: 'SC',
});

/** @param {string} eventType */
export function journalNumberPrefix(eventType) {
  return JOURNAL_NUMBER_PREFIXES[eventType] ?? 'JE';
}

/**
 * Allocate the next journal number for a business + event type + posting year.
 * Must run inside the posting transaction so a rolled-back posting cannot
 * publish its number (the gap simply remains if a later attempt succeeds).
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {{eventType: string, postingDate: string|Date}} params
 * @returns {Promise<string>}
 */
export async function allocateJournalNumber(tx, context, params) {
  assertTransactionClient(tx);
  const prefix = journalNumberPrefix(params.eventType);
  const year = new Date(params.postingDate).getUTCFullYear();
  const scopeKey = `${prefix}-${year}`;

  let row;
  try {
    // Row-locking atomic increment. If the row does not exist yet, create it
    // (unique constraint resolves the create/create race).
    row = await tx.acctV2JournalSequence.update({
      where: { tenantId_scopeKey: { tenantId: context.businessId, scopeKey } },
      data: { lastValue: { increment: 1 } },
    });
  } catch (err) {
    if (err && typeof err === 'object' && err.code === 'P2025') {
      try {
        row = await tx.acctV2JournalSequence.create({
          data: { tenantId: context.businessId, scopeKey, lastValue: 1 },
        });
      } catch (createErr) {
        if (createErr && typeof createErr === 'object' && createErr.code === 'P2002') {
          // A concurrent transaction created the row first — increment it.
          row = await tx.acctV2JournalSequence.update({
            where: { tenantId_scopeKey: { tenantId: context.businessId, scopeKey } },
            data: { lastValue: { increment: 1 } },
          });
        } else {
          throw createErr;
        }
      }
    } else {
      throw err;
    }
  }

  if (!row || !Number.isInteger(row.lastValue) || row.lastValue < 1) {
    throw new AccountingConcurrencyError({
      requestId: context.requestId,
      correlationId: context.correlationId,
      diagnostic: { scopeKey, allocated: row?.lastValue },
    });
  }
  return `${scopeKey}-${String(row.lastValue).padStart(6, '0')}`;
}
