import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { initializeDefaultPaymentAccounts } from '@/lib/paymentAccountInitialization';

async function ensurePaymentCoaForAccounts(tenantId, rows) {
  const { ensurePaymentAccountCoaLink } = await import('@/lib/paymentAccountCoaLink');
  for (const p of rows) {
    try {
      await ensurePaymentAccountCoaLink(tenantId, p, prisma);
    } catch (e) {
      console.warn('ensurePaymentAccountCoaLink failed (balances):', p?.id, e?.message || e);
    }
  }
}

/** Same as GET /api/payment-accounts: create type mains + GL children so Chart of Accounts shows payment methods. */
async function syncPaymentAccountsToCoa(tenantId) {
  await initializeDefaultPaymentAccounts(tenantId, prisma);

  let paymentAccounts = await prisma.paymentAccount.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });

  const needsLink = paymentAccounts.filter((p) => !p.coaAccountId);
  if (needsLink.length > 0) {
    await ensurePaymentCoaForAccounts(tenantId, needsLink.slice(0, 50));
    paymentAccounts = await prisma.paymentAccount.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  const linkedIds = [
    ...new Set(paymentAccounts.map((p) => p.coaAccountId).filter(Boolean)),
  ];
  if (linkedIds.length) {
    const badRows = await prisma.account.findMany({
      where: {
        id: { in: linkedIds },
        OR: [{ isActive: false }, { mergedIntoAccountId: { not: null } }],
      },
      select: { id: true },
    });
    const badIds = new Set(badRows.map((r) => r.id));
    const toRepair = paymentAccounts.filter((p) => p.coaAccountId && badIds.has(p.coaAccountId));
    const repairSlice = toRepair.slice(0, 30);
    for (const p of repairSlice) {
      await prisma.paymentAccount.update({
        where: { id: p.id },
        data: { coaAccountId: null },
      });
    }
    if (repairSlice.length) {
      await ensurePaymentCoaForAccounts(
        tenantId,
        repairSlice.map((p) => ({ ...p, coaAccountId: null }))
      );
    }
    if (toRepair.length) {
      paymentAccounts = await prisma.paymentAccount.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      });
    }
  }

  return paymentAccounts;
}

// GET - Get actual balances for all payment accounts (AccountBalance + Chart of Accounts)
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const tenantId = user.tenantId;

    const paymentAccounts = await syncPaymentAccountsToCoa(tenantId);

    // All AccountBalance records for tenant (source of truth for cash/bank/mobile)
    const accountBalanceRecords = await prisma.accountBalance.findMany({
      where: { tenantId }
    });

    const normalizeName = (name) => {
      if (!name) return '';
      return String(name).toLowerCase().trim().replace(/\s+/g, '_');
    };

    // Map: raw account key -> balance (exact key as stored in DB)
    const balanceByKey = new Map();
    accountBalanceRecords.forEach(b => {
      const key = String(b.account).trim();
      const val = parseFloat(b.balance) || 0;
      balanceByKey.set(key, (balanceByKey.get(key) || 0) + val);
    });

    // Map: normalized key -> balance (for name matching)
    const balanceByNormalized = new Map();
    accountBalanceRecords.forEach(b => {
      const norm = normalizeName(b.account);
      if (!norm) return;
      const val = parseFloat(b.balance) || 0;
      balanceByNormalized.set(norm, (balanceByNormalized.get(norm) || 0) + val);
    });

    // Chart of Accounts cash/bank/mobile accounts (1000–1050) – actual ledger balances
    const cashAccountCodes = ['1000', '1010', '1020', '1030', '1040', '1050'];
    const coaAccounts = await prisma.account.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { accountCode: { in: cashAccountCodes } },
          { accountName: { contains: 'Cash', mode: 'insensitive' } },
          { accountName: { contains: 'Bank', mode: 'insensitive' } },
          { accountName: { contains: 'Airtel', mode: 'insensitive' } },
          { accountName: { contains: 'Mpamba', mode: 'insensitive' } },
          { accountName: { contains: 'PayChangu', mode: 'insensitive' } }
        ]
      },
      select: { id: true, accountCode: true, accountName: true, balance: true }
    });

    // Balance by COA account code (prefer AccountBalance, else Account.balance)
    const balanceByCode = new Map();
    coaAccounts.forEach(acc => {
      const code = acc.accountCode || '';
      const fromAb = balanceByKey.get(code);
      const fromAccount = acc.balance != null ? parseFloat(acc.balance) : 0;
      balanceByCode.set(code, fromAb !== undefined && fromAb !== null ? fromAb : fromAccount);
    });
    accountBalanceRecords.forEach(b => {
      const k = String(b.account).trim();
      if (cashAccountCodes.includes(k)) {
        const val = parseFloat(b.balance) || 0;
        balanceByCode.set(k, val);
      }
    });

    // Resolve balance for one payment account.
    // User-created accounts: only use balance keyed by PaymentAccount.id (from transfers/revenue). Default 0.
    // System accounts: may also use name/type mapping to CoA for legacy display.
    const getBalanceForPaymentAccount = (account) => {
      const id = account.id;
      const name = account.name || '';
      const normalized = normalizeName(name);
      const accountType = (account.accountType || '').toLowerCase();

      // 1) AccountBalance keyed by PaymentAccount.id (only source for user-created accounts)
      let balance = balanceByKey.get(id);
      if (balance !== undefined && balance !== null) return balance;

      // 2) User-created accounts: no name/type fallback – new account must show 0 until money is transferred or revenue added
      if (!account.isSystem) {
        return 0;
      }

      // 3) System accounts only: AccountBalance keyed by normalized name
      balance = balanceByNormalized.get(normalized);
      if (balance !== undefined && balance !== null) return balance;

      // 4) System accounts only: map to CoA so default "Cash" shows ledger balance
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
    };

    const accountsWithBalances = paymentAccounts.map(account => ({
      id: account.id,
      name: account.name,
      accountType: account.accountType,
      reference: account.reference,
      isSystem: account.isSystem,
      isActive: account.isActive,
      balance: getBalanceForPaymentAccount(account)
    }));

    return NextResponse.json({
      success: true,
      accounts: accountsWithBalances
    });
  } catch (error) {
    console.error('Error fetching payment account balances:', error);
    return NextResponse.json({ error: 'Failed to fetch payment account balances' }, { status: 500 });
  }
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

