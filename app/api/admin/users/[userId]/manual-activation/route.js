import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

export async function POST(request, { params }) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        tenantId: true,
        status: true,
        isActive: true,
        isEmailVerified: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const shouldActivateStatus = user.status === 'pending';
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isEmailVerified: true,
        otpCode: null,
        otpExpiry: null,
        ...(shouldActivateStatus
          ? {
              isActive: true,
              status: 'active',
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        isActive: true,
        isEmailVerified: true,
        otpCode: true,
        otpExpiry: true,
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'USER_MANUAL_ACTIVATION',
        entityType: 'USER',
        entityId: userId,
        details: `Manually activated email verification for ${user.name || user.email}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        timestamp: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User account manually activated',
      user: updatedUser,
    });
  } catch (error) {
    console.error('admin/users/[userId]/manual-activation POST:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to manually activate user' },
      { status: 500 }
    );
  }
}
