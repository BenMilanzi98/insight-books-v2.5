import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { syncFinancialDefaultsForAllTenants } from '@/lib/syncFinancialDefaultsForAllTenants';

/**
 * POST /api/admin/tenants/sync-financial-defaults
 * Gap-fill CoA / payment accounts / tax / open period for all (or listed) tenants.
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const preferSystemCoaDefinition = body.preferSystemCoaDefinition !== false;
    const tenantIds = Array.isArray(body.tenantIds) ? body.tenantIds.filter(Boolean) : undefined;

    const result = await syncFinancialDefaultsForAllTenants(prisma, {
      preferSystemCoaDefinition,
      tenantIds,
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'SYNC_TENANT_FINANCIAL_DEFAULTS',
        entityType: 'Tenant',
        entityId: 'all',
        details: JSON.stringify({
          tenantCount: result.tenantCount,
          successCount: result.successCount,
          failureCount: result.failureCount,
          preferSystemCoaDefinition,
          tenantIds: tenantIds ?? null,
        }),
      },
    }).catch((auditErr) => {
      console.warn('sync-financial-defaults audit log failed:', auditErr?.message || auditErr);
    });

    return NextResponse.json({
      success: result.failureCount === 0,
      ...result,
    });
  } catch (error) {
    console.error('admin tenants sync-financial-defaults:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to sync tenant financial defaults' },
      { status: 500 }
    );
  }
}
