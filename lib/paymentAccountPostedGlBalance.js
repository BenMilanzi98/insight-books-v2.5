/**
 * Live payment-account balances from posted ACCOUNTING_V2 / Posted journal lines
 * on the linked Chart of Accounts account (PaymentAccount.coaAccountId).
 *
 * Fresh-books: AccountBalance keyed by PaymentAccount.id is not the financial SoT.
 */

const POSTED_STATUSES = ['Posted', 'posted', 'POSTED'];

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function isDebitNormal(account) {
  if (!account) return true;
  if (account.normalBalance === 'Credit') return false;
  if (account.normalBalance === 'Debit') return true;
  const t = String(account.accountType || '');
  return t === 'Asset' || t === 'Expense' || t.toLowerCase() === 'asset' || t.toLowerCase() === 'expense';
}

/**
 * @param {string} tenantId
 * @param {string[]} coaAccountIds
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} client
 * @returns {Promise<Map<string, number>>} coaAccountId → signed balance
 */
export async function loadPostedGlBalancesByCoaIds(tenantId, coaAccountIds, client) {
  const map = new Map();
  const ids = [...new Set((coaAccountIds || []).filter(Boolean))];
  if (!tenantId || !ids.length) return map;

  const accounts = await client.account.findMany({
    where: { tenantId, id: { in: ids } },
    select: { id: true, accountType: true, normalBalance: true },
  });
  const meta = new Map(accounts.map((a) => [a.id, a]));

  const lines = await client.journalEntryLine.findMany({
    where: {
      accountId: { in: ids },
      journalEntry: {
        tenantId,
        status: { in: POSTED_STATUSES },
      },
    },
    select: { accountId: true, debitAmount: true, creditAmount: true },
  });

  const sums = new Map();
  for (const line of lines) {
    const cur = sums.get(line.accountId) || { debit: 0, credit: 0 };
    cur.debit += parseFloat(line.debitAmount || 0);
    cur.credit += parseFloat(line.creditAmount || 0);
    sums.set(line.accountId, cur);
  }

  for (const id of ids) {
    const s = sums.get(id) || { debit: 0, credit: 0 };
    const bal = isDebitNormal(meta.get(id)) ? s.debit - s.credit : s.credit - s.debit;
    map.set(id, roundMoney(bal));
  }

  return map;
}

/**
 * Spendable balance for a PaymentAccount — same SoT as /payments UI:
 * posted GL on linked CoA, then legacy AccountBalance / currentBalance.
 *
 * @param {string} tenantId
 * @param {{ id: string, name?: string|null, coaAccountId?: string|null, currentBalance?: number|null, accountType?: string|null }} paymentAccount
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} client
 * @returns {Promise<number>}
 */
export async function resolvePaymentAccountSpendableBalance(tenantId, paymentAccount, client) {
  if (!tenantId || !paymentAccount) return 0;

  if (paymentAccount.coaAccountId) {
    const glMap = await loadPostedGlBalancesByCoaIds(tenantId, [paymentAccount.coaAccountId], client);
    if (glMap.has(paymentAccount.coaAccountId)) {
      return roundMoney(glMap.get(paymentAccount.coaAccountId));
    }

    // Fallback: Account.balance on linked CoA (stale but better than 0)
    const coa = await client.account.findFirst({
      where: { id: paymentAccount.coaAccountId, tenantId, isActive: true },
      select: { balance: true },
    });
    if (coa?.balance != null) {
      const stored = parseFloat(coa.balance);
      if (!Number.isNaN(stored)) return roundMoney(stored);
    }
  }

  const byId = await client.accountBalance.findFirst({
    where: { tenantId, account: paymentAccount.id },
  });
  if (byId?.balance != null) {
    const n = parseFloat(byId.balance);
    if (!Number.isNaN(n)) return roundMoney(n);
  }

  if (paymentAccount.name) {
    const name = String(paymentAccount.name).trim();
    const byName = await client.accountBalance.findFirst({
      where: { tenantId, account: name },
    });
    if (byName?.balance != null) {
      const n = parseFloat(byName.balance);
      if (!Number.isNaN(n)) return roundMoney(n);
    }
  }

  const current = parseFloat(paymentAccount.currentBalance);
  if (!Number.isNaN(current) && current !== 0) return roundMoney(current);

  return 0;
}

/**
 * Pure helper for tests: debit-normal asset balance from line aggregates.
 */
export function balanceFromDebitCredit(debit, credit, { normalBalance, accountType } = {}) {
  const debitNormal = isDebitNormal({ normalBalance, accountType });
  return roundMoney(debitNormal ? debit - credit : credit - debit);
}
