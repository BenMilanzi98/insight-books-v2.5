// app/api/users/update/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { userHasAccessToTenant } from '@/lib/tenantStockAccess';

function normalizeRoleId(role) {
  if (role == null) return null;
  if (typeof role === 'string') return role.trim() || null;
  if (typeof role === 'object' && typeof role.id === 'string') return role.id.trim() || null;
  return null;
}

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

    // Same email may exist in other tenants; only block duplicates within this business.
    if (updateData.email && updateData.email !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: { equals: String(updateData.email).trim(), mode: 'insensitive' },
          tenantId: user.tenantId,
          id: { not: userId },
        },
      });

      if (emailExists) {
        return NextResponse.json(
          { error: 'This email is already in use for another user in this business' },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const dataToUpdate = {};
    let selectedRoleId = null;

    // Only include fields that are provided in the request
    if (updateData.name !== undefined) dataToUpdate.name = updateData.name;
    if (updateData.email !== undefined) dataToUpdate.email = updateData.email;
    if (updateData.role !== undefined) {
      const roleId = normalizeRoleId(updateData.role);
      if (!roleId) {
        return NextResponse.json(
          { error: 'Invalid role value' },
          { status: 400 }
        );
      }
      const roleRow = await prisma.role.findFirst({
        where: {
          id: roleId,
          OR: [{ tenantId: user.tenantId }, { tenantId: null }],
        },
        select: { id: true },
      });
      if (!roleRow) {
        return NextResponse.json(
          { error: 'Invalid role for this business' },
          { status: 400 }
        );
      }
      selectedRoleId = roleId;
      dataToUpdate.role = { connect: { id: roleId } };
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
      const uniqueBranchIds = [...new Set(allowedBranchIds.filter((id) => typeof id === 'string' && id.trim()))];
      await prisma.userBranch.deleteMany({ where: { userId } });
      if (uniqueBranchIds.length > 0) {
        const validBranchIds = await prisma.branch.findMany({
          where: { id: { in: uniqueBranchIds }, tenantId: user.tenantId },
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

      const byTenant = new Map();
      for (const m of requested) {
        const tId = String(m?.tenantId || '').trim();
        const rId = String(m?.roleId || '').trim();
        if (!tId || !rId) continue;
        const ok = await userHasAccessToTenant(user, tId);
        if (ok) byTenant.set(tId, { tenantId: tId, roleId: rId });
      }
      const finalMemberships = [...byTenant.values()];
      const fallbackRoleId = selectedRoleId || existingUser.roleId;
      if (!finalMemberships.some((m) => m.tenantId === user.tenantId) && fallbackRoleId) {
        finalMemberships.unshift({ tenantId: user.tenantId, roleId: fallbackRoleId });
      }

      for (const m of finalMemberships) {
        const role = await prisma.role.findFirst({
          where: {
            id: m.roleId,
            OR: [{ tenantId: m.tenantId }, { tenantId: null }],
          },
          select: { id: true },
        });
        if (!role) {
          return NextResponse.json(
            { error: 'Invalid role assignment for selected business' },
            { status: 400 }
          );
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.tenantMembership.deleteMany({ where: { userId } });
        if (finalMemberships.length > 0) {
          await tx.tenantMembership.createMany({
            data: finalMemberships.map((m) => ({
              userId,
              tenantId: m.tenantId,
              roleId: m.roleId,
              status: 'active',
            })),
          });
        }
        await tx.user.update({
          where: { id: userId },
          data: {
            tenants: {
              set: finalMemberships.map((m) => ({ id: m.tenantId })),
            },
          },
          select: { id: true },
        });
      });
    } else if (selectedRoleId) {
      // When only role is changed, keep tenant membership role aligned for active tenant.
      await prisma.tenantMembership.upsert({
        where: {
          userId_tenantId: {
            userId,
            tenantId: user.tenantId,
          },
        },
        update: {
          roleId: selectedRoleId,
          status: 'active',
        },
        create: {
          userId,
          tenantId: user.tenantId,
          roleId: selectedRoleId,
          status: 'active',
        },
      });
    }

    const roleInclude = {
      role: {
        select: {
          id: true,
          name: true,
          description: true
        }
      }
    };

    // Prisma rejects user.update with an empty data object
    const updatedUser =
      Object.keys(dataToUpdate).length > 0
        ? await prisma.user.update({
            where: { id: userId },
            data: dataToUpdate,
            include: roleInclude,
          })
        : await prisma.user.findUnique({
            where: { id: userId },
            include: roleInclude,
          });

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
    const code = error?.code;
    if (code === 'P2002') {
      return NextResponse.json(
        { error: 'This update conflicts with existing data (duplicate).' },
        { status: 400 }
      );
    }
    if (code === 'P2003') {
      return NextResponse.json(
        { error: 'Invalid reference in update.' },
        { status: 400 }
      );
    }
    const allowDetail = process.env.NODE_ENV !== 'production';
    return NextResponse.json(
      {
        error: 'Failed to update user. Please try again.',
        ...(allowDetail && error?.message ? { detail: String(error.message) } : {}),
      },
      { status: 500 }
    );
  }
} 