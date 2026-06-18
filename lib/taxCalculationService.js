import prisma from './prisma';
import { assertPeriodOpen } from './accountingPeriodService';
import { percentOfMoney, roundMoney } from './money';
import { resolveTaxGlAccountForPosting } from './malawiTaxSeed.js';
import { postGlEntry } from './accountingEngine/postGlEntry.js';
import { findAccountsPayableGlAccount } from './coaPostingCodes.js';

/**
 * Get active tax type by ID or code
 */
export async function getTaxType(tenantId, taxTypeIdOrCode, tx = prisma) {
  const taxType = await tx.taxType.findFirst({
    where: {
      tenantId,
      OR: [
        { id: taxTypeIdOrCode },
        { taxCode: taxTypeIdOrCode },
        { taxId: taxTypeIdOrCode },
      ],
      status: 'Active',
    },
    include: {
      account: true,
    },
  });

  return taxType;
}

/**
 * Get all active tax types for a tenant
 */
export async function getActiveTaxTypes(tenantId, tx = prisma) {
  return await tx.taxType.findMany({
    where: {
      tenantId,
      status: 'Active',
    },
    include: {
      account: true,
    },
  });
}

/**
 * Calculate tax amount based on tax type and base amount
 */
export function calculateTaxAmount(baseAmount, taxType) {
  if (!taxType || taxType.status !== 'Active') {
    return 0;
  }

  if (taxType.calculationType === 'Fixed') {
    return roundMoney(taxType.taxRate || 0);
  }

  return percentOfMoney(baseAmount, taxType.taxRate || 0);
}

async function resolveTaxBalancingAccount(tenantId, sourceType, taxAccount, tx = prisma) {
  const normalized = String(sourceType || '').toLowerCase();

  if (normalized.includes('sale') || normalized.includes('invoice')) {
    const revenue = await tx.account.findFirst({
      where: {
        tenantId,
        isActive: true,
        accountType: { in: ['Income', 'Revenue'] },
      },
      orderBy: { accountCode: 'asc' },
    });
    if (revenue) return revenue;
  }

  if (normalized.includes('expense') || normalized.includes('payroll')) {
    const expense = await tx.account.findFirst({
      where: {
        tenantId,
        isActive: true,
        accountType: 'Expense',
        accountCode: { gte: '5000', lte: '5999' },
      },
      orderBy: { accountCode: 'asc' },
    });
    if (expense) return expense;
  }

  if (taxAccount.accountType === 'Liability') {
    const ap = await findAccountsPayableGlAccount(tenantId, tx);
    if (ap) return ap;
  }

  const cash = await tx.account.findFirst({
    where: { tenantId, isActive: true, accountCode: '1110' },
  });
  if (cash) return cash;

  throw new Error(`Could not resolve balancing account for tax posting (${sourceType}).`);
}

function buildBalancedTaxLines(taxAccount, balancingAccount, postedTaxAmount, taxTypeName, description, sourceType, reverse = false) {
  const amt = roundMoney(postedTaxAmount);
  let taxDebit = 0;
  let taxCredit = 0;

  if (taxAccount.accountType === 'Liability') {
    taxCredit = reverse ? 0 : amt;
    taxDebit = reverse ? amt : 0;
  } else if (taxAccount.accountType === 'Asset') {
    taxDebit = reverse ? 0 : amt;
    taxCredit = reverse ? amt : 0;
  } else {
    throw new Error(`Tax account must be Liability or Asset, got ${taxAccount.accountType}`);
  }

  const balanceDebit = taxCredit > 0 ? amt : 0;
  const balanceCredit = taxDebit > 0 ? amt : 0;

  return [
    {
      lineNumber: 1,
      accountId: taxAccount.id,
      debitAmount: taxDebit,
      creditAmount: taxCredit,
      description: `${reverse ? 'Tax Reversal' : 'Tax'}: ${taxTypeName} - ${description || sourceType}`,
    },
    {
      lineNumber: 2,
      accountId: balancingAccount.id,
      debitAmount: balanceDebit,
      creditAmount: balanceCredit,
      description: `${reverse ? 'Tax reversal offset' : 'Tax offset'} — ${balancingAccount.accountName || balancingAccount.name || ''}`.trim(),
    },
  ];
}

