import { NextResponse } from 'next/server';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import prisma from '@/lib/prisma';

/**
 * Tenant AuditLog list for admins.
 * Note: AuditLog uses `timestamp` (not createdAt).
 */
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
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);
    const action = searchParams.get('action') || '';

    const skip = (page - 1) * limit;
    const where = {};
    if (action) {
      where.action = action;
    }

    const [auditLogs, totalLogs] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        details: log.details,
        ipAddress: log.ipAddress,
        user: log.user
          ? { id: log.user.id, name: log.user.name, email: log.user.email }
          : null,
        timestamp: log.timestamp,
        createdAt: log.timestamp,
      })),
      pagination: {
        page,
        limit,
        total: totalLogs,
        pages: Math.ceil(totalLogs / limit) || 0,
      },
    });
  } catch (error) {
    console.error('Admin audit logs fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
