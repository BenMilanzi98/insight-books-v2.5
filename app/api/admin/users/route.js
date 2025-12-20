import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import bcrypt from 'bcryptjs';

// GET /api/admin/users - Get all users with pagination and filtering
export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';
    const tenant = searchParams.get('tenant') || '';

    // Build where clause for filtering
    const where = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (role && role !== 'all') {
      where.role = { name: role };
    }
    
    if (status && status !== 'all') {
      if (status === 'active') {
        where.isActive = true;
      } else if (status === 'inactive') {
        where.isActive = false;
      } else if (status === 'pending') {
        where.status = 'pending';
      }
    }
    
    if (tenant && tenant !== 'all') {
      where.tenant = { name: { contains: tenant, mode: 'insensitive' } };
    }

    // Get total count for pagination
    const totalUsers = await prisma.user.count({ where });
    
    // Get users with pagination
    const users = await prisma.user.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true
          }
        },
        role: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });

    // Transform data for frontend
    const transformedUsers = users.map(user => ({
      id: user.id,
      name: user.name || 'No Name',
      email: user.email,
      phone: user.phone || '',
      role: user.role?.name || 'No Role',
      status: user.status === 'pending' ? 'pending' : (user.isActive ? 'active' : 'inactive'),
      tenant: user.tenant?.name || 'No Tenant',
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      avatar: (user.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase()
    }));

    return NextResponse.json({
      users: transformedUsers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        hasNextPage: page * limit < totalUsers,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/users - Create new user
export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, phone, role, status, tenantId, password } = body;

    // Validate required fields
    if (!name || !email || !role || !status || !tenantId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, role, status, and tenant are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Find tenant by ID
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Find the role by ID
    const userRole = await prisma.role.findUnique({
      where: { id: role }
    });

    if (!userRole) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      );
    }

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        roleId: userRole.id,
        isActive: status === 'active',
        status: status, // Keep the status field as well
        password: password ? await bcrypt.hash(password, 12) : await bcrypt.hash('temporary123', 12),
        tenantId: tenant?.id || null
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true
          }
        },
        role: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Transform response
    const transformedUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone || '',
      role: newUser.role?.name || 'No Role',
      status: newUser.status === 'pending' ? 'pending' : (newUser.isActive ? 'active' : 'inactive'),
      tenant: newUser.tenant?.name || 'No Tenant',
      lastLogin: newUser.lastLogin,
      createdAt: newUser.createdAt,
      avatar: (newUser.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase()
    };

    return NextResponse.json({
      message: 'User created successfully',
      user: transformedUser
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 