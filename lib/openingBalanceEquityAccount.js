/**
 * Resolve or create the protected Opening Balance Equity account (3190).
 */
import prisma from '@/lib/prisma';
import { OPENING_BALANCE_EQUITY_CODE } from '@/lib/coaMoney';
import { ensureChartOfAccountsForTenant } from '@/lib/chartOfAccountsInitialization';

export const OPENING_BALANCE_EQUITY_NAME = 'Opening Balance Equity';

/**
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} [db]
 */
export async function resolveOpeningBalanceEquityAccount(tenantId, db = prisma) {
  let account = await db.account.findFirst({
    where: {
      tenantId,
      accountCode: OPENING_BALANCE_EQUITY_CODE,
      isActive: true,
      mergedIntoAccountId: null,
    },
  });

  if (account) return account;

  try {
    await ensureChartOfAccountsForTenant(tenantId, db, { preferSystemCoaDefinition: true });
  } catch {
    /* continue */
  }

  account = await db.account.findFirst({
    where: {
      tenantId,
      accountCode: OPENING_BALANCE_EQUITY_CODE,
      isActive: true,
      mergedIntoAccountId: null,
    },
  });
  if (account) return account;

  const parent3100 = await db.account.findFirst({
    where: { tenantId, accountCode: '3100', isActive: true },
    select: { id: true },
  });

  return db.account.create({
    data: {
      tenantId,
      accountCode: OPENING_BALANCE_EQUITY_CODE,
      code: OPENING_BALANCE_EQUITY_CODE,
      accountName: OPENING_BALANCE_EQUITY_NAME,
      name: OPENING_BALANCE_EQUITY_NAME,
      accountType: 'Equity',
      type: 'Equity',
      normalBalance: 'Credit',
      accountSubtype: 'Equity',
      parentAccountId: parent3100?.id ?? null,
      isActive: true,
      isSystem: true,
      acceptsNewTransactions: false,
      description: 'System counter-account for opening balances. Posting only via OpeningBalanceService.',
      balance: 0,
    },
  });
}

export function isOpeningBalanceEquityAccount(account) {
  const code = String(account?.accountCode ?? account?.code ?? '').trim();
  return code === OPENING_BALANCE_EQUITY_CODE;
}
