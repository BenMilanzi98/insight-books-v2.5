/**
 * COGS group **5100** is a structural rollup when detail accounts (5110, …) exist.
 * {@link updateAccountBalance} rejects direct postings to parents with active children;
 * sales and inventory flows must debit a leaf expense account.
 */
import prisma from '@/lib/prisma';

async function findAccountByTenantCode(tenantId, codeStr, tx) {
  return tx.account.findFirst({
    where: {
      tenantId,
      OR: [{ accountCode: codeStr }, { code: codeStr }],
      isActive: true,
    },
  });
}

/**
 * @returns {Promise<import('@prisma/client').Account | null>}
 */
export async function resolveCogsPostingLeafGlAccount(tenantId, tx = prisma) {
  let current = await findAccountByTenantCode(tenantId, '5100', tx);
  if (!current) return null;

  for (let depth = 0; depth < 30; depth += 1) {
    const next = await tx.account.findFirst({
      where: {
        tenantId,
        parentAccountId: current.id,
        isActive: true,
        accountType: 'Expense',
      },
      orderBy: [{ accountCode: 'asc' }],
    });
    if (!next) return current;
    current = next;
  }
  return current;
}
