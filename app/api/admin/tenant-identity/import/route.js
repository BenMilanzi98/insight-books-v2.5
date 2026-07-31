import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { importTenantIdentityPackage } from '@/lib/admin/tenantIdentity';

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const pkg = body.package || body;
    const result = await importTenantIdentityPackage(pkg, { commit: true }, prisma);

    try {
      await prisma.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'TENANT_IDENTITY_IMPORTED',
          entityType: 'TENANT_IDENTITY_PACKAGE',
          entityId: 'import',
          details: JSON.stringify({
            summary: result.summary,
            outcomes: (result.tenants || []).map((t) => ({
              tenantId: t.tenantId,
              subdomain: t.subdomain,
              outcome: t.outcome,
            })),
          }),
        },
      });
    } catch (auditErr) {
      console.warn('tenant-identity import audit failed:', auditErr?.message);
    }

    return NextResponse.json({ success: result.success, ...result });
  } catch (error) {
    console.error('tenant-identity import error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
