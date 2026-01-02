// app/api/users/delete/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// DELETE - Delete a user
export async function DELETE(request) {
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

    // Prevent self-deletion
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Soft delete the user by deactivating them (keeps all records intact)
    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        status: 'deleted'
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'USER_DELETED',
        entityType: 'USER',
        entityId: userId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          deletedUser: existingUser.email,
          deletedBy: user.email,
          action: 'soft_delete'
        })
      }
    });

    return NextResponse.json({
      message: 'User deleted successfully (soft delete - records preserved)'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user. Please try again.' },
      { status: 500 }
    );
  }
}
