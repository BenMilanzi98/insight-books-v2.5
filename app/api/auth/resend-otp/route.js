// app/api/auth/resend-otp/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendOTPEmail } from '@/lib/email';
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
    if (!body.email) {
      return NextResponse.json(
        { error: 'Email is required' },
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
            'This email is used for more than one business. Add your company subdomain (from your sign-up link) and try again.',
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
    
    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Update user with new OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: otp,
        otpExpiry: otpExpiry
      }
    });
    
    // Send OTP email
    let emailSent = false;
    let emailError = null;
    
    try {
      console.log(`Attempting to resend OTP email to: ${user.email}`);
      const emailResult = await sendOTPEmail(
        user.email,
        otp,
        user.name
      );
      
      if (emailResult.success) {
        emailSent = true;
        console.log('Resend OTP email sent successfully:', emailResult.messageId);
      } else {
        emailError = emailResult.error;
        console.error('Resend OTP email failed:', emailResult.error);
      }
    } catch (err) {
      console.error('Error sending resend OTP email:', err);
      emailError = err?.message || String(err);
    }
    
    if (!emailSent) {
      console.error('Failed to send resend OTP email:', emailError);
      return NextResponse.json(
        { error: `Failed to send verification email: ${emailError}` },
        { status: 500 }
      );
    }
    
    // Log the OTP resend
    await prisma.auditLog.create({
      data: {
        action: 'OTP_RESENT',
        entityType: 'USER',
        entityId: user.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          email: user.email
        }),
      }
    });
    
    return NextResponse.json({
      success: true,
      message: 'Verification code sent successfully'
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return NextResponse.json(
      { error: 'An error occurred while sending verification code' },
      { status: 500 }
    );
  }
}