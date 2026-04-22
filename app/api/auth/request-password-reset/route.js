import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { sendPasswordResetLinkEmail } from '@/lib/emailService';
import { getPublicAppBaseUrlForEmail } from '@/lib/publicAppUrl';

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

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        tenant: {
          select: { id: true, name: true, subdomain: true }
        }
      }
    });

    if (!user) {
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
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry
      }
    });

    // Send password reset email
    try {
      const baseUrl = getPublicAppBaseUrlForEmail({
        forwardedProto: request.headers.get('x-forwarded-proto'),
        forwardedHost: request.headers.get('x-forwarded-host')
      });

      const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;
      
      // Send the actual password reset email
      await sendPasswordResetLinkEmail(user.email, resetLink, user.name || 'User');
      
      console.log(`Password reset email sent to ${user.email}`);
      
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      return NextResponse.json(
        { success: false, error: 'Failed to send password reset email' },
        { status: 500 }
      );
    }

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'PASSWORD_RESET_REQUEST',
        entityType: 'USER',
        entityId: user.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: `Password reset requested for user: ${user.email}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
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
  }
}
