/**
 * Resolve cash & bank GL accounts from Chart of Accounts (shared by Balance Sheet + Cash Flow).
 */
import { isCoaStructuralRootCode } from './coaPostingCodes.js';
import { isPaymentGlChildCode, isPaymentGlParentCode } from './paymentGlChannels.js';

export const CANONICAL_CASH_CODES = ['1110', '1010', '1020', '1030', '1040', '1050'];
export const LEGACY_CASH_BALANCE_CODES = ['1000', '1010', '1020', '1030', '1040', '1050', '1110'];

export function normalizedAccountCode(account) {
  return String(account?.accountCode ?? account?.code ?? '').trim();
}


export function isBankGlCode(code) {
  const c = String(code || '').trim();
  return /^113[1-8]$/.test(c);
}

export function isBankMobileGlCode(code) {
  const c = String(code || '').trim();
  if (isPaymentGlParentCode(c)) return true;
  if (isPaymentGlChildCode(c)) return true;
  if (isBankGlCode(c)) return true;
  return /^1130-\d+/i.test(c);
}

/** Whether a CoA row represents a postable cash/bank/mobile wallet account. */
export function isCashOrBankGlAccount(account, { hasActiveChildren = false } = {}) {
  if (!account || account.isActive === false) return false;
  const type = String(account.accountType ?? account.type ?? '').trim();
  if (type && !/asset/i.test(type)) return false;

  const code = normalizedAccountCode(account);
  if (!code || isCoaStructuralRootCode(code)) return false;
  if (code === '1000' || code === '1100' || code === '1130') return false;
  if (isPaymentGlParentCode(code)) return false;
  if (code === '1110' || isPaymentGlChildCode(code)) return true;
  if (isBankMobileGlCode(code)) return true;
  if (CANONICAL_CASH_CODES.includes(code)) return true;

  const name = String(account.accountName ?? account.name ?? '').toLowerCase();
  const subtype = String(account.accountSubtype ?? '').toLowerCase();
  const cashKeyword =
    subtype.includes('cash') ||
    name.includes('cash on hand') ||
    name.includes('cash -') ||
    name.includes('bank') ||
    name.includes('airtel') ||
    name.includes('mpamba') ||
    name.includes('paychangu') ||
    name.includes('mobile money') ||
    name.includes('wallet');

  if (!cashKeyword) return false;
  if (hasActiveChildren) return false;
  if (account.acceptsNewTransactions === false) return false;
  return true;
}

/**
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} [db]
 */
export async function resolveCashAndBankAccounts(tenantId, db) {
  const prisma = db ?? (await import('./prisma.js')).default;
  const rows = await prisma.account.findMany({
    where: { tenantId, isActive: true, accountType: 'Asset' },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      code: true,
      name: true,
      accountType: true,
      accountSubtype: true,
      acceptsNewTransactions: true,
      parentAccountId: true,
      _count: { select: { childAccounts: { where: { isActive: true } } } },
    },
    orderBy: [{ accountCode: 'asc' }],
  });

  return rows
    .filter((a) =>
      isCashOrBankGlAccount(a, {
        hasActiveChildren: (a._count?.childAccounts || 0) > 0,
      })
    )
    .map(({ _count, ...a }) => ({
      ...a,
      accountCode: normalizedAccountCode(a),
      accountName: a.accountName ?? a.name ?? '',
    }));
}

export function isCashAccountCodeForBalanceSheet(code) {
  const c = String(code || '').trim();
  if (c === '1110' || isBankMobileGlCode(c)) return true;
  return ['1010', '1020', '1030', '1040', '1050'].includes(c);
}
