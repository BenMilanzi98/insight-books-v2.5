// app/api/roles/get/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';

// GET - Fetch a single role by ID with tenant isolation
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'roles.view');
    if (perm) return perm;

    // Get authenticated user and ensure tenant isolation
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('id');

    if (!roleId) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    // Fetch the role with user count, ensuring tenant isolation
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        tenantId: user.tenantId // Ensure tenant isolation
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true
          }
        },
        _count: {
          select: { users: true }
        }
      }
    });

    if (!role) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      );
    }

    // Format role for response
    const formattedRole = {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      users: role._count.users,
      assignedUsers: role.users,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    };

    return NextResponse.json(formattedRole);
  } catch (error) {
    console.error(`Error fetching role:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch role. Please try again.' },
      { status: 500 }
    );
  }
} 