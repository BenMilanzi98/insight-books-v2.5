import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/serverJwtSecret';
import bcrypt from 'bcryptjs';
import { generateSixCharAlphanumericPassword } from '@/lib/generateTemporaryPassword';

const prisma = new PrismaClient();

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
      decoded = jwt.verify(token, getJwtSecret());
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
    const { 
      name, 
      email, 
      role, 
      tenantId, 
      phone, 
      department, 
      isActive, 
      sendWelcomeEmail,
      password 
    } = body;

    // Validate required fields
    if (!name || !email || !role || !tenantId) {
      return NextResponse.json(
        { success: false, error: 'Name, email, role, and tenant are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate phone format (optional but if provided, should be valid)
    if (phone) {
      const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
      if (!phoneRegex.test(phone)) {
        return NextResponse.json(
          { success: false, error: 'Invalid phone number format' },
          { status: 400 }
        );
      }
    }

    // Check if user with this email already exists
    // In a real implementation, you would query the database
    const existingUser = null; // await prisma.user.findUnique({ where: { email } });
    
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Validate tenant exists
    // In a real implementation, you would query the database
    const tenant = null; // await prisma.tenant.findUnique({ where: { id: tenantId } });
    
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Invalid tenant ID' },
        { status: 400 }
      );
    }

    // Validate role exists
    // In a real implementation, you would query the database
    const roleExists = true; // await prisma.role.findUnique({ where: { id: role } });
    
    if (!roleExists) {
      return NextResponse.json(
        { success: false, error: 'Invalid role ID' },
        { status: 400 }
      );
    }

    const trimmedPwd =
      typeof password === 'string' && password.trim() ? password.trim() : '';
    const userPassword = trimmedPwd || generateSixCharAlphanumericPassword();

    // Hash password
    const hashedPassword = await bcrypt.hash(userPassword, 12);

    // Create user
    // In a real implementation, you would save to the database
    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      role,
      tenantId,
      phone: phone || '',
      department: department || '',
      isActive: isActive !== undefined ? isActive : true,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
      status: isActive !== undefined ? (isActive ? 'active' : 'inactive') : 'active'
    };

    // Create admin audit log for user creation
    await prisma.adminAuditLog.create({
      data: {
        adminId: decoded.adminId,
        action: 'USER_CREATE',
        entityType: 'USER',
        entityId: newUser.id,
        details: `Created new user: ${name} (${email}) with role: ${role}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    // Send welcome email if requested
    if (sendWelcomeEmail) {
      // In a real implementation, you would send an email
      console.log(`Welcome email would be sent to ${email}`);
    }

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = newUser;

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: userWithoutPassword,
      temporaryPassword: trimmedPwd ? undefined : userPassword
    });

  } catch (error) {
    console.error('Admin user creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create user' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}