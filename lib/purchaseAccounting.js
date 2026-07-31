// lib/purchaseAccounting.js
import prisma from '@/lib/prisma';
import { generateReferenceNumber } from './journalService';
import { validateTransactionBalance } from './accountingValidation';
import { getAccountForPaymentMethod } from './paymentMethodAccountMapping';
import { assertPeriodOpen } from './accountingPeriodService';
import { resolveOrEnsureInventoryGlAccount } from './inventoryGlAccount';
import { updateAccountBalanceOnTransaction } from './accountBalanceService';
import { findAccountsPayableGlAccount } from '@/lib/coaPostingCodes';

async function getAccounts(tenantId, tx = prisma) {
  const inventoryAccount = await resolveOrEnsureInventoryGlAccount(tenantId, tx);
  const accountsPayable = await findAccountsPayableGlAccount(tenantId, tx);

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
  tx = prisma,
  __skipCutover = false,
}) {
  if (!__skipCutover) {
    const { postGoodsReceivedAccounting } = await import('./accountingV2/adapters/goodsReceivedAdapter.js');
    const outcome = await postGoodsReceivedAccounting({
      db: tx,
      tenantId,
      userId,
      goodsReceiptId,
      totalAmount,
      legacyPost: async () => {
        const err = new Error(
          'Legacy goods-receipt posting removed (LEGACY_POSTING_REMOVED). Use V2 postGoodsReceivedAccounting only.'
        );
        err.code = 'LEGACY_POSTING_REMOVED';
        throw err;
      },
    });
    if (outcome.authority === 'V2') {
      return {
        id: outcome.result?.journalEntryId,
        journalEntryId: outcome.result?.journalEntryId,
        lines: outcome.result?.lines ?? [],
      };
    }
    return outcome.result;
  }

  const err = new Error(
    'createPurchaseReceiptJournalEntry legacy path removed (LEGACY_POSTING_REMOVED).'
  );
  err.code = 'LEGACY_POSTING_REMOVED';
  throw err;

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

  // Post once as JournalEntry + lines only. A parallel Transaction + TransactionLine used to be
  // created as well, which caused /general-ledger to show duplicate rows (it merges both sources).
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
      transactionId: null,
      lines: {
        create: transactionLines.map((line) => ({
          lineNumber: line.lineNumber,
          accountId: line.accountId,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          description: line.description,
        })),
      },
    },
    include: { lines: true },
  });

  return { id: journalEntry.id, journalEntryId: journalEntry.id, lines: journalEntry.lines };
}

async function getPaymentAccount(tenantId, paymentMethod, tx = prisma) {
  // Use the centralized payment method mapping
  try {
    return await getAccountForPaymentMethod(tenantId, paymentMethod, tx);
  } catch (error) {
    console.error('Error getting payment account:', error);
    // Fallback to old method if getAccountForPaymentMethod fails
    const paymentMethodMap = {
      Cash: '1110',
      'Bank Transfer': '1130-01',
      'Airtel Money': '1130-01',
      Mpamba: '1130-02',
      PayChangu: '1130-01',
      Cheque: '1130-01',
      'Mobile Money': '1130-01',
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
  tx = prisma,
  __skipCutover = false,
}) {
  if (!__skipCutover) {
    const { postSupplierPaymentAccounting } = await import('./accountingV2/adapters/supplierPaymentAdapter.js');
    const outcome = await postSupplierPaymentAccounting({
      db: tx,
      tenantId,
      userId,
      paymentId,
      paymentMethod,
      legacyPost: async () => {
        const err = new Error(
          'Legacy supplier-payment posting removed (LEGACY_POSTING_REMOVED). Use V2 postSupplierPaymentAccounting only.'
        );
        err.code = 'LEGACY_POSTING_REMOVED';
        throw err;
      },
    });
    if (outcome.authority === 'V2') {
      const journalId = outcome.result?.journalEntryId;
      if (journalId) {
        await tx.supplierPayment.update({
          where: { id: paymentId },
          data: { journalEntryId: journalId },
        });
      }
      return outcome.result;
    }
    return outcome.result;
  }

  {
    const err = new Error(
      'createSupplierPaymentEntry legacy path removed (LEGACY_POSTING_REMOVED).'
    );
    err.code = 'LEGACY_POSTING_REMOVED';
    throw err;
  }

  const accountsPayable = await findAccountsPayableGlAccount(tenantId, tx);

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

/**
 * Record an asset contributed by the owner (not purchased).
 * Dr Asset account, Cr Owner's Capital / Equity — no AP involved.
 */
export async function createOwnerContributedAssetEntry({
  tenantId,
  userId,
  assetAccountId,
  amount,
  description,
  sourceId,
  tx = prisma
}) {
  {
    const err = new Error(
      'createOwnerContributedAssetEntry legacy path removed (LEGACY_POSTING_REMOVED). Use V2 capital/asset adapters.'
    );
    err.code = 'LEGACY_POSTING_REMOVED';
    throw err;
  }
  // Prefer Owner's Capital (3100), not the Equity group header (3000).
  let equityAccount = await tx.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { accountCode: '3100' },
        {
          accountType: 'Equity',
          accountName: { contains: "Owner's Capital", mode: 'insensitive' },
        },
        {
          type: 'EQUITY',
          name: { contains: "Owner's Capital", mode: 'insensitive' },
        },
      ],
    },
  });

  if (!equityAccount) {
    equityAccount = await tx.account.findFirst({
      where: {
        tenantId,
        accountType: 'Equity',
        isActive: true,
        OR: [
          { accountName: { contains: 'Capital', mode: 'insensitive' } },
          { accountName: { contains: 'Share Capital', mode: 'insensitive' } },
        ],
        NOT: { accountCode: '3000' },
      },
    });
  }

  if (!equityAccount) {
    equityAccount = await tx.account.findFirst({
      where: { tenantId, accountType: 'Equity', isActive: true },
    });
  }

  if (!equityAccount) {
    throw new Error(
      'Owner\'s Capital / Equity account not found. Please set up your chart of accounts.'
    );
  }

  const entryDate = new Date();
  await assertPeriodOpen(tenantId, entryDate, tx);
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);

  const transactionLines = [
    {
      lineNumber: 1,
      accountId: assetAccountId,
      debitAmount: amount,
      creditAmount: 0,
      description: description || 'Asset contributed by owner',
    },
    {
      lineNumber: 2,
      accountId: equityAccount.id,
      debitAmount: 0,
      creditAmount: amount,
      description: 'Owner capital contribution',
    },
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
      description: `Owner contribution — ${description || 'asset'}`,
      entryType: 'Regular',
      status: 'posted',
      sourceType: 'OwnerContribution',
      sourceId: sourceId || null,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      lines: { create: transactionLines },
    },
    include: { lines: true },
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
      sourceType: 'OwnerContribution',
      sourceId: sourceId || null,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      transactionId: transaction.id,
      lines: {
        create: transactionLines.map((line) => ({
          lineNumber: line.lineNumber,
          accountId: line.accountId,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          description: line.description,
        })),
      },
    },
  });

  return transaction;
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
  {
    const err = new Error(
      'createSupplierPaymentSliceReversalEntry legacy path removed (LEGACY_POSTING_REMOVED). Reverse V2 journals via reverseSourceJournals.'
    );
    err.code = 'LEGACY_POSTING_REMOVED';
    throw err;
  }
  const amt = roundMoney(amount);
  if (amt <= 0) return null;

  const accountsPayable = await findAccountsPayableGlAccount(tenantId, tx);
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

