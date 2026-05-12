/**
 * Links PaymentAccount (POS / payment methods) to Chart of Accounts **posting-leaf** asset accounts only.
 * - **Structural parents** (**1000**, **1100**, **1110** “cash main bucket”, bare **1130** bank group): used for rollup in the chart;
 *   GL postings from sales/expenses/POS must hit **leaf** rows so balances break down correctly.
 * - **Cash** → **1111–1119** children under **1110** (first free slot); includes system “Cash” — never writes to **1110** itself via `coaAccountId`.
 * - **Bank**, **Mobile Money**, **Wallet**, **POS Terminal** → **1130-01 … 1130-99** under **1130** (never bare **1130**).
 */
import prisma from '@/lib/prisma';

const CASH_MAIN_CODE = 1110;
const BANK_GROUP_CODE = '1130';
const CASH_CHILD_SLOT_COUNT = 9;
const MAX_BANK_CHILD_SUFFIX = 99;

/** Payment modal types → strategy: 'cash_main' | 'cash_child' | 'bank_tree' */
const PAYMENT_TYPE_LINK_STRATEGY = {
  Cash: 'cash_main',
  Bank: 'bank_tree',
  'Mobile Money': 'bank_tree',
  Wallet: 'bank_tree',
  'POS Terminal': 'bank_tree',
};

export const PAYMENT_ACCOUNT_TYPE_MAIN_CODE = {
  Cash: CASH_MAIN_CODE,
  Bank: BANK_GROUP_CODE,
  'Mobile Money': BANK_GROUP_CODE,
  Wallet: BANK_GROUP_CODE,
  'POS Terminal': BANK_GROUP_CODE,
};

export const ALLOWED_PAYMENT_ACCOUNT_TYPES = Object.keys(PAYMENT_TYPE_LINK_STRATEGY);

export class PaymentGlSlotsExhaustedError extends Error {
  constructor(message, accountType) {
    super(message);
    this.name = 'PaymentGlSlotsExhaustedError';
    this.accountType = accountType;
    this.code = 'PAYMENT_GL_SLOTS_EXHAUSTED';
  }
}

function strategyForPaymentAccountType(accountType) {
  const key = (accountType || '').trim();
  return PAYMENT_TYPE_LINK_STRATEGY[key] ?? null;
}

function normalizedGlCode(account) {
  return String(account?.accountCode ?? account?.code ?? '').trim();
}

/**
 * Legacy tenants may have `coaAccountId` on structural rollup rows (**1110** cash bucket, **1130** bank group).
 * Postings must use leaf accounts (1111+, 1130-xx); this detects those old links for migration.
 * @param {{ accountCode?: string|null; code?: string|null } | null} linkedAccount
 * @param {string|null|undefined} paymentAccountType PaymentAccount.accountType
 */
export function accountIsStructuralPaymentParentForType(linkedAccount, paymentAccountType) {
  if (!linkedAccount) return false;
  const code = normalizedGlCode(linkedAccount);
  const t = String(paymentAccountType || '').trim();
  if (t === 'Cash' && code === String(CASH_MAIN_CODE)) return true;
  if (['Bank', 'Mobile Money', 'Wallet', 'POS Terminal'].includes(t) && code === BANK_GROUP_CODE) {
    return true;
  }
  return false;
}

/**
 * Existing PaymentAccount rows that still point at **1110** / **1130** (rollup parents) instead of leaf GL codes.
 * Run {@link ensurePaymentAccountCoaLink} on each to assign 1111–1119 or 1130-xx.
 * @returns {Promise<Array<{ id: string; tenantId: string; name: string; accountType: string; coaAccountId: string | null }>>}
 */
