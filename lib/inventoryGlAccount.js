import prisma from './prisma';
import { ensureChartOfAccountsForTenant } from './chartOfAccountsInitialization.js';

/** When false (default), missing inventory GL rows are not auto-created at runtime. */
const ALLOW_COA_AUTO_CREATE = process.env.ALLOW_COA_AUTO_CREATE === 'true';

/** Canonical GL for physical stock valuation (Stock Management + chart overlay). */
export const STOCK_ON_HAND_GL_CODE = '1310';
export const STOCK_ON_HAND_GL_NAME = 'Stock on Hand';
export const INVENTORY_GROUP_GL_CODE = '1300';

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

  if (!ALLOW_COA_AUTO_CREATE) {
    throw new Error(
      'Inventory stock account (1310) not found under Inventory 1300. ' +
        'Configure Chart of Accounts. Runtime auto-create is disabled ' +
        '(set ALLOW_COA_AUTO_CREATE=true to override; not recommended in production).'
    );
  }

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
 * Resolve the GL account used for inventory (stock) — returns **1310** when present.
 */
export async function resolveInventoryGlAccount(tenantId, tx = prisma) {
  const stock1310 = await tx.account.findFirst({
    where: {
      tenantId,
      accountCode: STOCK_ON_HAND_GL_CODE,
      isActive: true,
      mergedIntoAccountId: null,
    },
  });
  if (stock1310 && !isClearlyNotInventory(stock1310)) return stock1310;

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
 * @deprecated Prefer {@link resolveOrEnsureStockOnHandGlAccount} — all stock postings use **1310**.
 */
export async function resolveOrEnsureInventoryGlAccount(tenantId, tx = prisma) {
  return resolveOrEnsureStockOnHandGlAccount(tenantId, tx);
}

/**
 * Ensure **1300 Inventory** exists under Current Assets and return the row.
 * @returns {Promise<import('@prisma/client').Account|null>}
 */
async function ensureInventory1300Parent(tenantId, tx) {
  let parent1300 = await tx.account.findFirst({
    where: {
      tenantId,
      accountCode: INVENTORY_GROUP_GL_CODE,
      isActive: true,
      mergedIntoAccountId: null,
    },
  });
  if (parent1300 && isUsableInventoryGl(parent1300)) {
    await attachInventoryUnderCurrentAssetsIfMissing(tenantId, parent1300, tx);
    return parent1300;
  }

  try {
    await ensureChartOfAccountsForTenant(tenantId, tx, { preferSystemCoaDefinition: true });
  } catch (_) {
    /* non-fatal */
  }

  parent1300 = await tx.account.findFirst({
    where: {
      tenantId,
      accountCode: INVENTORY_GROUP_GL_CODE,
      isActive: true,
      mergedIntoAccountId: null,
    },
  });
  if (parent1300 && isUsableInventoryGl(parent1300)) {
    await attachInventoryUnderCurrentAssetsIfMissing(tenantId, parent1300, tx);
    return parent1300;
  }

  const parent1100 = await tx.account.findFirst({
    where: { tenantId, accountCode: '1100', accountType: 'Asset', isActive: true },
    select: { id: true },
  });

  if (!ALLOW_COA_AUTO_CREATE) {
    return null;
  }

  try {
    const created = await tx.account.create({
      data: {
        tenantId,
        accountCode: INVENTORY_GROUP_GL_CODE,
        code: INVENTORY_GROUP_GL_CODE,
        accountName: 'Inventory',
        name: 'Inventory',
        accountType: 'Asset',
        accountSubtype: 'Group',
        normalBalance: 'Debit',
        isActive: true,
        isSystem: true,
        acceptsNewTransactions: false,
        balance: 0,
        parentAccountId: parent1100?.id ?? null,
      },
    });
    return created;
  } catch (e) {
    if (e.code === 'P2002') {
      return tx.account.findFirst({
        where: { tenantId, accountCode: INVENTORY_GROUP_GL_CODE, isActive: true },
        orderBy: { updatedAt: 'desc' },
      });
    }
    throw e;
  }
}

/**
 * Resolve or create **1310 Stock on Hand** under **1300 Inventory** for stock valuation and GL postings.
 * @returns {Promise<import('@prisma/client').Account>}
 */
export async function resolveOrEnsureStockOnHandGlAccount(tenantId, tx = prisma) {
  const find1310 = () =>
    tx.account.findFirst({
      where: {
        tenantId,
        accountCode: STOCK_ON_HAND_GL_CODE,
        isActive: true,
        mergedIntoAccountId: null,
      },
    });

  let stock1310 = await find1310();
  if (stock1310 && !isClearlyNotInventory(stock1310)) {
    const parent1300 = await ensureInventory1300Parent(tenantId, tx);
    if (parent1300?.id && stock1310.parentAccountId !== parent1300.id) {
      stock1310 = await tx.account.update({
        where: { id: stock1310.id },
        data: {
          parentAccountId: parent1300.id,
          accountName: STOCK_ON_HAND_GL_NAME,
          name: STOCK_ON_HAND_GL_NAME,
          accountSubtype: 'Current Asset',
          acceptsNewTransactions: true,
        },
      });
    }
    return stock1310;
  }

  try {
    await ensureChartOfAccountsForTenant(tenantId, tx, { preferSystemCoaDefinition: true });
  } catch (_) {
    /* non-fatal */
  }

  stock1310 = await find1310();
  if (stock1310 && !isClearlyNotInventory(stock1310)) {
    const parent1300 = await ensureInventory1300Parent(tenantId, tx);
    if (parent1300?.id && stock1310.parentAccountId !== parent1300.id) {
      stock1310 = await tx.account.update({
        where: { id: stock1310.id },
        data: { parentAccountId: parent1300.id, acceptsNewTransactions: true },
      });
    }
    return stock1310;
  }

  const parent1300 = await ensureInventory1300Parent(tenantId, tx);
  if (!parent1300?.id) {
    throw new Error('Could not resolve Inventory (1300) parent for Stock on Hand (1310).');
  }

  try {
    return await tx.account.create({
      data: {
        tenantId,
        parentAccountId: parent1300.id,
        accountCode: STOCK_ON_HAND_GL_CODE,
        code: STOCK_ON_HAND_GL_CODE,
        accountName: STOCK_ON_HAND_GL_NAME,
        name: STOCK_ON_HAND_GL_NAME,
        accountType: 'Asset',
        accountSubtype: 'Current Asset',
        normalBalance: 'Debit',
        isActive: true,
        isSystem: true,
        balance: 0,
        acceptsNewTransactions: true,
      },
    });
  } catch (e) {
    if (e.code === 'P2002') {
      const again = await find1310();
      if (again && !isClearlyNotInventory(again)) return again;
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
