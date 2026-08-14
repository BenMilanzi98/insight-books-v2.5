// lib/paymentMethodAccountMapping.js
/**
 * Payment Method to Account Mapping
 * Centralized service for mapping payment methods to chart of accounts
 */

import prisma from './prisma';
import { isCoaStructuralRootCode } from './coaPostingCodes.js';
import { isPaymentGlParentCode, isPaymentGlChildCode } from './paymentGlChannels.js';
import { isTillFloatLeafAccount } from './posTillFloatAccounts.js';

/**
 * Default payment method to account code mapping
 * This is the standard mapping used across the system
 */
export const DEFAULT_PAYMENT_METHOD_MAP = {
  cash: {
    // Never use 1000 — it is the Assets *structural* header (non-postable in GL).
    accountCodes: ['1110', '1010', '1020'],
    accountNameKeywords: ['cash'],
    defaultAccountCode: '1110',
    defaultAccountName: 'Cash'
  },
  bank_transfer: {
    accountCodes: ['1131', '1132', '1133', '1134', '1135', '1136', '1137', '1138', '1020'],
    accountNameKeywords: ['bank', 'transfer'],
    defaultAccountCode: '1131',
    defaultAccountName: 'Bank Transfer'
  },
  airtel_money: {
    accountCodes: ['1140', '1030'],
    accountNameKeywords: ['airtel'],
    defaultAccountCode: '1140',
    defaultAccountName: 'Airtel Money'
  },
  mpamba: {
    accountCodes: ['1141', '1040'],
    accountNameKeywords: ['mpamba'],
    defaultAccountCode: '1141',
    defaultAccountName: 'Mpamba'
  },
  paychangu: {
    accountCodes: ['1131', '1050'],
    accountNameKeywords: ['paychangu'],
    defaultAccountCode: '1131',
    defaultAccountName: 'PayChangu'
  },
  // Aliases
  'Bank Transfer': {
    accountCodes: ['1131', '1132', '1133', '1134', '1135', '1136', '1137', '1138', '1020'],
    accountNameKeywords: ['bank', 'transfer'],
    defaultAccountCode: '1131',
    defaultAccountName: 'Bank Transfer'
  },
  'Airtel Money': {
    accountCodes: ['1140', '1030'],
    accountNameKeywords: ['airtel'],
    defaultAccountCode: '1140',
    defaultAccountName: 'Airtel Money'
  },
  'Mpamba': {
    accountCodes: ['1141', '1040'],
    accountNameKeywords: ['mpamba'],
    defaultAccountCode: '1141',
    defaultAccountName: 'Mpamba'
  },
  'PayChangu': {
    accountCodes: ['1131', '1050'],
    accountNameKeywords: ['paychangu'],
    defaultAccountCode: '1131',
    defaultAccountName: 'PayChangu'
  },
  'Cash': {
    accountCodes: ['1110', '1010', '1020'],
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
function glCodeForAccount(account) {
  return String(account?.accountCode ?? account?.code ?? '').trim();
}

/** Chart section roots (1000, 2000, …) must never receive payment/cash postings. */
function isPostablePaymentAssetAccount(account) {
  if (!account || account.accountType !== 'Asset') return false;
  const code = glCodeForAccount(account);
  if (isCoaStructuralRootCode(code)) return false;
  // Till float is internal POS only — cash sales always post to 1110.
  if (isTillFloatLeafAccount(account)) return false;
  if (account.acceptsNewTransactions === false) return false;
  return true;
}

async function canUsePaymentAssetAccount(tenantId, account, tx) {
  if (!isPostablePaymentAssetAccount(account)) return false;
  const code = glCodeForAccount(account);
  /** Single cash ledger — post here even if legacy 1111–1119 children exist. */
  if (code === '1110') return true;
  /** Bank / mobile rollup parents — postings only on child accounts (1131-01, …). */
  if (code === '1130' || isPaymentGlParentCode(code)) return false;
  if (isPaymentGlChildCode(code)) return true;

  const childCount = await tx.account.count({
    where: {
      tenantId,
      parentAccountId: account.id,
      isActive: true,
    },
  });
  return childCount === 0;
}

async function findFirstPostableChildUnderParent(tenantId, parentCode, tx) {
  const prefix = `${parentCode}-`;
  const children = await tx.account.findMany({
    where: {
      tenantId,
      isActive: true,
      accountType: 'Asset',
      OR: [{ accountCode: { startsWith: prefix } }, { code: { startsWith: prefix } }],
    },
    orderBy: [{ accountCode: 'asc' }],
  });
  for (const child of children) {
    if (await canUsePaymentAssetAccount(tenantId, child, tx)) return child;
  }
  return null;
}

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
    
    if (accountById && await canUsePaymentAssetAccount(tenantId, accountById, tx)) {
      console.log(`✅ Found account by ID: ${accountById.accountName} (${accountById.accountCode})`);
      return accountById;
    }
    if (accountById && !await canUsePaymentAssetAccount(tenantId, accountById, tx)) {
      console.warn(
        `Payment method resolved to non-postable account ${glCodeForAccount(accountById)}; falling back to method map`
      );
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
      const { isPosTillFloatPaymentAccount } = await import('./posTillFloatAccounts.js');
      if (isPosTillFloatPaymentAccount(paymentAccountById)) {
        console.warn('Till Float payment account cannot be used as a payment method; falling back to cash map');
      } else {
        if (paymentAccountById.coaAccountId) {
          const coaAccount = await tx.account.findFirst({
            where: {
              id: paymentAccountById.coaAccountId,
              tenantId,
              isActive: true,
            },
          });
          if (coaAccount && (await canUsePaymentAssetAccount(tenantId, coaAccount, tx))) {
            console.log(
              `✅ Found account via PaymentAccount coaAccountId: ${coaAccount.accountName} (${coaAccount.accountCode})`
            );
            return coaAccount;
          }
        }
        // No usable coaAccountId: map PaymentAccount name/accountType to method key and resolve CoA account
        const name = (paymentAccountById.name || '').toLowerCase();
        const type = (paymentAccountById.accountType || '').toLowerCase();
        let mappedMethodKey = 'cash';
        if (type.includes('bank') || name.includes('bank') || name.includes('transfer')) {
          mappedMethodKey = 'bank_transfer';
        } else if (name.includes('airtel')) mappedMethodKey = 'airtel_money';
        else if (name.includes('mpamba')) mappedMethodKey = 'mpamba';
        else if (name.includes('paychangu')) mappedMethodKey = 'paychangu';
        else if (type.includes('cash') || name.includes('cash')) mappedMethodKey = 'cash';
        const mappedMethodMap =
          DEFAULT_PAYMENT_METHOD_MAP[mappedMethodKey] || DEFAULT_PAYMENT_METHOD_MAP.cash;
        for (const code of mappedMethodMap.accountCodes) {
          if (isCoaStructuralRootCode(code)) continue;
          const account = await tx.account.findFirst({
            where: {
              tenantId,
              accountCode: code,
              isActive: true,
              accountType: 'Asset',
            },
          });
          if (account && (await canUsePaymentAssetAccount(tenantId, account, tx))) {
            console.log(
              `✅ Mapped PaymentAccount "${paymentAccountById.name}" to CoA: ${account.accountName} (${account.accountCode})`
            );
            return account;
          }
        }
        const { resolveOperatingCashGlAccount } = await import('./paymentAccountCoaLink.js');
        const cashLeaf = await resolveOperatingCashGlAccount(tenantId, tx);
        if (cashLeaf && (await canUsePaymentAssetAccount(tenantId, cashLeaf, tx))) {
          console.log(
            `✅ Mapped PaymentAccount "${paymentAccountById.name}" to operating cash GL: ${cashLeaf.accountName} (${cashLeaf.accountCode})`
          );
          return cashLeaf;
        }
        const { getStandardAccounts } = await import('./transactionJournalHelpers');
        const std = await getStandardAccounts(tenantId, tx);
        if (std.bank && (await canUsePaymentAssetAccount(tenantId, std.bank, tx))) return std.bank;
      }
    }
  }

  // Normalize payment method key
  const methodKey = paymentMethod.toLowerCase().replace(/\s+/g, '_');
  const methodMap = DEFAULT_PAYMENT_METHOD_MAP[methodKey] || DEFAULT_PAYMENT_METHOD_MAP[paymentMethod] || DEFAULT_PAYMENT_METHOD_MAP.cash;

  // Try to find account by code first
  for (const code of methodMap.accountCodes) {
    if (isCoaStructuralRootCode(code)) continue;
    const account = await tx.account.findFirst({
      where: {
        tenantId,
        accountCode: code,
        isActive: true,
        accountType: 'Asset' // Payment methods should be asset accounts
      }
    });
    if (account && await canUsePaymentAssetAccount(tenantId, account, tx)) {
      return account;
    }
    if (isPaymentGlParentCode(code)) {
      const child = await findFirstPostableChildUnderParent(tenantId, code, tx);
      if (child) return child;
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
    if (account && await canUsePaymentAssetAccount(tenantId, account, tx)) {
      return account;
    }
  }

  // Fallback: try to find or create default account
  const defaultCode = methodMap.defaultAccountCode;
  if (!isCoaStructuralRootCode(defaultCode)) {
    const defaultAccount = await tx.account.findFirst({
      where: {
        tenantId,
        accountCode: defaultCode,
        isActive: true
      }
    });

    if (defaultAccount && await canUsePaymentAssetAccount(tenantId, defaultAccount, tx)) {
      return defaultAccount;
    }
    if (isPaymentGlParentCode(defaultCode)) {
      const child = await findFirstPostableChildUnderParent(tenantId, defaultCode, tx);
      if (child) return child;
    }
  }

  const { resolveOperatingCashGlAccount } = await import('./paymentAccountCoaLink.js');
  const { getStandardAccounts } = await import('./transactionJournalHelpers');
  const cashLeaf = await resolveOperatingCashGlAccount(tenantId, tx);
  if (cashLeaf && (await canUsePaymentAssetAccount(tenantId, cashLeaf, tx))) {
    console.warn(`⚠️ Using operating cash GL for payment method ${paymentMethod}`);
    return cashLeaf;
  }
  const stdAccounts = await getStandardAccounts(tenantId, tx);
  if (stdAccounts.cash && (await canUsePaymentAssetAccount(tenantId, stdAccounts.cash, tx))) {
    console.warn(`⚠️ Using standard Cash account for payment method ${paymentMethod}`);
    return stdAccounts.cash;
  }
  if (stdAccounts.bank && await canUsePaymentAssetAccount(tenantId, stdAccounts.bank, tx)) {
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










