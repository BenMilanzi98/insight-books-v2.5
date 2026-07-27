import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { validateLifecycleCommand } from '@/lib/admin/tenantLifecycle';

const COMMAND_PERMISSION = {
  ACTIVATE: SYSTEM_ADMIN_PERMISSIONS.tenants.activate,
  SUSPEND: SYSTEM_ADMIN_PERMISSIONS.tenants.suspend,
  REACTIVATE: SYSTEM_ADMIN_PERMISSIONS.tenants.reactivate,
  ARCHIVE: SYSTEM_ADMIN_PERMISSIONS.tenants.archive,
};

function clientMeta(request) {
  return {
    ipAddress:
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

/**
 * POST /api/admin/tenants/[tenantId]/lifecycle
 * Body: { command: 'ACTIVATE'|'SUSPEND'|'REACTIVATE'|'ARCHIVE', reason?: string }
 * Soft status transitions only — never hard-deletes tenants.
 */
export async function POST(request, { params }) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId } = await params;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'tenantId is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const command = String(body?.command || '').toUpperCase();
    const reason = body?.reason != null ? String(body.reason) : '';

    const requiredPerm = COMMAND_PERMISSION[command];
    if (!requiredPerm) {
      return NextResponse.json(
        { success: false, error: 'Unknown tenant command' },
        { status: 400 }
      );
    }

    if (!adminHasPermission(admin, requiredPerm)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, status: true },
    });

    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    const validation = validateLifecycleCommand({
      command,
      reason,
      currentStatus: tenant.status,
    });

    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const previousStatus = tenant.status;
    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: validation.nextStatus },
      select: { id: true, name: true, status: true, updatedAt: true },
    });

    const meta = clientMeta(request);
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: `TENANT_${command}`,
        entityType: 'TENANT',
        entityId: tenantId,
        details: JSON.stringify({
          command,
          reason: String(reason || '').trim() || null,
          previousStatus,
          nextStatus: validation.nextStatus,
          tenantName: tenant.name,
        }),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return NextResponse.json({
      success: true,
      tenant: updated,
      command,
      previousStatus,
      nextStatus: validation.nextStatus,
    });
  } catch (error) {
    console.error('Tenant lifecycle error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update tenant lifecycle',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
