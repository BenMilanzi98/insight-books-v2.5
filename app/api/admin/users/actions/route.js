import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { guardAdminMutation } from '@/lib/admin/superAdminProtection';

const ACTION_PERMISSION = {
  activate: SYSTEM_ADMIN_PERMISSIONS.users.edit,
  deactivate: SYSTEM_ADMIN_PERMISSIONS.users.suspend,
  suspend: SYSTEM_ADMIN_PERMISSIONS.users.suspend,
  unsuspend: SYSTEM_ADMIN_PERMISSIONS.users.unlock,
  lock: SYSTEM_ADMIN_PERMISSIONS.users.lock,
  unlock: SYSTEM_ADMIN_PERMISSIONS.users.unlock,
  resetPassword: SYSTEM_ADMIN_PERMISSIONS.users.resetPassword,
  revokeSessions: SYSTEM_ADMIN_PERMISSIONS.users.revokeSessions,
  requireMfa: SYSTEM_ADMIN_PERMISSIONS.users.edit,
  changeRole: SYSTEM_ADMIN_PERMISSIONS.users.assignRole,
  sendEmail: SYSTEM_ADMIN_PERMISSIONS.users.edit,
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

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, userId, additionalData, targetType } = body;

    if (!action || !userId) {
      return NextResponse.json(
        { success: false, error: 'Action and user ID are required' },
        { status: 400 }
      );
    }

    const requiredPerm = ACTION_PERMISSION[action];
    if (!requiredPerm) {
      return NextResponse.json(
        { success: false, error: 'Invalid action specified' },
        { status: 400 }
      );
    }

    if (!adminHasPermission(admin, requiredPerm)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const meta = clientMeta(request);

    // Platform Admin mutations (Super Admin protection)
    if (targetType === 'admin') {
      const guardAction =
        action === 'deactivate' || action === 'suspend' || action === 'lock'
          ? 'lock'
          : action === 'changeRole'
            ? 'demote'
            : null;

      if (guardAction) {
        const guard = await guardAdminMutation(prisma, userId, guardAction);
        if (!guard.ok) {
          return NextResponse.json(
            { success: false, error: guard.error },
            { status: guard.status || 409 }
          );
        }
      }

      let adminUpdate = {};
      let auditAction = `ADMIN_${String(action).toUpperCase()}`;

      switch (action) {
        case 'activate':
        case 'unsuspend':
        case 'unlock':
          adminUpdate = { isActive: true };
          break;
        case 'deactivate':
        case 'suspend':
        case 'lock':
          adminUpdate = { isActive: false };
          break;
        case 'changeRole':
          if (!additionalData?.role) {
            return NextResponse.json(
              { success: false, error: 'Role is required' },
              { status: 400 }
            );
          }
          adminUpdate = { role: String(additionalData.role) };
          break;
        default:
          return NextResponse.json(
            { success: false, error: 'Action not supported for platform admins' },
            { status: 400 }
          );
      }

      const updated = await prisma.admin.update({
        where: { id: userId },
        data: adminUpdate,
        select: { id: true, email: true, name: true, role: true, isActive: true },
      });

      await prisma.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: auditAction,
          entityType: 'ADMIN',
          entityId: userId,
          details: JSON.stringify({ action, additionalData: additionalData || null }),
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Administrator ${action} completed`,
        admin: updated,
      });
    }

    // Tenant User mutations
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        isActive: true,
        mfaEnabled: true,
        tenantId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    let data = {};
    let message = '';
    let extra = {};

    switch (action) {
      case 'activate':
      case 'unsuspend':
      case 'unlock':
        data = { isActive: true, status: 'active' };
        message = 'User unlocked / activated';
        break;
      case 'deactivate':
        data = { isActive: false, status: 'inactive' };
        message = 'User deactivated';
        break;
      case 'suspend':
      case 'lock':
        data = { isActive: false, status: action === 'lock' ? 'locked' : 'suspended' };
        message = action === 'lock' ? 'User locked' : 'User suspended';
        break;
      case 'requireMfa':
        data = { mfaEnabled: true };
        message = 'MFA required for user';
        break;
      case 'resetPassword': {
        // Require password reset via opaque token — never return a password to the browser.
        const resetToken = randomBytes(32).toString('hex');
        data = {
          resetToken,
          resetTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
        };
        message =
          'Password reset required. A time-limited reset token was stored server-side and is not returned to the browser.';
        extra = {
          passwordReset: true,
          requirePasswordReset: true,
        };
        break;
      }
      case 'revokeSessions':
        // No dedicated session table for tenant users in all deployments —
        // bump updatedAt + clear reset tokens as a soft session invalidation signal.
        data = {
          resetToken: null,
          resetTokenExpiry: null,
          otpCode: null,
          otpExpiry: null,
        };
        message = 'User session credentials revoked';
        extra = { sessionsRevoked: true };
        break;
      case 'changeRole':
        if (!additionalData?.roleId) {
          return NextResponse.json(
            { success: false, error: 'roleId is required' },
            { status: 400 }
          );
        }
        data = { roleId: String(additionalData.roleId) };
        message = 'User role updated';
        break;
      case 'sendEmail':
        return NextResponse.json(
          {
            success: false,
            error: 'Use Email Management to send messages. This action no longer simulates send.',
          },
          { status: 400 }
        );
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action specified' },
          { status: 400 }
        );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        isActive: true,
        mfaEnabled: true,
        tenantId: true,
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: `USER_${String(action).toUpperCase()}`,
        entityType: 'USER',
        entityId: userId,
        details: JSON.stringify({
          action,
          previousStatus: user.status,
          nextStatus: updated.status,
        }),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return NextResponse.json({
      success: true,
      message,
      user: updated,
      ...extra,
    });
  } catch (error) {
    console.error('Admin user action error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process user action',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
