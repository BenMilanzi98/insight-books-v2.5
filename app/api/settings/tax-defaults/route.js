// app/api/settings/tax-defaults/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { ensureDefaultTaxAccountsForTenant } from '@/lib/taxAccountsInitialization';

/**
 * GET /api/settings/tax-defaults
 * Returns default tax types for inflow (sales/invoices/POS) and outflow (expenses/purchases)
 * based on the tenant's default tax accounts. Used to auto-populate tax selection in forms.
 * Ensures default tax inflow/outflow GL accounts (2041, 2045) exist and are set as tenant defaults
 * before returning, so every user has them even before making a sale.
 */
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const tenantId = String(user.tenantId);

    // Create default tax accounts (2041 Tax Inflow, 2045 Tax Outflow) and set as tenant defaults if not already set
    try {
      await ensureDefaultTaxAccountsForTenant(tenantId, prisma, true);
    } catch (initErr) {
      console.warn('Tax defaults: ensure default tax accounts (non-fatal):', initErr?.message || initErr);
    }

    let taxInflowAccountId = null;
    let taxOutflowAccountId = null;
    try {
      const settings = await prisma.tenantSettings.findFirst({
        where: { tenantId },
        select: { taxInflowAccountId: true, taxOutflowAccountId: true }
      });
      taxInflowAccountId = settings?.taxInflowAccountId ?? null;
      taxOutflowAccountId = settings?.taxOutflowAccountId ?? null;
    } catch (settingsErr) {
      console.warn('Tax defaults: could not load TenantSettings:', settingsErr?.message || settingsErr);
    }

    const accountSelect = { id: true, accountName: true, accountCode: true };

    let defaultTaxTypeForInflow = null;
    let defaultTaxTypeForOutflow = null;
    let activeTaxTypes = [];
    try {
      const inflowPromise = taxInflowAccountId
        ? prisma.taxType.findFirst({
            where: { tenantId, status: 'Active', accountId: taxInflowAccountId },
            include: { account: { select: accountSelect } }
          })
        : Promise.resolve(null);
      const outflowPromise = taxOutflowAccountId
        ? prisma.taxType.findFirst({
            where: { tenantId, status: 'Active', accountId: taxOutflowAccountId },
            include: { account: { select: accountSelect } }
          })
        : Promise.resolve(null);

      const [inflowResult, outflowResult] = await Promise.all([inflowPromise, outflowPromise]);
      defaultTaxTypeForInflow = inflowResult ?? null;
      defaultTaxTypeForOutflow = outflowResult ?? null;

      activeTaxTypes = await prisma.taxType.findMany({
        where: { tenantId, status: 'Active' },
        include: { account: { select: accountSelect } },
        orderBy: { taxRate: 'desc' },
        take: 10
      });
    } catch (taxErr) {
      console.warn('Tax defaults: could not load tax types:', taxErr?.message || taxErr);
    }

    const firstActive = Array.isArray(activeTaxTypes) && activeTaxTypes.length > 0 ? activeTaxTypes[0] : null;
    const defaultInflow = defaultTaxTypeForInflow ?? firstActive ?? null;
    const defaultOutflow = defaultTaxTypeForOutflow ?? firstActive ?? null;

    return NextResponse.json({
      defaultTaxTypeForInflow: defaultInflow,
      defaultTaxTypeForOutflow: defaultOutflow,
      taxInflowAccountId: taxInflowAccountId ?? defaultInflow?.accountId ?? null,
      taxOutflowAccountId: taxOutflowAccountId ?? defaultOutflow?.accountId ?? null
    });
  } catch (error) {
    console.error('Error fetching tax defaults:', error);
    const message = process.env.NODE_ENV === 'development' ? (error?.message || String(error)) : 'Failed to fetch tax defaults';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
