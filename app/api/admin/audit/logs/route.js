import { NextResponse } from 'next/server';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import prisma from '@/lib/prisma';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.audit.view)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '7d';
    const action = searchParams.get('action') || 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 500);

    const now = new Date();
    let startDate;
    switch (dateRange) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '7d':
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const whereClause = {
      timestamp: { gte: startDate },
    };
    if (action !== 'all') {
      whereClause.action = action;
    }

    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    const transformedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      user: log.user?.name || log.user?.email || 'Unknown User',
      userId: log.userId,
      details: log.details,
      ipAddress: log.ipAddress,
      timestamp: log.timestamp,
      status: log.status || 'Success',
      entityType: log.entityType,
      entityId: log.entityId,
    }));

    return NextResponse.json({
      success: true,
      logs: transformedLogs,
      total: transformedLogs.length,
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
