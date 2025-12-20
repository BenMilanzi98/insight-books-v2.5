import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { success: false, error: 'Token and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Find affiliate with this reset token
    const affiliate = await prisma.affiliate.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date() // Token not expired
        }
      }
    });

    if (!affiliate) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update affiliate with new password and clear reset token
    const updatedAffiliate = await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        updatedAt: new Date()
      }
    });

    // Create audit log entry
    await prisma.adminAuditLog.create({
      data: {
        action: 'AFFILIATE_PASSWORD_RESET',
        entityType: 'AFFILIATE',
        entityId: affiliate.id,
        details: JSON.stringify({
          affiliateName: affiliate.name,
          email: affiliate.email,
          action: 'Password reset via reset token'
        }),
        timestamp: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset password' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 