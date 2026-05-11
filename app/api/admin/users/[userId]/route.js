import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

function buildMembershipList(user) {
  const map = new Map();
  for (const m of user.memberships || []) {
    const st = String(m.status || '').toLowerCase();
    if (st && st !== 'active') continue;
    map.set(m.tenantId, {
      tenantId: m.tenantId,
      tenantName: m.tenant?.name || '',
      roleId: m.roleId,
      roleName: m.role?.name || '',
    });
  }
  if (user.tenantId && user.roleId) {
    if (!map.has(user.tenantId)) {
      map.set(user.tenantId, {
        tenantId: user.tenantId,
        tenantName: user.tenant?.name || '',
        roleId: user.roleId,
        roleName: user.role?.name || '',
      });
    }
  }
  return [...map.values()];
}

/**
 * GET /api/admin/users/[userId] — full user + multi-tenant memberships (InsightBooks admin).
 */
export async function GET(request, { params }) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
        memberships: {
          where: { status: { equals: 'active', mode: 'insensitive' } },
          include: {
            tenant: { select: { id: true, name: true } },
            role: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    let allowedBranchIds = [];
    try {
      const ub = await prisma.userBranch.findMany({
        where: { userId },
        select: { branchId: true },
      });
      allowedBranchIds = ub.map((r) => r.branchId);
    } catch {
      allowedBranchIds = [];
    }

    const memberships = buildMembershipList(user);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name || '',
        email: user.email,
        phone: user.phone || '',
        status: user.status === 'pending' ? 'pending' : user.isActive ? 'active' : 'inactive',
        tenantId: user.tenantId,
        tenantName: user.tenant?.name || '',
        roleId: user.roleId,
        roleName: user.role?.name || '',
        primaryTenantId: user.tenantId,
        defaultBranchId: user.defaultBranchId || null,
        allowedBranchIds,
        isEmailVerified: Boolean(user.isEmailVerified),
        otpCode: user.otpCode || null,
        otpExpiry: user.otpExpiry || null,
        memberships,
      },
    });
  } catch (error) {
    console.error('admin/users/[userId] GET:', error);
    return NextResponse.json({ success: false, error: 'Failed to load user' }, { status: 500 });
  }
}
