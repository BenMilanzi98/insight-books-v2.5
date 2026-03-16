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

    // Find the user by email (include tenant defaultBranchId and userBranches for session)
    const user = await prisma.user.findFirst({
      where: { email: body.email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        isActive: true,
        tenantId: true,
        defaultBranchId: true,
        role: true,
        userBranches: { select: { branchId: true } },
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            status: true,
            defaultBranchId: true,
            ownerUserId: true
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
    // If user has no password hash (e.g. created via OAuth only), treat as invalid credentials
    if (!user.password) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
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

    // Set default branch in session: owner gets all branches; added users get assigned or tenant default/first branch
    const isOwner = user.tenantId && user.tenant?.ownerUserId === user.id;
    let allowedIds = (user.userBranches ?? []).map((ub) => ub.branchId).filter(Boolean);
    if (!isOwner && allowedIds.length === 0 && user.tenantId) {
      const defaultBranchId = user.tenant?.defaultBranchId || null;
      const firstBranch = defaultBranchId
        ? null
        : await prisma.branch.findFirst({
            where: { tenantId: user.tenantId },
            orderBy: { createdAt: 'asc' },
            select: { id: true }
          });
      if (defaultBranchId) allowedIds = [defaultBranchId];
      else if (firstBranch) allowedIds = [firstBranch.id];
    }
    const preferredDefault = user.defaultBranchId ?? user.tenant?.defaultBranchId ?? null;
    const initialBranchId = isOwner
      ? preferredDefault
      : allowedIds.length > 0
        ? (preferredDefault && allowedIds.includes(preferredDefault) ? preferredDefault : allowedIds[0])
        : null;

    // Create session data
    const sessionData = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      branchId: initialBranchId
    };

    // In a real app, you'd encrypt and sign this data
    const session = Buffer.from(JSON.stringify(sessionData)).toString('base64');

    // Set session cookie (sameSite: lax so cookie is sent on same-origin API requests and top-level navigations)
    cookies().set({
      name: 'session',
      value: session,
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Log login activity (non-fatal if audit log table/schema is missing on older databases)
    try {
      await prisma.auditLog.create({
        data: {
          action: 'USER_LOGIN',
          entityType: 'USER',
          entityId: user.id,
          userId: user.id,
          tenantId: user.tenantId
        }
      });
    } catch (logError) {
      console.error('Login audit log failed (non-fatal):', logError?.message || logError);
    }

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