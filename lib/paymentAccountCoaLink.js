/**
 * Links PaymentAccount (POS / payment methods) to Chart of Accounts **posting** asset rows.
 * - **Cash** → **1110 Cash - Main Account** only (single cash ledger).
 * - **Bank / Mobile Money / Wallet / POS Terminal** → child GL under canonical parent (1131–1138, 1140, 1141), e.g. **1131-01**.
 *   Parent rows are rollup-only and never receive direct postings.
 */
import prisma from '@/lib/prisma';
import {
  PAYMENT_GL_PARENT_CODES,
  isPaymentGlChildCode,
  isPaymentGlParentCode,
  resolvePaymentParentGlCode,
  channelMetaForParentCode,
} from '@/lib/paymentGlChannels.js';

/** When false (default), missing cash/bank parent GL rows are not auto-created. */
const ALLOW_COA_AUTO_CREATE = process.env.ALLOW_COA_AUTO_CREATE === 'true';

const CASH_MAIN_CODE = 1110;
const BANK_GROUP_CODE = '1130';
const CASH_CHILD_SLOT_COUNT = 9;
const MAX_PAYMENT_CHILD_SUFFIX = 99;

/** Payment modal types → strategy: 'cash_main' | 'bank_tree' */
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

/** Legacy cash register rows (1111–1119) under 1110 — migrate PaymentAccount links to **1110**. */
export function isLegacyCashRegisterGlCode(code) {
  const n = parseInt(String(code ?? '').trim(), 10);
  return n >= CASH_MAIN_CODE + 1 && n <= CASH_MAIN_CODE + CASH_CHILD_SLOT_COUNT;
}

/**
 * Whether a PaymentAccount's linked GL should be moved to the canonical posting target.
 */
export function accountIsStructuralPaymentParentForType(linkedAccount, paymentAccountType) {
  if (!linkedAccount) return false;
  const code = normalizedGlCode(linkedAccount);
  const t = String(paymentAccountType || '').trim();

  if (t === 'Cash') {
    if (code === String(CASH_MAIN_CODE)) return false;
    return isLegacyCashRegisterGlCode(code);
  }

  if (['Bank', 'Mobile Money', 'Wallet', 'POS Terminal'].includes(t)) {
    if (code === BANK_GROUP_CODE) return true;
    if (isPaymentGlParentCode(code)) return true;
    if (/^1130-\d+$/i.test(code)) return true;
  }

  return false;
}

/**
 * PaymentAccount rows whose `coaAccountId` should be updated to a postable leaf.
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
      reference: true,
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

/** Ensure payment parent GL rows (1131–1141) are rollup-only. */
export async function ensurePaymentGlParentRollupFlags(tenantId, tx = prisma) {
  for (const code of [...PAYMENT_GL_PARENT_CODES, BANK_GROUP_CODE]) {
    const acc = await findAccountByTenantCode(tenantId, code, tx);
    if (!acc?.id) continue;
    await tx.account.update({
      where: { id: acc.id },
      data: {
        acceptsNewTransactions: false,
        accountSubtype: 'Group',
      },
    });
  }
}

export async function ensurePaymentTypeMainGlAccounts(tenantId, tx = prisma) {
  const { parentId } = await resolveAssetHierarchyParentForPaymentMains(tenantId, tx);
  if (!parentId) return;

  let main1110 = await findAccountByTenantCode(tenantId, String(CASH_MAIN_CODE), tx);
  if (!main1110) {
    if (!ALLOW_COA_AUTO_CREATE) {
      /* fail closed — caller must use existing CoA */
    } else {
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
    }
  } else if (main1110.parentAccountId == null) {
    await tx.account.update({
      where: { id: main1110.id },
      data: { parentAccountId: parentId },
    });
  }

  let group1130 = await findAccountByTenantCode(tenantId, BANK_GROUP_CODE, tx);
  if (!group1130) {
    if (ALLOW_COA_AUTO_CREATE) {
      group1130 = await tx.account.create({
        data: {
          tenantId,
          code: BANK_GROUP_CODE,
          name: 'Bank - Primary',
          type: 'ASSET',
          accountCode: BANK_GROUP_CODE,
          accountName: 'Bank - Primary',
          accountType: 'Asset',
          accountSubtype: 'Group',
          normalBalance: 'Debit',
          parentAccountId: parentId,
          isActive: true,
          isSystem: true,
          acceptsNewTransactions: false,
          balance: 0,
        },
      });
    }
  } else if (group1130.parentAccountId == null) {
    await tx.account.update({
      where: { id: group1130.id },
      data: { parentAccountId: parentId, acceptsNewTransactions: false, accountSubtype: 'Group' },
    });
  }

  await ensurePaymentGlParentRollupFlags(tenantId, tx);
}

