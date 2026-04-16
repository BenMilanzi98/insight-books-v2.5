import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  buildDefaultSystemCoaPayload,
  validateSystemCoaPayload,
} from '@/lib/systemCoaPayload';

const SYSTEM_COA_ID = 'default';

/**
 * Admin-only: tenant GL accounts, payment accounts, plus default blueprint and saved system definition
 * (read-only catalog for /insightbooks/chart-of-accounts merge planning).
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

    const defaultPayload = buildDefaultSystemCoaPayload();
    const blueprintChartCatalog = (defaultPayload.accounts || []).map((a) => ({
      _inventorySource: 'blueprint',
      code: a.code,
      name: a.name,
      type: a.type,
      subtype: a.subtype ?? null,
      parentCode: a.parentCode ?? null,
      normalBalance: a.normalBalance ?? null,
      isSystem: Boolean(a.isSystem),
      description: a.description ?? null,
    }));

    let savedDefinitionCatalog = [];
    try {
      const defRow = await prisma.systemCoaDefinition.findUnique({
        where: { id: SYSTEM_COA_ID },
        select: { payload: true },
      });
      if (defRow?.payload && typeof defRow.payload === 'object') {
        const v = validateSystemCoaPayload(defRow.payload);
        if (v.ok && Array.isArray(v.payload.accounts)) {
          savedDefinitionCatalog = v.payload.accounts.map((a) => ({
            _inventorySource: 'saved_definition',
            code: a.code,
            name: a.name,
            type: a.type,
            subtype: a.subtype ?? null,
            parentCode: a.parentCode ?? null,
            normalBalance: a.normalBalance ?? null,
            isSystem: Boolean(a.isSystem),
            description: a.description ?? null,
          }));
        }
      }
    } catch (e) {
      console.warn('tenant-accounts: saved definition catalog skipped:', e?.message || e);
    }

    return NextResponse.json({
      meta: {
        chartAccountCount: chartAccounts.length,
        blueprintCatalogCount: blueprintChartCatalog.length,
        savedDefinitionCatalogCount: savedDefinitionCatalog.length,
        combinedGlCatalogCount:
          chartAccounts.length + blueprintChartCatalog.length + savedDefinitionCatalog.length,
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
      blueprintChartCatalog,
      savedDefinitionCatalog,
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
