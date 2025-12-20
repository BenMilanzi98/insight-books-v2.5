// app/api/roles/update/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// PUT - Update an existing role
export async function PUT(request) {
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
    const { roleId, ...updateData } = body;

    if (!roleId) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!updateData.name || !updateData.description) {
      return NextResponse.json(
        { error: 'Name and description are required' },
        { status: 400 }
      );
    }

    // Check if the role exists and belongs to the tenant
    const existingRole = await prisma.role.findFirst({
      where: {
        id: roleId,
        tenantId: user.tenantId
      }
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      );
    }

    // Check if name is being changed and if it's already in use
    if (updateData.name && updateData.name !== existingRole.name) {
      const nameExists = await prisma.role.findFirst({
        where: {
          name: updateData.name,
          tenantId: user.tenantId,
          id: { not: roleId }
        }
      });

      if (nameExists) {
        return NextResponse.json(
          { error: 'Role name is already in use' },
          { status: 400 }
        );
      }
    }

    // Update the role
    const updatedRole = await prisma.role.update({
      where: { id: roleId },
      data: {
        name: updateData.name,
        description: updateData.description,
        permissions: updateData.permissions || existingRole.permissions,
        updatedAt: new Date()
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'ROLE_UPDATED',
        entityType: 'ROLE',
        entityId: roleId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          updatedFields: Object.keys(updateData),
          updatedBy: user.email
        })
      }
    });

    return NextResponse.json({
      message: 'Role updated successfully',
      role: updatedRole
    });
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json(
      { error: 'Failed to update role. Please try again.' },
      { status: 500 }
    );
  }
} 