import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function GET(request) {
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
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const type = searchParams.get('type') || 'all';

    // Build where clause
    const where = {};
    if (status !== 'all') {
      where.status = status;
    }
    if (type !== 'all') {
      where.type = type;
    }

    // Fetch updates from database (mock data for now)
    const updates = [
      {
        id: '1',
        title: 'Security Patch v1.2.1',
        description: 'Critical security vulnerability fix for authentication system',
        version: '1.2.1',
        type: 'security',
        status: 'installed',
        size: '2.3 MB',
        installedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        installedBy: 'System',
        duration: '5 minutes'
      },
      {
        id: '2',
        title: 'Performance Optimization v1.2.0',
        description: 'Database query optimization and memory management improvements',
        version: '1.2.0',
        type: 'feature',
        status: 'installed',
        size: '5.1 MB',
        installedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        installedBy: 'Admin',
        duration: '8 minutes'
      },
      {
        id: '3',
        title: 'Bug Fixes v1.1.9',
        description: 'Various bug fixes and stability improvements',
        version: '1.1.9',
        type: 'bugfix',
        status: 'installed',
        size: '3.7 MB',
        installedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
        installedBy: 'System',
        duration: '4 minutes'
      }
    ];

    // Filter updates based on query parameters
    let filteredUpdates = updates;
    if (status !== 'all') {
      filteredUpdates = filteredUpdates.filter(update => update.status === status);
    }
    if (type !== 'all') {
      filteredUpdates = filteredUpdates.filter(update => update.type === type);
    }

    return NextResponse.json({
      success: true,
      updates: filteredUpdates,
      total: filteredUpdates.length
    });

  } catch (error) {
    console.error('Admin updates fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch updates' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

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
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
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
    const { action, updateId } = body;

    switch (action) {
      case 'check':
        // Simulate checking for updates
        const availableUpdates = [
          {
            id: '4',
            title: 'Security Patch v1.2.2',
            description: 'Latest security updates and vulnerability fixes',
            version: '1.2.2',
            type: 'security',
            status: 'available',
            size: '2.8 MB',
            priority: 'high'
          },
          {
            id: '5',
            title: 'Feature Update v1.3.0',
            description: 'New admin dashboard features and UI improvements',
            version: '1.3.0',
            type: 'feature',
            status: 'available',
            size: '8.2 MB',
            priority: 'medium'
          }
        ];

        return NextResponse.json({
          success: true,
          availableUpdates,
          message: 'Update check completed'
        });

      case 'install':
        // Simulate installing an update
        if (!updateId) {
          return NextResponse.json(
            { success: false, error: 'Update ID is required' },
            { status: 400 }
          );
        }

        // Create admin audit log for update installation
        await prisma.adminAuditLog.create({
          data: {
            adminId: decoded.adminId,
            action: 'UPDATE_INSTALL',
            entityType: 'SYSTEM',
            entityId: updateId,
            details: `System update installation initiated`,
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown'
          }
        });

        return NextResponse.json({
          success: true,
          message: 'Update installation started successfully',
          updateId
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Admin updates action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process update action' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 