import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { validateLifecycleCommand } from '@/lib/admin/tenantLifecycle';

/**
 * POST /api/admin/tenants/delete
 * Soft-archives the tenant. Hard-delete of billed/historical tenants is prohibited.
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.tenants.archive)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const tenantId = body.tenantId;
    const reason =
      String(body.reason || '').trim() ||
      'Archived via delete endpoint (soft-archive; data preserved)';

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, status: true },
    });

    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    if (String(tenant.status).toUpperCase() === 'ARCHIVED') {
      return NextResponse.json({
        success: true,
        message: 'Tenant is already archived',
        tenant,
        archived: true,
      });
    }

    const validation = validateLifecycleCommand({
      command: 'ARCHIVE',
      reason,
      currentStatus: tenant.status,
    });

    if (!validation.ok) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
          hint: 'Hard delete is prohibited. Suspend then archive, or use the lifecycle ARCHIVE command.',
        },
        { status: 400 }
      );
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: validation.nextStatus },
      select: { id: true, name: true, status: true },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'TENANT_ARCHIVE',
        entityType: 'TENANT',
        entityId: tenantId,
        details: JSON.stringify({
          previousStatus: tenant.status,
          nextStatus: validation.nextStatus,
          reason,
          hardDelete: false,
        }),
        ipAddress:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Tenant archived successfully. Historical data was preserved.',
      tenant: updated,
      archived: true,
    });
  } catch (error) {
    console.error('Error archiving tenant:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to archive tenant' },
      { status: 500 }
    );
  }
}
