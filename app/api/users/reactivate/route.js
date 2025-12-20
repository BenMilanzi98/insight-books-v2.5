// app/api/users/reactivate/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// POST - Reactivate a user
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

    // Check if user is already active
    if (existingUser.isActive) {
      return NextResponse.json(
        { error: 'User is already active' },
        { status: 400 }
      );
    }

    // Reactivate the user
    await prisma.user.update({
      where: { id: userId },
      data: { 
        isActive: true,
        status: 'active'
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'USER_REACTIVATED',
        entityType: 'USER',
        entityId: userId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          reactivatedUser: existingUser.email,
          reactivatedBy: user.email
        })
      }
    });

    return NextResponse.json({
      message: 'User reactivated successfully',
      userId: userId,
      action: 'reactivated'
    });
  } catch (error) {
    console.error('Error reactivating user:', error);
    return NextResponse.json(
      { error: 'Failed to reactivate user. Please try again.' },
      { status: 500 }
    );
  }
}






