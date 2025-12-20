import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const search = searchParams.get('search') || '';

    // Build where clause
    let whereClause = {};
    
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Fetch roles from database
    const roles = await prisma.role.findMany({
      where: whereClause,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true
          }
        },
        users: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Transform data for frontend
    const transformedRoles = roles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description || '',
      tenant: role.tenant ? {
        id: role.tenant.id,
        name: role.tenant.name,
        subdomain: role.tenant.subdomain
      } : null,
      userCount: role.users.length,
      permissions: role.permissions || {},
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    }));

    return NextResponse.json({
      success: true,
      roles: transformedRoles
    });

  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch roles' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, tenantId, permissions } = body;

    // Validate required fields
    if (!name || !tenantId) {
      return NextResponse.json(
        { success: false, error: 'Name and tenant are required' },
        { status: 400 }
      );
    }

    // Check if role already exists for this tenant
    const existingRole = await prisma.role.findFirst({
      where: {
        name: name,
        tenantId: tenantId
      }
    });

    if (existingRole) {
      return NextResponse.json(
        { success: false, error: 'A role with this name already exists in this tenant' },
        { status: 409 }
      );
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Create the role
    const newRole = await prisma.role.create({
      data: {
        name: name.trim(),
        description: description?.trim() || '',
        tenantId: tenantId,
        permissions: permissions || {}
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true
          }
        }
      }
    });

    // Create admin audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'ROLE_CREATE',
        entityType: 'ROLE',
        entityId: newRole.id,
        details: `Created new role: ${name} in tenant: ${tenant.name}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        timestamp: new Date()
      }
    });

    // Transform response
    const transformedRole = {
      id: newRole.id,
      name: newRole.name,
      description: newRole.description,
      tenant: {
        id: newRole.tenant.id,
        name: newRole.tenant.name,
        subdomain: newRole.tenant.subdomain
      },
      userCount: 0,
      permissions: newRole.permissions,
      createdAt: newRole.createdAt,
      updatedAt: newRole.updatedAt
    };

    return NextResponse.json({
      success: true,
      message: 'Role created successfully',
      role: transformedRole
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating role:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create role' },
      { status: 500 }
    );
  }
}
