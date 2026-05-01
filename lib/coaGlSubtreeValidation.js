/**
 * Validate GL accounts sit under canonical CoA roots 1500 (fixed assets) or 2000 (liabilities),
 * and build picker lists for asset/liability registers.
 */
import { normAccountCode } from '@/lib/coaSystemStructureTree.js';

export const GL_SUBTREE_ROOT_ASSETS = '1500';
export const GL_SUBTREE_ROOT_LIABILITIES = '2000';

/** @param {string|null|undefined} code */
export function primaryNumericCode(code) {
  const base = normAccountCode(code).split('-')[0];
  const m = base.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : NaN;
}

/**
 * When tenant has no Account row for the canonical root code, allow pickers/validation by numeric range + type.
 * @param {string} rootCodeNorm — `1500` or `2000`
 * @param {string|null|undefined} accountCode
 * @param {string|null|undefined} accountTypeRaw
 */
export function matchesFallbackSubtree(rootCodeNorm, accountCode, accountTypeRaw) {
  const n = primaryNumericCode(accountCode);
  const t = String(accountTypeRaw || '')
    .trim()
    .toLowerCase();
  if (rootCodeNorm === GL_SUBTREE_ROOT_ASSETS) {
    return t === 'asset' && Number.isFinite(n) && n >= 1500 && n <= 1599;
  }
  if (rootCodeNorm === GL_SUBTREE_ROOT_LIABILITIES) {
    return t === 'liability' && Number.isFinite(n) && n >= 2000 && n <= 2999;
  }
  return false;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {string} accountId
 * @param {'1500'|'2000'} rootParam
 */
export async function assertAccountInSubtree(prisma, tenantId, accountId, rootParam) {
  const rootNorm = normAccountCode(rootParam);
  if (rootNorm !== GL_SUBTREE_ROOT_ASSETS && rootNorm !== GL_SUBTREE_ROOT_LIABILITIES) {
    const err = new Error('Invalid GL subtree root');
    err.code = 'INVALID_GL_SUBTREE_ROOT';
    throw err;
  }
  if (!accountId) {
    const err = new Error('GL account is required');
    err.code = 'GL_ACCOUNT_REQUIRED';
    throw err;
  }

  const acc = await prisma.account.findFirst({
    where: { id: accountId, tenantId },
    select: {
      id: true,
      accountCode: true,
      accountType: true,
      parentAccountId: true,
    },
  });
  if (!acc) {
    const err = new Error('GL account not found for this business');
    err.code = 'GL_ACCOUNT_NOT_FOUND';
    throw err;
  }

  const root = await prisma.account.findFirst({
    where: { tenantId, accountCode: rootNorm },
    select: { id: true },
  });

  if (root) {
    let curId = acc.id;
    const seen = new Set();
    while (curId && !seen.has(curId)) {
      seen.add(curId);
      if (curId === root.id) {
        return acc;
      }
      const row = await prisma.account.findFirst({
        where: { id: curId, tenantId },
        select: { parentAccountId: true },
      });
      curId = row?.parentAccountId || null;
    }
    const err = new Error(`GL account must fall under chart root ${rootNorm} (Fixed Assets or Liabilities)`);
    err.code = 'GL_ACCOUNT_OUTSIDE_SUBTREE';
    throw err;
  }

  if (!matchesFallbackSubtree(rootNorm, acc.accountCode, acc.accountType)) {
    const err = new Error(
      `GL account must be a ${rootNorm === GL_SUBTREE_ROOT_ASSETS ? 'fixed-asset' : 'liability'} code in the allowed range for root ${rootNorm}`
    );
    err.code = 'GL_ACCOUNT_OUTSIDE_SUBTREE';
    throw err;
  }
  return acc;
}

/**
 * Flat subtree for `<select>` / grouped options (active, chart-visible, non-merge rows).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {'1500'|'2000'} rootParam
 * @returns {Promise<Array<{ id: string, accountCode: string, accountName: string, parentAccountId: string|null, depth: number }>>}
 */
export async function fetchGlSubtreePickerList(prisma, tenantId, rootParam) {
  const rootNorm = normAccountCode(rootParam);
  if (rootNorm !== GL_SUBTREE_ROOT_ASSETS && rootNorm !== GL_SUBTREE_ROOT_LIABILITIES) {
    const err = new Error('Invalid GL subtree root');
    err.code = 'INVALID_GL_SUBTREE_ROOT';
    throw err;
  }

  const baseWhere = {
    tenantId,
    isActive: true,
    visibleInChart: true,
    mergedIntoAccountId: null,
  };

  const all = await prisma.account.findMany({
    where: baseWhere,
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      parentAccountId: true,
      accountType: true,
    },
    orderBy: { accountCode: 'asc' },
  });

  const byId = new Map(all.map((a) => [a.id, a]));
  const root = all.find((a) => normAccountCode(a.accountCode) === rootNorm) || null;

  if (root) {
    const childrenByParent = new Map();
    for (const a of all) {
      if (!a.parentAccountId) continue;
      if (!childrenByParent.has(a.parentAccountId)) {
        childrenByParent.set(a.parentAccountId, []);
      }
      childrenByParent.get(a.parentAccountId).push(a.id);
    }
    /** @type {Array<{ id: string, accountCode: string, accountName: string, parentAccountId: string|null, depth: number }>} */
    const out = [];
    const queue = [{ id: root.id, depth: 0 }];
    const seen = new Set();
    while (queue.length) {
      const { id, depth } = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      const row = byId.get(id);
      if (!row) continue;
      out.push({
        id: row.id,
        accountCode: normAccountCode(row.accountCode),
        accountName: row.accountName || '',
        parentAccountId: row.parentAccountId,
        depth,
      });
      for (const cid of childrenByParent.get(id) || []) {
        if (!seen.has(cid)) {
          queue.push({ id: cid, depth: depth + 1 });
        }
      }
    }
    out.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    return out;
  }

  const fallback = all.filter((a) => matchesFallbackSubtree(rootNorm, a.accountCode, a.accountType));
  return fallback.map((row) => ({
    id: row.id,
    accountCode: normAccountCode(row.accountCode),
    accountName: row.accountName || '',
    parentAccountId: row.parentAccountId,
    depth: 0,
  }));
}
