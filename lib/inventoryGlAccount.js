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

/** Candidates under an inventory rollup (e.g. 1300 → 1310). Do not require `accountType: Asset` — legacy rows often omit it. */
const inventoryChildWhere = (tenantId, parentId) => ({
  tenantId,
  parentAccountId: parentId,
  isActive: true,
  mergedIntoAccountId: null,
  NOT: {
    OR: [
      { accountCode: '1200' },
      { code: '1200' },
      { accountName: { contains: 'Receivable', mode: 'insensitive' } },
      { accountSubtype: { equals: 'Group', mode: 'insensitive' } },
    ],
  },
});

/**
 * When 1310–1399 rows already exist but are not usable children of the resolved **1300**, reparent
 * the first suitable account (prefer **1310**) instead of allocating a new code.
 */
async function reuseExistingInventoryDetailAccount(tenantId, parentInventoryId, tx) {
  for (let n = 1310; n <= 1399; n += 1) {
    const codeStr = String(n);
    const existing = await tx.account.findFirst({
      where: {
        tenantId,
        accountCode: codeStr,
        isActive: true,
        mergedIntoAccountId: null,
      },
    });
    if (!existing || isClearlyNotInventory(existing)) continue;
    if (existing.parentAccountId === parentInventoryId) return existing;

    const patch = {
      parentAccountId: parentInventoryId,
      acceptsNewTransactions: true,
    };
    if (!existing.accountType) patch.accountType = 'Asset';
    const subtype = String(existing.accountSubtype || '').trim();
    if (!subtype || subtype.toLowerCase() === 'group') {
      patch.accountSubtype = 'Current Asset';
    }
    if (!existing.normalBalance) patch.normalBalance = 'Debit';

    return tx.account.update({
      where: { id: existing.id },
      data: patch,
    });
  }
  return null;
}

/** Allocate first free **1310**–**1399** code and create Stock on Hand under the inventory parent. */
async function createDefaultInventoryStockAccount(tenantId, parentInventoryId, tx) {
  const reused = await reuseExistingInventoryDetailAccount(tenantId, parentInventoryId, tx);
  if (reused) return reused;

  for (let n = 1310; n <= 1399; n += 1) {
    const codeStr = String(n);
    const taken = await tx.account.findFirst({
      where: { tenantId, accountCode: codeStr },
      select: { id: true },
    });
    if (taken) continue;
    try {
      return await tx.account.create({
        data: {
          tenantId,
          parentAccountId: parentInventoryId,
          accountCode: codeStr,
          accountName: 'Stock on Hand',
          accountType: 'Asset',
          accountSubtype: 'Current Asset',
          normalBalance: 'Debit',
          isActive: true,
          balance: 0,
          acceptsNewTransactions: true,
        },
      });
    } catch (e) {
      if (e.code === 'P2002') continue;
      throw e;
    }
  }
  throw new Error(
    'Could not allocate an inventory detail account (codes 1310–1399) under Inventory 1300. Contact support.',
  );
}

/**
 * Walk from resolved inventory (often **1300**) to a posting leaf. If **1300** has only non-posting
 * children (e.g. subtype Group), create a detail account so consolidation rules allow the posting.
 * @param {import('@prisma/client').Account} start
 * @returns {Promise<import('@prisma/client').Account>}
 */
async function ensureInventoryPostingLeaf(tenantId, start, tx) {
  if (!start?.id) return start;
  let current = start;
  for (let depth = 0; depth < 30; depth += 1) {
    const childCount = await tx.account.count({
      where: inventoryChildWhere(tenantId, current.id),
    });
    if (childCount === 0) break;
    const next = await tx.account.findFirst({
      where: inventoryChildWhere(tenantId, current.id),
      orderBy: [{ accountCode: 'asc' }],
    });
    if (!next || isClearlyNotInventory(next)) break;
    current = next;
  }

  const glCode = String(current.accountCode ?? current.code ?? '').trim();
  const totalActiveChildren = await tx.account.count({
    where: {
      tenantId,
      parentAccountId: current.id,
      isActive: true,
      mergedIntoAccountId: null,
    },
  });
  const usableChildCount = await tx.account.count({
    where: inventoryChildWhere(tenantId, current.id),
  });
  if (totalActiveChildren > 0 && usableChildCount === 0 && glCode === '1300') {
    const reused = await reuseExistingInventoryDetailAccount(tenantId, current.id, tx);
    if (reused) return reused;
    return createDefaultInventoryStockAccount(tenantId, current.id, tx);
  }

  if (glCode === '1300') {
    const reused = await reuseExistingInventoryDetailAccount(tenantId, current.id, tx);
    if (reused) return reused;
  }

  return current;
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

  const pickPreferred = async (rows) => {
    if (!rows?.length) return null;
    const usable = rows.filter(isUsableInventoryGl);
    if (!usable.length) return null;

    const stock1310 = await tx.account.findFirst({
      where: { tenantId, accountCode: '1310', isActive: true, mergedIntoAccountId: null },
      select: { parentAccountId: true },
    });
    if (stock1310?.parentAccountId) {
      const match = usable.find((r) => r.id === stock1310.parentAccountId);
      if (match) return match;
    }

    for (const candidate of usable) {
      const childCount = await tx.account.count({
        where: inventoryChildWhere(tenantId, candidate.id),
      });
      if (childCount > 0) return candidate;
    }

    const withParent = usable.find((r) => r.parentAccountId);
    return withParent || usable[0];
  };

  let acc = await pickPreferred(
    await tx.account.findMany({
      where: { ...base, accountCode: '1300', ...excludeAr },
      orderBy: { updatedAt: 'desc' },
      take: 25,
    }),
  );

  if (!acc) {
    acc = await pickPreferred(
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
    return ensureInventoryPostingLeaf(tenantId, resolved, tx);
  }

  try {
    await ensureChartOfAccountsForTenant(tenantId, tx, { preferSystemCoaDefinition: true });
  } catch (_) {
    /* non-fatal */
  }

  resolved = await resolveInventoryGlAccount(tenantId, tx);
  if (resolved) {
    await attachInventoryUnderCurrentAssetsIfMissing(tenantId, resolved, tx);
    return ensureInventoryPostingLeaf(tenantId, resolved, tx);
  }

  const parent1100 = await tx.account.findFirst({
    where: { tenantId, accountCode: '1100', accountType: 'Asset', isActive: true },
    select: { id: true },
  });

  try {
    const created = await tx.account.create({
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
    return ensureInventoryPostingLeaf(tenantId, created, tx);
  } catch (e) {
    if (e.code === 'P2002') {
      const again = await tx.account.findFirst({
        where: { tenantId, accountCode: '1300', accountType: 'Asset', isActive: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (isUsableInventoryGl(again)) return ensureInventoryPostingLeaf(tenantId, again, tx);
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
