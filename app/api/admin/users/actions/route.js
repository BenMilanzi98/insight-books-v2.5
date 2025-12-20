import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    // Verify admin authentication
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 403 }
      );
    }

    if (!decoded.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, userId, additionalData } = body;

    // Validate required fields
    if (!action || !userId) {
      return NextResponse.json(
        { success: false, error: 'Action and user ID are required' },
        { status: 400 }
      );
    }

    // Validate action type
    const validActions = ['activate', 'deactivate', 'resetPassword', 'sendEmail', 'changeRole', 'suspend', 'unsuspend'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action specified' },
        { status: 400 }
      );
    }

    // Validate user ID format
    if (typeof userId !== 'string' || !userId.trim()) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    let result = {};
    let auditAction = '';
    let auditDetails = '';

    // Process the action
    switch (action) {
      case 'activate':
        // In a real implementation, you would update the user status in the database
        result = {
          success: true,
          message: 'User activated successfully',
          userId,
          status: 'active'
        };
        auditAction = 'USER_ACTIVATE';
        auditDetails = 'User account activated';
        break;

      case 'deactivate':
        // In a real implementation, you would update the user status in the database
        result = {
          success: true,
          message: 'User deactivated successfully',
          userId,
          status: 'inactive'
        };
        auditAction = 'USER_DEACTIVATE';
        auditDetails = 'User account deactivated';
        break;

      case 'resetPassword':
        // In a real implementation, you would generate a new password and send it to the user
        const newPassword = generateTemporaryPassword();
        result = {
          success: true,
          message: 'Password reset successfully',
          userId,
          newPassword: newPassword, // In production, this should be sent via email only
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        };
        auditAction = 'USER_PASSWORD_RESET';
        auditDetails = 'User password reset initiated';
        break;

      case 'sendEmail':
        if (!additionalData?.emailTemplate || !additionalData?.subject) {
          return NextResponse.json(
            { success: false, error: 'Email template and subject are required' },
            { status: 400 }
          );
        }
        // In a real implementation, you would send an email to the user
        result = {
          success: true,
          message: 'Email sent successfully',
          userId,
          emailSent: true,
          template: additionalData.emailTemplate,
          subject: additionalData.subject
        };
        auditAction = 'USER_EMAIL_SENT';
        auditDetails = `Email sent to user: ${additionalData.subject}`;
        break;

      case 'changeRole':
        if (!additionalData?.roleId) {
          return NextResponse.json(
            { success: false, error: 'Role ID is required for role change' },
            { status: 400 }
          );
        }
        // In a real implementation, you would update the user's role in the database
        result = {
          success: true,
          message: 'User role changed successfully',
          userId,
          newRoleId: additionalData.roleId,
          previousRoleId: additionalData.previousRoleId || 'unknown'
        };
        auditAction = 'USER_ROLE_CHANGE';
        auditDetails = `User role changed from ${additionalData.previousRoleId || 'unknown'} to ${additionalData.roleId}`;
        break;

      case 'suspend':
        if (!additionalData?.reason) {
          return NextResponse.json(
            { success: false, error: 'Suspension reason is required' },
            { status: 400 }
          );
        }
        // In a real implementation, you would suspend the user in the database
        result = {
          success: true,
          message: 'User suspended successfully',
          userId,
          status: 'suspended',
          reason: additionalData.reason,
          suspendedUntil: additionalData.suspendedUntil || null
        };
        auditAction = 'USER_SUSPEND';
        auditDetails = `User suspended. Reason: ${additionalData.reason}`;
        break;

      case 'unsuspend':
        // In a real implementation, you would unsuspend the user in the database
        result = {
          success: true,
          message: 'User unsuspended successfully',
          userId,
          status: 'active'
        };
        auditAction = 'USER_UNSUSPEND';
        auditDetails = 'User suspension removed';
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

    // Create admin audit log for the action
    await prisma.adminAuditLog.create({
      data: {
        adminId: decoded.adminId,
        action: auditAction,
        entityType: 'USER',
        entityId: userId,
        details: auditDetails,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Admin user action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process user action' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to generate temporary passwords
function generateTemporaryPassword(length = 12) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
} 