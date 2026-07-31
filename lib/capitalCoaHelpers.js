import prisma from '@/lib/prisma';
import { ensureChartOfAccountsForTenant } from './chartOfAccountsInitialization.js';
import { isInventoryLedgerAccount } from './journalManualLineValidation.js';

import { OPENING_BALANCE_EQUITY_CODE } from '@/lib/coaMoney.js';

/** Owner's Capital — primary pool; contribution detail posts to 3101–3199 children (3190 reserved). */
export const OWNERS_CAPITAL_GL_CODE = '3100';

/** Codes reserved for system use — never allocate as capital contribution subs. */
export const RESERVED_CAPITAL_SUB_CODES = new Set([OPENING_BALANCE_EQUITY_CODE]);
export const OWNERS_CAPITAL_GL_NAME = "Owner's Capital";
export const EQUITY_GROUP_GL_CODE = '3000';

const PARENT_CODE = OWNERS_CAPITAL_GL_CODE;

function isCoaAssetAccount(account) {
  if (!account) return false;
  const t = (account.accountType || account.type || '').toUpperCase();
  return t === 'ASSET' || t === 'ASSETS';
}

/**
 * Resolve cash/bank GL for a capital contribution debit.
 * Accepts PaymentAccount id (from /payments) or CoA Account id; falls back to **1110**.
 */
export async function resolveContributionCashDebitAccount(tenantId, cashAccountId, db = prisma) {
  if (cashAccountId) {
    const paymentAccount = await db.paymentAccount.findFirst({
      where: { id: cashAccountId, tenantId, isActive: true },
      select: { coaAccountId: true, name: true },
    });
    if (paymentAccount?.coaAccountId) {
      const coa = await db.account.findFirst({
        where: { id: paymentAccount.coaAccountId, tenantId, isActive: true },
      });
      if (coa && isCoaAssetAccount(coa) && !isInventoryLedgerAccount(coa)) {
        return coa;
      }
    }

    const byCoaId = await db.account.findFirst({
      where: { id: cashAccountId, tenantId, isActive: true },
    });
    if (byCoaId && isCoaAssetAccount(byCoaId) && !isInventoryLedgerAccount(byCoaId)) {
      return byCoaId;
    }
  }

  const { resolveOperatingCashGlAccount } = await import('./paymentAccountCoaLink.js');
  const cash = await resolveOperatingCashGlAccount(tenantId, db);
  if (cash && isCoaAssetAccount(cash) && !isInventoryLedgerAccount(cash)) {
    return cash;
  }

  return db.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      accountCode: '1110',
      mergedIntoAccountId: null,
    },
  });
}

/**
 * Ensure **3100 Owner's Capital** exists under **3000 Equity** (chart bootstrap or create).
 * @returns {Promise<import('@prisma/client').Account>}
 */
export async function resolveOrEnsureOwnersCapitalGlAccount(tenantId, db = prisma) {
  const find3100 = () =>
    db.account.findFirst({
      where: {
        tenantId,
        accountCode: PARENT_CODE,
        isActive: true,
        mergedIntoAccountId: null,
      },
    });

  let parent = await find3100();
  if (parent) return parent;

  try {
    await ensureChartOfAccountsForTenant(tenantId, db, { preferSystemCoaDefinition: true });
  } catch (_) {
    /* non-fatal */
  }

  parent = await find3100();
  if (parent) return parent;

  let parent3000 = await db.account.findFirst({
    where: { tenantId, accountCode: EQUITY_GROUP_GL_CODE, isActive: true },
    select: { id: true },
  });
  if (!parent3000) {
    try {
      await ensureChartOfAccountsForTenant(tenantId, db, { preferSystemCoaDefinition: true });
    } catch (_) {}
    parent3000 = await db.account.findFirst({
      where: { tenantId, accountCode: EQUITY_GROUP_GL_CODE, isActive: true },
      select: { id: true },
    });
  }

  try {
    return await db.account.create({
      data: {
        tenantId,
        accountCode: PARENT_CODE,
        code: PARENT_CODE,
        accountName: OWNERS_CAPITAL_GL_NAME,
        name: OWNERS_CAPITAL_GL_NAME,
        accountType: 'Equity',
        type: 'Equity',
        accountSubtype: 'Equity',
        normalBalance: 'Credit',
        parentAccountId: parent3000?.id ?? null,
        isActive: true,
        isSystem: true,
        acceptsNewTransactions: false,
        balance: 0,
        description: 'Owner capital pool — contributions post to sub-accounts 3101–3199.',
      },
    });
  } catch (e) {
    if (e.code === 'P2002') {
      const again = await find3100();
      if (again) return again;
    }
    throw e;
  }
}

/**
 * Owner's Capital (3100) — parent row for contribution sub-accounts (3101–3199).
 */
export async function ensureCapitalParentAccount(tenantId, db = prisma) {
  return resolveOrEnsureOwnersCapitalGlAccount(tenantId, db);
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
  let nextNum = max + 1;
  while (RESERVED_CAPITAL_SUB_CODES.has(String(nextNum)) && nextNum < 3200) {
    nextNum += 1;
  }
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

/**
 * Fresh-books V2: Account.balance is not financial SoT — parent rollup writes are disabled.
 * Callers may still invoke this after capital movements; it is intentionally a no-op.
 */
export async function syncCapitalParentRollupBalance(_tenantId, _parentAccountId, _db = prisma) {
  return null;
}