/**
 * @returns {Promise<string|null>}
 */
export async function allocateNextPaymentChildCode(tenantId, parentCode, tx = prisma) {
  const prefix = `${parentCode}-`;
  const rows = await tx.account.findMany({
    where: {
      tenantId,
      OR: [{ accountCode: { startsWith: prefix } }, { code: { startsWith: prefix } }],
    },
    select: { accountCode: true, code: true },
  });
  let max = 0;
  const re = new RegExp(`^${parentCode}-(\\d+)$`);
  for (const r of rows) {
    for (const raw of [r.accountCode, r.code]) {
      const m = re.exec(String(raw ?? '').trim());
      if (!m) continue;
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n >= 1 && n <= MAX_PAYMENT_CHILD_SUFFIX) {
        max = Math.max(max, n);
      }
    }
  }
  if (max >= MAX_PAYMENT_CHILD_SUFFIX) return null;
  return `${parentCode}-${String(max + 1).padStart(2, '0')}`;
}

function buildChildGlDisplayName(paymentAccount, _childCode) {
  return buildPaymentGlAccountDisplayName(paymentAccount);
}

/**
 * Human-readable GL label for a payment method: "{name} · {account number}".
 * @param {{ name?: string|null; reference?: string|null }} paymentAccount
 */
export function buildPaymentGlAccountDisplayName(paymentAccount) {
  const ref = String(paymentAccount?.reference ?? '').trim();
  const name = String(paymentAccount?.name ?? '').trim() || 'Payment account';
  if (ref) return `${name} · ${ref}`;
  return name;
}

/**
 * Keep linked GL row labels in sync when payment account name/reference changes.
 */
async function syncPaymentChildGlDisplayFromPaymentAccount(paymentAccount, linkedAccountId, tx) {
  const displayName = buildPaymentGlAccountDisplayName(paymentAccount);
  const linked = await tx.account.findFirst({
    where: { id: linkedAccountId },
    select: { accountName: true, name: true },
  });
  if (!linked) return;
  const cur = String(linked.accountName || linked.name || '').trim();
  if (cur === displayName) return;
  await tx.account.update({
    where: { id: linkedAccountId },
    data: {
      name: displayName,
      accountName: displayName,
    },
  });
}

/**
 * Overlay payment account name + reference on GL child rows for chart / picker display.
 * @param {string} tenantId
 * @param {Array<Record<string, unknown>>} accounts
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function enrichChartAccountsWithPaymentAccounts(tenantId, accounts, db = prisma) {
  if (!tenantId || !Array.isArray(accounts) || !accounts.length) return accounts;

  const childGlIds = accounts
    .filter((a) => isPaymentGlChildCode(String(a.accountCode || a.code || '')))
    .map((a) => a.id)
    .filter(Boolean);
  if (!childGlIds.length) return accounts;

  const paymentRows = await db.paymentAccount.findMany({
    where: { tenantId, coaAccountId: { in: childGlIds } },
    select: { id: true, name: true, reference: true, coaAccountId: true },
  });
  if (!paymentRows.length) return accounts;

  const byCoaId = new Map(paymentRows.map((p) => [p.coaAccountId, p]));

  return accounts.map((a) => {
    const pa = byCoaId.get(a.id);
    if (!pa) return a;
    const displayName = buildPaymentGlAccountDisplayName(pa);
    return {
      ...a,
      accountName: displayName,
      name: displayName,
      paymentAccountName: pa.name,
      paymentAccountReference: pa.reference,
    };
  });
}

/**
 * @returns {Promise<import('@prisma/client').Account|null>}
 */
async function createPaymentChildGlAccount(tenantId, parentAccount, paymentAccount, tx) {
  if (!ALLOW_COA_AUTO_CREATE) return null;
  const parentCode = normalizedGlCode(parentAccount);
  const codeStr = await allocateNextPaymentChildCode(tenantId, parentCode, tx);
  if (!codeStr) return null;

  const displayName = buildChildGlDisplayName(paymentAccount, codeStr);
  const channel = channelMetaForParentCode(parentCode);

  return tx.account.create({
    data: {
      tenantId,
      code: codeStr,
      name: displayName,
      type: 'ASSET',
      accountCode: codeStr,
      accountName: displayName,
      accountType: 'Asset',
      accountSubtype: 'Current Asset',
      normalBalance: 'Debit',
      parentAccountId: parentAccount.id,
      isActive: true,
      acceptsNewTransactions: true,
      visibleInChart: true,
      description: channel
        ? `Payment sub-account under ${parentCode} ${channel.name}`
        : `Payment sub-account under ${parentCode}`,
      balance: 0,
    },
  });
}

/**
 * Resolve the rollup parent GL row for a payment account.
 * @returns {Promise<import('@prisma/client').Account|null>}
 */
