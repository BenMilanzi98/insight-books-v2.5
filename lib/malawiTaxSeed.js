import prisma from '@/lib/prisma';
import {
  MALAWI_TAX_CATALOG,
  MALAWI_TAX_INFLOW_PARENT,
  MALAWI_TAX_OUTFLOW_PARENT,
  MALAWI_STANDARD_VAT_RATE,
  getMalawiTaxCatalogEntry,
} from './malawiTaxCatalog.js';
import {
  ensureDefaultTaxAccountsForTenant,
  TAX_INFLOW_CODE,
  TAX_OUTFLOW_CODE,
} from './taxAccountsInitialization.js';

/**
 * Upgrade 2041 / 2045 to rollup-only group parents; leaf tax types post to 2041-xx / 2045-xx children.
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} tx
 */
async function ensureTaxParentRollupAccounts(tenantId, tx = prisma) {
  await ensureDefaultTaxAccountsForTenant(tenantId, tx, false);

  for (const code of [TAX_INFLOW_CODE, TAX_OUTFLOW_CODE]) {
    await tx.account.updateMany({
      where: { tenantId, accountCode: code },
      data: {
        acceptsNewTransactions: false,
        accountSubtype: 'Group',
        isSystem: true,
      },
    });
  }
}

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} tx
 */
async function ensureTaxGlChild(tenantId, parentAccount, def, tx = prisma) {
  const existing = await tx.account.findFirst({
    where: { tenantId, accountCode: def.glCode, mergedIntoAccountId: null },
  });
  if (existing) return existing;

  try {
    return await tx.account.create({
      data: {
        tenantId,
        accountCode: def.glCode,
        code: def.glCode,
        accountName: def.glAccountName || def.taxName,
        name: def.glAccountName || def.taxName,
        accountType: 'Liability',
        type: 'Liability',
        accountSubtype: 'Current Liability',
        normalBalance: 'Credit',
        parentAccountId: parentAccount?.id ?? null,
        description:
          def.description ||
          `MRA ${def.taxName} — child of ${parentAccount?.accountCode || def.flow === 'inflow' ? '2041' : '2045'}.`,
        isActive: true,
        isSystem: true,
        acceptsNewTransactions: true,
        balance: 0,
      },
    });
  } catch (e) {
    if (e.code === 'P2002') {
      const again = await tx.account.findFirst({
        where: { tenantId, accountCode: def.glCode },
      });
      if (again) return again;
    }
    throw e;
  }
}

/**
 * Idempotently seed Malawi tax types + GL children under 2041 / 2045.
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} [tx]
 * @param {{ applyCatalogRates?: boolean }} [options]
 *   When applyCatalogRates is true, system tax names/rates/types are reset to the MRA catalog
 *   (used by explicit "Sync MRA Catalog" — not on ordinary GET /api/tax-types).
 * @returns {Promise<{ created: number, updated: number, glCreated: number }>}
 */
