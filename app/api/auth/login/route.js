import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcrypt';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const body = await request.json();

    // Basic validation
    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find the user by email
    const user = await prisma.user.findFirst({
      where: { email: body.email },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            status: true
          }
        }
      }
    });

    // Check if user exists
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Compare password using bcrypt instead of direct comparison
    const passwordMatch = await bcrypt.compare(body.password, user.password);

    // Check if password matches
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user account is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Your account has been deactivated' },
        { status: 401 }
      );
    }

    // Check if tenant account is active (for tenant users)
    if (user.tenantId && user.tenant?.status !== 'active') {
      return NextResponse.json(
        { error: 'Your business account has been suspended' },
        { status: 401 }
      );
    }

    // Create session data
    const sessionData = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId
    };

    // In a real app, you'd encrypt and sign this data
    const session = Buffer.from(JSON.stringify(sessionData)).toString('base64');

    // Set session cookie
    cookies().set({
      name: 'session',
      value: session,
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Log login activity
    await prisma.auditLog.create({
      data: {
        action: 'USER_LOGIN',
        entityType: 'USER',
        entityId: user.id,
        userId: user.id,
        tenantId: user.tenantId
      }
    });

    // Return success with user info (excluding password)
    return NextResponse.json({
      success: true,
      token: session, // Provided for mobile app authentication
      user: {
        id: user.id,
        name: user.name,

        email: user.email,
        role: user.role,
        tenant: user.tenant ? {
          id: user.tenant.id,
          name: user.tenant.name,
          subdomain: user.tenant.subdomain
        } : null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}