import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '7d';
    const action = searchParams.get('action') || 'all';
    const limit = parseInt(searchParams.get('limit')) || 100;

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (dateRange) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Build where clause
    let whereClause = {
      timestamp: {
        gte: startDate
      }
    };

    if (action !== 'all') {
      whereClause.action = action;
    }

    // Fetch audit logs
    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit
    });

    // Transform logs for frontend
    const transformedLogs = logs.map(log => ({
      id: log.id,
      action: log.action,
      user: log.user?.name || log.user?.email || 'Unknown User',
      userId: log.userId,
      details: log.details,
      ipAddress: log.ipAddress,
      timestamp: log.timestamp,
      status: log.status || 'Success',
      entityType: log.entityType,
      entityId: log.entityId
    }));

    return NextResponse.json({
      success: true,
      logs: transformedLogs,
      total: transformedLogs.length
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 