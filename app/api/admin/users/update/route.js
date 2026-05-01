import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

function normalizeMemberships(memberships, legacyTenantId, legacyRoleId) {
  if (Array.isArray(memberships) && memberships.length > 0) {
    const byTenant = new Map();
    for (const m of memberships) {
      const tid = m?.tenantId;
      const rid = m?.roleId;
      if (!tid || !rid) continue;
      if (!byTenant.has(tid)) byTenant.set(tid, { tenantId: tid, roleId: rid });
    }
    return [...byTenant.values()];
  }
  if (legacyTenantId && legacyRoleId) {
    return [{ tenantId: legacyTenantId, roleId: legacyRoleId }];
  }
  return [];
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, ...updateData } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const {
      name,
      email,
      phone,
      role,
      status,
      tenantId,
      memberships,
      primaryTenantId,
      defaultBranchId,
      allowedBranchIds,
    } = updateData;

    if (!name || !email || !status) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: name, email, and status are required',
        },
        { status: 400 }
      );
    }

    const cleaned = normalizeMemberships(memberships, tenantId, role);
    if (cleaned.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'At least one business with a role is required (memberships or tenant + role)',
        },
        { status: 400 }
      );
    }

    const primaryTid =
      primaryTenantId && cleaned.some((x) => x.tenantId === primaryTenantId)
        ? primaryTenantId
        : cleaned[0].tenantId;
    const primaryRow = cleaned.find((x) => x.tenantId === primaryTid) || cleaned[0];

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (String(email).trim().toLowerCase() !== String(existingUser.email).toLowerCase()) {
      const emailConflict = await prisma.user.findFirst({
        where: {
          email: { equals: String(email).trim(), mode: 'insensitive' },
          tenantId: primaryTid,
          id: { not: userId },
        },
      });

      if (emailConflict) {
        return NextResponse.json(
          {
            success: false,
            error: 'A user with this email already exists in the primary business',
          },
          { status: 400 }
        );
      }
    }

    const primaryTenant = await prisma.tenant.findUnique({
      where: { id: primaryTid },
      select: { id: true, name: true },
    });

    if (!primaryTenant) {
      return NextResponse.json({ success: false, error: 'Primary tenant not found' }, { status: 404 });
    }

    for (const m of cleaned) {
      const r = await prisma.role.findUnique({
        where: { id: m.roleId },
        select: { id: true, tenantId: true },
      });
      if (!r || r.tenantId !== m.tenantId) {
        return NextResponse.json(
          {
            success: false,
            error: `Role does not belong to the selected business (tenant ${m.tenantId})`,
          },
          { status: 400 }
        );
      }
    }

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'USER_UPDATE',
        entityType: 'USER',
        entityId: userId,
        details: `Updated user: ${name} (${email}); businesses: ${cleaned.map((c) => c.tenantId).join(', ')}; primary: ${primaryTid}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        timestamp: new Date(),
      },
    });

    const data = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone || null,
      roleId: primaryRow.roleId,
      tenantId: primaryTid,
      isActive: status === 'active',
      status,
      updatedAt: new Date(),
    };
    if (defaultBranchId !== undefined) data.defaultBranchId = defaultBranchId || null;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data,
      });

      await tx.tenantMembership.deleteMany({ where: { userId } });

      await tx.tenantMembership.createMany({
        data: cleaned.map((m) => ({
          userId,
          tenantId: m.tenantId,
          roleId: m.roleId,
          status: 'active',
        })),
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          tenants: { set: cleaned.map((m) => ({ id: m.tenantId })) },
        },
      });

      if (Array.isArray(allowedBranchIds)) {
        const userBranch = tx.userBranch;
        if (!userBranch || typeof userBranch.deleteMany !== 'function') {
          console.warn(
            '[admin/users/update] Prisma client missing userBranch delegate; skipping allowedBranchIds sync.'
          );
        } else {
          await userBranch.deleteMany({ where: { userId } });
          if (allowedBranchIds.length > 0) {
            const validBranchIds = await tx.branch.findMany({
              where: { id: { in: allowedBranchIds }, tenantId: primaryTid },
              select: { id: true },
            });
            const ids = validBranchIds.map((b) => b.id);
            if (ids.length > 0) {
              await userBranch.createMany({
                data: ids.map((branchId) => ({ userId, branchId })),
              });
            }
          }
        }
      }
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
      },
    });

    const transformedUser = {
      id: updatedUser.id,
      name: updatedUser.name || 'No Name',
      email: updatedUser.email,
      phone: updatedUser.phone || '',
      role: updatedUser.role?.name || 'No Role',
      roleId: updatedUser.role?.id,
      status: updatedUser.status === 'pending' ? 'pending' : updatedUser.isActive ? 'active' : 'inactive',
      tenant: updatedUser.tenant?.name || 'No Tenant',
      tenantId: updatedUser.tenant?.id,
      lastLogin: updatedUser.lastLogin,
      createdAt: updatedUser.createdAt,
      avatar: (updatedUser.name || 'U')
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase(),
    };

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      user: transformedUser,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update user: ' + error.message },
      { status: 500 }
    );
  }
}
