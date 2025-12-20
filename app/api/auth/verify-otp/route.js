// app/api/auth/verify-otp/route.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

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
    
    // Find the user by email
    const user = await prisma.user.findUnique({
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
    
    // Create session data
    const sessionData = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId
    };
    
    // Set session cookie
    const session = Buffer.from(JSON.stringify(sessionData)).toString('base64');
    cookies().set({
      name: 'session',
      value: session,
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
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