/**
 * Auto-post tax entry to the tax account (balanced double-entry).
 */
export async function autoPostTaxEntry({
  tenantId,
  userId,
  taxTypeId,
  taxAmount,
  transactionDate,
  sourceType,
  sourceId,
  description,
  balancingAccountId = null,
  tx = prisma,
}) {
  const postedTaxAmount = roundMoney(taxAmount);
  if (!postedTaxAmount || postedTaxAmount <= 0) {
    return null;
  }

  const taxType = await getTaxType(tenantId, taxTypeId, tx);
  if (!taxType) {
    throw new Error(`Tax type not found: ${taxTypeId}`);
  }

  const taxAccount = await resolveTaxGlAccountForPosting(tenantId, taxType, sourceType, tx);
  if (!taxAccount) {
    throw new Error(
      `Tax type ${taxType.taxName} has no resolvable GL account under 2041/2045. Run tax catalog sync from Tax Types.`
    );
  }

  const entryDate = transactionDate instanceof Date ? transactionDate : new Date(transactionDate);
  await assertPeriodOpen(tenantId, entryDate, tx);

  let balancingAccount = null;
  if (balancingAccountId) {
    balancingAccount = await tx.account.findFirst({
      where: { id: balancingAccountId, tenantId, isActive: true },
    });
  }
  if (!balancingAccount) {
    balancingAccount = await resolveTaxBalancingAccount(tenantId, sourceType, taxAccount, tx);
  }

  const lines = buildBalancedTaxLines(
    taxAccount,
    balancingAccount,
    postedTaxAmount,
    taxType.taxName,
    description,
    sourceType,
    false
  );

  return postGlEntry({
    tenantId,
    userId,
    entryDate,
    description: description || `Tax: ${taxType.taxName}`,
    sourceType: `Tax-${sourceType}`,
    sourceId: `${sourceId}-tax`,
    lines,
    tx,
  });
}

/**
 * Reverse a tax entry (for refunds/voids).
 */
export async function reverseAutoPostTaxEntry({
  tenantId,
  userId,
  taxTypeId,
  taxAmount,
  transactionDate,
  sourceType,
  sourceId,
  description,
  balancingAccountId = null,
  tx = prisma,
}) {
  const postedTaxAmount = roundMoney(taxAmount);
  if (!postedTaxAmount || postedTaxAmount <= 0) {
    return null;
  }

  const taxType = await getTaxType(tenantId, taxTypeId, tx);
  if (!taxType) {
    throw new Error(`Tax type not found: ${taxTypeId}`);
  }

  const taxAccount = await resolveTaxGlAccountForPosting(tenantId, taxType, sourceType, tx);
  if (!taxAccount) {
    throw new Error(
      `Tax type ${taxType.taxName} has no resolvable GL account for reversal. Sync Malawi tax catalog from Tax Types.`
    );
  }

  const entryDate = transactionDate instanceof Date ? transactionDate : new Date(transactionDate);
  await assertPeriodOpen(tenantId, entryDate, tx);

  let balancingAccount = null;
  if (balancingAccountId) {
    balancingAccount = await tx.account.findFirst({
      where: { id: balancingAccountId, tenantId, isActive: true },
    });
  }
  if (!balancingAccount) {
    balancingAccount = await resolveTaxBalancingAccount(tenantId, sourceType, taxAccount, tx);
  }

  const lines = buildBalancedTaxLines(
    taxAccount,
    balancingAccount,
    postedTaxAmount,
    taxType.taxName,
    description,
    sourceType,
    true
  );

  return postGlEntry({
    tenantId,
    userId,
    entryDate,
    description: description || `Tax Reversal: ${taxType.taxName}`,
    sourceType: `Tax-${sourceType}`,
    sourceId: `${sourceId}-tax-reversal`,
    lines,
    tx,
  });
}

/**
 * Post tax payment (when paying tax authority)
 */
