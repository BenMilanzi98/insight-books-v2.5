/**
 * Phase 9 Stage 1 — Bank charge / interest income → Posting Engine cutover.
 * Source is typically a Payment row with type bank_charge | interest_income.
 */

import { AccountingEventType, AccountingSourceModule } from '../domain/enums.js';
import {
  amountString,
  contextFromSession,
  resolveCashAccountIdForEngine,
  submitViaCutover,
  toIsoDate,
} from './baseAdapter.js';

async function postBankingEvent({
  db,
  tenantId,
  userId,
  paymentId,
  eventType,
  hasPermission = () => true,
  currency = 'MWK',
}) {
  const payment = await db.payment.findFirst({ where: { id: paymentId, tenantId } });
  if (!payment) throw new Error("Source payment not found for V2 posting");

  const context = contextFromSession({
    tenantId,
    userId,
    currency,
    branchId: payment.branchId,
  });

  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.BANKING,
    eventType,
    hasPermission,
    buildEngineInput: async () => {
      const bankAccountId = await resolveCashAccountIdForEngine({
        db,
        context,
        tenantId,
        paymentMethod:
          payment.paymentMethod || payment.sourceAccount || payment.destinationAccount,
        purpose: 'PRIMARY_BANK',
      });
      const sourceType =
        eventType === AccountingEventType.BANK_CHARGE_POSTED ? 'BankCharge' : 'InterestIncome';
      return {
        sourceReference: {
          sourceModule: AccountingSourceModule.BANKING,
          sourceType,
          sourceId: payment.id,
          sourceNumber: payment.reference || payment.id,
          eventType,
        },
        transactionDate: toIsoDate(payment.paymentDate),
        requestedPostingDate: toIsoDate(payment.paymentDate),
        currency,
        totalAmount: amountString(payment.amount),
        taxAmount: '0.00',
        description: payment.notes || (eventType === AccountingEventType.BANK_CHARGE_POSTED ? 'Bank charge' : 'Interest income'),
        dimensions: { bankAccountId: payment.destinationAccount || payment.sourceAccount || undefined },
        metadata: { bankAccountId },
        payload: null,
      };
    },
  });
}

export function postBankChargeAccounting(params) {
  return postBankingEvent({ ...params, eventType: AccountingEventType.BANK_CHARGE_POSTED });
}

export function postInterestIncomeAccounting(params) {
  return postBankingEvent({ ...params, eventType: AccountingEventType.INTEREST_INCOME_POSTED });
}