async function resolvePaymentParentGlAccount(tenantId, paymentAccount, tx) {
  const parentCode = resolvePaymentParentGlCode({
    accountType: paymentAccount.accountType,
    name: paymentAccount.name,
    parentGlCode: paymentAccount.parentGlCode,
  });
  if (!parentCode) return null;
  return findAccountByTenantCode(tenantId, parentCode, tx);
}

/**
 * @param {string} tenantId
 * @param {{ id: string; name: string; accountType: string; reference?: string|null; coaAccountId?: string|null; isSystem?: boolean; parentGlCode?: string|null }} paymentAccount
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx]
 */
export async function ensurePaymentAccountCoaLink(tenantId, paymentAccount, tx = prisma) {
  await ensurePaymentTypeMainGlAccounts(tenantId, tx);

  const strategy = strategyForPaymentAccountType(paymentAccount.accountType);
  const main1110 =
    strategy === 'cash_main' ? await findAccountByTenantCode(tenantId, String(CASH_MAIN_CODE), tx) : null;

  if (paymentAccount.coaAccountId) {
    const linked = await tx.account.findFirst({
      where: {
        id: paymentAccount.coaAccountId,
        tenantId,
        isActive: true,
        mergedIntoAccountId: null,
      },
      select: { id: true, accountCode: true, code: true, parentAccountId: true },
    });

    if (linked) {
      if (!strategy) return paymentAccount;

      const code = normalizedGlCode(linked);

      if (strategy === 'cash_main' && main1110?.id) {
        if (linked.id === main1110.id && code === String(CASH_MAIN_CODE)) {
          return paymentAccount;
        }
        if (isLegacyCashRegisterGlCode(code)) {
          return tx.paymentAccount.update({
            where: { id: paymentAccount.id },
            data: { coaAccountId: main1110.id },
          });
        }
        return paymentAccount;
      }

      if (strategy === 'bank_tree' && isPaymentGlChildCode(code)) {
        await syncPaymentChildGlDisplayFromPaymentAccount(paymentAccount, linked.id, tx);
        return paymentAccount;
      }

      if (strategy === 'bank_tree' && accountIsStructuralPaymentParentForType(linked, paymentAccount.accountType)) {
        const parentAccount = isPaymentGlParentCode(code)
          ? linked
          : await resolvePaymentParentGlAccount(tenantId, paymentAccount, tx);

        if (parentAccount?.id) {
          const child = await createPaymentChildGlAccount(tenantId, parentAccount, paymentAccount, tx);
          if (child) {
            return tx.paymentAccount.update({
              where: { id: paymentAccount.id },
              data: { coaAccountId: child.id },
            });
          }
          console.warn(
            `[payment GL] Tenant ${tenantId} payment account ${paymentAccount.id}: could not create child under ${normalizedGlCode(parentAccount)} (slots full).`
          );
        }
      }

      return paymentAccount;
    }
  }

  if (!strategy) return paymentAccount;

  if (strategy === 'cash_main' && main1110?.id) {
    return tx.paymentAccount.update({
      where: { id: paymentAccount.id },
      data: { coaAccountId: main1110.id },
    });
  }

  if (strategy === 'bank_tree') {
    const parent = await resolvePaymentParentGlAccount(tenantId, paymentAccount, tx);
    if (!parent?.id) {
      throw new PaymentGlSlotsExhaustedError(
        'Select a bank or mobile money channel (1131–1138, 1140, or 1141) before creating this account.',
        paymentAccount.accountType
      );
    }

    const child = await createPaymentChildGlAccount(tenantId, parent, paymentAccount, tx);
    if (!child) {
      throw new PaymentGlSlotsExhaustedError(
        `The maximum number of accounts under ${normalizedGlCode(parent)} (${MAX_PAYMENT_CHILD_SUFFIX} slots) has been reached.`,
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
 * GL account used for operating cash (sales/expense/standard "cash" fallbacks). Always **1110**.
 */
export async function resolveOperatingCashGlAccount(tenantId, tx = prisma) {
  await ensurePaymentTypeMainGlAccounts(tenantId, tx);
  return findAccountByTenantCode(tenantId, String(CASH_MAIN_CODE), tx);
}

/** @deprecated Use allocateNextPaymentChildCode — retained for legacy imports */
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
  for (const r of rows) {
    for (const raw of [r.accountCode, r.code]) {
      const m = /^1130-(\d+)$/.exec(String(raw ?? '').trim());
      if (!m) continue;
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n >= 1 && n <= MAX_PAYMENT_CHILD_SUFFIX) max = Math.max(max, n);
    }
  }
  if (max >= MAX_PAYMENT_CHILD_SUFFIX) return null;
  return `${BANK_GROUP_CODE}-${String(max + 1).padStart(2, '0')}`;
}
