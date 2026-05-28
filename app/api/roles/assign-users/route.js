// app/api/roles/assign-users/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';

// POST - Assign users to a role
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'roles.assign');
    if (perm) return perm;

    // Get authenticated user and ensure tenant isolation
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    
    const { roleId, userIds } = await request.json();
    
    // Validate inputs
    if (!roleId) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'User IDs are required' },
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
    
    // Check if all users belong to the same tenant
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: userIds
        }
      },
      select: {
        id: true,
        tenantId: true
      }
    });
    
    const invalidUsers = users.filter(u => u.tenantId !== user.tenantId);
    
    if (invalidUsers.length > 0) {
      return NextResponse.json(
        { error: 'One or more users do not belong to your tenant' },
        { status: 400 }
      );
    }

    const tenantUserIds = users.map((u) => u.id);
    if (tenantUserIds.length !== userIds.length) {
      return NextResponse.json(
        { error: 'One or more users were not found' },
        { status: 400 }
      );
    }
    
    await prisma.$transaction(async (tx) => {
      // Keep both legacy User.roleId and tenant-scoped membership role aligned.
      await tx.user.updateMany({
        where: {
          id: {
            in: tenantUserIds
          },
          tenantId: user.tenantId
        },
        data: {
          roleId: roleId
        }
      });

      const existingMemberships = await tx.tenantMembership.findMany({
        where: {
          userId: { in: tenantUserIds },
          tenantId: user.tenantId,
        },
        select: { userId: true },
      });
      const existingMembershipUserIds = new Set(existingMemberships.map((m) => m.userId));

      await tx.tenantMembership.updateMany({
        where: {
          userId: { in: tenantUserIds },
          tenantId: user.tenantId,
        },
        data: {
          roleId,
          status: 'active',
        },
      });

      const missingMemberships = tenantUserIds.filter((userId) => !existingMembershipUserIds.has(userId));
      if (missingMemberships.length > 0) {
        await tx.tenantMembership.createMany({
          data: missingMemberships.map((userId) => ({
            userId,
            tenantId: user.tenantId,
            roleId,
            status: 'active',
          })),
          skipDuplicates: true,
        });
      }
    });
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'USERS_ASSIGNED_TO_ROLE',
        entityType: 'ROLE',
        entityId: roleId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          roleName: existingRole.name,
          userCount: tenantUserIds.length,
          userIds: tenantUserIds
        })
      }
    });
    
    return NextResponse.json({
      message: 'Users assigned to role successfully',
      role: existingRole.name,
      userCount: tenantUserIds.length
    });
  } catch (error) {
    console.error('Error assigning users to role:', error);
    return NextResponse.json(
      { error: 'Failed to assign users to role. Please try again.' },
      { status: 500 }
    );
  }
} 