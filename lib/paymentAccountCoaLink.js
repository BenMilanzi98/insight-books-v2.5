/**
 * Keeps PaymentAccount (POS / payment methods) aligned with Chart of Accounts asset accounts
 * so cash/bank movements appear on the correct GL accounts.
 */
import prisma from '@/lib/prisma';
import { getStandardAccounts } from '@/lib/transactionJournalHelpers';

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

  const std = await getStandardAccounts(tenantId, tx);
  const type = (paymentAccount.accountType || '').toLowerCase();
  const name = (paymentAccount.name || '').toLowerCase();

  let coa =
    type.includes('bank') || name.includes('bank') || name.includes('transfer')
      ? std.bank
      : null;
  if (!coa && (type.includes('cash') || name.includes('cash'))) {
    coa = std.cash;
  }
  if (!coa) coa = std.cash || std.bank;
  if (!coa) return paymentAccount;

  return tx.paymentAccount.update({
    where: { id: paymentAccount.id },
    data: { coaAccountId: coa.id },
  });
}
