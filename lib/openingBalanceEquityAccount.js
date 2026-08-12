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

  if (account) {
    return ensureOpeningBalanceEquityPostable(account, db);
  }

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
  if (account) {
    return ensureOpeningBalanceEquityPostable(account, db);
  }

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
      acceptsNewTransactions: true,
      postingAllowed: true,
      coaV2Behaviour: 'POSTING',
      coaV2Category: 'EQUITY',
      coaV2NormalBalance: 'CREDIT',
      coaV2Status: 'ACTIVE',
      description: 'System counter-account for opening balances (3190). Posted only via opening-balance service.',
      balance: 0,
    },
  });
}

export function isOpeningBalanceEquityAccount(account) {
  const code = String(account?.accountCode ?? account?.code ?? '').trim();
  return code === OPENING_BALANCE_EQUITY_CODE;
}

/** V2 posting requires a postable 3190 leaf (manual UI posting stays restricted). */
export async function ensureOpeningBalanceEquityPostable(account, db) {
  if (!account) return account;
  const behaviour = String(account.coaV2Behaviour || '').toUpperCase();
  const needsPatch =
    account.acceptsNewTransactions === false ||
    account.postingAllowed === false ||
    behaviour === 'HEADER' ||
    behaviour === 'NON_POSTING';
  if (!needsPatch) return account;
  return db.account.update({
    where: { id: account.id },
    data: {
      acceptsNewTransactions: true,
      postingAllowed: true,
      coaV2Behaviour: behaviour === 'HEADER' || behaviour === 'NON_POSTING' ? 'POSTING' : account.coaV2Behaviour,
      coaV2Category: account.coaV2Category || 'EQUITY',
      coaV2NormalBalance: account.coaV2NormalBalance || 'CREDIT',
      coaV2Status: 'ACTIVE',
    },
  });
}
