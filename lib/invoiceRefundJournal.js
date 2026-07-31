/**
 * Invoice refund GL posting — Stage 3B cutover via postCustomerRefundAccounting.
 * Replaces the former direct Transaction.create / postGlEntry bypass.
 */

import { getPaymentAccount, getStandardAccounts } from '@/lib/transactionJournalHelpers';
import { generateReferenceNumber } from '@/lib/journalService';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import { validateTransactionBalance } from '@/lib/accountingValidation';
import { postCustomerRefundAccounting } from '@/lib/accountingV2/adapters/customerRefundAdapter.js';

/**
 * @param {object} params
 * @param {Map<string, number>|Array<[string, number]>} params.paymentRefundMap
 *   paymentMethod → amount credited from cash/bank
 */
export async function createInvoiceRefundJournalEntry({
  tenantId,
  userId,
  refundId,
  invoiceId,
  invoiceNumber,
  refundAmount,
  refundReason,
  paymentRefundMap,
  refundDate = new Date(),
  tx,
  __skipCutover = false,
}) {
  const mapEntries = paymentRefundMap instanceof Map
    ? [...paymentRefundMap.entries()]
    : Array.isArray(paymentRefundMap)
      ? paymentRefundMap
      : Object.entries(paymentRefundMap || {});

  const primaryMethod = mapEntries[0]?.[0] || null;

  if (!__skipCutover) {
    const outcome = await postCustomerRefundAccounting({
      db: tx,
      tenantId,
      userId,
      refundId,
      invoiceId,
      refundAmount,
      refundDate,
      paymentMethod: primaryMethod,
      legacyPost: () =>
        createInvoiceRefundJournalEntry({
          tenantId,
          userId,
          refundId,
          invoiceId,
          invoiceNumber,
          refundAmount,
          refundReason,
          paymentRefundMap,
          refundDate,
          tx,
          __skipCutover: true,
        }),
    });
    return outcome.result;
  }

  const accounts = await getStandardAccounts(tenantId, tx);
  if (!accounts.accountsReceivable) {
    throw new Error('Accounts Receivable account not found. Please set up your chart of accounts.');
  }

  const entryDate = refundDate instanceof Date ? refundDate : new Date(refundDate);
  await assertPeriodOpen(tenantId, entryDate, tx);
  const reference = await generateReferenceNumber(tx, tenantId, entryDate);

  const lines = [
    {
      lineNumber: 1,
      accountId: accounts.accountsReceivable.id,
      debitAmount: Number(refundAmount),
      creditAmount: 0,
      description: `Accounts Receivable restored for refund of Invoice ${invoiceNumber}`,
    },
  ];
  let lineNumber = 2;
  for (const [paymentMethod, amount] of mapEntries) {
    const paymentAccount = await getPaymentAccount(tenantId, paymentMethod, tx);
    if (!paymentAccount) {
      throw new Error(`Payment account not found for method: ${paymentMethod}`);
    }
    lines.push({
      lineNumber: lineNumber++,
      accountId: paymentAccount.id,
      debitAmount: 0,
      creditAmount: Number(amount),
      description: `Refund via ${paymentMethod} for Invoice ${invoiceNumber}`,
    });
  }

  const balanceValidation = validateTransactionBalance(lines);
  if (!balanceValidation.isValid) {
    throw new Error(`Refund transaction validation failed: ${balanceValidation.error}`);
  }

  // Fresh-books V2: legacy Transaction writer removed. V2 path is above (__skipCutover=false).
  const err = new Error(
    'createInvoiceRefundJournalEntry legacy path removed (LEGACY_POSTING_REMOVED). Use postCustomerRefundAccounting.'
  );
  err.code = 'LEGACY_POSTING_REMOVED';
  throw err;
}
