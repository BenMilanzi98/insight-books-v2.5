import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    console.log('Update user endpoint called');
    const body = await request.json();
    console.log('Request body:', body);
    const { userId, ...updateData } = body;
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const admin = await getAdminFromRequest(request);
    if (!admin) {
      console.log('Admin authentication failed');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('Admin authenticated:', admin.email);
    console.log('Attempting to update user with ID:', userId);

    const { name, email, phone, role, status, tenantId, defaultBranchId, allowedBranchIds } = updateData;

    // Validate required fields
    if (!name || !email || !role || !status || !tenantId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: name, email, role, status, and tenant are required' 
      }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      console.log('User not found:', userId);
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (email !== existingUser.email) {
      const emailConflict = await prisma.user.findFirst({
        where: {
          email: { equals: String(email).trim(), mode: 'insensitive' },
          tenantId,
          id: { not: userId },
        },
      });

      if (emailConflict) {
        console.log('Email conflict detected:', email);
        return NextResponse.json({
          success: false,
          error: 'A user with this email already exists in that business',
        }, { status: 400 });
      }
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      console.log('Tenant not found:', tenantId);
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    // Verify role exists
    const userRole = await prisma.role.findUnique({
      where: { id: role }
    });

    if (!userRole) {
      console.log('Role not found:', role);
      return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 });
    }

    console.log('User, tenant, and role found, proceeding with update');

    // Create admin audit log for user update
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'USER_UPDATE',
        entityType: 'USER',
        entityId: userId,
        details: `Updated user: ${name} (${email}) in tenant: ${tenant.name}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        timestamp: new Date()
      }
    });

    const data = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone || null,
      roleId: userRole.id,
      tenantId: tenant.id,
      isActive: status === 'active',
      status: status,
      updatedAt: new Date()
    };
    if (defaultBranchId !== undefined) data.defaultBranchId = defaultBranchId || null;

    if (Array.isArray(allowedBranchIds)) {
      const userBranch = prisma.userBranch;
      if (!userBranch || typeof userBranch.deleteMany !== 'function') {
        // Outdated generated client (schema has UserBranch but client was not regenerated).
        // Still apply core user fields; branch restrictions are skipped until `npx prisma generate` + restart.
        console.warn(
          '[admin/users/update] Prisma client missing userBranch delegate; skipping allowedBranchIds sync. Run: npx prisma generate && restart.'
        );
      } else {
        await userBranch.deleteMany({ where: { userId } });
        if (allowedBranchIds.length > 0) {
          const validBranchIds = await prisma.branch.findMany({
            where: { id: { in: allowedBranchIds }, tenantId: tenant.id },
            select: { id: true }
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

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
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

    console.log('User updated successfully:', userId);

    // Transform the response
    const transformedUser = {
      id: updatedUser.id,
      name: updatedUser.name || 'No Name',
      email: updatedUser.email,
      phone: updatedUser.phone || '',
      role: updatedUser.role?.name || 'No Role',
      status: updatedUser.status === 'pending' ? 'pending' : (updatedUser.isActive ? 'active' : 'inactive'),
      tenant: updatedUser.tenant?.name || 'No Tenant',
      lastLogin: updatedUser.lastLogin,
      createdAt: updatedUser.createdAt,
      avatar: (updatedUser.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase()
    };

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      user: transformedUser
    });

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to update user: ' + error.message 
    }, { status: 500 });
  }
}
