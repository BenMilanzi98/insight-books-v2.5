// lib/purchaseAccounting.js
import prisma from '@/lib/prisma';
import { getAccountForPaymentMethod } from './paymentMethodAccountMapping';
import { resolveOrEnsureInventoryGlAccount } from './inventoryGlAccount';
import { findAccountsPayableGlAccount } from '@/lib/coaPostingCodes';
import { postGlEntry } from './accountingEngine/postGlEntry.js';

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
}) {
  const { inventoryAccount, accountsPayable } = await getAccounts(tenantId, tx);
  const entryDate = new Date();

  const transactionLines = [
    {
      lineNumber: 1,
      accountId: inventoryAccount.id,
      debitAmount: totalAmount,
      creditAmount: 0,
      description: 'Inventory received',
    },
    {
      lineNumber: 2,
      accountId: accountsPayable.id,
      debitAmount: 0,
      creditAmount: totalAmount,
      description: 'Amount due to supplier',
    },
  ];

  const transaction = await postGlEntry({
    tenantId,
    userId,
    entryDate,
    description: `Goods Receipt ${reference}`,
    sourceType: 'GoodsReceipt',
    sourceId: goodsReceiptId,
    lines: transactionLines,
    tx,
  });

  return { id: transaction.id, journalEntryId: transaction.id, lines: transaction.lines };
}

async function getPaymentAccount(tenantId, paymentMethod, tx = prisma) {
  try {
    return await getAccountForPaymentMethod(tenantId, paymentMethod, tx);
  } catch (error) {
    console.error('Error getting payment account:', error);
    const paymentMethodMap = {
      Cash: '1110',
      'Bank Transfer': '1131',
      'Airtel Money': '1140',
      Mpamba: '1141',
      PayChangu: '1131',
      Cheque: '1131',
      'Mobile Money': '1140',
    };

    const accountCode = paymentMethodMap[paymentMethod] || '1000';
    const account = await tx.account.findFirst({
      where: { tenantId, accountCode, isActive: true },
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
}) {
  const accountsPayable = await findAccountsPayableGlAccount(tenantId, tx);

  if (!accountsPayable) {
    throw new Error('Accounts Payable account not found. Please set up your chart of accounts.');
  }

  const cashAccount = await getPaymentAccount(tenantId, paymentMethod, tx);
  const entryDate = new Date();

  const transactionLines = [
    {
      lineNumber: 1,
      accountId: accountsPayable.id,
      debitAmount: amount,
      creditAmount: 0,
      description: `Payment to ${supplierName}`,
    },
    {
      lineNumber: 2,
      accountId: cashAccount.id,
      debitAmount: 0,
      creditAmount: amount,
      description: `Payment via ${paymentMethod}`,
    },
  ];

  const transaction = await postGlEntry({
    tenantId,
    userId,
    entryDate,
    description: `Payment to ${supplierName} - ${paymentMethod} ${reference}`,
    sourceType: 'SupplierPayment',
    sourceId: paymentId,
    lines: transactionLines,
    tx,
  });

  return { ...transaction, journalEntryId: transaction.id };
}

/**
 * Record an asset contributed by the owner (not purchased).
 */
export async function createOwnerContributedAssetEntry({
  tenantId,
  userId,
  assetAccountId,
  amount,
  description,
  sourceId,
  tx = prisma,
}) {
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
          { accountName: { contains: 'Share Capital', mode: 'insensitive' },
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
    throw new Error("Owner's Capital / Equity account not found. Please set up your chart of accounts.");
  }

  const entryDate = new Date();

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

  return postGlEntry({
    tenantId,
    userId,
    entryDate,
    description: `Owner contribution — ${description || 'asset'}`,
    sourceType: 'OwnerContribution',
    sourceId: sourceId || `owner-asset-${assetAccountId}`,
    lines: transactionLines,
    tx,
  });
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
  tx = prisma,
}) {
  const amt = roundMoney(amount);
  if (amt <= 0) return null;

  const accountsPayable = await findAccountsPayableGlAccount(tenantId, tx);
  if (!accountsPayable) {
    throw new Error('Accounts Payable account not found. Please set up your chart of accounts.');
  }

  const cashAccount = await getPaymentAccount(tenantId, paymentMethod, tx);
  const entryDate = new Date();

  const transactionLines = [
    {
      lineNumber: 1,
      accountId: cashAccount.id,
      debitAmount: amt,
      creditAmount: 0,
      description: `Undo payment slice — restore cash (${reference || 'payment'})`,
    },
    {
      lineNumber: 2,
      accountId: accountsPayable.id,
      debitAmount: 0,
      creditAmount: amt,
      description: `Undo payment slice — restore AP (${supplierName || 'supplier'})`,
    },
  ];

  return postGlEntry({
    tenantId,
    userId,
    entryDate,
    description: `Bill cancel — payment allocation reversal (${reference || sourceBillId}). ${reversalReason}`,
    sourceType: 'BillCancelPaymentSlice',
    sourceId: sourceBillId,
    lines: transactionLines,
    tx,
  });
}
