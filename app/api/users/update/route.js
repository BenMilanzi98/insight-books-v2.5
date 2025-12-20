// app/api/users/update/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { getUserFromSession } from '@/lib/auth';

// PUT - Update a user
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
    const { userId, ...updateData } = body;

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

    // Check if email is being changed and if it's already in use
    if (updateData.email && updateData.email !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: updateData.email,
          tenantId: user.tenantId,
          id: { not: userId }
        }
      });

      if (emailExists) {
        return NextResponse.json(
          { error: 'Email is already in use' },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const dataToUpdate = {};

    // Only include fields that are provided in the request
    if (updateData.name !== undefined) dataToUpdate.name = updateData.name;
    if (updateData.email !== undefined) dataToUpdate.email = updateData.email;
    if (updateData.role !== undefined) {
      // Handle role assignment using Prisma connect syntax
      dataToUpdate.role = {
        connect: {
          id: updateData.role
        }
      };
    }
    if (updateData.department !== undefined) dataToUpdate.department = updateData.department;
    if (updateData.status !== undefined) dataToUpdate.status = updateData.status;

    // Hash password if provided
    if (updateData.password) {
      dataToUpdate.password = await bcrypt.hash(updateData.password, 10);
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'USER_UPDATED',
        entityType: 'USER',
        entityId: userId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          updatedFields: Object.keys(dataToUpdate),
          updatedBy: user.email
        })
      }
    });

    // Return updated user without sensitive info
    const { password, otpCode, otpExpiry, ...userWithoutSensitiveInfo } = updatedUser;

    return NextResponse.json({
      message: 'User updated successfully',
      user: userWithoutSensitiveInfo
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user. Please try again.' },
      { status: 500 }
    );
  }
} 