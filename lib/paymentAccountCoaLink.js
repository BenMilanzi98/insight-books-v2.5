/**
 * Keeps PaymentAccount (POS / payment methods) aligned with Chart of Accounts asset accounts
 * so cash/bank movements appear on the correct GL accounts.
 */
import prisma from '@/lib/prisma';
import { getStandardAccounts } from '@/lib/transactionJournalHelpers';

/**
 * @param {string} tenantId
 * @param {string} parentAccountId
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
async function nextPaymentGlCodeUnder1120(tenantId, parentAccountId, tx) {
  const siblings = await tx.account.findMany({
    where: { tenantId, parentAccountId },
    select: { accountCode: true },
  });
  let max = 5;
  for (const s of siblings) {
    const m = String(s.accountCode || '').match(/^1130-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max + 1;
  return `1130-${String(next).padStart(2, '0')}`;
}

/**
 * @param {string} tenantId
 * @param {{ id: string; name: string; accountType: string; coaAccountId?: string|null }} paymentAccount
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx]
 */
export async function ensurePaymentAccountCoaLink(tenantId, paymentAccount, tx = prisma) {
  if (paymentAccount.coaAccountId) {
    const linked = await tx.account.findFirst({
      where: { id: paymentAccount.coaAccountId, tenantId, isActive: true },
      select: { id: true },
    });
    if (linked) return paymentAccount;
  }

  const type = (paymentAccount.accountType || '').toLowerCase();
  const name = (paymentAccount.name || '').toLowerCase();

  const isCash =
    (type.includes('cash') || name.includes('cash')) &&
    !type.includes('bank') &&
    !name.includes('bank') &&
    !name.includes('transfer') &&
    !name.includes('airtel') &&
    !name.includes('mpamba') &&
    !name.includes('paychangu');

  if (isCash) {
    const cash = await tx.account.findFirst({
      where: { tenantId, accountCode: '1110', accountType: 'Asset', isActive: true },
      select: { id: true },
    });
    if (cash) {
      return tx.paymentAccount.update({
        where: { id: paymentAccount.id },
        data: { coaAccountId: cash.id },
      });
    }
  }

  const parent1120 = await tx.account.findFirst({
    where: { tenantId, accountCode: '1120', accountType: 'Asset', isActive: true },
    select: { id: true },
  });

  if (parent1120?.id) {
    const matchName = (paymentAccount.name || '').trim();
    let coa = matchName
      ? await tx.account.findFirst({
          where: {
            tenantId,
            parentAccountId: parent1120.id,
            accountName: matchName,
            isActive: true,
            accountType: 'Asset',
          },
        })
      : null;
    if (!coa) {
      const code = await nextPaymentGlCodeUnder1120(tenantId, parent1120.id, tx);
      coa = await tx.account.create({
        data: {
          tenantId,
          accountCode: code,
          accountName: matchName || 'Payment method',
          accountType: 'Asset',
          accountSubtype: 'Current Asset',
          normalBalance: 'Debit',
          parentAccountId: parent1120.id,
          isActive: true,
          balance: 0,
        },
      });
    }
    return tx.paymentAccount.update({
      where: { id: paymentAccount.id },
      data: { coaAccountId: coa.id },
    });
  }

  const std = await getStandardAccounts(tenantId, tx);
  const coa = std.bank || std.cash;
  if (!coa) return paymentAccount;

  return tx.paymentAccount.update({
    where: { id: paymentAccount.id },
    data: { coaAccountId: coa.id },
  });
}
