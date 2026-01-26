import prisma from './prisma';
import { generateReferenceNumber } from './journalService';
import { updateAccountBalanceOnTransaction } from './accountBalanceService';

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

  const amount = parseFloat(baseAmount) || 0;
  const rate = parseFloat(taxType.taxRate) || 0;

  if (taxType.calculationType === 'Fixed') {
    return rate;
  } else {
    // Percentage calculation
    return (amount * rate) / 100;
  }
}

/**
 * Auto-post tax entry to the tax account
 * This creates a transaction that posts tax to the correct account
 * 
 * @param {Object} params
 * @param {string} params.tenantId - Tenant ID
 * @param {string} params.userId - User ID
 * @param {string} params.taxTypeId - Tax Type ID
 * @param {number} params.taxAmount - Tax amount to post
 * @param {Date} params.transactionDate - Transaction date
 * @param {string} params.sourceType - Source type (Payroll, Sale, Invoice, Expense, etc.)
 * @param {string} params.sourceId - Source document ID
 * @param {string} params.description - Description for the transaction
 * @param {Object} params.tx - Prisma transaction (optional)
 * @returns {Promise<Object>} Created transaction
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
  tx = prisma,
}) {
  if (!taxAmount || taxAmount <= 0) {
    return null; // No tax to post
  }

  // Get tax type with account
  const taxType = await getTaxType(tenantId, taxTypeId, tx);
  if (!taxType) {
    throw new Error(`Tax type not found: ${taxTypeId}`);
  }

  if (!taxType.account) {
    throw new Error(`Tax type ${taxType.taxName} does not have an account linked`);
  }

  const taxAccount = taxType.account;
  const entryDate = transactionDate instanceof Date ? transactionDate : new Date(transactionDate);
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);

  // Determine debit/credit based on account type
  // Liability accounts: Credit increases liability (tax owed)
  // Asset accounts: Debit increases asset (WHT receivable)
  let debitAmount = 0;
  let creditAmount = 0;

  if (taxAccount.accountType === 'Liability') {
    // Liability: Credit increases tax payable
    creditAmount = taxAmount;
  } else if (taxAccount.accountType === 'Asset') {
    // Asset (WHT): Debit increases receivable
    debitAmount = taxAmount;
  } else {
    throw new Error(`Tax account must be Liability or Asset, got ${taxAccount.accountType}`);
  }

  // Create transaction for tax posting
  const transaction = await tx.transaction.create({
    data: {
      tenantId,
      date: entryDate,
      reference: referenceNumber,
      description: description || `Tax: ${taxType.taxName}`,
      entryType: 'Regular',
      status: 'posted',
      sourceType: `Tax-${sourceType}`,
      sourceId: sourceId,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      lines: {
        create: [
          {
            lineNumber: 1,
            accountId: taxAccount.id,
            debitAmount,
            creditAmount,
            description: `Tax: ${taxType.taxName} - ${description || sourceType}`,
          },
        ],
      },
    },
    include: { lines: true },
  });

  // Update account balance
  await updateAccountBalanceOnTransaction(
    taxAccount.id,
    debitAmount,
    creditAmount,
    tx
  );

  return transaction;
}

/**
 * Post tax payment (when paying tax authority)
 * Debits the tax liability account and credits bank/cash
 * 
 * @param {Object} params
 * @param {string} params.tenantId - Tenant ID
 * @param {string} params.userId - User ID
 * @param {string} params.taxTypeId - Tax Type ID
 * @param {number} params.paymentAmount - Amount being paid
 * @param {string} params.paymentAccountId - Bank/Cash account ID
 * @param {Date} params.paymentDate - Payment date
 * @param {string} params.description - Description
 * @param {Object} params.tx - Prisma transaction (optional)
 * @returns {Promise<Object>} Created transaction
 */
