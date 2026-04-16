import prisma from '@/lib/prisma';

const PARENT_CODE = '500000';

/**
 * Ensure Equity parent account 500000 exists (child of 3100 Owner's Capital when present, else 3000).
 */
export async function ensureCapitalParentAccount(tenantId, db = prisma) {
  let parent = await db.account.findFirst({
    where: { tenantId, accountCode: PARENT_CODE },
  });
  if (parent) return parent;

  const ownersCapital = await db.account.findFirst({
    where: { tenantId, accountCode: '3100' },
    select: { id: true },
  });
  const equityGroup = await db.account.findFirst({
    where: { tenantId, accountCode: '3000' },
    select: { id: true },
  });
  const parentEquityId = ownersCapital?.id ?? equityGroup?.id ?? null;

  parent = await db.account.create({
    data: {
      tenantId,
      accountCode: PARENT_CODE,
      code: PARENT_CODE,
      accountName: 'Capital Account',
      name: 'Capital Account',
      accountType: 'Equity',
      type: 'Equity',
      normalBalance: 'Credit',
      accountSubtype: 'Capital',
      description: 'Parent for owner contributions. Each contribution is posted to a sub-account.',
      parentAccountId: parentEquityId,
      balance: 0,
      isActive: true,
      isSystem: true,
    },
  });
  return parent;
}

/**
 * Next unique sub-account code under 500000 (500001 …).
 */
export async function allocateContributionAccountCode(tenantId, parentAccountId, db = prisma) {
  const siblings = await db.account.findMany({
    where: { tenantId, parentAccountId },
    select: { accountCode: true },
  });
  let max = 500000;
  for (const s of siblings) {
    const raw = String(s.accountCode || '').replace(/\D/g, '');
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  const nextNum = Math.min(max + 1, 599999);
  const nextCode = String(nextNum).padStart(6, '0');
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
      description: `Sub-account under ${PARENT_CODE} for a single capital contribution.`,
      balance: 0,
      isActive: true,
      isSystem: false,
    },
  });
}

export async function listCapitalContributionAccountIds(tenantId, db = prisma) {
  const parent = await db.account.findFirst({
    where: { tenantId, accountCode: PARENT_CODE },
    select: { id: true },
  });
  if (!parent) return null;
  const children = await db.account.findMany({
    where: { tenantId, parentAccountId: parent.id },
    select: { id: true },
  });
  return [parent.id, ...children.map((c) => c.id)];
}
