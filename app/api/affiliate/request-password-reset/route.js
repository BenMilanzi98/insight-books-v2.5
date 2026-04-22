import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { getPublicAppBaseUrlForEmail } from '@/lib/publicAppUrl';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find the affiliate
    const affiliate = await prisma.affiliate.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!affiliate) {
      // Don't reveal if email exists or not for security
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in database
    await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: {
        resetToken,
        resetTokenExpiry
      }
    });

    // Send password reset email
    try {
      const resetLink = `${getPublicAppBaseUrlForEmail({
        forwardedProto: request.headers.get('x-forwarded-proto'),
        forwardedHost: request.headers.get('x-forwarded-host')
      })}/affiliate/reset-password?token=${resetToken}`;
      
      // Here you would integrate with your email service
      // For now, we'll just log it
      console.log(`Password reset link for ${affiliate.email}: ${resetLink}`);
      
      // You can integrate with your existing email service like:
      // await sendPasswordResetEmail(affiliate.email, affiliate.name, resetLink);
      
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      return NextResponse.json(
        { success: false, error: 'Failed to send password reset email' },
        { status: 500 }
      );
    }

    // Create audit log entry
    await prisma.adminAuditLog.create({
      data: {
        action: 'AFFILIATE_PASSWORD_RESET_REQUESTED',
        entityType: 'AFFILIATE',
        entityId: affiliate.id,
        details: JSON.stringify({
          affiliateName: affiliate.name,
          email: affiliate.email,
          action: 'Password reset requested'
        }),
        timestamp: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });

  } catch (error) {
    console.error('Error requesting password reset:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process password reset request' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 