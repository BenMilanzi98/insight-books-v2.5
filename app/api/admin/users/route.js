import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import bcrypt from 'bcryptjs';
import { generateSixCharAlphanumericPassword } from '@/lib/generateTemporaryPassword';
import { resolveHiddenPrimaryBranchId } from '@/lib/hiddenPrimaryBranch';

// GET /api/admin/users - Get all users with pagination and filtering
export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.users.view)) {
      return NextResponse.json({ error: 'Insufficient admin privileges' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';
    const tenant = searchParams.get('tenant') || '';

    // Build where clause for filtering
    const where = {
      // Soft-deleted users stay out of the default admin directory.
      NOT: { status: 'deleted' },
    };
    
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
      } else if (status === 'deleted') {
        // Explicitly request archived/deleted users
        delete where.NOT;
        where.status = 'deleted';
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
        },
        // Branch isolation is optional for legacy schemas.
        // Some DB/prisma client combos may not expose `userBranches` on `User`.
        // To prevent 500s, we omit it here and default `allowedBranchIds` to [].
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
      roleId: user.role?.id,
      status: user.status === 'pending' ? 'pending' : (user.isActive ? 'active' : 'inactive'),
      tenant: user.tenant?.name || 'No Tenant',
      tenantId: user.tenant?.id,
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

    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.users.create)) {
      return NextResponse.json({ error: 'Insufficient admin privileges' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      email,
      phone,
      role,
      status,
      tenantId,
      memberships,
      primaryTenantId,
      password,
      department,
    } = body;

    function normalizeMembershipsCreate(membershipsArr, legacyTenantId, legacyRoleId) {
      if (Array.isArray(membershipsArr) && membershipsArr.length > 0) {
        const byTenant = new Map();
        for (const m of membershipsArr) {
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

    const cleaned = normalizeMembershipsCreate(memberships, tenantId, role);

    if (!name || !email || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, and status are required' },
        { status: 400 }
      );
    }

    if (cleaned.length === 0) {
      return NextResponse.json(
        { error: 'At least one business with a role is required' },
        { status: 400 }
      );
    }

    const primaryTid =
      primaryTenantId && cleaned.some((x) => x.tenantId === primaryTenantId)
        ? primaryTenantId
        : cleaned[0].tenantId;
    const primaryRow = cleaned.find((x) => x.tenantId === primaryTid) || cleaned[0];

    const existingUser = await prisma.user.findFirst({
      where: {
        email: { equals: String(email).trim(), mode: 'insensitive' },
        tenantId: primaryTid,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists in that business' },
        { status: 409 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: primaryTid },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Primary tenant not found' }, { status: 404 });
    }

    const userRole = await prisma.role.findUnique({
      where: { id: primaryRow.roleId },
    });

    if (!userRole || userRole.tenantId !== primaryTid) {
      return NextResponse.json(
        { error: 'Primary role not found or does not belong to primary business' },
        { status: 404 }
      );
    }

    for (const m of cleaned) {
      const r = await prisma.role.findUnique({
        where: { id: m.roleId },
        select: { tenantId: true },
      });
      if (!r || r.tenantId !== m.tenantId) {
        return NextResponse.json(
          { error: `Role does not belong to the selected business` },
          { status: 400 }
        );
      }
    }

    const trimmedPassword =
      typeof password === 'string' && password.trim() ? password.trim() : '';
    const plainPassword = trimmedPassword || generateSixCharAlphanumericPassword();
    const primaryBranchId = await resolveHiddenPrimaryBranchId(tenant.id);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        department: department && String(department).trim() ? String(department).trim() : null,
        roleId: userRole.id,
        isActive: status === 'active',
        status: status, // Keep the status field as well
        password: await bcrypt.hash(plainPassword, 12),
        tenantId: tenant.id,
        isEmailVerified: true,
        otpCode: null,
        otpExpiry: null,
        ...(primaryBranchId ? { defaultBranchId: primaryBranchId } : {}),
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

    await prisma.tenantMembership.createMany({
      data: cleaned.map((m) => ({
        userId: newUser.id,
        tenantId: m.tenantId,
        roleId: m.roleId,
        status: 'active',
      })),
      skipDuplicates: true,
    });

    await prisma.user.update({
      where: { id: newUser.id },
      data: {
        tenants: { connect: cleaned.map((m) => ({ id: m.tenantId })) },
      },
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

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: transformedUser,
        ...(trimmedPassword ? {} : { temporaryPassword: plainPassword }),
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 