import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';

/**
 * Admin-only: all tenant-scoped GL accounts and payment accounts (read-only inventory)
 * for reconciling the system chart template against real tenant data.
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantIdFilter = searchParams.get('tenantId')?.trim() || null;

    const tenantWhere = tenantIdFilter ? { id: tenantIdFilter } : {};

    const [chartAccounts, paymentAccounts, tenantSummaries] = await Promise.all([
      prisma.account.findMany({
        where: {
          tenantId: { not: null },
          ...(tenantIdFilter ? { tenantId: tenantIdFilter } : {}),
        },
        select: {
          id: true,
          tenantId: true,
          accountCode: true,
          accountName: true,
          accountType: true,
          accountSubtype: true,
          normalBalance: true,
          isActive: true,
          isSystem: true,
          mergedIntoAccountId: true,
          parentAccountId: true,
          description: true,
          tenant: { select: { name: true, subdomain: true, status: true } },
          mergedIntoAccount: {
            select: { id: true, accountCode: true, accountName: true },
          },
          parentAccount: {
            select: { id: true, accountCode: true, accountName: true },
          },
        },
        orderBy: [{ tenantId: 'asc' }, { accountCode: 'asc' }],
      }),
      prisma.paymentAccount.findMany({
        where: tenantIdFilter ? { tenantId: tenantIdFilter } : {},
        select: {
          id: true,
          tenantId: true,
          name: true,
          accountType: true,
          reference: true,
          isActive: true,
          isSystem: true,
          coaAccountId: true,
          tenant: { select: { name: true, subdomain: true, status: true } },
          coaAccount: {
            select: { id: true, accountCode: true, accountName: true, accountType: true },
          },
        },
        orderBy: [{ tenantId: 'asc' }, { name: 'asc' }],
      }),
      prisma.tenant.findMany({
        where: tenantWhere,
        select: {
          id: true,
          name: true,
          subdomain: true,
          status: true,
          _count: {
            select: { accounts: true, paymentAccounts: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const tenantIds = new Set([
      ...chartAccounts.map((a) => a.tenantId),
      ...paymentAccounts.map((p) => p.tenantId),
    ]);

    return NextResponse.json({
      meta: {
        chartAccountCount: chartAccounts.length,
        paymentAccountCount: paymentAccounts.length,
        tenantCount: tenantSummaries.length,
        distinctTenantIdsInRows: tenantIds.size,
        filteredByTenantId: tenantIdFilter,
      },
      tenants: tenantSummaries.map((t) => ({
        id: t.id,
        name: t.name,
        subdomain: t.subdomain,
        status: t.status,
        chartAccountCount: t._count.accounts,
        paymentAccountCount: t._count.paymentAccounts,
      })),
      chartAccounts,
      paymentAccounts,
    });
  } catch (error) {
    console.error('admin system-coa tenant-accounts GET:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load tenant accounts' },
      { status: 500 }
    );
  }
}
