/**
 * Overlay TaxType metadata on GL child rows (2041-xx / 2045-xx) for chart / picker display.
 */
import prisma from '@/lib/prisma';
import { isTaxGlChildCode } from '@/lib/malawiTaxCatalog.js';

/**
 * @param {string} tenantId
 * @param {Array<Record<string, unknown>>} accounts
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function enrichChartAccountsWithTaxTypes(tenantId, accounts, db = prisma) {
  if (!tenantId || !Array.isArray(accounts) || !accounts.length) return accounts;

  const childGlIds = accounts
    .filter((a) => isTaxGlChildCode(String(a.accountCode || a.code || '')))
    .map((a) => a.id)
    .filter(Boolean);
  if (!childGlIds.length) return accounts;

  const taxTypes = await db.taxType.findMany({
    where: { tenantId, accountId: { in: childGlIds } },
    select: {
      id: true,
      taxName: true,
      taxCode: true,
      taxId: true,
      taxRate: true,
      calculationType: true,
      accountId: true,
    },
  });
  if (!taxTypes.length) return accounts;

  const byCoaId = new Map(taxTypes.map((t) => [t.accountId, t]));

  return accounts.map((a) => {
    const tt = byCoaId.get(a.id);
    if (!tt) return a;
    const displayName = String(tt.taxName || a.accountName || a.name || '').trim();
    const rateLabel =
      tt.calculationType === 'Percentage' && tt.taxRate != null ? `${tt.taxRate}%` : null;
    return {
      ...a,
      accountName: displayName || a.accountName,
      name: displayName || a.name,
      taxTypeName: tt.taxName,
      taxTypeCode: tt.taxCode || tt.taxId,
      taxTypeRate: rateLabel,
    };
  });
}
