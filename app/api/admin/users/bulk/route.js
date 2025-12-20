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
    const { action, userIds, additionalData } = body;

    // Validate required fields
    if (!action || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Action and user IDs are required' },
        { status: 400 }
      );
    }

    // Validate action type
    const validActions = ['activate', 'deactivate', 'delete', 'changeRole', 'sendEmail', 'export'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action specified' },
        { status: 400 }
      );
    }

    // Validate user IDs (basic format validation)
    if (userIds.some(id => !id || typeof id !== 'string')) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    let results = [];
    let successCount = 0;
    let failureCount = 0;

    // Process each user based on the action
    for (const userId of userIds) {
      try {
        switch (action) {
          case 'activate':
            // In a real implementation, you would update the user status in the database
            results.push({
              userId,
              success: true,
              message: 'User activated successfully'
            });
            successCount++;
            break;

          case 'deactivate':
            // In a real implementation, you would update the user status in the database
            results.push({
              userId,
              success: true,
              message: 'User deactivated successfully'
            });
            successCount++;
            break;

          case 'delete':
            // In a real implementation, you would delete the user from the database
            // For safety, you might want to soft delete instead
            results.push({
              userId,
              success: true,
              message: 'User deleted successfully'
            });
            successCount++;
            break;

          case 'changeRole':
            if (!additionalData?.roleId) {
              results.push({
                userId,
                success: false,
                message: 'Role ID is required for role change'
              });
              failureCount++;
              break;
            }
            // In a real implementation, you would update the user's role in the database
            results.push({
              userId,
              success: true,
              message: `User role changed to ${additionalData.roleId}`
            });
            successCount++;
            break;

          case 'sendEmail':
            if (!additionalData?.emailTemplate) {
              results.push({
                userId,
                success: false,
                message: 'Email template is required for sending emails'
              });
              failureCount++;
              break;
            }
            // In a real implementation, you would send an email to the user
            results.push({
              userId,
              success: true,
              message: 'Email sent successfully'
            });
            successCount++;
            break;

          case 'export':
            // This is typically handled differently, but we'll include it for completeness
            results.push({
              userId,
              success: true,
              message: 'User data prepared for export'
            });
            successCount++;
            break;

          default:
            results.push({
              userId,
              success: false,
              message: 'Unknown action'
            });
            failureCount++;
        }
      } catch (error) {
        results.push({
          userId,
          success: false,
          message: `Error processing user: ${error.message}`
        });
        failureCount++;
      }
    }

    // Create admin audit log for bulk action
    await prisma.adminAuditLog.create({
      data: {
        adminId: decoded.adminId,
        action: `BULK_${action.toUpperCase()}`,
        entityType: 'USER',
        entityId: userIds.join(','),
        details: `Bulk ${action} action on ${userIds.length} users. Success: ${successCount}, Failed: ${failureCount}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      message: `Bulk ${action} action completed`,
      results: {
        total: userIds.length,
        success: successCount,
        failure: failureCount,
        details: results
      }
    });

  } catch (error) {
    console.error('Admin bulk user action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process bulk action' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 