import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcrypt';
import prisma from '@/lib/prisma';
import { applyTenantMembershipRole, getDefaultPostLoginPath } from '@/lib/auth';
import { fetchUserBranchAccessContext, computeAllowedBranchIds } from '@/lib/branchAccess';
import { getSessionCookieOptions } from '@/lib/sessionCookie';
import { isPrismaConnectionError } from '@/lib/isPrismaConnectionError';
import {
  findUsersByEmailForAuth,
  pickUserForLogin,
  tenantsHintFromUserCandidates,
} from '@/lib/userEmailResolve';

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

    const hintTenantId =
      typeof body.tenantId === 'string' && body.tenantId.trim() ? body.tenantId.trim() : '';
    const hintSubdomain =
      typeof body.subdomain === 'string' && body.subdomain.trim() ? body.subdomain.trim() : '';

    let user;
    let candidates = [];
    try {
      candidates = await findUsersByEmailForAuth(prisma, email);
      user = await pickUserForLogin(prisma, candidates, {
        tenantId: hintTenantId || undefined,
        subdomain: hintSubdomain || undefined,
      });
    } catch (lookupErr) {
      console.error('Login user lookup failed:', lookupErr?.message || lookupErr);
      if (isPrismaConnectionError(lookupErr)) {
        return NextResponse.json(
          {
            error:
              'Database is temporarily unavailable. Check that the database server is running and DATABASE_URL is correct.',
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: 'An error occurred during login' }, { status: 500 });
    }

    if (!user && candidates.length > 1) {
      return NextResponse.json(
        {
          error:
            'This email is used for more than one business. Choose the business you want to access, then try again.',
          code: 'MULTI_TENANT_EMAIL',
          tenants: tenantsHintFromUserCandidates(candidates),
        },
        { status: 409 }
      );
    }

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

    // Block login for unverified email — user must complete OTP verification first
    if (!user.isEmailVerified) {
      return NextResponse.json(
        {
          error: 'Please verify your email before logging in. Check your inbox for the verification code.',
          requiresVerification: true,
          email: user.email,
        },
        { status: 403 }
      );
    }

    await applyTenantMembershipRole(user, user.tenantId);

    // Session branch: owners / single-location tenants may use tenant or user default; assigned users only their allowed set.
    let initialBranchId = null;
    try {
      const ctx = await fetchUserBranchAccessContext(user.id, user.tenantId);
      const { allowedBranchIds } = computeAllowedBranchIds({
        userId: user.id,
        tenantId: user.tenantId,
        roleName: user.role ? user.role.name : null,
        contextLoadFailed: ctx.contextLoadFailed,
        tenantBranchCount: ctx.tenantBranchCount,
        userBranches: ctx.userBranches,
        tenant: ctx.tenant,
      });
      const preferredDefault =
        ctx.defaultBranchId ?? ctx.tenant?.defaultBranchId ?? null;
      if (allowedBranchIds == null) {
        initialBranchId = preferredDefault ?? null;
      } else if (allowedBranchIds.length > 0) {
        initialBranchId =
          preferredDefault && allowedBranchIds.includes(preferredDefault)
            ? preferredDefault
            : allowedBranchIds[0];
      } else {
        initialBranchId = null;
      }
    } catch (branchError) {
      console.error('Login branch selection failed (non-fatal, defaulting branchId to null):', branchError?.message || branchError);
      initialBranchId = null;
    }

    // Create session data – keep payload small so cookie stays under header limits.
    // Middleware only needs role name string; all permissions are loaded in getUserFromSession.
    const sessionData = {
      userId: user.id,
      tenantId: user.tenantId,
      branchId: initialBranchId,
      role: user.role ? user.role.name : null
    };

    const session = Buffer.from(JSON.stringify(sessionData)).toString('base64');
    if (session.length > 4000) {
      console.warn('Login: session payload large, cookie may be rejected by browser');
    }

    // Set session cookie (sameSite: lax so cookie is sent on same-origin API requests and top-level navigations)
    // Next.js 15: cookies() is async and must be awaited
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'session',
      value: session,
      ...getSessionCookieOptions(),
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
      defaultPostLoginPath: getDefaultPostLoginPath(user),
      user: {
        id: user.id,
        name: user.name,

        email: user.email,
        isEmailVerified: user.isEmailVerified,
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
    if (isPrismaConnectionError(error)) {
      return NextResponse.json(
        {
          error:
            'Database is temporarily unavailable. Check that the database server is running and DATABASE_URL is correct.',
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        error: 'An error occurred during login',
        ...(process.env.NODE_ENV !== 'production' && { detail: error?.message })
      },
      { status: 500 }
    );
  }
}