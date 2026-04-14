import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/serverJwtSecret';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    // Verify admin authentication
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 403 }
      );
    }

    if (!decoded.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { tenantId } = body;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Get tenant details before deletion for audit log
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Create admin audit log before deletion
    await prisma.adminAuditLog.create({
      data: {
        adminId: decoded.adminId || decoded.id || 1,
        action: 'TENANT_DELETE',
        entityType: 'TENANT',
        entityId: tenantId,
        details: `Deleted tenant: ${tenant.name}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    // Delete related records first to avoid foreign key constraint issues
    try {
      // Delete account subscriptions
      await prisma.accountSubscription.deleteMany({
        where: { tenantId: tenantId }
      });

      // Delete tenant settings
      await prisma.tenantSettings.deleteMany({
        where: { tenantId: tenantId }
      });

      // Delete the tenant
      await prisma.tenant.delete({
        where: { id: tenantId }
      });
    } catch (deleteError) {
      console.error('Error during deletion:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete tenant due to database constraints. Please ensure all related data is removed first.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tenant deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting tenant:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete tenant' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 