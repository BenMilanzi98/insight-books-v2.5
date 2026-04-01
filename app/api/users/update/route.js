// app/api/users/update/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { userHasAccessToTenant } from '@/lib/tenantStockAccess';

// PUT - Update a user
export async function PUT(request) {
  try {
    const perm = await requirePermission(request, 'users.update');
    if (perm) return perm;

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
    if (updateData.defaultBranchId !== undefined) dataToUpdate.defaultBranchId = updateData.defaultBranchId || null;

    // Hash password if provided
    if (updateData.password) {
      dataToUpdate.password = await bcrypt.hash(updateData.password, 10);
    }

    // Sync allowed branches (user-branch assignment): empty array = all branches, non-empty = restrict to those
    const allowedBranchIds = updateData.allowedBranchIds;
    if (Array.isArray(allowedBranchIds)) {
      await prisma.userBranch.deleteMany({ where: { userId } });
      if (allowedBranchIds.length > 0) {
        const validBranchIds = await prisma.branch.findMany({
          where: { id: { in: allowedBranchIds }, tenantId: user.tenantId },
          select: { id: true }
        });
        const ids = validBranchIds.map((b) => b.id);
        if (ids.length > 0) {
          await prisma.userBranch.createMany({
            data: ids.map((branchId) => ({ userId, branchId }))
          });
        }
      }
    }

    // Multi-business memberships (role per business)
    if (Array.isArray(updateData.memberships)) {
      const requested = updateData.memberships;

      const finalMemberships = [];
      for (const m of requested) {
        const tId = String(m?.tenantId || '').trim();
        const rId = String(m?.roleId || '').trim();
        if (!tId || !rId) continue;
        const ok = await userHasAccessToTenant(user, tId);
        if (ok) finalMemberships.push({ tenantId: tId, roleId: rId });
      }

      try {
        // Validate roles belong to their tenants
        for (const m of finalMemberships) {
          const role = await prisma.role.findFirst({
            where: { id: m.roleId, tenantId: m.tenantId },
            select: { id: true },
          });
          if (!role) {
            throw new Error('Invalid role assignment for selected business');
          }
        }

        await prisma.tenantMembership.deleteMany({ where: { userId } });
        if (finalMemberships.length > 0) {
          await prisma.tenantMembership.createMany({
            data: finalMemberships.map((m) => ({
              userId,
              tenantId: m.tenantId,
              roleId: m.roleId,
              status: 'active',
            })),
          });
        }

        // Keep legacy join table in sync
        await prisma.user.update({
          where: { id: userId },
          data: {
            tenants: {
              set: finalMemberships.map((m) => ({ id: m.tenantId })),
            },
          },
          select: { id: true },
        });
      } catch (membershipWriteError) {
        console.warn('Skipping membership updates (legacy DB / not deployed yet):', membershipWriteError?.message || membershipWriteError);
      }
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