import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    // Verify admin authentication
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 403 }
      );
    }

    if (!decoded.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges' },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active') || 'true';

    // Fetch roles from database (mock data for now)
    const roles = [
      {
        id: '1',
        name: 'Super Admin',
        description: 'Full system access and control',
        permissions: ['all'],
        isActive: true,
        userCount: 2,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-08-01')
      },
      {
        id: '2',
        name: 'Admin',
        description: 'Administrative access to assigned tenants',
        permissions: ['user_manage', 'tenant_manage', 'reports_view', 'settings_view'],
        isActive: true,
        userCount: 5,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-08-05')
      },
      {
        id: '3',
        name: 'Manager',
        description: 'Team management and reporting access',
        permissions: ['user_view', 'reports_view', 'basic_manage'],
        isActive: true,
        userCount: 12,
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-08-10')
      },
      {
        id: '4',
        name: 'User',
        description: 'Standard user access',
        permissions: ['basic_access', 'own_data_manage'],
        isActive: true,
        userCount: 45,
        createdAt: new Date('2024-03-01'),
        updatedAt: new Date('2024-08-15')
      },
      {
        id: '5',
        name: 'Guest',
        description: 'Limited read-only access',
        permissions: ['read_only'],
        isActive: false,
        userCount: 8,
        createdAt: new Date('2024-04-01'),
        updatedAt: new Date('2024-07-20')
      }
    ];

    // Filter roles based on active status if specified
    let filteredRoles = roles;
    if (active === 'true') {
      filteredRoles = roles.filter(role => role.isActive);
    } else if (active === 'false') {
      filteredRoles = roles.filter(role => !role.isActive);
    }

    return NextResponse.json({
      success: true,
      roles: filteredRoles,
      total: filteredRoles.length
    });

  } catch (error) {
    console.error('Admin roles fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch roles' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request) {
  try {
    // Verify admin authentication
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 403 }
      );
    }

    if (!decoded.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, permissions, isActive } = body;

    // Validate required fields
    if (!name || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json(
        { success: false, error: 'Name and permissions are required' },
        { status: 400 }
      );
    }

    // Create admin audit log for role creation
    await prisma.adminAuditLog.create({
      data: {
        adminId: decoded.adminId,
        action: 'ROLE_CREATE',
        entityType: 'ROLE',
        entityId: Date.now().toString(),
        details: `Created new role: ${name}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    // In a real implementation, you would save the role to the database
    const newRole = {
      id: Date.now().toString(),
      name,
      description: description || '',
      permissions,
      isActive: isActive !== undefined ? isActive : true,
      userCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return NextResponse.json({
      success: true,
      message: 'Role created successfully',
      role: newRole
    });

  } catch (error) {
    console.error('Admin role creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create role' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 