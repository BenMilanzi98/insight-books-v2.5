/**
 * Standard financial setup for every new tenant:
 * - Default payment accounts (Cash on and active — see paymentAccountInitialization)
 * - Full baseline chart of accounts (parent/child GL)
 * - Default tax GL links (taxAccountsInitialization)
 * - Open monthly accounting period for the current month (legacy)
 * - Open V2 financial year for the current date (default Jan–Dec; tenant-configurable)
 *
 * Safe to call with an optional Prisma transaction client (tenant signup flows).
 *
 * Called from: public registration, OAuth/email signup, tenant/add, and
 * POST /api/admin/tenants (Insightbooks admin → Tenant Management).
 *
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} tx
 * @param {{ preferSystemCoaDefinition?: boolean }} [options] — default true: new tenants follow admin `SystemCoaDefinition` when saved. Pass `preferSystemCoaDefinition: false` from chart bootstrap (gap-fill) so existing tenants keep conservative blueprint behaviour.
 */

import { getCurrentDateInAfricaBlantyre } from '@/lib/dateUtils';

export async function initializeNewTenantFinancialDefaults(tenantId, tx, options = {}) {
  if (!tenantId || !tx) {
    console.warn('initializeNewTenantFinancialDefaults: missing tenantId or db client');
    return;
  }

  const preferSystemCoaDefinition = options.preferSystemCoaDefinition !== false;

  const { initializeDefaultPaymentAccounts, ensureCashPaymentAccountEnabled } = await import(
    '@/lib/paymentAccountInitialization'
  );
  await initializeDefaultPaymentAccounts(tenantId, tx);
  await ensureCashPaymentAccountEnabled(tenantId, tx);

  try {
    const { ensureChartOfAccountsForTenant } = await import('@/lib/chartOfAccountsInitialization');
    await ensureChartOfAccountsForTenant(tenantId, tx, { preferSystemCoaDefinition });
  } catch (coaErr) {
    console.error('Chart of accounts initialization failed (fatal):', coaErr?.message || coaErr);
    throw coaErr;
  }

  try {
    const { ensureDefaultTaxAccountsForTenant } = await import('@/lib/taxAccountsInitialization');
    await ensureDefaultTaxAccountsForTenant(tenantId, tx, true);
  } catch (taxErr) {
    console.warn('Default tax accounts initialization failed (non-fatal):', taxErr?.message || taxErr);
  }

  try {
    const { ensureMalawiTaxTypesForTenant } = await import('@/lib/malawiTaxSeed.js');
    await ensureMalawiTaxTypesForTenant(tenantId, tx);
  } catch (seedErr) {
    console.warn('Malawi tax catalog seed failed (non-fatal):', seedErr?.message || seedErr);
  }

  try {
    const nowBlantyre = getCurrentDateInAfricaBlantyre();
    const periodStart = new Date(nowBlantyre.getFullYear(), nowBlantyre.getMonth(), 1, 0, 0, 0, 0);
    const periodEnd = new Date(
      nowBlantyre.getFullYear(),
      nowBlantyre.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const month = periodStart.toLocaleString('en-US', { month: 'short' });
    const periodName = `${month} ${periodStart.getFullYear()}`;

    const existingOverlap = await tx.accountingPeriod.findFirst({
      where: {
        tenantId,
        periodType: 'Monthly',
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
    });

    if (!existingOverlap) {
      await tx.accountingPeriod.create({
        data: {
          tenantId,
          name: periodName,
          periodType: 'Monthly',
          startDate: periodStart,
          endDate: periodEnd,
          status: 'open',
        },
      });
    }
  } catch (periodErr) {
    console.warn('Accounting period initialization failed (non-fatal):', periodErr?.message || periodErr);
  }

  // Canonical V2 financial year (default Jan–Dec). Required for invoice/sales posting.
  // Always use root Prisma client: createFinancialYear opens its own transaction.
  try {
    const { default: prismaRoot } = await import('@/lib/prisma');
    const { provisionTenantFinancialCalendar } = await import(
      '@/lib/accountingV2/periods/ensureFinancialYear.js'
    );
    let ownerUserId = null;
    try {
      const tenant = await (tx.tenant?.findUnique
        ? tx.tenant.findUnique({ where: { id: tenantId }, select: { ownerUserId: true } })
        : prismaRoot.tenant.findUnique({ where: { id: tenantId }, select: { ownerUserId: true } }));
      ownerUserId = tenant?.ownerUserId || null;
    } catch {
      ownerUserId = null;
    }
    await provisionTenantFinancialCalendar(prismaRoot, {
      tenantId,
      userId: ownerUserId || 'system',
      asOfDate: getCurrentDateInAfricaBlantyre(),
    });
  } catch (fyErr) {
    console.warn(
      'V2 financial year provisioning failed (non-fatal; posting will retry ensure):',
      fyErr?.message || fyErr
    );
  }
}
