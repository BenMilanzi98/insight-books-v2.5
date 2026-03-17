import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcrypt';
import prisma from '@/lib/prisma';

/**
 * POST /api/auth/login
 * Handles tenant user login. 502 from this route is often infrastructure (timeout/OOM);
 * browser extension errors (e.g. AdBlock "indexOf") are unrelated - have users try incognito or disable extensions.
 */
export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.warn('Login: invalid request body', parseError?.message || parseError);
      return NextResponse.json(
        { error: 'Invalid request body. Please send JSON with email and password.' },
        { status: 400 }
      );
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = body.password != null ? String(body.password) : '';

    // Basic validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find the user by email. Use a minimal select that works on all DBs (no userBranches,
    // no defaultBranchId/ownerUserId) so development/legacy DBs that lack those fields don't 502.
    let user;
    try {
      user = await prisma.user.findFirst({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          password: true,
          isActive: true,
          tenantId: true,
          role: true,
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
    } catch (lookupErr) {
      console.error('Login user lookup failed (trying without role):', lookupErr?.message || lookupErr);
      try {
        user = await prisma.user.findFirst({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            isActive: true,
            tenantId: true,
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
        if (user) user.role = null;
      } catch (fallbackErr) {
        console.error('Login user lookup fallback failed:', fallbackErr?.message || fallbackErr);
        return NextResponse.json(
          { error: 'An error occurred during login' },
          { status: 500 }
        );
      }
    }

    // Do not query userBranches/defaultBranchId/ownerUserId here; development/legacy DBs may not have them.
    if (user) {
      user.defaultBranchId = null;
      user.userBranches = [];
    }

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
    let passwordMatch = false;
    try {
      passwordMatch = await bcrypt.compare(password, user.password);
    } catch (bcryptError) {
      console.warn('Login: bcrypt compare failed (invalid hash or input)', bcryptError?.message || bcryptError);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

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

    // Check if tenant account is active (only when tenant is loaded; avoid blocking when relation is missing)
    if (user.tenant && user.tenant.status !== 'active') {
      return NextResponse.json(
        { error: 'Your business account has been suspended' },
        { status: 401 }
      );
    }

    // Set default branch in session: owner gets all branches; added users get assigned or tenant default/first branch.
    // If legacy DB without branch separation fields, fall back to "no branch" (null) so login still works.
    let initialBranchId = null;
    try {
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
      initialBranchId = isOwner
        ? preferredDefault
        : allowedIds.length > 0
          ? (preferredDefault && allowedIds.includes(preferredDefault) ? preferredDefault : allowedIds[0])
          : null;
    } catch (branchError) {
      console.error('Login branch selection failed (non-fatal, defaulting branchId to null):', branchError?.message || branchError);
      initialBranchId = null;
    }

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
    // Next.js 15: cookies() is async and must be awaited
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'session',
      value: session,
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    // Update last login timestamp (non-fatal if column missing on older DB)
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });
    } catch (updateErr) {
      console.error('Login lastLogin update failed (non-fatal):', updateErr?.message || updateErr);
    }

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
    console.error('Login error:', error?.message || error);
    console.error('Login error stack:', error?.stack);
    return NextResponse.json(
      {
        error: 'An error occurred during login',
        ...(process.env.NODE_ENV !== 'production' && { detail: error?.message })
      },
      { status: 500 }
    );
  }
}