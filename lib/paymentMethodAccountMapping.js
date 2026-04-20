// lib/paymentMethodAccountMapping.js
/**
 * Payment Method to Account Mapping
 * Centralized service for mapping payment methods to chart of accounts
 */

import prisma from './prisma';

/**
 * Default payment method to account code mapping
 * This is the standard mapping used across the system
 */
export const DEFAULT_PAYMENT_METHOD_MAP = {
  cash: {
    accountCodes: ['1110', '1000', '1010'],
    accountNameKeywords: ['cash'],
    defaultAccountCode: '1110',
    defaultAccountName: 'Cash'
  },
  bank_transfer: {
    accountCodes: ['1130-01', '1130-02', '1020'],
    accountNameKeywords: ['bank', 'transfer'],
    defaultAccountCode: '1130-01',
    defaultAccountName: 'Bank Transfer'
  },
  airtel_money: {
    accountCodes: ['1130-01', '1130-02', '1030'],
    accountNameKeywords: ['airtel'],
    defaultAccountCode: '1130-01',
    defaultAccountName: 'Airtel Money'
  },
  mpamba: {
    accountCodes: ['1130-01', '1130-02', '1040'],
    accountNameKeywords: ['mpamba'],
    defaultAccountCode: '1130-02',
    defaultAccountName: 'Mpamba'
  },
  paychangu: {
    accountCodes: ['1130-01', '1130-02', '1050'],
    accountNameKeywords: ['paychangu'],
    defaultAccountCode: '1130-01',
    defaultAccountName: 'PayChangu'
  },
  // Aliases
  'Bank Transfer': {
    accountCodes: ['1130-01', '1130-02', '1020'],
    accountNameKeywords: ['bank', 'transfer'],
    defaultAccountCode: '1130-01',
    defaultAccountName: 'Bank Transfer'
  },
  'Airtel Money': {
    accountCodes: ['1130-01', '1130-02', '1030'],
    accountNameKeywords: ['airtel'],
    defaultAccountCode: '1130-01',
    defaultAccountName: 'Airtel Money'
  },
  'Mpamba': {
    accountCodes: ['1130-01', '1130-02', '1040'],
    accountNameKeywords: ['mpamba'],
    defaultAccountCode: '1130-02',
    defaultAccountName: 'Mpamba'
  },
  'PayChangu': {
    accountCodes: ['1130-01', '1130-02', '1050'],
    accountNameKeywords: ['paychangu'],
    defaultAccountCode: '1130-01',
    defaultAccountName: 'PayChangu'
  },
  'Cash': {
    accountCodes: ['1110', '1000', '1010'],
    accountNameKeywords: ['cash'],
    defaultAccountCode: '1110',
    defaultAccountName: 'Cash'
  },
  // Credit sales: debit Accounts Receivable until payment is received
  credit: {
    accountCodes: ['1200', '1100'],
    accountNameKeywords: ['receivable', 'ar', 'a/r'],
    defaultAccountCode: '1200',
    defaultAccountName: 'Accounts Receivable'
  },
  accounts_receivable: {
    accountCodes: ['1200', '1100'],
    accountNameKeywords: ['receivable', 'ar', 'a/r'],
    defaultAccountCode: '1200',
    defaultAccountName: 'Accounts Receivable'
  },
  'Accounts Receivable': {
    accountCodes: ['1200', '1100'],
    accountNameKeywords: ['receivable', 'ar', 'a/r'],
    defaultAccountCode: '1200',
    defaultAccountName: 'Accounts Receivable'
  }
};

/**
 * Get account for a payment method
 * @param {string} tenantId - Tenant ID
 * @param {string} paymentMethod - Payment method key (e.g., 'cash', 'bank_transfer')
 * @param {Object} tx - Optional transaction client
 * @returns {Promise<Object>} Account object
 */
