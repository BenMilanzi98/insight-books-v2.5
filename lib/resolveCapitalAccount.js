import prisma from '@/lib/prisma';

function legacyCapitalWhere(tenantId) {
  return {
    tenantId,
    isActive: true,
    AND: [
      {
        OR: [
          { accountType: 'Equity' },
          { accountType: 'EQUITY' },
          { type: 'Equity' },
          { type: 'EQUITY' },
        ],
      },
      {
        OR: [
          { accountName: { contains: 'Capital', mode: 'insensitive' } },
          { name: { contains: 'Capital', mode: 'insensitive' } },
        ],
      },
      { NOT: { accountCode: '3000' } },
    ],
  };
}

/**
 * True when 500000 is actually used (new capital model): pool balance, children, or posted credits on subtree.
 * Empty 500000 from chart bootstrap alone must stay false so legacy tenants keep using 3100.
 */
async function isCapital500000InUse(tenantId, account500, db = prisma) {
  if (!account500?.id) return false;
  if (Math.abs(Number(account500.balance) || 0) > 1e-9) return true;

  const children = await db.account.findMany({
    where: { tenantId, parentAccountId: account500.id, isActive: true },
    select: { id: true },
  });
  if (children.length > 0) return true;

  const jeParent = await db.journalEntry.count({
    where: { accountId: account500.id, credit: { gt: 0 } },
  });
  if (jeParent > 0) return true;

  return false;
}

/**
 * Primary capital GL for balances & transfers.
 * Structure file: Owner's Capital is **3100**. Legacy **500000** is still returned when in use until migrated to 3100.
 */
export async function resolvePrimaryCapitalAccount(tenantId, db = prisma) {
  if (!tenantId) return null;

  const [a3100, a500] = await Promise.all([
    db.account.findFirst({
      where: { tenantId, isActive: true, accountCode: '3100' },
    }),
    db.account.findFirst({
      where: { tenantId, isActive: true, accountCode: '500000' },
    }),
  ]);

  if (a3100) return a3100;
  if (a500 && (await isCapital500000InUse(tenantId, a500, db))) {
    return a500;
  }
  if (a500) return a500;

  return db.account.findFirst({
    where: legacyCapitalWhere(tenantId),
  });
}

/** Ledger balance for transfers / UI "available" (primary capital account row). */
export async function getCapitalLedgerBalanceForTransfers(tenantId, db = prisma) {
  const primary = await resolvePrimaryCapitalAccount(tenantId, db);
  if (!primary) return 0;
  return Number(primary.balance) || 0;
}
