import { NextResponse } from 'next/server';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import prisma from '@/lib/prisma';

/**
 * Soft-delete a tenant user.
 * Hard delete is unsafe: users are FK parents of sales, journals, invoices, etc.
 * Soft delete deactivates the account, frees the email unique slot, and preserves history.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.users.archive)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
      },
    });

    if (!existingUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (existingUser.status === 'deleted') {
      return NextResponse.json({
        success: true,
        message: 'User already deleted',
      });
    }

    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const stamp = Date.now();
    // Keep email unique per tenant after soft delete (@@unique([tenantId, email])).
    const freedEmail = `deleted+${stamp}.${existingUser.email}`.slice(0, 190);

    await prisma.$transaction(async (tx) => {
      await tx.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'USER_SOFT_DELETE',
          entityType: 'USER',
          entityId: userId,
          details: `Soft-deleted user: ${existingUser.name} (${existingUser.email}) from tenant: ${existingUser.tenant?.name || 'Unknown'}`,
          ipAddress,
          userAgent,
          timestamp: new Date(),
        },
      });

      await tx.tenant.updateMany({
        where: { ownerUserId: userId },
        data: { ownerUserId: null },
      });

      if (tx.tenantMembership) {
        await tx.tenantMembership.deleteMany({ where: { userId } });
      }
      if (tx.userBranch) {
        await tx.userBranch.deleteMany({ where: { userId } });
      }

      // Drop many-to-many tenant membership join if present
      try {
        await tx.user.update({
          where: { id: userId },
          data: {
            tenants: { set: [] },
          },
        });
      } catch {
        /* relation may not support set on this client shape */
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          status: 'deleted',
          email: freedEmail,
          resetToken: null,
          resetTokenExpiry: null,
          otpCode: null,
          otpExpiry: null,
          defaultBranchId: null,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete user: ' + (error?.message || 'Unknown error'),
      },
      { status: 500 }
    );
  }
}