export async function getAccountForPaymentMethod(tenantId, paymentMethod, tx = prisma) {
  if (!paymentMethod) {
    throw new Error('Payment method is required');
  }

  // If paymentMethod looks like an account ID (CUID format: long alphanumeric string), try to find it directly
  if (typeof paymentMethod === 'string' && paymentMethod.length > 20 && /^[a-z0-9]+$/i.test(paymentMethod)) {
    const accountById = await tx.account.findFirst({
      where: {
        id: paymentMethod,
        tenantId,
        isActive: true
      }
    });
    
    if (accountById) {
      console.log(`✅ Found account by ID: ${accountById.accountName} (${accountById.accountCode})`);
      return accountById;
    }
    
    // Also check PaymentAccount model
    const paymentAccountById = await tx.paymentAccount.findFirst({
      where: {
        id: paymentMethod,
        tenantId,
        isActive: true
      }
    });
    
    if (paymentAccountById) {
      if (paymentAccountById.coaAccountId) {
        const coaAccount = await tx.account.findFirst({
          where: {
            id: paymentAccountById.coaAccountId,
            tenantId,
            isActive: true
          }
        });
        if (coaAccount) {
          console.log(`✅ Found account via PaymentAccount coaAccountId: ${coaAccount.accountName} (${coaAccount.accountCode})`);
          return coaAccount;
        }
      }
      // No coaAccountId: map PaymentAccount name/accountType to method key and resolve CoA account
      const name = (paymentAccountById.name || '').toLowerCase();
      const type = (paymentAccountById.accountType || '').toLowerCase();
      let methodKey = 'cash';
      if (type.includes('bank') || name.includes('bank') || name.includes('transfer')) methodKey = 'bank_transfer';
      else if (name.includes('airtel')) methodKey = 'airtel_money';
      else if (name.includes('mpamba')) methodKey = 'mpamba';
      else if (name.includes('paychangu')) methodKey = 'paychangu';
      else if (type.includes('cash') || name.includes('cash')) methodKey = 'cash';
      const methodMap = DEFAULT_PAYMENT_METHOD_MAP[methodKey] || DEFAULT_PAYMENT_METHOD_MAP.cash;
      for (const code of methodMap.accountCodes) {
        const account = await tx.account.findFirst({
          where: {
            tenantId,
            accountCode: code,
            isActive: true,
            accountType: 'Asset'
          }
        });
        if (account) {
          console.log(`✅ Mapped PaymentAccount "${paymentAccountById.name}" to CoA: ${account.accountName} (${account.accountCode})`);
          return account;
        }
      }
      const { getStandardAccounts } = await import('./transactionJournalHelpers');
      const std = await getStandardAccounts(tenantId, tx);
      if (std.cash) return std.cash;
      if (std.bank) return std.bank;
    }
  }

  // Normalize payment method key
  const methodKey = paymentMethod.toLowerCase().replace(/\s+/g, '_');
  const methodMap = DEFAULT_PAYMENT_METHOD_MAP[methodKey] || DEFAULT_PAYMENT_METHOD_MAP[paymentMethod] || DEFAULT_PAYMENT_METHOD_MAP.cash;

  // Try to find account by code first
  for (const code of methodMap.accountCodes) {
    const account = await tx.account.findFirst({
      where: {
        tenantId,
        accountCode: code,
        isActive: true,
        accountType: 'Asset' // Payment methods should be asset accounts
      }
    });
    if (account) {
      return account;
    }
  }

  // Try to find account by name keywords
  for (const keyword of methodMap.accountNameKeywords) {
    const account = await tx.account.findFirst({
      where: {
        tenantId,
        isActive: true,
        accountType: 'Asset',
        OR: [
          { accountName: { contains: keyword, mode: 'insensitive' } },
          { accountName: { contains: methodMap.defaultAccountName, mode: 'insensitive' } }
        ]
      }
    });
    if (account) {
      return account;
    }
  }

  // Fallback: try to find or create default account
  const defaultAccount = await tx.account.findFirst({
    where: {
      tenantId,
      accountCode: methodMap.defaultAccountCode,
      isActive: true
    }
  });

  if (defaultAccount) {
    return defaultAccount;
  }

  const { getStandardAccounts } = await import('./transactionJournalHelpers');
  const stdAccounts = await getStandardAccounts(tenantId, tx);
  if (stdAccounts.cash) {
    console.warn(`⚠️ Using standard Cash account for payment method ${paymentMethod}`);
    return stdAccounts.cash;
  }
  if (stdAccounts.bank) {
    console.warn(`⚠️ Using standard Bank account for payment method ${paymentMethod}`);
    return stdAccounts.bank;
  }

  // If no account found, throw error
  throw new Error(
    `No account found for payment method "${paymentMethod}". ` +
    `Please create an account with code ${methodMap.defaultAccountCode} or name containing "${methodMap.defaultAccountName}" in your chart of accounts.`
  );
}

