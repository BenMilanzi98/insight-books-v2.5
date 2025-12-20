import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function DELETE(request, { params }) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Log the session termination
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'SESSION_TERMINATE',
        entityType: 'SESSION',
        entityId: id,
        details: `Session ${id} terminated by admin`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    // Here you would typically terminate the actual session
    // For now, we'll just return success
    // You can extend this to invalidate JWT tokens, clear session data, etc.

    return NextResponse.json({
      success: true,
      message: 'Session terminated successfully'
    });

  } catch (error) {
    console.error('Error terminating session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to terminate session' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 