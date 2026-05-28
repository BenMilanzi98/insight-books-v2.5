/**
 * Dashboard COGS should follow the GL: debits to COGS (expense) minus credits
 * (void/refund/sale reversal journals credit COGS). Summing debits only ignores returns.
 *
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} client
 * @param {{ cogsAccountIds: string[], transactionWhere: Record<string, unknown> }} args
 * @returns {Promise<number>}
 */
import { parseMoney, subtractMoney } from '@/lib/money';

export async function sumNetCogsDebitMinusCredit(client, { cogsAccountIds, transactionWhere }) {
  if (!cogsAccountIds?.length) return 0;

  const base = {
    accountId: { in: cogsAccountIds },
    transaction: transactionWhere,
  };

  const [debits, credits] = await Promise.all([
    client.transactionLine.aggregate({
      where: { ...base, debitAmount: { gt: 0 } },
      _sum: { debitAmount: true },
    }),
    client.transactionLine.aggregate({
      where: { ...base, creditAmount: { gt: 0 } },
      _sum: { creditAmount: true },
    }),
  ]);

  return subtractMoney(parseMoney(debits._sum.debitAmount), parseMoney(credits._sum.creditAmount));
}