/**
 * Get all payment method mappings for a tenant
 * Returns the mapping configuration showing which accounts are linked to which payment methods
 * @param {string} tenantId - Tenant ID
 * @param {Object} tx - Optional transaction client
 * @returns {Promise<Array>} Array of payment method mappings
 */
export async function getPaymentMethodMappings(tenantId, tx = prisma) {
  const mappings = [];

  // Get unique payment method keys (excluding aliases)
  const uniqueMethods = new Set();
  Object.keys(DEFAULT_PAYMENT_METHOD_MAP).forEach(key => {
    const normalized = key.toLowerCase().replace(/\s+/g, '_');
    if (!uniqueMethods.has(normalized)) {
      uniqueMethods.add(normalized);
      uniqueMethods.add(key); // Also keep original
    }
  });

  // Get accounts for each payment method
  for (const methodKey of ['cash', 'bank_transfer', 'airtel_money', 'mpamba', 'paychangu']) {
    try {
      const account = await getAccountForPaymentMethod(tenantId, methodKey, tx);
      const methodInfo = DEFAULT_PAYMENT_METHOD_MAP[methodKey] || DEFAULT_PAYMENT_METHOD_MAP.cash;
      
      mappings.push({
        paymentMethod: methodKey,
        paymentMethodName: methodInfo.defaultAccountName,
        accountId: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        isConfigured: true
      });
    } catch (error) {
      const methodInfo = DEFAULT_PAYMENT_METHOD_MAP[methodKey] || DEFAULT_PAYMENT_METHOD_MAP.cash;
      mappings.push({
        paymentMethod: methodKey,
        paymentMethodName: methodInfo.defaultAccountName,
        accountId: null,
        accountCode: methodInfo.defaultAccountCode,
        accountName: methodInfo.defaultAccountName,
        accountType: 'Asset',
        isConfigured: false,
        error: error.message
      });
    }
  }

  return mappings;
}

/**
 * Verify payment method account mappings
 * Checks if all payment methods have valid account mappings
 * @param {string} tenantId - Tenant ID
 * @param {Object} tx - Optional transaction client
 * @returns {Promise<Object>} Verification results
 */
export async function verifyPaymentMethodMappings(tenantId, tx = prisma) {
  const results = {
    allConfigured: true,
    mappings: [],
    missingAccounts: [],
    errors: []
  };

  for (const methodKey of ['cash', 'bank_transfer', 'airtel_money', 'mpamba', 'paychangu']) {
    try {
      const account = await getAccountForPaymentMethod(tenantId, methodKey, tx);
      const methodInfo = DEFAULT_PAYMENT_METHOD_MAP[methodKey] || DEFAULT_PAYMENT_METHOD_MAP.cash;
      
      results.mappings.push({
        paymentMethod: methodKey,
        accountCode: account.accountCode,
        accountName: account.accountName,
        status: 'configured'
      });
    } catch (error) {
      results.allConfigured = false;
      const methodInfo = DEFAULT_PAYMENT_METHOD_MAP[methodKey] || DEFAULT_PAYMENT_METHOD_MAP.cash;
      
      results.missingAccounts.push({
        paymentMethod: methodKey,
        expectedAccountCode: methodInfo.defaultAccountCode,
        expectedAccountName: methodInfo.defaultAccountName
      });
      
      results.errors.push({
        paymentMethod: methodKey,
        error: error.message
      });
    }
  }

  return results;
}










