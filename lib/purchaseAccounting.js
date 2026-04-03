// lib/purchaseAccounting.js
import prisma from '@/lib/prisma';
import { generateReferenceNumber } from './journalService';
import { validateTransactionBalance } from './accountingValidation';
import { getAccountForPaymentMethod } from './paymentMethodAccountMapping';
import { assertPeriodOpen } from './accountingPeriodService';
import { resolveOrEnsureInventoryGlAccount } from './inventoryGlAccount';
import { updateAccountBalanceOnTransaction } from './accountBalanceService';

async function getAccounts(tenantId, tx = prisma) {
  const inventoryAccount = await resolveOrEnsureInventoryGlAccount(tenantId, tx);

  // Try to find accounts payable by code
  let accountsPayable = await tx.account.findFirst({
    where: { 
      tenantId, 
      OR: [
        { accountCode: '2000' },
        { accountCode: '2100' }
      ],
      accountType: 'Liability',
      isActive: true
    }
  });

  // If not found, try by name
  if (!accountsPayable) {
    accountsPayable = await tx.account.findFirst({
      where: { 
        tenantId,
        accountName: { contains: 'Accounts Payable', mode: 'insensitive' },
        accountType: 'Liability',
        isActive: true
      }
    });
  }

  if (!inventoryAccount || !accountsPayable) {
    throw new Error('Inventory or Accounts Payable accounts not found. Please set up your chart of accounts.');
  }
  return { inventoryAccount, accountsPayable };
}

export async function createPurchaseReceiptJournalEntry({
  tenantId,
  userId,
  goodsReceiptId,
  supplierId,
  totalAmount,
  reference,
  tx = prisma
}) {
  const { inventoryAccount, accountsPayable } = await getAccounts(tenantId, tx);

  const entryDate = new Date();
  await assertPeriodOpen(tenantId, entryDate, tx);
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);

  // Prepare transaction lines
  const transactionLines = [
    {
      lineNumber: 1,
      accountId: inventoryAccount.id,
      debitAmount: totalAmount,
      creditAmount: 0,
      description: 'Inventory received'
    },
    {
      lineNumber: 2,
      accountId: accountsPayable.id,
      debitAmount: 0,
      creditAmount: totalAmount,
      description: 'Amount due to supplier'
    }
  ];

  // Validate balance
  const balanceValidation = validateTransactionBalance(transactionLines);
  if (!balanceValidation.isValid) {
    throw new Error(`Transaction does not balance: ${balanceValidation.error}`);
  }

  // Create transaction
  const transaction = await tx.transaction.create({
    data: {
      tenantId,
      date: entryDate,
      reference: referenceNumber,
      description: `Goods Receipt ${reference}`,
      entryType: 'Regular',
      status: 'posted',
      sourceType: 'GoodsReceipt',
      sourceId: goodsReceiptId,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      lines: {
        create: transactionLines
      }
    },
    include: { lines: true }
  });

  // Also create JournalEntry for schema compatibility
  const journalEntry = await tx.journalEntry.create({
    data: {
      tenantId,
      entryDate: entryDate,
      referenceNumber: referenceNumber,
      description: `Goods Receipt ${reference}`,
      entryType: 'Regular',
      status: 'Posted',
      sourceType: 'GoodsReceipt',
      sourceId: goodsReceiptId,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      transactionId: transaction.id, // Link to Transaction
      lines: {
        create: transactionLines.map((line, index) => ({
          lineNumber: line.lineNumber,
          accountId: line.accountId,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          description: line.description
        }))
      }
    }
  });

  // Return transaction, but journalEntry.id can be used for journalEntryId fields
  return { ...transaction, journalEntryId: journalEntry.id };
}

async function getPaymentAccount(tenantId, paymentMethod, tx = prisma) {
  // Use the centralized payment method mapping
  try {
    return await getAccountForPaymentMethod(tenantId, paymentMethod, tx);
  } catch (error) {
    console.error('Error getting payment account:', error);
    // Fallback to old method if getAccountForPaymentMethod fails
    const paymentMethodMap = {
      'Cash': '1000',
      'Bank Transfer': '1020',
      'Airtel Money': '1030',
      'Mpamba': '1040',
      'PayChangu': '1050',
      'Cheque': '1020',
      'Mobile Money': '1030'
    };
    
    const accountCode = paymentMethodMap[paymentMethod] || '1000';
    const account = await tx.account.findFirst({
      where: { tenantId, accountCode, isActive: true }
    });
    
    if (!account) {
      throw new Error(`Payment account (${accountCode}) not found for payment method: ${paymentMethod}`);
    }
    
    return account;
 }
}

