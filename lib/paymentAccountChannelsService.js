/**
 * Builds grouped payment channel view for /payments UI.
 */
import {
  PAYMENT_CASH_GL_CODE,
  PAYMENT_CASH_GL_NAME,
  PAYMENT_GL_CHANNELS,
  isPaymentGlParentCode,
  paymentChildBelongsToParent,
} from '@/lib/paymentGlChannels.js';
import { initializeDefaultPaymentAccounts } from '@/lib/paymentAccountInitialization.js';
import {
  ensurePaymentAccountCoaLink,
  findPaymentAccountsNeedingLeafCoaMigration,
} from '@/lib/paymentAccountCoaLink.js';
import { loadPostedGlBalancesByCoaIds } from '@/lib/paymentAccountPostedGlBalance.js';

function normalizeName(name) {
  if (!name) return '';
  return String(name).toLowerCase().trim().replace(/\s+/g, '_');
}

function glCode(account) {
  return String(account?.accountCode ?? account?.code ?? '').trim();
}

async function syncPaymentAccounts(tenantId, db) {
  await initializeDefaultPaymentAccounts(tenantId, db);

  let paymentAccounts = await db.paymentAccount.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });

  const needsLeafMigration = await findPaymentAccountsNeedingLeafCoaMigration(tenantId, db);
  const needsLink = paymentAccounts.filter((p) => !p.coaAccountId);
  const toCoaFix = [...new Map([...needsLink, ...needsLeafMigration].map((p) => [p.id, p])).values()];

  for (const p of toCoaFix.slice(0, 80)) {
    try {
      await ensurePaymentAccountCoaLink(tenantId, p, db);
    } catch (e) {
      console.warn('ensurePaymentAccountCoaLink (channels):', p?.id, e?.message || e);
    }
  }

  if (toCoaFix.length) {
    paymentAccounts = await db.paymentAccount.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  return paymentAccounts;
}

function resolveBalanceForAccount(
  account,
  balanceByKey,
  balanceByNormalized,
  balanceByCode,
  glByCoaId
) {
  // Prefer posted GL on linked CoA (V2 / POS). Legacy AccountBalance is fallback only.
  if (account.coaAccountId && glByCoaId?.has(account.coaAccountId)) {
    return glByCoaId.get(account.coaAccountId);
  }

  const id = account.id;
  const name = account.name || '';
  const normalized = normalizeName(name);
  const accountType = (account.accountType || '').toLowerCase();

  let balance = balanceByKey.get(id);
  if (balance !== undefined && balance !== null) return balance;

  if (!account.isSystem) return 0;

  balance = balanceByNormalized.get(normalized);
  if (balance !== undefined && balance !== null) return balance;

  if (accountType === 'cash') {
    const b = balanceByCode.get(PAYMENT_CASH_GL_CODE);
    if (b !== undefined && b !== null) return b;
  }

  return 0;
}

/**
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient} db
 */
export async function fetchPaymentAccountChannels(tenantId, db) {
  const paymentAccounts = await syncPaymentAccounts(tenantId, db);

  const coaIds = [...new Set(paymentAccounts.map((p) => p.coaAccountId).filter(Boolean))];
  const coaRows = coaIds.length
    ? await db.account.findMany({
        where: { tenantId, id: { in: coaIds } },
        select: {
          id: true,
          accountCode: true,
          code: true,
          accountName: true,
          name: true,
          parentAccountId: true,
          parentAccount: { select: { accountCode: true, code: true } },
        },
      })
    : [];
  const coaById = new Map(coaRows.map((a) => [a.id, a]));

  const accountBalanceRecords = await db.accountBalance.findMany({ where: { tenantId } });
  const balanceByKey = new Map();
  const balanceByNormalized = new Map();
  for (const b of accountBalanceRecords) {
    const key = String(b.account).trim();
    const val = parseFloat(b.balance) || 0;
    balanceByKey.set(key, (balanceByKey.get(key) || 0) + val);
    const norm = normalizeName(key);
    if (norm) balanceByNormalized.set(norm, (balanceByNormalized.get(norm) || 0) + val);
  }

  const cashCoa = await db.account.findFirst({
    where: { tenantId, accountCode: PAYMENT_CASH_GL_CODE, isActive: true },
    select: { id: true, balance: true },
  });
  const balanceByCode = new Map();
  if (cashCoa) {
    const fromAb = balanceByKey.get(PAYMENT_CASH_GL_CODE);
    balanceByCode.set(
      PAYMENT_CASH_GL_CODE,
      fromAb !== undefined && fromAb !== null ? fromAb : parseFloat(cashCoa.balance) || 0
    );
  }

  const glByCoaId = await loadPostedGlBalancesByCoaIds(tenantId, coaIds, db);

  const enriched = paymentAccounts.map((pa) => {
    const coa = pa.coaAccountId ? coaById.get(pa.coaAccountId) : null;
    const coaCode = coa ? glCode(coa) : null;
    let parentGlCode = null;
    if (coa?.parentAccount) {
      parentGlCode = glCode(coa.parentAccount);
    } else if (isPaymentGlParentCode(coaCode)) {
      parentGlCode = coaCode;
    }
    return {
      id: pa.id,
      name: pa.name,
      accountType: pa.accountType,
      reference: pa.reference,
      isSystem: pa.isSystem,
      isActive: pa.isActive,
      coaAccountId: pa.coaAccountId,
      coaCode,
      parentGlCode,
      balance: resolveBalanceForAccount(
        pa,
        balanceByKey,
        balanceByNormalized,
        balanceByCode,
        glByCoaId
      ),
    };
  });

  const cashAccounts = enriched.filter((a) => a.accountType === 'Cash');
  const cashTotal = cashAccounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);

  const channels = PAYMENT_GL_CHANNELS.map((ch) => {
    const accounts = enriched.filter(
      (a) =>
        a.parentGlCode === ch.code ||
        (a.coaCode && paymentChildBelongsToParent(ch.code, a.coaCode)) ||
        (a.accountType === ch.accountType &&
          !a.coaCode &&
          a.accountType !== 'Cash' &&
          ch.code === '1131')
    );
    const totalBalance = accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
    return {
      code: ch.code,
      name: ch.name,
      accountType: ch.accountType,
      totalBalance,
      accounts,
    };
  });

  const otherAccounts = enriched.filter(
    (a) =>
      a.accountType !== 'Cash' &&
      !channels.some((ch) => ch.accounts.some((x) => x.id === a.id))
  );

  return {
    cash: {
      code: PAYMENT_CASH_GL_CODE,
      name: PAYMENT_CASH_GL_NAME,
      accountType: 'Cash',
      totalBalance: cashTotal,
      accounts: cashAccounts,
    },
    channels,
    otherAccounts,
    allAccounts: enriched,
  };
}
