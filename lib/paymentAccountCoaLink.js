/**
 * Links PaymentAccount (POS / payment methods) to Chart of Accounts asset accounts.
 * - **Cash** (default system cash) → GL **1110** (Cash - Main Account).
 * - Extra **Cash** registers → **1111–1119** under 1110.
 * - **Bank**, **Mobile Money**, **Wallet**, **POS Terminal** → **1130-xx** under the **1130**
 *   “Bank & Mobile Money - Primary” group (canonical blueprint), not legacy 1140–1170 mains.
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
  if (paymentAccount.coaAccountId) {
    const linked = await tx.account.findFirst({
      where: {
        id: paymentAccount.coaAccountId,
        tenantId,
        isActive: true,
        mergedIntoAccountId: null,
      },
      select: { id: true },
    });
    if (linked) return paymentAccount;
  }

  await ensurePaymentTypeMainGlAccounts(tenantId, tx);

  const strategy = strategyForPaymentAccountType(paymentAccount.accountType);
  if (!strategy) {
    return paymentAccount;
  }

  const main1110 = await findAccountByTenantCode(tenantId, String(CASH_MAIN_CODE), tx);
  const group1130 = await findAccountByTenantCode(tenantId, BANK_GROUP_CODE, tx);

  const isDefaultSystemCash =
    paymentAccount.isSystem === true &&
    paymentAccount.name === 'Cash' &&
    (paymentAccount.accountType || '').trim() === 'Cash';

  if (strategy === 'cash_main' && isDefaultSystemCash && main1110?.id) {
    return tx.paymentAccount.update({
      where: { id: paymentAccount.id },
      data: { coaAccountId: main1110.id },
    });
  }

  if (strategy === 'cash_main' && main1110?.id) {
    const child = await createNextCashChildGlAccount(tenantId, main1110.id, paymentAccount.name, tx);
    if (!child) {
      throw new PaymentGlSlotsExhaustedError(
        `The maximum number of extra Cash payment accounts (${CASH_CHILD_SLOT_COUNT}) has been reached (codes ${CASH_MAIN_CODE + 1}–${CASH_MAIN_CODE + CASH_CHILD_SLOT_COUNT}). Remove or merge an account before adding another.`,
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
