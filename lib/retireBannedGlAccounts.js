/**
 * Retire banned GL codes (e.g. 1120 Petty Cash) by soft-merging into the survivor.
 */

import { RETIRED_GL_CODES } from './coaRetiredAccounts.js';

/**
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 */
export async function retireBannedGlAccountsForTenant(tenantId, db) {
  if (!tenantId || !db) return { retired: [] };

  const retired = [];

  for (const [sourceCode, meta] of Object.entries(RETIRED_GL_CODES)) {
    const source = await db.account.findFirst({
      where: { tenantId, accountCode: sourceCode },
      select: {
        id: true,
        isActive: true,
        mergedIntoAccountId: true,
        accountName: true,
      },
    });
    if (!source) continue;

    let target = await db.account.findFirst({
      where: {
        tenantId,
        accountCode: meta.mergeIntoCode,
        mergedIntoAccountId: null,
      },
      select: { id: true },
    });

    if (!target) {
      // Survivor missing — leave source inactive so it cannot be used for posting.
      if (source.isActive !== false) {
        await db.account.update({
          where: { id: source.id },
          data: {
            isActive: false,
            acceptsNewTransactions: false,
          },
        });
      }
      retired.push({ sourceCode, targetCode: meta.mergeIntoCode, status: 'deactivated-no-target' });
      continue;
    }

    if (source.id === target.id) continue;

    const parent1100 = await db.account.findFirst({
      where: { tenantId, accountCode: '1100' },
      select: { id: true },
    });

    await db.account.updateMany({
      where: { tenantId, parentAccountId: source.id },
      data: { parentAccountId: parent1100?.id ?? target.id },
    });

    if (db.paymentAccount?.updateMany) {
      await db.paymentAccount.updateMany({
        where: { tenantId, coaAccountId: source.id },
        data: { coaAccountId: target.id },
      });
    }

    if (db.coaV2AccountMapping?.updateMany) {
      try {
        await db.coaV2AccountMapping.updateMany({
          where: { tenantId, accountId: source.id },
          data: { accountId: target.id },
        });
      } catch {
        /* mapping table optional on older DBs */
      }
    }

    await db.account.update({
      where: { id: source.id },
      data: {
        isActive: false,
        acceptsNewTransactions: false,
        mergedIntoAccountId: target.id,
        accountName: `${meta.displayName} (retired → ${meta.mergeIntoCode})`,
        name: `${meta.displayName} (retired → ${meta.mergeIntoCode})`,
      },
    });

    retired.push({
      sourceCode,
      targetCode: meta.mergeIntoCode,
      sourceId: source.id,
      targetId: target.id,
      status: 'merged',
    });
  }

  return { retired };
}
