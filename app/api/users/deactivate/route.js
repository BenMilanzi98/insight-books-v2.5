// app/api/users/deactivate/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// POST - Deactivate a user (soft delete)
export async function POST(request) {
  try {
    // Get authenticated user
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if user exists and belongs to the tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: user.tenantId // Ensure tenant isolation
      }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent self-deactivation
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' },
        { status: 400 }
      );
    }

    // Check if user is already deactivated
    if (!existingUser.isActive) {
      return NextResponse.json(
        { error: 'User is already deactivated' },
        { status: 400 }
      );
    }

    // Deactivate the user (soft delete)
    await prisma.user.update({
      where: { id: userId },
      data: { 
        isActive: false,
        status: 'inactive'
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'USER_DEACTIVATED',
        entityType: 'USER',
        entityId: userId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          deactivatedUser: existingUser.email,
          deactivatedBy: user.email,
          reason: 'Soft delete due to related records'
        })
      }
    });

    return NextResponse.json({
      message: 'User deactivated successfully',
      userId: userId,
      action: 'deactivated'
    });
  } catch (error) {
    console.error('Error deactivating user:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate user. Please try again.' },
      { status: 500 }
    );
  }
}






