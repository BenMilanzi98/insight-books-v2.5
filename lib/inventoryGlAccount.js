import prisma from './prisma';
import { ensureChartOfAccountsForTenant } from './chartOfAccountsInitialization.js';

/**
 * Never treat Accounts Receivable (1200) or receivable-named accounts as inventory.
 */
export function isClearlyNotInventory(account) {
  if (!account) return true;
  const code = String(account.accountCode ?? account.code ?? '').trim();
  if (code === '1200') return true;
  const name = String(account.accountName ?? account.name ?? '').toLowerCase();
  if (name.includes('receivable') && !name.includes('inventory') && !name.includes('stock')) {
    return true;
  }
  // Mis-tagged: code 1300 must not be used as AR
  if (code === '1300' && name.includes('receivable') && !name.includes('inventory') && !name.includes('stock')) {
    return true;
  }
  return false;
}

function isUsableInventoryGl(account) {
  return account && !isClearlyNotInventory(account);
}

/**
 * Resolve the GL account used for inventory (stock) — purchases, COGS credit, etc.
 * Prefers code 1300, then legacy `code`, then name match (Inventory / Stock), excluding AR.
 */
export async function resolveInventoryGlAccount(tenantId, tx = prisma) {
  const base = { tenantId, isActive: true, accountType: 'Asset' };
  const excludeAr = {
    NOT: {
      OR: [
        { accountCode: '1200' },
        { code: '1200' },
        { accountName: { contains: 'Receivable', mode: 'insensitive' } },
      ],
    },
  };

  const pickPreferred = (rows) => {
    if (!rows?.length) return null;
    const usable = rows.filter(isUsableInventoryGl);
    if (!usable.length) return null;
    const withParent = usable.find((r) => r.parentAccountId);
    return withParent || usable[0];
  };

  let acc = pickPreferred(
    await tx.account.findMany({
      where: { ...base, accountCode: '1300', ...excludeAr },
      orderBy: { updatedAt: 'desc' },
      take: 25,
    }),
  );

  if (!acc) {
    acc = pickPreferred(
      await tx.account.findMany({
        where: { ...base, code: '1300', ...excludeAr },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      }),
    );
  }
  if (!acc) {
    acc = await tx.account.findFirst({
      where: {
        ...base,
        ...excludeAr,
        OR: [
          { accountName: { contains: 'Inventory', mode: 'insensitive' } },
          { accountName: { contains: 'Stock', mode: 'insensitive' } },
        ],
      },
    });
    if (!isUsableInventoryGl(acc)) acc = null;
  }

  return acc;
}

/**
 * Resolve inventory GL or create standard 1300 – Inventory (Asset) when missing.
 */
export async function resolveOrEnsureInventoryGlAccount(tenantId, tx = prisma) {
  let resolved = await resolveInventoryGlAccount(tenantId, tx);
  if (resolved) {
    await attachInventoryUnderCurrentAssetsIfMissing(tenantId, resolved, tx);
    return resolved;
  }

  try {
    await ensureChartOfAccountsForTenant(tenantId, tx, { preferSystemCoaDefinition: true });
  } catch (_) {
    /* non-fatal */
  }

  resolved = await resolveInventoryGlAccount(tenantId, tx);
  if (resolved) {
    await attachInventoryUnderCurrentAssetsIfMissing(tenantId, resolved, tx);
    return resolved;
  }

  const parent1100 = await tx.account.findFirst({
    where: { tenantId, accountCode: '1100', accountType: 'Asset', isActive: true },
    select: { id: true },
  });

  try {
    return await tx.account.create({
      data: {
        tenantId,
        accountCode: '1300',
        accountName: 'Inventory',
        accountType: 'Asset',
        accountSubtype: 'Current Asset',
        normalBalance: 'Debit',
        isActive: true,
        balance: 0,
        parentAccountId: parent1100?.id ?? null,
      },
    });
  } catch (e) {
    if (e.code === 'P2002') {
      const again = await tx.account.findFirst({
        where: { tenantId, accountCode: '1300', accountType: 'Asset', isActive: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (isUsableInventoryGl(again)) return again;
    }
    throw e;
  }
}

/**
 * Orphan 1300 rows (no parent) break rollups; attach under 1100 Current Assets when safe.
 * @param {import('@prisma/client').PrismaClient} tx
 */
async function attachInventoryUnderCurrentAssetsIfMissing(tenantId, account, tx) {
  if (!account?.id || account.parentAccountId) return;
  const parent1100 = await tx.account.findFirst({
    where: { tenantId, accountCode: '1100', accountType: 'Asset', isActive: true },
    select: { id: true },
  });
  if (!parent1100) return;
  await tx.account
    .update({
      where: { id: account.id },
      data: { parentAccountId: parent1100.id },
    })
    .catch(() => {});
}