export async function createSupplierPaymentEntry({
  tenantId,
  userId,
  paymentId,
  supplierName,
  amount,
  paymentMethod,
  reference,
  tx = prisma
}) {
  // Get accounts payable account
  let accountsPayable = await tx.account.findFirst({
    where: { 
      tenantId, 
      OR: [
        { accountCode: '2000' },
        { accountCode: '2100' }
      ],
      accountType: 'Liability',
      isActive: true
    }
  });

  if (!accountsPayable) {
    accountsPayable = await tx.account.findFirst({
      where: { 
        tenantId,
        accountName: { contains: 'Accounts Payable', mode: 'insensitive' },
        accountType: 'Liability',
        isActive: true
      }
    });
  }
  
  if (!accountsPayable) {
    throw new Error('Accounts Payable account not found. Please set up your chart of accounts.');
  }
  
  const cashAccount = await getPaymentAccount(tenantId, paymentMethod, tx);
  
  const entryDate = new Date();
  await assertPeriodOpen(tenantId, entryDate, tx);
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);

  // Prepare transaction lines
  const transactionLines = [
    {
      lineNumber: 1,
      accountId: accountsPayable.id,
      debitAmount: amount,
      creditAmount: 0,
      description: `Payment to ${supplierName}`
    },
    {
      lineNumber: 2,
      accountId: cashAccount.id,
      debitAmount: 0,
      creditAmount: amount,
      description: `Payment via ${paymentMethod}`
    }
  ];

  // Validate balance
  const balanceValidation = validateTransactionBalance(transactionLines);
  if (!balanceValidation.isValid) {
    throw new Error(`Transaction does not balance: ${balanceValidation.error}`);
  }

  // Create transaction
  const transaction = await tx.transaction.create({
    data: {
      tenantId,
      date: entryDate,
      reference: referenceNumber,
      description: `Payment to ${supplierName} - ${paymentMethod} ${reference}`,
      entryType: 'Regular',
      status: 'posted',
      sourceType: 'SupplierPayment',
      sourceId: paymentId,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      lines: {
        create: transactionLines
      }
    },
    include: { lines: true }
  });

  // Also create JournalEntry for schema compatibility
  const journalEntry = await tx.journalEntry.create({
    data: {
      tenantId,
      entryDate: entryDate,
      referenceNumber: referenceNumber,
      description: `Payment to ${supplierName} - ${paymentMethod} ${reference}`,
      entryType: 'Regular',
      status: 'Posted',
      sourceType: 'SupplierPayment',
      sourceId: paymentId,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      transactionId: transaction.id, // Link to Transaction
      lines: {
        create: transactionLines.map((line, index) => ({
          lineNumber: line.lineNumber,
          accountId: line.accountId,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          description: line.description
        }))
      }
    }
  });

  // Return transaction, but journalEntry.id can be used for journalEntryId fields
  return { ...transaction, journalEntryId: journalEntry.id };
}

const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

/**
 * When a supplier payment was allocated to multiple bills, reversing one bill must not
 * reverse the entire payment journal. This posts DR Cash / CR AP for the slice only.
 */
export async function createSupplierPaymentSliceReversalEntry({
  tenantId,
  userId,
  amount,
  paymentMethod,
  supplierName,
  reference,
  sourceBillId,
  reversalReason,
  tx = prisma
}) {
  const amt = roundMoney(amount);
  if (amt <= 0) return null;

  let accountsPayable = await tx.account.findFirst({
    where: {
      tenantId,
      OR: [{ accountCode: '2000' }, { accountCode: '2100' }],
      accountType: 'Liability',
      isActive: true
    }
  });
  if (!accountsPayable) {
    accountsPayable = await tx.account.findFirst({
      where: {
        tenantId,
        accountName: { contains: 'Accounts Payable', mode: 'insensitive' },
        accountType: 'Liability',
        isActive: true
      }
    });
  }
  if (!accountsPayable) {
    throw new Error('Accounts Payable account not found. Please set up your chart of accounts.');
  }

  const cashAccount = await getPaymentAccount(tenantId, paymentMethod, tx);

  const entryDate = new Date();
  await assertPeriodOpen(tenantId, entryDate, tx);
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);

  const transactionLines = [
    {
      lineNumber: 1,
      accountId: cashAccount.id,
      debitAmount: amt,
      creditAmount: 0,
      description: `Undo payment slice — restore cash (${reference || 'payment'})`
    },
    {
      lineNumber: 2,
      accountId: accountsPayable.id,
      debitAmount: 0,
      creditAmount: amt,
      description: `Undo payment slice — restore AP (${supplierName || 'supplier'})`
    }
  ];

  const balanceValidation = validateTransactionBalance(transactionLines);
  if (!balanceValidation.isValid) {
    throw new Error(`Transaction does not balance: ${balanceValidation.error}`);
  }

  const transaction = await tx.transaction.create({
    data: {
      tenantId,
      date: entryDate,
      reference: referenceNumber,
      description: `Bill cancel — payment allocation reversal (${reference || sourceBillId}). ${reversalReason}`,
      entryType: 'Regular',
      status: 'posted',
      sourceType: 'BillCancelPaymentSlice',
      sourceId: sourceBillId,
      createdById: userId,
      postedById: userId,
      postedDate: entryDate,
      lines: {
        create: transactionLines
      }
    },
    include: { lines: true }
  });

  for (const line of transaction.lines) {
    await updateAccountBalanceOnTransaction(
      line.accountId,
      Number(line.debitAmount || 0),
      Number(line.creditAmount || 0),
      tx
    );
  }

  await tx.journalEntry.create({
    data: {
      tenantId,
      entryDate,
      referenceNumber,
      description: transaction.description,
      entryType: 'Regular',
      status: 'Posted',
      sourceType: 'BillCancelPaymentSlice',
      sourceId: sourceBillId,
      createdById: userId,
      postedById: userId,
      postedDate: entryDate,
      transactionId: transaction.id,
      lines: {
        create: transactionLines.map((line) => ({
          lineNumber: line.lineNumber,
          accountId: line.accountId,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          description: line.description
        }))
      }
    }
  });

  return transaction;
}

