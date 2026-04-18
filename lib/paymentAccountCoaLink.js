/**
 * Links PaymentAccount (POS / payment methods) to Chart of Accounts asset accounts.
 * Payment-type mains (1110, 1140, …) sit under **Current Assets (1100)** when present,
 * otherwise under **Assets (1000)** — matching the system CoA blueprint.
 * Each payment method is a child of its type main (codes main+1 … main+9).
 */
import prisma from '@/lib/prisma';

/** Payment modal types → main GL account code (parent). Children use main+1 … main+9. */
export const PAYMENT_ACCOUNT_TYPE_MAIN_CODE = {
  Cash: 1110,
  Bank: 1140,
  'Mobile Money': 1150,
  Wallet: 1160,
  'POS Terminal': 1170,
};

export const ALLOWED_PAYMENT_ACCOUNT_TYPES = Object.keys(PAYMENT_ACCOUNT_TYPE_MAIN_CODE);

const MAIN_LABELS = {
  1110: 'Cash — payment methods (main)',
  1140: 'Bank — payment methods (main)',
  1150: 'Mobile money — payment methods (main)',
  1160: 'Wallet — payment methods (main)',
  1170: 'POS terminal — payment methods (main)',
};

const CHILD_SLOT_COUNT = 9;

export class PaymentGlSlotsExhaustedError extends Error {
  constructor(message, accountType) {
    super(message);
    this.name = 'PaymentGlSlotsExhaustedError';
    this.accountType = accountType;
    this.code = 'PAYMENT_GL_SLOTS_EXHAUSTED';
  }
}

function mainCodeForPaymentAccountType(accountType) {
  const key = (accountType || '').trim();
  return PAYMENT_ACCOUNT_TYPE_MAIN_CODE[key] ?? null;
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
 * Ensure the five main payment-type GL headers exist as **Asset** accounts under the Assets tree.
 */
export async function ensurePaymentTypeMainGlAccounts(tenantId, tx = prisma) {
  const { parentId } = await resolveAssetHierarchyParentForPaymentMains(tenantId, tx);
  const mains = Object.entries(PAYMENT_ACCOUNT_TYPE_MAIN_CODE);

  for (const [, mainCode] of mains) {
    const codeStr = String(mainCode);
    let main = await findAccountByTenantCode(tenantId, codeStr, tx);
    if (!main) {
      const label = MAIN_LABELS[mainCode] || `Payment methods (${codeStr})`;
      main = await tx.account.create({
        data: {
          tenantId,
          code: codeStr,
          name: label,
          type: 'ASSET',
          accountCode: codeStr,
          accountName: label,
          accountType: 'Asset',
          accountSubtype: 'Current Asset',
          normalBalance: 'Debit',
          parentAccountId: parentId,
          isActive: true,
          balance: 0,
        },
      });
    } else if (parentId && main.parentAccountId == null) {
      await tx.account.update({
        where: { id: main.id },
        data: { parentAccountId: parentId },
      });
    }
  }
}

/**
 * Next free child code main+1 … main+9 under parent; creates child GL account.
 * @returns {Promise<import('@prisma/client').Account>}
 */
async function createNextChildGlAccount(tenantId, mainCode, parentId, accountName, tx) {
  const safeName = (accountName || 'Payment method').trim() || 'Payment method';

  for (let i = 1; i <= CHILD_SLOT_COUNT; i += 1) {
    const codeStr = String(mainCode + i);
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
          parentAccountId: parentId,
          isActive: true,
          balance: 0,
        },
      });
    }
    if (existing.parentAccountId === parentId) {
      continue;
    }
  }
  return null;
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

  const mainCode = mainCodeForPaymentAccountType(paymentAccount.accountType);
  if (mainCode == null) {
    return paymentAccount;
  }

  const mainAccount = await findAccountByTenantCode(tenantId, String(mainCode), tx);
  if (!mainAccount?.id) {
    return paymentAccount;
  }

  const isDefaultSystemCash =
    paymentAccount.isSystem === true &&
    paymentAccount.name === 'Cash' &&
    (paymentAccount.accountType || '').trim() === 'Cash';

  if (isDefaultSystemCash) {
    return tx.paymentAccount.update({
      where: { id: paymentAccount.id },
      data: { coaAccountId: mainAccount.id },
    });
  }

  const child = await createNextChildGlAccount(
    tenantId,
    mainCode,
    mainAccount.id,
    paymentAccount.name,
    tx
  );

  if (!child) {
    throw new PaymentGlSlotsExhaustedError(
      `The maximum number of payment accounts (${CHILD_SLOT_COUNT}) for type "${paymentAccount.accountType}" has been reached (codes ${mainCode + 1}–${mainCode + CHILD_SLOT_COUNT}). Remove or merge an account before adding another.`,
      paymentAccount.accountType
    );
  }

  return tx.paymentAccount.update({
    where: { id: paymentAccount.id },
    data: { coaAccountId: child.id },
  });
}