export async function findPaymentAccountsNeedingLeafCoaMigration(tenantId, tx = prisma) {
  const rows = await tx.paymentAccount.findMany({
    where: { tenantId, isActive: true, coaAccountId: { not: null } },
    select: {
      id: true,
      tenantId: true,
      name: true,
      accountType: true,
      coaAccountId: true,
      isSystem: true,
    },
  });
  const linkedIds = [...new Set(rows.map((r) => r.coaAccountId).filter(Boolean))];
  if (!linkedIds.length) return [];
  const accounts = await tx.account.findMany({
    where: { tenantId, id: { in: linkedIds } },
    select: { id: true, accountCode: true, code: true },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return rows.filter((p) => {
    const acc = byId.get(p.coaAccountId);
    return accountIsStructuralPaymentParentForType(acc, p.accountType);
  });
}

async function findAccountByTenantCode(tenantId, codeStr, tx) {
  return tx.account.findFirst({
    where: {
      tenantId,
      OR: [{ accountCode: codeStr }, { code: codeStr }],
    },
  });
}

/**
 * Parent for payment-type GL mains: **1100 Current Assets** (preferred), else **1000 Assets**.
 * @returns {{ parentId: string|null, via: '1100'|'1000'|null }}
 */
async function resolveAssetHierarchyParentForPaymentMains(tenantId, tx) {
  let cur = await findAccountByTenantCode(tenantId, '1100', tx);
  if (cur?.id) return { parentId: cur.id, via: '1100' };

  cur = await tx.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      accountType: 'Asset',
      OR: [
        { accountName: { equals: 'Current Assets', mode: 'insensitive' } },
        { name: { equals: 'Current Assets', mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
  if (cur?.id) return { parentId: cur.id, via: '1100' };

  const root = await findAccountByTenantCode(tenantId, '1000', tx);
  if (root?.id) return { parentId: root.id, via: '1000' };

  return { parentId: null, via: null };
}

/**
 * Ensure **1130** group and **1110** cash main exist under the asset tree (for tenants missing blueprint rows).
 */
export async function ensurePaymentTypeMainGlAccounts(tenantId, tx = prisma) {
  const { parentId } = await resolveAssetHierarchyParentForPaymentMains(tenantId, tx);
  if (!parentId) return;

  let main1110 = await findAccountByTenantCode(tenantId, String(CASH_MAIN_CODE), tx);
  if (!main1110) {
    main1110 = await tx.account.create({
      data: {
        tenantId,
        code: String(CASH_MAIN_CODE),
        name: 'Cash - Main Account',
        type: 'ASSET',
        accountCode: String(CASH_MAIN_CODE),
        accountName: 'Cash - Main Account',
        accountType: 'Asset',
        accountSubtype: 'Current Asset',
        normalBalance: 'Debit',
        parentAccountId: parentId,
        isActive: true,
        isSystem: true,
        balance: 0,
      },
    });
  } else if (main1110.parentAccountId == null) {
    await tx.account.update({
      where: { id: main1110.id },
      data: { parentAccountId: parentId },
    });
  }

  let group1130 = await findAccountByTenantCode(tenantId, BANK_GROUP_CODE, tx);
  if (!group1130) {
    group1130 = await tx.account.create({
      data: {
        tenantId,
        code: BANK_GROUP_CODE,
        name: 'Bank & Mobile Money - Primary',
        type: 'ASSET',
        accountCode: BANK_GROUP_CODE,
        accountName: 'Bank - Primary',
        accountType: 'Asset',
        accountSubtype: 'Group',
        normalBalance: 'Debit',
        parentAccountId: parentId,
        isActive: true,
        isSystem: true,
        balance: 0,
      },
    });
  } else if (group1130.parentAccountId == null) {
    await tx.account.update({
      where: { id: group1130.id },
      data: { parentAccountId: parentId },
    });
  }
}

/**
 * Next free **1111–1119** under cash main (extra cash registers).
 * @returns {Promise<import('@prisma/client').Account|null>}
 */
async function createNextCashChildGlAccount(tenantId, mainAccountId, accountName, tx) {
  const safeName = (accountName || 'Payment method').trim() || 'Payment method';

  for (let i = 1; i <= CASH_CHILD_SLOT_COUNT; i += 1) {
    const codeStr = String(CASH_MAIN_CODE + i);
    const existing = await findAccountByTenantCode(tenantId, codeStr, tx);
    if (!existing) {
      return tx.account.create({
        data: {
          tenantId,
          code: codeStr,
          name: safeName,
          type: 'ASSET',
          accountCode: codeStr,
          accountName: safeName,
          accountType: 'Asset',
          accountSubtype: 'Current Asset',
          normalBalance: 'Debit',
          parentAccountId: mainAccountId,
          isActive: true,
          balance: 0,
        },
      });
    }
    if (existing.parentAccountId === mainAccountId) {
      continue;
    }
  }
  return null;
}

/**
 * Next free **1130-NN** (01–99) for the tenant (used by payment GL and legacy CoA migration).
 * @returns {Promise<string|null>}
 */
export async function allocateNext1130DashChildCode(tenantId, tx = prisma) {
  const rows = await tx.account.findMany({
    where: {
      tenantId,
      OR: [
        { accountCode: { startsWith: `${BANK_GROUP_CODE}-` } },
        { code: { startsWith: `${BANK_GROUP_CODE}-` } },
      ],
    },
    select: { accountCode: true, code: true },
  });
  let max = 0;
  const bumpFromCodeString = (raw) => {
    if (raw == null) return;
    const m = /^1130-(\d+)$/.exec(String(raw).trim());
    if (!m) return;
    const n = parseInt(m[1], 10);
    if (Number.isNaN(n) || n < 1 || n > MAX_BANK_CHILD_SUFFIX) return;
    max = Math.max(max, n);
  };
  for (const r of rows) {
    bumpFromCodeString(r.accountCode);
    bumpFromCodeString(r.code);
  }
  if (max >= MAX_BANK_CHILD_SUFFIX) return null;
  return `${BANK_GROUP_CODE}-${String(max + 1).padStart(2, '0')}`;
}

/**
 * @returns {Promise<import('@prisma/client').Account|null>}
 */
async function createNextBankTreeChildGlAccount(tenantId, group1130Id, accountName, tx) {
  const safeName = (accountName || 'Payment method').trim() || 'Payment method';
  const codeStr = await allocateNext1130DashChildCode(tenantId, tx);
  if (!codeStr) return null;
  return tx.account.create({
    data: {
      tenantId,
      code: codeStr,
      name: safeName,
      type: 'ASSET',
      accountCode: codeStr,
      accountName: safeName,
      accountType: 'Asset',
      accountSubtype: 'Current Asset',
      normalBalance: 'Debit',
      parentAccountId: group1130Id,
      isActive: true,
      balance: 0,
    },
  });
}

/**
 * @param {string} tenantId
 * @param {{ id: string; name: string; accountType: string; coaAccountId?: string|null; isSystem?: boolean }} paymentAccount
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx]
 */
export async function ensurePaymentAccountCoaLink(tenantId, paymentAccount, tx = prisma) {
  await ensurePaymentTypeMainGlAccounts(tenantId, tx);

  const strategy = strategyForPaymentAccountType(paymentAccount.accountType);
  const main1110 =
    strategy === 'cash_main' ? await findAccountByTenantCode(tenantId, String(CASH_MAIN_CODE), tx) : null;
  const group1130 =
    strategy === 'bank_tree' ? await findAccountByTenantCode(tenantId, BANK_GROUP_CODE, tx) : null;

  if (paymentAccount.coaAccountId) {
    const linked = await tx.account.findFirst({
      where: {
        id: paymentAccount.coaAccountId,
        tenantId,
        isActive: true,
        mergedIntoAccountId: null,
      },
      select: { id: true, accountCode: true, code: true },
    });
    if (linked) {
      if (!strategy) {
        return paymentAccount;
      }
      const code = normalizedGlCode(linked);
      const linkedToCashParent =
        strategy === 'cash_main' &&
        main1110?.id &&
        linked.id === main1110.id &&
        code === String(CASH_MAIN_CODE);
      const linkedToBankParent =
        strategy === 'bank_tree' &&
        group1130?.id &&
        linked.id === group1130.id &&
        code === BANK_GROUP_CODE;

      if (linkedToCashParent) {
        const child = await createNextCashChildGlAccount(tenantId, main1110.id, paymentAccount.name, tx);
        if (child) {
          return tx.paymentAccount.update({
            where: { id: paymentAccount.id },
            data: { coaAccountId: child.id },
          });
        }
        console.warn(
          `[payment GL] Tenant ${tenantId} payment account ${paymentAccount.id}: could not migrate off ${CASH_MAIN_CODE} header (slots full).`
        );
        return paymentAccount;
      }

      if (linkedToBankParent) {
        const child = await createNextBankTreeChildGlAccount(tenantId, group1130.id, paymentAccount.name, tx);
        if (child) {
          return tx.paymentAccount.update({
            where: { id: paymentAccount.id },
            data: { coaAccountId: child.id },
          });
        }
        console.warn(
          `[payment GL] Tenant ${tenantId} payment account ${paymentAccount.id}: could not migrate off ${BANK_GROUP_CODE} group (slots full).`
        );
        return paymentAccount;
      }

      return paymentAccount;
    }
  }

  if (!strategy) {
    return paymentAccount;
  }

  if (strategy === 'cash_main' && main1110?.id) {
    const child = await createNextCashChildGlAccount(tenantId, main1110.id, paymentAccount.name, tx);
    if (!child) {
      throw new PaymentGlSlotsExhaustedError(
        `The maximum number of Cash payment registers (${CASH_CHILD_SLOT_COUNT} slots under ${CASH_MAIN_CODE}: codes ${CASH_MAIN_CODE + 1}–${CASH_MAIN_CODE + CASH_CHILD_SLOT_COUNT}) has been reached. Remove or merge an account before adding another.`,
        paymentAccount.accountType
      );
    }
    return tx.paymentAccount.update({
      where: { id: paymentAccount.id },
      data: { coaAccountId: child.id },
    });
  }

  if (strategy === 'bank_tree' && group1130?.id) {
    const child = await createNextBankTreeChildGlAccount(tenantId, group1130.id, paymentAccount.name, tx);
    if (!child) {
      throw new PaymentGlSlotsExhaustedError(
        `The maximum number of payment accounts under ${BANK_GROUP_CODE} (${MAX_BANK_CHILD_SUFFIX} slots) has been reached. Remove or merge an account before adding another.`,
        paymentAccount.accountType
      );
    }
    return tx.paymentAccount.update({
      where: { id: paymentAccount.id },
      data: { coaAccountId: child.id },
    });
  }

  return paymentAccount;
}

/**
 * GL account used for operating cash (sales/expense/standard "cash" fallbacks).
 * When **1110** has active Asset children (1111–1119 registers), postings must hit the **leaf** so the chart
 * does not show the same outflow on both the rollup line and a register.
 *
 * @returns {Promise<import('@prisma/client').Account | null>}
 */
export async function resolveOperatingCashGlAccount(tenantId, tx = prisma) {
  await ensurePaymentTypeMainGlAccounts(tenantId, tx);
  const main = await findAccountByTenantCode(tenantId, String(CASH_MAIN_CODE), tx);
  if (!main?.id) return null;
  const leaf = await tx.account.findFirst({
    where: {
      tenantId,
      parentAccountId: main.id,
      isActive: true,
      accountType: 'Asset',
    },
    orderBy: { accountCode: 'asc' },
  });
  return leaf || main;
}
