// app/api/users/get/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';

// GET - Fetch a single user by ID
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'users.view');
    if (perm) return perm;

    // Get authenticated user
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if user exists and belongs to the tenant
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: user.tenantId // Ensure tenant isolation
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        status: true,
        lastLogin: true,
        createdAt: true,
        isEmailVerified: true,
        defaultBranchId: true,
        userBranches: { select: { branchId: true } }
      }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { userBranches, ...rest } = targetUser;
    const allowedBranchIds = (userBranches ?? []).map((ub) => ub.branchId).filter(Boolean);

    let memberships = [];
    try {
      memberships = await prisma.tenantMembership.findMany({
        where: { userId: targetUser.id, status: 'active' },
        select: {
          tenantId: true,
          roleId: true,
          tenant: { select: { id: true, name: true } },
          role: { select: { id: true, name: true } },
        },
      });
    } catch (e) {
      // Backward compatible: membership table may not be deployed yet.
      memberships = [];
    }
    return NextResponse.json({
      ...rest,
      allowedBranchIds: allowedBranchIds.length > 0 ? allowedBranchIds : [],
      memberships
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user. Please try again.' },
      { status: 500 }
    );
  }
} 