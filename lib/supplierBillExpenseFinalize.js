/**
 * Post expense-type supplier bills to the GL (Dr expense/tax, Cr AP).
 * Shared by manual bill creation and PO-from-receipt automation.
 */

import { generateReferenceNumber } from '@/lib/journalService';
import { getTaxOutflowAccount } from '@/lib/transactionJournalHelpers';
import { updateAccountBalanceOnTransaction } from '@/lib/accountBalanceService';
import { findAccountsPayableGlAccount } from '@/lib/coaPostingCodes';

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {object} bill - must include supplier: { supplierName }, items[]
 * @param {string} tenantId
 * @param {string} userId
 */
export async function finalizeExpenseBill(tx, bill, tenantId, userId) {
  if (bill.journalEntryId) return;

  const apAccount = await findAccountsPayableGlAccount(tenantId, tx);

  if (!apAccount) {
    throw new Error('Accounts Payable account not found. Please set up your chart of accounts.');
  }

  const entryDate = bill.billDate instanceof Date ? bill.billDate : new Date(bill.billDate);
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);

  const billTotal = Number(bill.totalAmount || 0);
  const billTax = Number(bill.taxAmount || 0);
  const expenseTotal = billTotal - billTax;
  const taxAccount = billTax > 0 ? await getTaxOutflowAccount(tenantId, tx) : null;
  const scale = billTotal > 0 && billTax > 0 && taxAccount ? expenseTotal / billTotal : 1;

  const lines = [];
  let lineNum = 1;

  for (const item of bill.items) {
    if (!item.expenseAccountId) continue;

    const expenseAccount = await tx.account.findFirst({
      where: {
        id: item.expenseAccountId,
        tenantId,
        isActive: true,
      },
    });

    if (!expenseAccount) {
      throw new Error(`Expense account not found: ${item.expenseAccountId}`);
    }

    const itemDebit = Number(item.lineTotal || 0) * scale;
    lines.push({
      lineNumber: lineNum++,
      accountId: expenseAccount.id,
      debitAmount: itemDebit,
      creditAmount: 0,
      description: item.description || `Expense - ${bill.billNumber}`,
    });
  }

  if (billTax > 0 && taxAccount) {
    lines.push({
      lineNumber: lineNum++,
      accountId: taxAccount.id,
      debitAmount: billTax,
      creditAmount: 0,
      description: `Tax on bill - ${bill.billNumber}`,
    });
  }

  lines.push({
    lineNumber: lineNum,
    accountId: apAccount.id,
    debitAmount: 0,
    creditAmount: billTotal,
    description: `Accounts Payable - ${bill.supplier.supplierName}`,
  });

  const transaction = await tx.transaction.create({
    data: {
      tenantId,
      date: entryDate,
      reference: referenceNumber,
      description: `Expense Bill ${bill.billNumber} - ${bill.supplier.supplierName}`,
      entryType: 'Regular',
      status: 'posted',
      sourceType: 'SupplierBill',
      sourceId: bill.id,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      lines: {
        create: lines,
      },
    },
    include: { lines: true },
  });

  for (const line of transaction.lines) {
    await updateAccountBalanceOnTransaction(
      line.accountId,
      line.debitAmount,
      line.creditAmount,
      tx
    );
  }

  await tx.supplierBill.update({
    where: { id: bill.id },
    data: { journalEntryId: transaction.id },
  });

  await tx.supplier.update({
    where: { id: bill.supplierId },
    data: {
      currentBalance: {
        increment: bill.totalAmount,
      },
    },
  });
}
