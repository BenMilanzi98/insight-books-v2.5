// app/api/auth/verify-otp/route.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { getSessionCookieOptions } from '@/lib/sessionCookie';
import {
  findUsersByEmailForAuth,
  pickUserForLogin,
  tenantsHintFromUserCandidates,
} from '@/lib/userEmailResolve';

// Ensure environment variables are loaded
import 'dotenv/config';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Basic validation
    if (!body.email || !body.otp) {
      return NextResponse.json(
        { error: 'Email and verification code are required' },
        { status: 400 }
      );
    }
    
    const email = String(body.email).trim();
    const hintTenantId =
      typeof body.tenantId === 'string' && body.tenantId.trim() ? body.tenantId.trim() : '';
    const hintSubdomain =
      typeof body.subdomain === 'string' && body.subdomain.trim() ? body.subdomain.trim() : '';

    const candidates = await findUsersByEmailForAuth(prisma, email);
    const user = await pickUserForLogin(prisma, candidates, {
      tenantId: hintTenantId || undefined,
      subdomain: hintSubdomain || undefined,
    });

    if (!user && candidates.length > 1) {
      return NextResponse.json(
        {
          error:
            'This email is used for more than one business. Open the verification link from the same browser session, or add your company subdomain.',
          code: 'MULTI_TENANT_EMAIL',
          tenants: tenantsHintFromUserCandidates(candidates),
        },
        { status: 409 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Check if email is already verified
    if (user.isEmailVerified) {
      return NextResponse.json(
        { error: 'Email is already verified', alreadyVerified: true },
        { status: 400 }
      );
    }
    
    // Check if OTP exists
    if (!user.otpCode || !user.otpExpiry) {
      return NextResponse.json(
        { error: 'Verification code not found or expired. Please request a new one.' },
        { status: 400 }
      );
    }
    
    // Check if OTP is expired
    if (new Date() > new Date(user.otpExpiry)) {
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new one.', expired: true },
        { status: 400 }
      );
    }
    
    // Check if OTP matches - normalize both values to strings and trim whitespace
    // This handles type mismatches (number vs string) and whitespace issues
    const storedOtp = String(user.otpCode || '').trim();
    const providedOtp = String(body.otp || '').trim();
    
    if (storedOtp !== providedOtp) {
      console.log('OTP mismatch:', { 
        storedOtp, 
        providedOtp, 
        storedType: typeof user.otpCode, 
        providedType: typeof body.otp 
      });
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }
    
    // Update user to mark email as verified and clear OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        otpCode: null,  // Clear the OTP
        otpExpiry: null // Clear the expiry
      }
    });
    
    // Log the verification
    await prisma.auditLog.create({
      data: {
        action: 'EMAIL_VERIFIED',
        entityType: 'USER',
        entityId: user.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          email: user.email
        }),
      }
    });
    
    // Choose a safe default branch so branch-scoped APIs behave consistently.
    // Tenants without branches => branchId stays null.
    let initialBranchId = null;
    try {
      const firstBranch = await prisma.branch.findFirst({
        where: { tenantId: user.tenantId, isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      });
      initialBranchId = firstBranch?.id || null;
    } catch (e) {
      console.error('OTP: failed to resolve default branch (non-fatal):', e?.message || e);
      initialBranchId = null;
    }

    // Create session data (minimal to keep cookie/header size small)
    const sessionData = {
      userId: user.id,
      tenantId: user.tenantId,
      branchId: initialBranchId,
      role: user.role ? user.role.name : null
    };
    
    // Set session cookie (Next.js 15: cookies() is async and must be awaited)
    const session = Buffer.from(JSON.stringify(sessionData)).toString('base64');
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'session',
      value: session,
      ...getSessionCookieOptions(),
    });
    
    // Return success with user info
    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
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
    console.error('OTP verification error:', error);
    return NextResponse.json(
      { error: 'An error occurred during verification' },
      { status: 500 }
    );
  }
}