import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { buildTenantIdentityPackage } from '@/lib/admin/tenantIdentity';

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const mode = body.mode || 'active';
    if (!['active', 'paid_inactive', 'specific'].includes(mode)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mode. Use active, paid_inactive, or specific.' },
        { status: 400 }
      );
    }

    const pkg = await buildTenantIdentityPackage(
      {
        mode,
        tenantId: body.tenantId,
        subdomain: body.subdomain,
        previewOnly: Boolean(body.previewOnly),
        sourceApp: 'v2.5',
      },
      prisma
    );

    try {
      await prisma.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'TENANT_IDENTITY_EXPORTED',
          entityType: 'TENANT_IDENTITY_PACKAGE',
          entityId: mode,
          details: JSON.stringify({
            mode,
            previewOnly: Boolean(body.previewOnly),
            tenantCount: pkg.preview?.length || pkg.tenants?.length || 0,
            tenantIds: (pkg.preview || []).map((t) => t.id),
          }),
        },
      });
    } catch (auditErr) {
      console.warn('tenant-identity export audit failed:', auditErr?.message);
    }

    return NextResponse.json({ success: true, package: pkg });
  } catch (error) {
    console.error('tenant-identity export error:', error);
    const status = error?.code === 'INVALID_FILTER' ? 400 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Export failed' },
      { status }
    );
  }
}
