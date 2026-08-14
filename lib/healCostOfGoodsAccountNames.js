/**
 * Heal legacy Cost of Sales / Purchases display names → Cost of Goods.
 * Safe: only renames known system codes when the name still matches old defaults.
 */

const HEALS = Object.freeze([
  {
    codes: ['5100'],
    toName: 'Cost of Goods',
    match: /^(cost of sales)$/i,
  },
  {
    codes: ['5110'],
    toName: 'Cost of Goods Sold',
    match: /^(purchases|cost of sales|cost of goods sold)$/i,
  },
]);

/**
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} db
 * @returns {Promise<{ updated: number }>}
 */
export async function healCostOfGoodsAccountNames(tenantId, db) {
  if (!tenantId || !db?.account?.findMany) return { updated: 0 };
  let updated = 0;
  for (const heal of HEALS) {
    const rows = await db.account.findMany({
      where: {
        tenantId,
        accountCode: { in: heal.codes },
      },
      select: { id: true, accountName: true, name: true },
    });
    for (const row of rows) {
      const current = String(row.accountName || row.name || '').trim();
      if (!heal.match.test(current)) continue;
      if (current === heal.toName) continue;
      await db.account.update({
        where: { id: row.id },
        data: {
          accountName: heal.toName,
          name: heal.toName,
        },
      });
      updated += 1;
    }
  }
  return { updated };
}
