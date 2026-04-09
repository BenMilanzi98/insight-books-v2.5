// app/api/auth/resend-otp/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendOTPEmail } from '@/lib/email';

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
    // Case-insensitive match (same as verify-otp); avoids misses when the client normalizes casing.
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
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
    } catch (emailError) {
      console.error('Error sending resend OTP email:', emailError);
      emailError = emailError.message;
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