export async function ensureMalawiTaxTypesForTenant(tenantId, tx = prisma, options = {}) {
  const { applyCatalogRates = false } = options;
  if (!tenantId) return { created: 0, updated: 0, glCreated: 0 };

  await ensureTaxParentRollupAccounts(tenantId, tx);

  const inflowParent = await tx.account.findFirst({
    where: { tenantId, accountCode: MALAWI_TAX_INFLOW_PARENT, isActive: true },
  });
  const outflowParent = await tx.account.findFirst({
    where: { tenantId, accountCode: MALAWI_TAX_OUTFLOW_PARENT, isActive: true },
  });

  let created = 0;
  let updated = 0;
  let glCreated = 0;

  for (const def of MALAWI_TAX_CATALOG) {
    const parent = def.flow === 'inflow' ? inflowParent : outflowParent;
    if (!parent) continue;

    const beforeGl = await tx.account.findFirst({
      where: { tenantId, accountCode: def.glCode },
      select: { id: true },
    });
    const glAccount = await ensureTaxGlChild(tenantId, parent, def, tx);
    if (!beforeGl) glCreated += 1;

    let taxType = await tx.taxType.findFirst({
      where: {
        tenantId,
        OR: [{ taxId: def.taxId }, ...(def.taxCode ? [{ taxCode: def.taxCode }] : [])],
      },
    });

    // Legacy PAYE alias (may exist under old name)
    if (!taxType && def.taxId === 'PAYE') {
      taxType = await tx.taxType.findFirst({
        where: {
          tenantId,
          OR: [
            { taxName: { contains: 'PAYE', mode: 'insensitive' } },
            { taxId: { contains: 'PAYE', mode: 'insensitive' } },
          ],
        },
      });
    }

    if (!taxType) {
      await tx.taxType.create({
        data: {
          tenantId,
          taxId: def.taxId,
          taxName: def.taxName,
          taxCode: def.taxCode,
          taxRate: def.taxRate,
          calculationType: def.calculationType || 'Percentage',
          accountId: glAccount.id,
          status: 'Inactive',
        },
      });
      created += 1;
      continue;
    }

    const patch = {};
    if (!taxType.accountId) patch.accountId = glAccount.id;
    if (!taxType.taxCode && def.taxCode) patch.taxCode = def.taxCode;

    // Always keep standard VAT at the current MRA default (17.5%).
    // Other system rates update only when applyCatalogRates is requested.
    const isStandardVat =
      def.taxId === 'MW-VAT' ||
      def.taxId === 'MW-VAT-IN' ||
      (def.isSystem && Number(def.taxRate) === MALAWI_STANDARD_VAT_RATE && /vat/i.test(String(def.taxName || '')));

    if ((applyCatalogRates && def.isSystem) || isStandardVat) {
      if (taxType.taxName !== def.taxName) patch.taxName = def.taxName;
      if (Number(taxType.taxRate) !== def.taxRate) patch.taxRate = def.taxRate;
      const catalogCalc = def.calculationType || 'Percentage';
      if ((taxType.calculationType || 'Percentage') !== catalogCalc) {
        patch.calculationType = catalogCalc;
      }
    }
    if (Object.keys(patch).length > 0) {
      await tx.taxType.update({ where: { id: taxType.id }, data: patch });
      updated += 1;
    }
  }

  // Resolve system VAT types by taxId regardless of status (Activate is opt-in for selling).
  const vatIn = await tx.taxType.findFirst({
    where: { tenantId, taxId: 'MW-VAT' },
    select: { id: true, accountId: true },
  });
  const vatOut = await tx.taxType.findFirst({
    where: { tenantId, taxId: 'MW-VAT-IN' },
    select: { id: true, accountId: true },
  });

  const settings = await tx.tenantSettings.findUnique({
    where: { tenantId },
    select: { id: true, taxInflowAccountId: true, taxOutflowAccountId: true },
  });

  const settingsPatch = {};
  if (inflowParent?.id && !settings?.taxInflowAccountId) {
    settingsPatch.taxInflowAccountId = inflowParent.id;
  }
  if (outflowParent?.id && !settings?.taxOutflowAccountId) {
    settingsPatch.taxOutflowAccountId = outflowParent.id;
  }

  if (Object.keys(settingsPatch).length > 0) {
    await tx.tenantSettings.upsert({
      where: { tenantId },
      update: settingsPatch,
      create: { tenantId, enabledModules: [], ...settingsPatch },
    });
  }

  // Keep tenant default tax rate on the current MRA standard VAT (17.5%)
  await tx.tenantSettings.updateMany({
    where: {
      tenantId,
      OR: [{ defaultTaxRate: 16.5 }, { defaultTaxRate: 0 }],
    },
    data: { defaultTaxRate: MALAWI_STANDARD_VAT_RATE },
  });

  // Bump legacy / alias VAT tax types still stored at 16.5%
  await tx.taxType.updateMany({
    where: {
      tenantId,
      taxRate: 16.5,
      OR: [
        { taxId: { in: ['MW-VAT', 'MW-VAT-IN', 'A', 'VAT'] } },
        { taxCode: { in: ['VAT', 'VAT16.5', 'MW-VAT-STD', 'MW-VAT-IN', 'A'] } },
        { taxName: { contains: 'VAT', mode: 'insensitive' } },
      ],
    },
    data: { taxRate: MALAWI_STANDARD_VAT_RATE },
  });

  return { created, updated, glCreated, vatInflowTaxTypeId: vatIn?.id, vatOutflowTaxTypeId: vatOut?.id };
}

/**
 * Resolve the GL account for posting/reversal — tax type leaf, catalog child, then 2041/2045 parent.
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} tx
 */
export async function resolveTaxGlAccountForPosting(tenantId, taxType, sourceType, tx = prisma) {
  if (taxType?.account) {
    const code = taxType.account.accountCode || taxType.account.code;
    if (code && code !== TAX_INFLOW_CODE && code !== TAX_OUTFLOW_CODE) {
      return taxType.account;
    }
  }

  if (taxType?.accountId) {
    const linked = await tx.account.findFirst({
      where: { id: taxType.accountId, tenantId, isActive: true },
    });
    if (linked) {
      const code = linked.accountCode || linked.code;
      if (code && code !== TAX_INFLOW_CODE && code !== TAX_OUTFLOW_CODE) {
        return linked;
      }
    }
  }

  const entry = getMalawiTaxCatalogEntry(taxType?.taxId) || getMalawiTaxCatalogEntry(taxType?.taxCode);
  if (entry?.glCode) {
    const child = await tx.account.findFirst({
      where: { tenantId, accountCode: entry.glCode, isActive: true },
    });
    if (child) return child;
  }

  const { getFixedTaxInflowAccount, getFixedTaxOutflowAccount } = await import('./taxAccountsInitialization.js');
  const { resolveTaxFlowForPosting } = await import('./malawiTaxCatalog.js');
  const flow = resolveTaxFlowForPosting(taxType, sourceType);
  return flow === 'outflow'
    ? await getFixedTaxOutflowAccount(tenantId, tx)
    : await getFixedTaxInflowAccount(tenantId, tx);
}

export { ensureTaxParentRollupAccounts };
