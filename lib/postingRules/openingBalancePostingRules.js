/**
 * Opening balance posting rules — resolves debit/credit legs per transaction type.
 */
import { resolveOpeningBalanceEquityAccount } from '@/lib/openingBalanceEquityAccount';
import { resolveInventoryGlAccount } from '@/lib/inventoryGlAccount';
import { inferCoaNormalBalance } from '@/lib/coaMoney';

/** @typedef {'opening_stock'|'opening_payment_account'|'opening_receivable'|'opening_payable'|'opening_fixed_asset'|'opening_liability'|'opening_owner_capital'} OpeningBalanceType */

export const OPENING_BALANCE_TYPES = [
  'opening_stock',
  'opening_payment_account',
  'opening_receivable',
  'opening_payable',
  'opening_fixed_asset',
  'opening_liability',
  'opening_owner_capital',
];

const DEFAULT_CODES = {
  opening_receivable: '1200',
  opening_payable: '2110',
};

/**
 * @param {OpeningBalanceType} type
 * @param {object} ctx
 * @param {import('@prisma/client').Account} ctx.targetAccount
 * @param {import('@prisma/client').Account} ctx.equityAccount
 * @param {number} ctx.amount
 */
export function buildOpeningBalanceLines(type, ctx) {
  const amount = Math.abs(Number(ctx.amount) || 0);
  if (amount <= 0) {
    throw new Error('Opening amount must be greater than zero.');
  }

  const targetId = ctx.targetAccount.id;
  const equityId = ctx.equityAccount.id;
  const targetName = ctx.targetAccount.accountName || ctx.targetAccount.name || 'Account';

  switch (type) {
    case 'opening_stock':
    case 'opening_payment_account':
    case 'opening_receivable':
    case 'opening_fixed_asset':
      return [
        { accountId: targetId, debitAmount: amount, creditAmount: 0, description: `Opening balance — ${targetName}` },
        { accountId: equityId, debitAmount: 0, creditAmount: amount, description: 'Opening Balance Equity' },
      ];
    case 'opening_payable':
    case 'opening_liability':
      return [
        { accountId: equityId, debitAmount: amount, creditAmount: 0, description: 'Opening Balance Equity' },
        { accountId: targetId, debitAmount: 0, creditAmount: amount, description: `Opening balance — ${targetName}` },
      ];
    case 'opening_owner_capital': {
      const normal = inferCoaNormalBalance(ctx.targetAccount);
      if (normal === 'Credit') {
        return [
          { accountId: equityId, debitAmount: amount, creditAmount: 0, description: 'Opening Balance Equity' },
          { accountId: targetId, debitAmount: 0, creditAmount: amount, description: `Opening capital — ${targetName}` },
        ];
      }
      return [
        { accountId: targetId, debitAmount: amount, creditAmount: 0, description: `Opening capital — ${targetName}` },
        { accountId: equityId, debitAmount: 0, creditAmount: amount, description: 'Opening Balance Equity' },
      ];
    }
    default:
      throw new Error(`Unsupported opening balance type: ${type}`);
  }
}

/**
 * @param {OpeningBalanceType} type
 * @param {string} tenantId
 * @param {string|null} accountId — target GL account (optional for stock summary)
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} db
 */
export async function resolveOpeningBalanceTargetAccount(type, tenantId, accountId, db) {
  if (accountId) {
    const acct = await db.account.findFirst({
      where: { id: accountId, tenantId, isActive: true, mergedIntoAccountId: null },
    });
    if (!acct) throw new Error('Account not found or inactive.');
    if (acct.acceptsNewTransactions === false && type !== 'opening_stock') {
      throw new Error(`Account ${acct.accountCode} does not accept direct postings.`);
    }
    const code = String(acct.accountCode || acct.code || '').trim();
    if (code === '3100') {
      throw new Error('Opening balances must post to a leaf account, not Equity parent 3100.');
    }
    if (type === 'opening_payment_account') {
      const subtype = String(acct.accountSubtype || '').toLowerCase();
      const name = String(acct.accountName || acct.name || '').toLowerCase();
      const isCashOrBank =
        code.startsWith('111') ||
        code.startsWith('112') ||
        code.startsWith('113') ||
        subtype.includes('cash') ||
        subtype.includes('bank') ||
        name.includes('cash') ||
        name.includes('bank');
      if (!isCashOrBank) {
        throw new Error('Payment-account opening balances must debit a cash or bank leaf account.');
      }
    }
    return acct;
  }

  if (type === 'opening_stock') {
    return resolveInventoryGlAccount(tenantId, db);
  }

  const defaultCode = DEFAULT_CODES[type];
  if (!defaultCode) {
    throw new Error('accountId is required for this opening balance type.');
  }

  const acct = await db.account.findFirst({
    where: { tenantId, accountCode: defaultCode, isActive: true },
  });
  if (!acct) {
    throw new Error(`Required account ${defaultCode} is missing from Chart of Accounts.`);
  }
  return acct;
}

export function buildOpeningBalanceIdempotencyKey({
  tenantId,
  businessId = null,
  type,
  accountId,
  entityId = null,
  asOfDate,
}) {
  const dateKey = asOfDate instanceof Date
    ? asOfDate.toISOString().slice(0, 10)
    : String(asOfDate || '').slice(0, 10);
  const parts = ['opening', tenantId, businessId || 'main', type, accountId];
  if (entityId) parts.push(entityId);
  parts.push(dateKey);
  return parts.join('-');
}