export async function postTaxPayment({
  tenantId,
  userId,
  taxTypeId,
  paymentAmount,
  paymentAccountId,
  paymentDate,
  description,
  tx = prisma,
}) {
  const taxType = await getTaxType(tenantId, taxTypeId, tx);
  if (!taxType || !taxType.account) {
    throw new Error(`Tax type not found or has no account: ${taxTypeId}`);
  }

  const taxAccount = taxType.account;
  const entryDate = paymentDate instanceof Date ? paymentDate : new Date(paymentDate);
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);

  // Get payment account
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

  // Determine debit/credit
  // For Liability: Debit reduces liability (paying off tax)
  // For Asset: Credit reduces asset (WHT being used/paid)
  let taxDebitAmount = 0;
  let taxCreditAmount = 0;

  if (taxAccount.accountType === 'Liability') {
    taxDebitAmount = paymentAmount; // Debit reduces liability
  } else if (taxAccount.accountType === 'Asset') {
    taxCreditAmount = paymentAmount; // Credit reduces asset
  }

  // Payment account: Credit bank/cash (money going out)
  const paymentDebitAmount = 0;
  const paymentCreditAmount = paymentAmount;

  // Create transaction
  const transaction = await tx.transaction.create({
    data: {
      tenantId,
      date: entryDate,
      reference: referenceNumber,
      description: description || `Tax Payment: ${taxType.taxName}`,
      entryType: 'Regular',
      status: 'posted',
      sourceType: 'TaxPayment',
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      lines: {
        create: [
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
            debitAmount: paymentDebitAmount,
            creditAmount: paymentCreditAmount,
            description: `Payment to tax authority`,
          },
        ],
      },
    },
    include: { lines: true },
  });

  // Update account balances
  await Promise.all([
    updateAccountBalanceOnTransaction(
      taxAccount.id,
      taxDebitAmount,
      taxCreditAmount,
      tx
    ),
    updateAccountBalanceOnTransaction(
      paymentAccount.id,
      paymentDebitAmount,
      paymentCreditAmount,
      tx
    ),
  ]);

  return transaction;
}

/**
 * Offset WHT against tax liability
 * When WHT (asset) is used to offset tax liability
 * 
 * @param {Object} params
 * @param {string} params.tenantId - Tenant ID
 * @param {string} params.userId - User ID
 * @param {string} params.whtTaxTypeId - WHT Tax Type ID (Asset)
 * @param {string} params.liabilityTaxTypeId - Liability Tax Type ID
 * @param {number} params.offsetAmount - Amount to offset
 * @param {Date} params.transactionDate - Transaction date
 * @param {string} params.description - Description
 * @param {Object} params.tx - Prisma transaction (optional)
 * @returns {Promise<Object>} Created transaction
 */
export async function offsetWHTAgainstTaxLiability({
  tenantId,
  userId,
  whtTaxTypeId,
  liabilityTaxTypeId,
  offsetAmount,
  transactionDate,
  description,
  tx = prisma,
}) {
  const whtTaxType = await getTaxType(tenantId, whtTaxTypeId, tx);
  const liabilityTaxType = await getTaxType(tenantId, liabilityTaxTypeId, tx);

  if (!whtTaxType || !whtTaxType.account) {
    throw new Error(`WHT tax type not found: ${whtTaxTypeId}`);
  }

  if (!liabilityTaxType || !liabilityTaxType.account) {
    throw new Error(`Liability tax type not found: ${liabilityTaxTypeId}`);
  }

  if (whtTaxType.account.accountType !== 'Asset') {
    throw new Error(`WHT tax type must be linked to an Asset account`);
  }

  if (liabilityTaxType.account.accountType !== 'Liability') {
    throw new Error(`Liability tax type must be linked to a Liability account`);
  }

  const entryDate = transactionDate instanceof Date ? transactionDate : new Date(transactionDate);
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);

  // WHT Account (Asset): Credit reduces asset
  // Liability Account: Debit reduces liability
  const transaction = await tx.transaction.create({
    data: {
      tenantId,
      date: entryDate,
      reference: referenceNumber,
      description: description || `WHT Offset: ${whtTaxType.taxName} against ${liabilityTaxType.taxName}`,
      entryType: 'Regular',
      status: 'posted',
      sourceType: 'TaxOffset',
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      lines: {
        create: [
          {
            lineNumber: 1,
            accountId: liabilityTaxType.account.id,
            debitAmount: offsetAmount, // Debit reduces liability
            creditAmount: 0,
            description: `WHT offset against ${liabilityTaxType.taxName}`,
          },
          {
            lineNumber: 2,
            accountId: whtTaxType.account.id,
            debitAmount: 0,
            creditAmount: offsetAmount, // Credit reduces asset
            description: `WHT used: ${whtTaxType.taxName}`,
          },
        ],
      },
    },
    include: { lines: true },
  });

  // Update account balances
  await Promise.all([
    updateAccountBalanceOnTransaction(
      liabilityTaxType.account.id,
      offsetAmount,
      0,
      tx
    ),
    updateAccountBalanceOnTransaction(
      whtTaxType.account.id,
      0,
      offsetAmount,
      tx
    ),
  ]);

  return transaction;
}
