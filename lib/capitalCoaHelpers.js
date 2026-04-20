import prisma from '@/lib/prisma';

const PARENT_CODE = '3100';

/**
 * Owner's Capital (3100) per chart of accounts structure — parent row for contribution sub-accounts (3101–3199).
 */
export async function ensureCapitalParentAccount(tenantId, db = prisma) {
  const parent = await db.account.findFirst({
    where: { tenantId, accountCode: PARENT_CODE, isActive: true },
  });
  if (parent) return parent;

  throw new Error(
    `Chart of accounts is missing Owner's Capital (${PARENT_CODE}). Run chart bootstrap / Sync CoA before using capital contributions.`
  );
}

/**
 * Next unique 4-digit equity sub-account under 3100 (3101 … 3199).
 */
export async function allocateContributionAccountCode(tenantId, parentAccountId, db = prisma) {
  const siblings = await db.account.findMany({
    where: { tenantId, parentAccountId },
    select: { accountCode: true },
  });
  let max = 3100;
  for (const s of siblings) {
    const c = String(s.accountCode || '').trim();
    if (!/^\d{4}$/.test(c)) continue;
    const n = parseInt(c, 10);
    if (n > max && n < 3200) max = n;
  }
  const nextNum = max + 1;
  if (nextNum >= 3200) {
    const fallback = `C${Date.now().toString(36).toUpperCase()}`;
    return { accountCode: fallback, accountNameSuffix: fallback };
  }
  const nextCode = String(nextNum);
  const clash = await db.account.findFirst({
    where: { tenantId, accountCode: nextCode },
    select: { id: true },
  });
  if (clash) {
    const fallback = `C${Date.now().toString(36).toUpperCase()}`;
    return { accountCode: fallback, accountNameSuffix: fallback };
  }
  return { accountCode: nextCode, accountNameSuffix: nextCode };
}

export async function createContributionSubAccount(tenantId, parentAccount, db, label) {
  const { accountCode, accountNameSuffix } = await allocateContributionAccountCode(
    tenantId,
    parentAccount.id,
    db
  );
  const safeLabel = (label || 'Contribution').slice(0, 80);
  return db.account.create({
    data: {
      tenantId,
      accountCode,
      code: accountCode,
      accountName: `Capital contribution — ${safeLabel} (${accountNameSuffix})`,
      name: `Capital contribution — ${safeLabel} (${accountNameSuffix})`,
      accountType: 'Equity',
      type: 'Equity',
      normalBalance: 'Credit',
      accountSubtype: 'Capital',
      parentAccountId: parentAccount.id,
      description: `Sub-account under Owner's Capital (${PARENT_CODE}) for a single capital contribution.`,
      balance: 0,
      isActive: true,
      isSystem: false,
    },
  });
}

export async function listCapitalContributionAccountIds(tenantId, db = prisma) {
  const parent = await db.account.findFirst({
    where: { tenantId, accountCode: PARENT_CODE, isActive: true },
    select: { id: true },
  });
  if (!parent) return null;
  const children = await db.account.findMany({
    where: { tenantId, parentAccountId: parent.id },
    select: { id: true },
  });
  return [parent.id, ...children.map((c) => c.id)];
}
