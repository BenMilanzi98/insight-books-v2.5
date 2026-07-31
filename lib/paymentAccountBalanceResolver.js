/**
 * Resolve live balance for a PaymentAccount (same rules as /api/payment-accounts/balances).
 * Used by POS cash day opening balance sync.
 */
import prisma from './prisma';
import { initializeDefaultPaymentAccounts } from './paymentAccountInitialization';
import { loadPostedGlBalancesByCoaIds } from './paymentAccountPostedGlBalance';

function normalizeName(value) {
  if (!value) return '';
  return String(value).toLowerCase().trim().replace(/\s+/g, '_');
}

function getStandardKeysForNameAndType(name, accountType) {
  const n = String(name).toLowerCase();
  if (n.includes('cash')) return ['cash'];
  if (n.includes('bank') || n.includes('transfer')) return ['bank_transfer'];
  if (n.includes('airtel')) return ['airtel_money'];
  if (n.includes('mpamba')) return ['mpamba'];
  if (n.includes('paychangu')) return ['paychangu'];
  if (accountType === 'cash') return ['cash'];
  if (accountType === 'bank') return ['bank_transfer'];
  if (accountType.includes('mobile')) return ['airtel_money', 'mpamba', 'paychangu'];
  return [];
}

function getAccountCodesForNameAndType(name, accountType) {
  const n = String(name).toLowerCase();
  if (n.includes('cash')) return ['1000', '1010'];
  if (n.includes('bank') || n.includes('transfer')) return ['1020'];
  if (n.includes('airtel')) return ['1030'];
  if (n.includes('mpamba')) return ['1040'];
  if (n.includes('paychangu')) return ['1050'];
  if (accountType === 'cash') return ['1000', '1010'];
  if (accountType === 'bank') return ['1020'];
  if (accountType.includes('mobile')) return ['1030', '1040', '1050'];
  return [];
}

/**
 * @param {string} tenantId
 * @param {{ id: string, name: string, accountType: string, isSystem: boolean }} account
 * @param {import('@prisma/client').PrismaClient} [client]
 * @returns {Promise<number>}
 */
export async function resolvePaymentAccountBalance(tenantId, account, client = prisma) {
  await initializeDefaultPaymentAccounts(tenantId, client);

  // Authoritative: posted journals on linked CoA leaf (POS / V2 cash receipts).
  if (account?.coaAccountId) {
    const gl = await loadPostedGlBalancesByCoaIds(tenantId, [account.coaAccountId], client);
    if (gl.has(account.coaAccountId)) {
      return gl.get(account.coaAccountId);
    }
  }

  const accountBalanceRecords = await client.accountBalance.findMany({
    where: { tenantId },
  });

  const balanceByKey = new Map();
  accountBalanceRecords.forEach((b) => {
    const key = String(b.account).trim();
    const val = parseFloat(b.balance) || 0;
    balanceByKey.set(key, (balanceByKey.get(key) || 0) + val);
  });

  const balanceByNormalized = new Map();
  accountBalanceRecords.forEach((b) => {
    const norm = normalizeName(b.account);
    if (!norm) return;
    const val = parseFloat(b.balance) || 0;
    balanceByNormalized.set(norm, (balanceByNormalized.get(norm) || 0) + val);
  });

  const cashAccountCodes = ['1000', '1010', '1020', '1030', '1040', '1050'];
  const coaAccounts = await client.account.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { accountCode: { in: cashAccountCodes } },
        { accountName: { contains: 'Cash', mode: 'insensitive' } },
        { accountName: { contains: 'Bank', mode: 'insensitive' } },
        { accountName: { contains: 'Airtel', mode: 'insensitive' } },
        { accountName: { contains: 'Mpamba', mode: 'insensitive' } },
        { accountName: { contains: 'PayChangu', mode: 'insensitive' } },
      ],
    },
    select: { id: true, accountCode: true, accountName: true, balance: true },
  });

  const balanceByCode = new Map();
  coaAccounts.forEach((acc) => {
    const code = acc.accountCode || '';
    const fromAb = balanceByKey.get(code);
    const fromAccount = acc.balance != null ? parseFloat(acc.balance) : 0;
    balanceByCode.set(code, fromAb !== undefined && fromAb !== null ? fromAb : fromAccount);
  });
  accountBalanceRecords.forEach((b) => {
    const k = String(b.account).trim();
    if (cashAccountCodes.includes(k)) {
      balanceByCode.set(k, parseFloat(b.balance) || 0);
    }
  });

  const id = account.id;
  const name = account.name || '';
  const normalized = normalizeName(name);
  const accountType = (account.accountType || '').toLowerCase();

  let balance = balanceByKey.get(id);
  if (balance !== undefined && balance !== null) return balance;

  if (!account.isSystem) {
    return 0;
  }

  balance = balanceByNormalized.get(normalized);
  if (balance !== undefined && balance !== null) return balance;

  const standardKeys = getStandardKeysForNameAndType(name, accountType);
  for (const key of standardKeys) {
    const b = balanceByNormalized.get(key) ?? balanceByKey.get(key);
    if (b !== undefined && b !== null && b !== 0) return b;
  }
  const codes = getAccountCodesForNameAndType(name, accountType);
  let sum = 0;
  for (const code of codes) {
    const b = balanceByCode.get(code);
    if (b !== undefined && b !== null) sum += b;
  }
  if (codes.length) return sum;

  return 0;
}

/**
 * Deny cash outflows when the payment account balance is below required.
 * @returns {{ ok: true, available?: number, required?: number } | { ok: false, code: string, message: string, available: number, required: number, shortfall: number }}
 */
export async function assertPaymentAccountHasFunds(
  tenantId,
  paymentAccountId,
  requiredAmount,
  client = prisma
) {
  const required = Number(requiredAmount) || 0;
  const id = paymentAccountId != null ? String(paymentAccountId).trim() : '';
  if (!id || required <= 0) return { ok: true };

  // Legacy string methods (e.g. "cash") — skip; UI uses PaymentAccount ids.
  if (id.length < 16) return { ok: true };

  const account = await client.paymentAccount.findFirst({
    where: { id, tenantId, isActive: true },
  });
  if (!account) {
    return {
      ok: false,
      code: 'PAYMENT_ACCOUNT_NOT_FOUND',
      message: 'Selected payment account was not found or is inactive.',
      available: 0,
      required,
      shortfall: required,
    };
  }

  const available = Number(await resolvePaymentAccountBalance(tenantId, account, client)) || 0;
  if (available + 0.009 >= required) {
    return { ok: true, available, required };
  }

  const shortfall = Math.round((required - available) * 100) / 100;
  return {
    ok: false,
    code: 'INSUFFICIENT_PAYMENT_FUNDS',
    message: `Insufficient funds in "${account.name}". Available: ${available.toFixed(2)}, Required: ${required.toFixed(2)}. Transfer or add funds before continuing.`,
    available,
    required,
    shortfall,
    accountId: account.id,
    accountName: account.name,
  };
}

export async function getSystemCashPaymentAccount(tenantId, client = prisma) {
  await initializeDefaultPaymentAccounts(tenantId, client);
  const acc =
    (await client.paymentAccount.findFirst({
      where: { tenantId, isSystem: true, accountType: 'Cash', name: 'Cash', isActive: true },
    })) ||
    (await client.paymentAccount.findFirst({
      where: { tenantId, isSystem: true, accountType: 'Cash', isActive: true },
    }));
  return acc;
}
