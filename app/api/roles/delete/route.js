// app/api/roles/delete/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// DELETE - Delete a role
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
    const { roleId } = body;

    if (!roleId) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    // Check if the role exists and belongs to the tenant
    const existingRole = await prisma.role.findFirst({
      where: {
        id: roleId,
        tenantId: user.tenantId
      },
      include: {
        _count: {
          select: { users: true }
        }
      }
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      );
    }

    // Check if role has users assigned
    if (existingRole._count.users > 0) {
      return NextResponse.json(
        { error: 'Cannot delete role with assigned users. Please reassign users first.' },
        { status: 400 }
      );
    }

    // Delete the role
    await prisma.role.delete({
      where: { id: roleId }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'ROLE_DELETED',
        entityType: 'ROLE',
        entityId: roleId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          deletedRole: existingRole.name,
          deletedBy: user.email
        })
      }
    });

    return NextResponse.json({
      message: 'Role deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json(
      { error: 'Failed to delete role. Please try again.' },
      { status: 500 }
    );
  }
} 