export async function postTaxPayment({
  tenantId,
  userId,
  taxTypeId,
  paymentAmount,
  paymentAccountId,
  paymentDate,
  description,
  sourceId = null,
  tx = prisma,
}) {
  const postedPaymentAmount = roundMoney(paymentAmount);
  const taxType = await getTaxType(tenantId, taxTypeId, tx);
  const taxAccount = await resolveTaxGlAccountForPosting(tenantId, taxType, 'TaxPayment', tx);
  if (!taxType || !taxAccount) {
    throw new Error(`Tax type not found or has no account: ${taxTypeId}`);
  }

  const entryDate = paymentDate instanceof Date ? paymentDate : new Date(paymentDate);
  await assertPeriodOpen(tenantId, entryDate, tx);

  const paymentAccount = await tx.account.findFirst({
    where: {
      id: paymentAccountId,
      tenantId,
      isActive: true,
    },
  });

  if (!paymentAccount) {
    throw new Error(`Payment account not found: ${paymentAccountId}`);
  }

  let taxDebitAmount = 0;
  let taxCreditAmount = 0;

  if (taxAccount.accountType === 'Liability') {
    taxDebitAmount = postedPaymentAmount;
  } else if (taxAccount.accountType === 'Asset') {
    taxCreditAmount = postedPaymentAmount;
  }

  const lines = [
    {
      lineNumber: 1,
      accountId: taxAccount.id,
      debitAmount: taxDebitAmount,
      creditAmount: taxCreditAmount,
      description: `Tax Payment: ${taxType.taxName}`,
    },
    {
      lineNumber: 2,
      accountId: paymentAccount.id,
      debitAmount: 0,
      creditAmount: postedPaymentAmount,
      description: 'Payment to tax authority',
    },
  ];

  return postGlEntry({
    tenantId,
    userId,
    entryDate,
    description: description || `Tax Payment: ${taxType.taxName}`,
    sourceType: 'TaxPayment',
    sourceId: sourceId || `tax-payment-${taxTypeId}-${entryDate.toISOString().slice(0, 10)}`,
    lines,
    tx,
  });
}

/**
 * Offset WHT against tax liability
 */
export async function offsetWHTAgainstTaxLiability({
  tenantId,
  userId,
  whtTaxTypeId,
  liabilityTaxTypeId,
  offsetAmount,
  transactionDate,
  description,
  sourceId = null,
  tx = prisma,
}) {
  const postedOffsetAmount = roundMoney(offsetAmount);
  const whtTaxType = await getTaxType(tenantId, whtTaxTypeId, tx);
  const liabilityTaxType = await getTaxType(tenantId, liabilityTaxTypeId, tx);

  if (!whtTaxType || !whtTaxType.account) {
    throw new Error(`WHT tax type not found: ${whtTaxTypeId}`);
  }

  if (!liabilityTaxType || !liabilityTaxType.account) {
    throw new Error(`Liability tax type not found: ${liabilityTaxTypeId}`);
  }

  if (whtTaxType.account.accountType !== 'Asset') {
    throw new Error('WHT tax type must be linked to an Asset account');
  }

  if (liabilityTaxType.account.accountType !== 'Liability') {
    throw new Error('Liability tax type must be linked to a Liability account');
  }

  const entryDate = transactionDate instanceof Date ? transactionDate : new Date(transactionDate);

  const lines = [
    {
      lineNumber: 1,
      accountId: liabilityTaxType.account.id,
      debitAmount: postedOffsetAmount,
      creditAmount: 0,
      description: `WHT offset against ${liabilityTaxType.taxName}`,
    },
    {
      lineNumber: 2,
      accountId: whtTaxType.account.id,
      debitAmount: 0,
      creditAmount: postedOffsetAmount,
      description: `WHT used: ${whtTaxType.taxName}`,
    },
  ];

  return postGlEntry({
    tenantId,
    userId,
    entryDate,
    description: description || `WHT Offset: ${whtTaxType.taxName} against ${liabilityTaxType.taxName}`,
    sourceType: 'TaxOffset',
    sourceId: sourceId || `wht-offset-${whtTaxTypeId}-${liabilityTaxTypeId}`,
    lines,
    tx,
  });
}
